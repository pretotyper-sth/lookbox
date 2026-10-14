import json
import hashlib
import os
import sqlite3
import threading
import time
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen


PRICE_REV = "openai-standard-2026-10-14"
PRICES = {
    "gpt-image-1": {"text_in": 5, "image_in": 10, "out": 40, "text_cached": 1.25, "image_cached": 2.5},
    "gpt-image-2": {"text_in": 5, "image_in": 8, "out": 30, "text_cached": 5, "image_cached": 8},
    "gpt-image-2.5-flare": {"text_in": 5, "image_in": 8, "out": 30, "text_cached": 5, "image_cached": 8},
    "gpt-image-2.5-sunburst": {"text_in": 5, "image_in": 8, "out": 30, "text_cached": 5, "image_cached": 8},
    "gpt-4o": {"text_in": 2.5, "image_in": 2.5, "out": 10, "text_cached": 1.25, "image_cached": 1.25},
    "gpt-4o-mini": {"text_in": .15, "image_in": .15, "out": .6, "text_cached": .075, "image_cached": .075},
}


def usage_json(usage):
    if usage is None:
        return None
    if isinstance(usage, dict):
        return usage
    dump = getattr(usage, "model_dump", None)
    if callable(dump):
        return dump(mode="json")
    to_dict = getattr(type(usage), "to_dict", None)
    return to_dict(usage) if callable(to_dict) else None


def tokens_from_usage(usage):
    try:
        return _tokens_from_usage(usage)
    except (ValueError, TypeError, AttributeError):
        return None


def _tokens_from_usage(usage):
    if not isinstance(usage, dict):
        return None
    total = usage.get("input_tokens", usage.get("prompt_tokens"))
    output = usage.get("output_tokens", usage.get("completion_tokens"))
    if total is None or output is None:
        return None
    details = usage.get("input_tokens_details") or {}
    image = int(details.get("image_tokens") or 0)
    text = int(details.get("text_tokens") if details.get("text_tokens") is not None else int(total) - image)
    cached_details = details.get("cached_tokens_details") or {}
    cached = int(details.get("cached_tokens", (usage.get("prompt_tokens_details") or {}).get("cached_tokens", 0)) or 0)
    image_cached = int(cached_details.get("image_tokens") or 0)
    text_cached = int(cached_details.get("text_tokens", max(0, cached - image_cached)) or 0)
    if min(image, text, int(output), image_cached, text_cached) < 0 or image + text != int(total) or text_cached > text or image_cached > image:
        return None
    return {"text_in": text, "image_in": image, "out": int(output),
            "text_cached": text_cached, "image_cached": image_cached}


def estimate_cost(model, tokens):
    price = PRICES.get(model)
    if price is None or tokens is None:
        return None
    return round(((tokens["text_in"] - tokens.get("text_cached", 0)) * price["text_in"]
                  + (tokens["image_in"] - tokens.get("image_cached", 0)) * price["image_in"]
                  + tokens.get("text_cached", 0) * price["text_cached"]
                  + tokens.get("image_cached", 0) * price["image_cached"]
                  + tokens["out"] * price["out"]) / 1_000_000, 9)


class UsageLedger:
    def __init__(self, path, sink=None):
        self.path = Path(path)
        self.sink = sink
        self.lock = threading.Lock()
        self.sync_lock = threading.Lock()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self._db() as db:
            db.execute("CREATE TABLE IF NOT EXISTS ai_outbox (id TEXT PRIMARY KEY, payload TEXT NOT NULL, synced INTEGER NOT NULL DEFAULT 0)")
        os.chmod(self.path, 0o600)

    @contextmanager
    def _db(self):
        db = sqlite3.connect(self.path, timeout=15)
        try:
            db.execute("PRAGMA synchronous=FULL")
            with db:
                yield db
        finally:
            db.close()

    def save(self, row):
        with self.lock, self._db() as db:
            db.execute("INSERT INTO ai_outbox(id,payload,synced) VALUES(?,?,0) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,synced=0",
                       (row["id"], json.dumps(row, ensure_ascii=False)))
        self.flush()
        with self._db() as db:
            return bool(db.execute("SELECT synced FROM ai_outbox WHERE id=?", (row["id"],)).fetchone()[0])

    def flush(self):
        if not self.sink or not self.sync_lock.acquire(blocking=False):
            return
        try:
            with self._db() as db:
                pending = db.execute("SELECT id,payload FROM ai_outbox WHERE synced=0 ORDER BY rowid LIMIT 100").fetchall()
            for key, payload in pending:
                try:
                    self.sink(json.loads(payload))
                except Exception as exc:
                    print(f"[ai-usage] database sync pending id={key} error={type(exc).__name__}", flush=True)
                    break
                with self._db() as db:
                    db.execute("UPDATE ai_outbox SET synced=1 WHERE id=? AND payload=?", (key, payload))
        finally:
            self.sync_lock.release()

    def pending_count(self):
        with self._db() as db:
            return db.execute("SELECT count(*) FROM ai_outbox WHERE synced=0").fetchone()[0]


_ledger = None
_ledger_lock = threading.Lock()


def get_ledger():
    global _ledger
    with _ledger_lock:
        if _ledger is None:
            path = os.environ.get("AI_USAGE_OUTBOX_PATH") or str(Path(__file__).parents[1] / ".local" / "ai-usage.sqlite3")
            _ledger = UsageLedger(path)
        return _ledger


def configure_usage(sink):
    ledger = get_ledger()
    ledger.sink = sink
    ledger.flush()

    def sync():
        while True:
            time.sleep(30)
            ledger.flush()

    threading.Thread(target=sync, name="ai-usage-sync", daemon=True).start()


def configure_usage_from_env():
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        return

    def sink(row):
        request = Request(url + "/rest/v1/ai_usage_logs?on_conflict=id",
                          data=json.dumps(row).encode(), method="POST",
                          headers={"apikey": key, "Authorization": "Bearer " + key,
                                   "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates"})
        with urlopen(request, timeout=10):
            pass

    configure_usage(sink)


def call_ai(user_id, feature, call, *args, metadata=None, provider="openai", ledger=None, **kwargs):
    ledger = ledger or get_ledger()
    model = str(kwargs.get("model") or (metadata or {}).get("model") or "unknown")
    client = getattr(getattr(call, "__self__", None), "_client", None)
    api_key = getattr(client, "api_key", None)
    project = getattr(client, "project", None)
    meta = {**(metadata or {}), "event_type": "api_call", "provider": provider,
            "status": "started", "cost_status": "unknown", "cost_usd": None,
            "price_revision": PRICE_REV, "billing_basis": "public_standard_estimate"}
    meta["api_key_fingerprint"] = hashlib.sha256(api_key.encode()).hexdigest()[:16] if isinstance(api_key, str) else None
    meta["project_id"] = project if isinstance(project, str) else None
    meta["deploy_revision"] = os.environ.get("RENDER_GIT_COMMIT") or os.environ.get("GIT_COMMIT")
    for key in ("quality", "size", "n"):
        if key in kwargs:
            meta[key] = kwargs[key]
    row = {"id": str(uuid.uuid4()), "user_id": user_id, "feature": feature, "model": model,
           "created_at": datetime.now(timezone.utc).isoformat(), "metadata": meta}
    synced = ledger.save(row)
    if isinstance(ledger, UsageLedger) and ledger.sink is not None and not synced:
        meta.update(status="not_sent", cost_status="not_billed", cost_usd=0)
        ledger.save(row)
        raise RuntimeError("AI usage audit storage is unavailable; API request was not sent")
    started = time.monotonic()
    try:
        result = call(*args, **kwargs)
    except Exception as exc:
        meta.update(status="error", error_type=type(exc).__name__,
                    http_status=getattr(exc, "status_code", None), request_id=getattr(exc, "request_id", None))
        meta["duration_ms"] = round((time.monotonic() - started) * 1000)
        ledger.save(row)
        raise
    raw = usage_json(getattr(result, "usage", None) or getattr(result, "usage_metadata", None))
    tokens = tokens_from_usage(raw) if provider == "openai" else None
    if model.startswith("gpt-image-") and not (isinstance(raw, dict) and
            (raw.get("input_tokens_details") or {}).get("image_tokens") is not None):
        tokens = None
    cost = estimate_cost(model, tokens) if provider == "openai" else None
    meta.update(status="success", raw_usage=raw, tokens=tokens, cost_usd=cost,
                cost_status="estimated" if cost is not None else "unknown",
                request_id=getattr(result, "_request_id", None), response_id=getattr(result, "id", None),
                duration_ms=round((time.monotonic() - started) * 1000))
    if model in PRICES:
        meta["unit_prices_usd_per_million"] = PRICES[model]
    ledger.save(row)
    return result
