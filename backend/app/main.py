import base64
import hashlib
import html as html_lib
import io
import json
import os
import re
import tempfile
import time
import uuid
from collections import deque
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

import requests

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from openai import OpenAI
from PIL import Image
from pydantic import BaseModel
from supabase import Client, create_client

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_BUCKET = os.environ.get("SUPABASE_BUCKET", "wardrobe")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENAI_VISION_MODEL = os.environ.get("OPENAI_VISION_MODEL", "gpt-4o")
# 분류(이름·카테고리·색)만 더 싼 모델로 A/B. 추천 텍스트는 VISION 유지.
OPENAI_CLASSIFY_MODEL = os.environ.get("OPENAI_CLASSIFY_MODEL", "gpt-4o-mini")
OPENAI_IMAGE_MODEL = os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-1")
OPENAI_IMAGE_QUALITY = os.environ.get("OPENAI_IMAGE_QUALITY", "medium")
DEFAULT_IMAGE_CREDITS = int(os.environ.get("DEFAULT_IMAGE_CREDITS", "25"))
FRONTEND_ORIGINS = [
    origin.strip()
    for origin in os.environ.get(
        "FRONTEND_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,https://lookbox.vercel.app",
    ).split(",")
    if origin.strip()
]

if not SUPABASE_URL or not SUPABASE_ANON_KEY or not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError("Supabase environment variables are required")

supabase_user: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
supabase_admin: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
openai_client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

app = FastAPI(title="LOOKBOX API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    # The ported prototype reads error messages from `data.error`.
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})


CATEGORY_KO = {
    "top": "상의",
    "bottom": "하의",
    "outer": "아우터",
    "dress": "원피스",
    "shoes": "신발",
    "bag": "가방",
    "accessory": "액세서리",
}


class UserContext(BaseModel):
    id: str
    email: str | None = None


class WardrobeUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    color: str | None = None
    status: str | None = None
    note: str | None = None


class RecommendRequest(BaseModel):
    anchor_id: str | None = None
    style: str = "dandy"
    max_combos: int = 4
    make_images: bool = True


class OutfitAction(BaseModel):
    saved: bool | None = None
    worn: bool | None = None


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def require_supabase() -> None:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=500, detail="Supabase is not configured")


async def current_user(authorization: str | None = Header(default=None)) -> UserContext:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="login_required")
    token = authorization.split(" ", 1)[1]
    try:
        result = supabase_user.auth.get_user(token)
        user = result.user
    except Exception as exc:
        raise HTTPException(status_code=401, detail="invalid_session") from exc
    if not user:
        raise HTTPException(status_code=401, detail="invalid_session")
    upsert_profile(user.id, user.email)
    return UserContext(id=user.id, email=user.email)


def upsert_profile(user_id: str, email: str | None) -> None:
    supabase_admin.table("profiles").upsert(
        {"id": user_id, "email": email, "updated_at": now_iso()}
    ).execute()


def public_url(path: str) -> str:
    return supabase_admin.storage.from_(SUPABASE_BUCKET).get_public_url(path)


def upload_bytes(path: str, data: bytes, content_type: str) -> str:
    supabase_admin.storage.from_(SUPABASE_BUCKET).upload(
        path,
        data,
        file_options={"content-type": content_type, "upsert": "true"},
    )
    return public_url(path)


def read_image_as_png_bytes(path: str, max_side: int = 1024) -> bytes:
    image = Image.open(path).convert("RGBA")
    if max(image.size) > max_side:
        image.thumbnail((max_side, max_side))
    out = io.BytesIO()
    image.save(out, format="PNG")
    return out.getvalue()


def image_to_data_url(path: str) -> str:
    data = read_image_as_png_bytes(path)
    return "data:image/png;base64," + base64.b64encode(data).decode("ascii")


def credit_balance(user_id: str) -> int:
    rows = (
        supabase_admin.table("credit_ledger")
        .select("delta")
        .eq("user_id", user_id)
        .execute()
        .data
        or []
    )
    return DEFAULT_IMAGE_CREDITS + sum(int(row.get("delta") or 0) for row in rows)


def charge_credit(user_id: str, reason: str, metadata: dict[str, Any] | None = None) -> bool:
    if credit_balance(user_id) <= 0:
        return False
    supabase_admin.table("credit_ledger").insert(
        {"user_id": user_id, "delta": -1, "reason": reason, "metadata": metadata or {}}
    ).execute()
    return True


def log_ai_usage(user_id: str, feature: str, model: str, metadata: dict[str, Any]) -> None:
    supabase_admin.table("ai_usage_logs").insert(
        {"user_id": user_id, "feature": feature, "model": model, "metadata": metadata}
    ).execute()


def _record_extraction_timing(user_id: str | None, source: str, item_count: int, duration_ms: float) -> None:
    """추출(사진·URL) 소요시간 기록 — 개수별 평균 산출용. 실패해도 요청은 계속."""
    ms = int(duration_ms)
    try:
        supabase_admin.table("extraction_timings").insert(
            {"user_id": user_id, "source": source, "item_count": int(item_count), "duration_ms": ms}
        ).execute()
    except Exception as exc:  # noqa: BLE001
        print(f"[timing] record failed: {exc}", flush=True)
    print(f"[timing] source={source} items={item_count} duration_ms={ms} ({ms / 1000:.1f}s)", flush=True)


def classify_item(path: str) -> dict[str, Any]:
    fallback = {
        "name": "새로 추가한 옷",
        "category": "top",
        "color": "neutral",
        "tags": [],
    }
    if not openai_client:
        return fallback
    prompt = """이미지의 주요 패션 아이템 1개를 분석하세요. JSON만 응답하세요.
형식:
{
  "name": "한국어 이름",
  "category": "top|bottom|outer|dress|shoes|bag|accessory",
  "color": "대표 색상",
  "tags": ["키워드"]
}
"""
    try:
        response = openai_client.chat.completions.create(
            model=OPENAI_CLASSIFY_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": image_to_data_url(path)}},
                    ],
                }
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
        )
        data = json.loads(response.choices[0].message.content or "{}")
        if data.get("category") not in CATEGORY_KO:
            data["category"] = fallback["category"]
        return {**fallback, **data}
    except Exception:
        return fallback


# 스튜디오/순백 판으로 보이는 밝은 배경 → 투명 처리 (코디 합성 시 카드처럼 안 보이게)
_STUDIO_BG = (243, 243, 241)  # #F3F3F1 — 이전에 굽던 연회색도 제거 대상


def make_transparent_cutout(png_bytes: bytes) -> bytes:
    """가장자리에서 이어진 순백·연회색 배경을 투명으로 바꿔 옷만 남김."""
    img = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    w, h = img.size
    px = img.load()
    visited = [[False] * w for _ in range(h)]
    q: deque[tuple[int, int]] = deque()

    def is_plate(x: int, y: int) -> bool:
        r, g, b, a = px[x, y]
        if a < 12:
            return True
        # 순백에 가깝거나, 예전 스튜디오 그레이에 가까우면 배경으로 취급
        if r >= 248 and g >= 248 and b >= 248:
            return True
        return (
            abs(r - _STUDIO_BG[0]) <= 10
            and abs(g - _STUDIO_BG[1]) <= 10
            and abs(b - _STUDIO_BG[2]) <= 10
        )

    seeds = [
        (0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1),
        (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2),
    ]
    for x, y in seeds:
        if 0 <= x < w and 0 <= y < h and is_plate(x, y) and not visited[y][x]:
            visited[y][x] = True
            q.append((x, y))
    while q:
        x, y = q.popleft()
        r, g, b, _a = px[x, y]
        px[x, y] = (r, g, b, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not visited[ny][nx] and is_plate(nx, ny):
                visited[ny][nx] = True
                q.append((nx, ny))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def generate_product_image(user_id: str, path: str, meta: dict[str, Any]) -> bytes | None:
    if not openai_client or not charge_credit(user_id, "product_image", {"name": meta.get("name")}):
        return None
    prompt = f"""이 이미지에서 {meta.get('name') or '패션 아이템'} 하나만 추출해 깔끔한 제품 컷으로 만들어주세요.
- 배경은 완전히 투명하게 (배경 완전 제거)
- 사람, 마네킹, 그림자, 텍스트, 로고, 여분 소품 제거
- 아이템 전체가 잘리지 않게 중앙 배치
- 원본 색상과 재질은 유지
"""
    try:
        img_bytes = read_image_as_png_bytes(path)
        buf = io.BytesIO(img_bytes)
        buf.name = "source.png"
        result = openai_client.images.edit(
            model=OPENAI_IMAGE_MODEL,
            image=buf,
            prompt=prompt,
            size="1024x1536",
            quality=OPENAI_IMAGE_QUALITY,
            background="transparent",
        )
        log_ai_usage(user_id, "product_image", OPENAI_IMAGE_MODEL, {"quality": OPENAI_IMAGE_QUALITY})
        raw = base64.b64decode(result.data[0].b64_json)
        return make_transparent_cutout(raw)
    except Exception:
        try:
            # background=transparent 미지원 모델 폴백
            img_bytes = read_image_as_png_bytes(path)
            buf = io.BytesIO(img_bytes)
            buf.name = "source.png"
            result = openai_client.images.edit(
                model=OPENAI_IMAGE_MODEL,
                image=buf,
                prompt=prompt,
                size="1024x1536",
                quality=OPENAI_IMAGE_QUALITY,
            )
            log_ai_usage(user_id, "product_image", OPENAI_IMAGE_MODEL, {"quality": OPENAI_IMAGE_QUALITY})
            raw = base64.b64decode(result.data[0].b64_json)
            return make_transparent_cutout(raw)
        except Exception:
            return None


def item_payload(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row.get("name") or "옷",
        "category": CATEGORY_KO.get(row.get("category"), row.get("category") or "상의"),
        "categoryKey": row.get("category"),
        "color": row.get("color") or "neutral",
        "imageUrl": row.get("image_url"),
        "status": row.get("status"),
        "note": row.get("note") or "",
        "createdAt": row.get("created_at"),
    }


def outfit_payload(row: dict[str, Any], items: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "label": row.get("label") or "추천 코디",
        "mood": row.get("mood") or "",
        "type": row.get("type") or "daily",
        "lookImageUrl": row.get("look_image_url"),
        "saved": bool(row.get("saved")),
        "wornAt": row.get("worn_at"),
        "items": [item_payload(item) for item in items],
    }


def _style_tone(style: str) -> str:
    style_map = {
        "dandy": "댄디하고 깔끔한 톤",
        "minimal": "절제된 미니멀 톤",
        "casual": "편한 데일리 캐주얼 톤",
        "office": "출근하기 좋은 오피스 톤",
        "street": "자유로운 스트릿 톤",
        "chic": "모던하고 시크한 톤",
        "sporty": "활동적인 스포티 톤",
        "classic": "격식 있는 클래식 톤",
        "amekaji": "빈티지 아메카지 톤",
        "gorpcore": "기능적인 아웃도어 톤",
        "hiphop": "자유분방한 힙합 톤",
        "y2k": "과감한 Y2K 톤",
        "preppy": "단정한 프레피 톤",
    }
    return style_map.get(style) or f"{style} 무드"


def recommend_text(
    user_id: str,
    anchor: dict[str, Any] | None,
    items: list[dict[str, Any]],
    style: str,
    max_combos: int,
    exclude_item_ids: list[list[str]] | None = None,
    styles: list[str] | None = None,
) -> list[dict[str, Any]]:
    if not items:
        return []
    catalog = "\n".join(
        f"id={item['id']} | {item.get('category')} | {item.get('color')} | {item.get('name')}"
        for item in items
    )
    style_ids = [s for s in (styles or []) if s] or ([style] if style else ["dandy"])
    # 순서 유지하며 중복 제거
    seen_s: set[str] = set()
    uniq_styles: list[str] = []
    for s in style_ids:
        if s in seen_s:
            continue
        seen_s.add(s)
        uniq_styles.append(s)
    tones = [_style_tone(s) for s in uniq_styles]
    tone = " · ".join(tones)
    style_id_note = ", ".join(uniq_styles)
    exclude_keys = {
        tuple(sorted(str(x) for x in ids if x))
        for ids in (exclude_item_ids or [])
        if ids
    }
    exclude_note = ""
    if exclude_keys:
        lines = [", ".join(k) for k in list(exclude_keys)[:20]]
        exclude_note = "\n이미 보여준 조합(제외):\n" + "\n".join(f"- {ln}" for ln in lines) + "\n"
    if not openai_client:
        return fallback_combos(items, anchor, max_combos, tone, exclude_keys, uniq_styles)
    prompt = f"""사용자의 옷장 목록만 사용해 실제로 어울리는 코디를 최대 {max_combos}개 추천하세요.
사용자가 마이페이지에서 설정한 선호 무드 id: {style_id_note}
선호 무드 설명: {tone}
{('기준 아이템 id=' + anchor['id']) if anchor else '기준 아이템 없음'}

옷장:
{catalog}
{exclude_note}
규칙:
- item_ids에는 위 목록에 있는 id만 넣기
- 한 코디에는 상의/하의/신발 중심으로 2~4개 구성
- 기준 아이템이 있으면 반드시 포함
- 서로 다른 아이템 조합만. 같은 옷 세트를 반복한 코디는 금지
- 이미 보여준 조합은 절대 다시 쓰지 말 것
- 만들 수 있는 고유 조합이 max보다 적으면 적은 수만큼만 반환 (억지로 채우지 말 것)
- 각 코디는 선호 무드 중 1~2개에만 맞춰 만들고, styles에 그 무드 id만 넣기 (전체 선호 무드를 한 코디에 몰아넣지 말 것)
- 여러 코디가 있으면 선호 무드를 가능한 한 나눠 배정
- mood에는 그 코디의 짧은 분위기 문구(한국어)
- JSON만 응답

형식:
{{"combos":[{{"label":"", "mood":"", "styles":["minimal"], "item_ids":["..."]}}]}}
"""
    try:
        response = openai_client.chat.completions.create(
            model=OPENAI_VISION_MODEL,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.45,
        )
        data = json.loads(response.choices[0].message.content or "{}")
        valid = {item["id"] for item in items}
        allowed_styles = set(uniq_styles)
        combos = []
        seen: set[tuple[str, ...]] = set(exclude_keys)
        for combo in data.get("combos") or []:
            ids = [item_id for item_id in combo.get("item_ids", []) if item_id in valid]
            if anchor and anchor["id"] not in ids:
                ids = [anchor["id"], *ids]
            ids = ids[:4]
            if len(ids) < 2:
                continue
            key = tuple(sorted(ids))
            if key in seen:
                continue
            seen.add(key)
            combo_styles = [s for s in (combo.get("styles") or []) if s in allowed_styles][:2]
            if not combo_styles:
                combo_styles = [uniq_styles[len(combos) % len(uniq_styles)]]
            combos.append(
                {
                    "label": combo.get("label") or "추천 코디",
                    "mood": combo.get("mood") or _style_tone(combo_styles[0]),
                    "styles": combo_styles,
                    "item_ids": ids,
                }
            )
            if len(combos) >= max_combos:
                break
        log_ai_usage(user_id, "recommend_text", OPENAI_VISION_MODEL, {"count": len(combos)})
        return combos or fallback_combos(items, anchor, max_combos, tone, exclude_keys, uniq_styles)
    except Exception:
        return fallback_combos(items, anchor, max_combos, tone, exclude_keys, uniq_styles)


def _item_bucket(item: dict[str, Any]) -> str:
    cat = (item.get("category") or "").lower()
    if cat in ("top", "상의", "outer", "아우터"):
        return "top"
    if cat in ("bottom", "하의"):
        return "bottom"
    if cat in ("dress", "원피스"):
        return "dress"
    if cat in ("shoes", "신발"):
        return "shoes"
    return "other"


def fallback_combos(
    items: list[dict[str, Any]],
    anchor: dict[str, Any] | None,
    max_combos: int,
    mood: str = "내 옷장 기반 추천",
    exclude_keys: set[tuple[str, ...]] | None = None,
    styles: list[str] | None = None,
) -> list[dict[str, Any]]:
    """상의×하의 고유 페어만 만든다. 부족하면 억지로 복제하지 않는다."""
    tops = [i for i in items if _item_bucket(i) in ("top", "dress")]
    bottoms = [i for i in items if _item_bucket(i) in ("bottom", "dress")]
    shoes = [i for i in items if _item_bucket(i) == "shoes"]
    combos: list[dict[str, Any]] = []
    seen: set[tuple[str, ...]] = set(exclude_keys or ())
    style_cycle = [s for s in (styles or []) if s] or []

    def _push(ids: list[str], label: str) -> None:
        if len(ids) < 2:
            return
        if anchor and anchor["id"] not in ids:
            ids = [anchor["id"], *[x for x in ids if x != anchor["id"]]]
        key = tuple(sorted(ids[:4]))
        if key in seen:
            return
        seen.add(key)
        assigned = [style_cycle[len(combos) % len(style_cycle)]] if style_cycle else []
        combos.append({
            "label": label,
            "mood": (_style_tone(assigned[0]) if assigned else mood),
            "styles": assigned,
            "item_ids": ids[:4],
        })

    n = 0
    for t in tops:
        for b in bottoms:
            if t["id"] == b["id"]:
                continue
            ids = [t["id"], b["id"]]
            if shoes:
                ids.append(shoes[n % len(shoes)]["id"])
                n += 1
            _push(ids, f"추천 코디 {len(combos) + 1}")
            if len(combos) >= max_combos:
                return combos

    # 페어가 거의 없으면 인접 아이템으로 최소 조합만
    if not combos and len(items) >= 2:
        ids = [items[0]["id"], items[1]["id"]]
        _push(ids, "데일리 조합")
        if len(combos) >= max_combos:
            return combos

    return combos


def look_cache_key(item_ids: list[str]) -> str:
    return hashlib.sha256(",".join(sorted(item_ids)).encode()).hexdigest()[:20]


def generate_look_image(user_id: str, combo: dict[str, Any], items: list[dict[str, Any]]) -> str | None:
    key = look_cache_key(combo["item_ids"])
    cached = (
        supabase_admin.table("generated_images")
        .select("*")
        .eq("user_id", user_id)
        .eq("cache_key", key)
        .limit(1)
        .execute()
        .data
        or []
    )
    if cached:
        return cached[0].get("image_url")
    if not openai_client or not charge_credit(user_id, "look_image", {"cache_key": key}):
        return None
    board = Image.new("RGB", (1024, 1024), (244, 237, 232))
    slots = [(64, 64, 448, 448), (576, 64, 960, 448), (64, 576, 448, 960), (576, 576, 960, 960)]
    for idx, item in enumerate(items[:4]):
        try:
            raw = supabase_admin.storage.from_(SUPABASE_BUCKET).download(item["storage_path"])
            image = Image.open(io.BytesIO(raw)).convert("RGBA")
            image.thumbnail((340, 340))
            x1, y1, x2, y2 = slots[idx]
            x = x1 + ((x2 - x1) - image.width) // 2
            y = y1 + ((y2 - y1) - image.height) // 2
            board.paste(image, (x, y), image)
        except Exception:
            continue
    source = io.BytesIO()
    board.save(source, format="PNG")
    source.seek(0)
    source.name = "look-reference.png"
    prompt = """참고 이미지의 의류만 사용해 하나의 깔끔한 패션 플랫레이 코디 이미지를 만드세요.
- 배경은 #EFEDE8 단색
- 사람, 텍스트, 라벨, 카드 프레임, 장식 추가 금지
- 각 옷은 잘리지 않게 자연스럽게 배치
- 쇼핑몰 스타일의 깔끔한 제품 플랫레이
"""
    try:
        result = openai_client.images.edit(
            model=OPENAI_IMAGE_MODEL,
            image=source,
            prompt=prompt,
            size="1024x1536",
            quality=OPENAI_IMAGE_QUALITY,
        )
        out = base64.b64decode(result.data[0].b64_json)
        storage_path = f"{user_id}/looks/{key}.png"
        image_url = upload_bytes(storage_path, out, "image/png")
        supabase_admin.table("generated_images").insert(
            {"user_id": user_id, "cache_key": key, "kind": "look", "storage_path": storage_path, "image_url": image_url}
        ).execute()
        log_ai_usage(user_id, "look_image", OPENAI_IMAGE_MODEL, {"quality": OPENAI_IMAGE_QUALITY})
        return image_url
    except Exception:
        return None


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "openai": bool(openai_client),
        "supabase": bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY),
    }


@app.get("/me")
def me(user: UserContext = Depends(current_user)) -> dict[str, Any]:
    return {"user": user.model_dump(), "credits": credit_balance(user.id)}


@app.get("/usage/credits")
def credits(user: UserContext = Depends(current_user)) -> dict[str, Any]:
    return {"remaining": credit_balance(user.id), "included": DEFAULT_IMAGE_CREDITS}


@app.get("/wardrobe")
def list_wardrobe(user: UserContext = Depends(current_user)) -> dict[str, Any]:
    rows = (
        supabase_admin.table("wardrobe_items")
        .select("*")
        .eq("user_id", user.id)
        .neq("status", "deleted")
        .order("created_at", desc=True)
        .execute()
        .data
        or []
    )
    return {"items": [item_payload(row) for row in rows]}


@app.post("/wardrobe/upload")
async def upload_item(
    status: str = "owned",
    file: UploadFile = File(...),
    user: UserContext = Depends(current_user),
) -> dict[str, Any]:
    require_supabase()
    suffix = os.path.splitext(file.filename or "image.jpg")[1] or ".jpg"
    content_type = file.content_type or "image/jpeg"
    raw = await file.read()
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(raw)
        tmp_path = tmp.name
    try:
        meta = classify_item(tmp_path)
        original_path = f"{user.id}/original/{uuid.uuid4().hex}{suffix}"
        original_url = upload_bytes(original_path, raw, content_type)
        product_bytes = generate_product_image(user.id, tmp_path, meta)
        image_path = original_path
        image_url = original_url
        if product_bytes:
            image_path = f"{user.id}/items/{uuid.uuid4().hex}.png"
            image_url = upload_bytes(image_path, product_bytes, "image/png")
        row = (
            supabase_admin.table("wardrobe_items")
            .insert(
                {
                    "user_id": user.id,
                    "name": meta.get("name") or "새 옷",
                    "category": meta.get("category") or "top",
                    "color": meta.get("color") or "neutral",
                    "image_url": image_url,
                    "storage_path": image_path,
                    "source": "upload",
                    "status": status if status in {"owned", "considering"} else "owned",
                    "metadata": {"tags": meta.get("tags") or []},
                }
            )
            .execute()
            .data[0]
        )
        return {"item": item_payload(row), "credits": credit_balance(user.id)}
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass


@app.patch("/wardrobe/{item_id}")
def update_item(item_id: str, body: WardrobeUpdate, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    if not patch:
        return {"ok": True}
    row = (
        supabase_admin.table("wardrobe_items")
        .update(patch)
        .eq("id", item_id)
        .eq("user_id", user.id)
        .execute()
        .data
    )
    return {"item": item_payload(row[0]) if row else None}


@app.delete("/wardrobe/{item_id}")
def delete_item(item_id: str, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    supabase_admin.table("wardrobe_items").update({"status": "deleted"}).eq("id", item_id).eq("user_id", user.id).execute()
    return {"ok": True}


@app.post("/recommend/daily")
def recommend_daily(body: RecommendRequest, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    return create_recommendations(user, None, body, "daily")


@app.post("/recommend/purchase-check")
def recommend_purchase(body: RecommendRequest, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    if not body.anchor_id:
        raise HTTPException(status_code=400, detail="anchor_id_required")
    anchor_rows = (
        supabase_admin.table("wardrobe_items")
        .select("*")
        .eq("id", body.anchor_id)
        .eq("user_id", user.id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not anchor_rows:
        raise HTTPException(status_code=404, detail="anchor_not_found")
    return create_recommendations(user, anchor_rows[0], body, "purchase")


def create_recommendations(user: UserContext, anchor: dict[str, Any] | None, body: RecommendRequest, rec_type: str) -> dict[str, Any]:
    rows = (
        supabase_admin.table("wardrobe_items")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "owned")
        .order("created_at", desc=True)
        .execute()
        .data
        or []
    )
    pool = rows[:]
    if anchor:
        pool = [anchor, *pool]
    if len(pool) < 2:
        raise HTTPException(status_code=400, detail="not_enough_items")
    combos = recommend_text(user.id, anchor, pool, body.style, min(max(body.max_combos, 1), 10))
    outfits = []
    by_id = {item["id"]: item for item in pool}
    for combo in combos:
        combo_items = [by_id[item_id] for item_id in combo["item_ids"] if item_id in by_id]
        look_url = generate_look_image(user.id, combo, combo_items) if body.make_images else None
        row = (
            supabase_admin.table("outfits")
            .insert(
                {
                    "user_id": user.id,
                    "label": combo["label"],
                    "mood": combo["mood"],
                    "type": rec_type,
                    "item_ids": combo["item_ids"],
                    "look_image_url": look_url,
                    "metadata": {"style": body.style},
                }
            )
            .execute()
            .data[0]
        )
        outfits.append(outfit_payload(row, combo_items))
    return {"outfits": outfits, "credits": credit_balance(user.id)}


@app.get("/outfits")
def list_outfits(user: UserContext = Depends(current_user)) -> dict[str, Any]:
    rows = (
        supabase_admin.table("outfits")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", desc=True)
        .limit(50)
        .execute()
        .data
        or []
    )
    item_ids = sorted({item_id for row in rows for item_id in (row.get("item_ids") or [])})
    items = []
    if item_ids:
        items = (
            supabase_admin.table("wardrobe_items")
            .select("*")
            .eq("user_id", user.id)
            .in_("id", item_ids)
            .execute()
            .data
            or []
        )
    by_id = {item["id"]: item for item in items}
    return {"outfits": [outfit_payload(row, [by_id[i] for i in row.get("item_ids", []) if i in by_id]) for row in rows]}


@app.post("/outfits/{outfit_id}/save")
def save_outfit(outfit_id: str, body: OutfitAction, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    patch: dict[str, Any] = {}
    if body.saved is not None:
        patch["saved"] = body.saved
    if body.worn is not None:
        patch["worn_at"] = now_iso() if body.worn else None
    if not patch:
        return {"ok": True}
    supabase_admin.table("outfits").update(patch).eq("id", outfit_id).eq("user_id", user.id).execute()
    return {"ok": True}


# ---------------------------------------------------------------------------
# /api/live/* — compatibility layer for the ported prototype UI.
# The prototype expects garment items shaped as { id, serverId, name,
# category(KO), color, img } and outfits as { id, label, mood, itemIds, lookImg }.
# Look images are composed client-side by <LookComposite>, so we skip paid image
# generation here and return lookImg=null to keep the daily flow free.
# ---------------------------------------------------------------------------

LIVE_STATUS_MAP = {"owned": "owned", "considering": "considering", "archived": "archived", "delete": "deleted", "deleted": "deleted"}


class LiveImportUrl(BaseModel):
    url: str
    status: str = "owned"


class LiveCoordinate(BaseModel):
    max_combos: int = 4
    style: str = "dandy"
    # 마이페이지 선호 무드(복수 가능). 있으면 style보다 우선해 톤에 반영
    styles: list[str] = []
    anchor_id: str | None = None
    # 이미 보여준 조합(item id 목록) — 더 추천 시 중복 방지
    exclude_item_ids: list[list[str]] = []


class LiveStatus(BaseModel):
    ids: list[str] = []
    status: str = "owned"


def live_item_payload(row: dict[str, Any]) -> dict[str, Any]:
    meta = row.get("metadata") or {}
    return {
        "id": row["id"],
        "serverId": row["id"],
        "name": row.get("name") or "옷",
        "category": CATEGORY_KO.get(row.get("category"), row.get("category") or "상의"),
        "color": row.get("color") or "",
        "img": row.get("image_url"),
        "status": row.get("status"),
        "brand": meta.get("brand") or "",
        "size": meta.get("size") or "",
        "store": meta.get("store") or "",
        "note": row.get("note") or meta.get("note") or "",
        "sourceUrl": meta.get("source_url") or "",
    }


class LiveItemUpdate(BaseModel):
    name: str | None = None
    color: str | None = None
    brand: str | None = None
    size: str | None = None
    store: str | None = None
    note: str | None = None


def _store_uploaded_item(
    user_id: str,
    raw: bytes,
    suffix: str,
    content_type: str,
    status: str,
    *,
    source: str = "upload",
    name_override: str | None = None,
    source_url: str | None = None,
    brand: str | None = None,
    store: str | None = None,
    color_override: str | None = None,
) -> dict[str, Any]:
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(raw)
        tmp_path = tmp.name
    try:
        meta = classify_item(tmp_path)
        original_path = f"{user_id}/original/{uuid.uuid4().hex}{suffix}"
        original_url = upload_bytes(original_path, raw, content_type)
        product_bytes = generate_product_image(user_id, tmp_path, meta)
        image_path, image_url = original_path, original_url
        if product_bytes:
            image_path = f"{user_id}/items/{uuid.uuid4().hex}.png"
            image_url = upload_bytes(image_path, product_bytes, "image/png")
        # brand/store/source_url은 스키마 변경 없이 metadata(jsonb)에 저장.
        item_metadata: dict[str, Any] = {"tags": meta.get("tags") or []}
        if (brand or "").strip():
            item_metadata["brand"] = brand.strip()
        if (store or "").strip():
            item_metadata["store"] = store.strip()
        if (source_url or "").strip():
            item_metadata["source_url"] = source_url.strip()
        row = (
            supabase_admin.table("wardrobe_items")
            .insert(
                {
                    "user_id": user_id,
                    "name": (name_override or "").strip() or meta.get("name") or "새 옷",
                    "category": meta.get("category") or "top",
                    "color": (color_override or "").strip() or meta.get("color") or "neutral",
                    "image_url": image_url,
                    "storage_path": image_path,
                    "source": source,
                    "status": LIVE_STATUS_MAP.get(status, "owned"),
                    "metadata": item_metadata,
                }
            )
            .execute()
            .data[0]
        )
        return row
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass


# 플랫폼 도메인 → 구매처명. 순서대로 매칭 (더 구체적인 것 먼저).
STORE_DOMAINS = [
    ("musinsa.com", "무신사"),
    ("zigzag.kr", "지그재그"),
    ("29cm.co.kr", "29CM"),
    ("a-bly.com", "에이블리"),
    ("ably.co.kr", "에이블리"),
    ("wconcept.co.kr", "W컨셉"),
    ("kream.co.kr", "KREAM"),
    ("brandi.co.kr", "브랜디"),
    ("ssg.com", "SSG닷컴"),
    ("sivillage.com", "SI빌리지"),
    ("thehyundai.com", "더현대닷컴"),
    ("lookpin.co.kr", "룩핀"),
    ("hiver.co.kr", "하이버"),
    ("oco.kr", "OCO"),
    ("4910.kr", "포켓"),
    ("trenbe.com", "트렌비"),
    ("balaan.co.kr", "발란"),
    ("balaan.com", "발란"),
    ("mustit.co.kr", "머스트잇"),
    ("smartstore.naver.com", "네이버 스마트스토어"),
    ("brand.naver.com", "네이버 브랜드스토어"),
    ("shopping.naver.com", "네이버쇼핑"),
    ("coupang.com", "쿠팡"),
]


def _host_of(page_url: str) -> str:
    host = (urlparse(page_url).hostname or "").lower()
    if host.startswith("www."):
        host = host[4:]
    if host.startswith("m."):
        host = host[2:]
    return host


def _meta_content(html: str, key: str, attr: str = "property") -> str:
    m = re.search(
        rf'<meta[^>]+{attr}=["\']{re.escape(key)}["\'][^>]+content=["\']([^"\']+)["\']',
        html,
        re.I,
    )
    if not m:
        m = re.search(
            rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]+{attr}=["\']{re.escape(key)}["\']',
            html,
            re.I,
        )
    return m.group(1).strip() if m and m.group(1).strip() else ""


def _clean_brand(val: str) -> str:
    return (val or "").strip().strip("|·-–—").strip()[:40]


# 상품명 끝의 '_블루' / '_삭스' 같은 색상 꼬리표 판별용.
COLOR_WORDS = (
    "블랙", "화이트", "오프화이트", "그레이", "라이트그레이", "다크그레이", "그레이지",
    "차콜", "차콜그레이", "네이비", "다크네이비", "블루", "딥블루", "스카이블루",
    "라이트블루", "소라", "삭스", "색스", "베이지", "샌드", "브라운", "카멜", "모카",
    "탄", "카키", "올리브", "세이지", "세이지그린", "그린", "민트", "틸", "터콰이즈",
    "아이보리", "크림", "에크루", "오트밀", "레드", "와인", "버건디", "마룬",
    "핑크", "라이트핑크", "핫핑크", "더스티핑크", "로즈", "코랄", "오렌지",
    "옐로우", "머스타드", "퍼플", "라벤더", "라일락", "코발트",
    "연청", "중청", "진청", "흑청", "데님", "인디고", "멜란지", "카멜색",
    "실버", "골드", "멀티",
    "black", "white", "offwhite", "gray", "grey", "charcoal", "navy", "blue",
    "saxe", "skyblue", "lightblue", "beige", "sand", "brown", "camel", "khaki",
    "olive", "sage", "green", "mint", "teal", "ivory", "cream", "ecru", "oatmeal",
    "red", "wine", "burgundy", "maroon", "pink", "rose", "coral", "orange",
    "yellow", "mustard", "purple", "lavender", "lilac", "denim", "indigo",
    "tan", "mocha", "silver", "gold",
)

# Cafe24 등에서 '_세트', '_남성'처럼 색상이 아닌 꼬리표.
NON_COLOR_TAILS = frozenset({
    "세트", "set", "남", "여", "남성", "여성", "남자", "여자",
    "유니섹스", "unisex", "신상", "베스트", "best", "hot", "new", "sale",
    "프리오더", "preorder", "한정", "시즌", "리오더", "재입고", "outlet",
    "fw", "ss", "ss24", "ss25", "ss26", "fw24", "fw25", "fw26",
})


def _norm_color_token(s: str) -> str:
    return re.sub(r"\s+", "", (s or "").strip().lower())


_COLOR_NORM = {_norm_color_token(w) for w in COLOR_WORDS}


def _is_color_tail(tail: str) -> bool:
    """상품명 `_뒤` / 옵션 값이 색상(변형)명으로 보이는지."""
    t = (tail or "").strip()
    if not t or len(t) > 16:
        return False
    tn = _norm_color_token(t)
    if not tn or tn in NON_COLOR_TAILS:
        return False
    if tn in _COLOR_NORM:
        return True
    # 사이즈·SKU 제외
    if re.fullmatch(r"(?i)(xxs|xs|s|m|l|xl|xxl|2xl|3xl|4xl|[0-9]{1,2})$", t):
        return False
    if re.fullmatch(r"[A-Za-z]*\d{2,}[A-Za-z0-9]*", t):
        return False
    # 브랜드몰 관례: '_삭스', '_세이지'처럼 짧은 한글 토큰은 색상 변형명
    if re.fullmatch(r"[가-힣]{1,10}", t):
        return True
    return False


def _split_color_from_title(title: str) -> tuple[str, str]:
    """'…셔츠_삭스' → ('…셔츠', '삭스'). 색상으로 보일 때만 분리."""
    t = html_lib.unescape((title or "").strip())
    t = t.replace("\\_", "_").replace("＿", "_")
    if "_" in t:
        head, _, tail = t.rpartition("_")
        head, tail = head.strip(), tail.strip()
        if head and _is_color_tail(tail):
            return head, tail
    m = re.search(r"^(.*?)[\s]*[\(\[]\s*([가-힣A-Za-z]{1,14})\s*[\)\]]\s*$", t)
    if m and _is_color_tail(m.group(2)):
        return m.group(1).strip(), m.group(2).strip()
    return t, ""


def _extract_page_color(page_html: str) -> str:
    """상세 HTML에서 색상/컬러 필드 추출 (Cafe24 등)."""
    patterns = (
        r"<th[^>]*>\s*(?:색상|컬러|Color)\s*</th>\s*<td[^>]*>\s*([^<]{1,20}?)\s*</td>",
        r"id=[\"']product_color[\"'][^>]*>\s*([^<]{1,20})",
        r"[\"'](?:product_)?color[\"']\s*:\s*[\"']([^\"']{1,20})[\"']",
        r"option_name[\"']?\s*:\s*[\"'](?:색상|컬러|Color)[\"'][^}]{0,200}?option_value[\"']?\s*:\s*[\"']([^\"']{1,20})",
    )
    for pat in patterns:
        m = re.search(pat, page_html, re.I | re.S)
        if not m:
            continue
        c = re.sub(r"\s+", " ", html_lib.unescape(m.group(1))).strip()
        if c and _is_color_tail(c):
            return c
    return ""


def _brand_from_jsonld(html: str) -> str:
    for block in re.findall(
        r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        html,
        re.I | re.S,
    ):
        raw = block.strip()
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except Exception:
            m = re.search(r'"brand"\s*:\s*\{[^{}]*?"name"\s*:\s*"([^"]+)"', raw)
            if m:
                return _clean_brand(m.group(1))
            m = re.search(r'"brand"\s*:\s*"([^"]+)"', raw)
            if m:
                return _clean_brand(m.group(1))
            continue
        stack = [data]
        while stack:
            node = stack.pop()
            if isinstance(node, list):
                stack.extend(node)
            elif isinstance(node, dict):
                if "@graph" in node:
                    stack.extend(node["@graph"] if isinstance(node["@graph"], list) else [node["@graph"]])
                b = node.get("brand")
                if isinstance(b, dict) and b.get("name"):
                    return _clean_brand(str(b["name"]))
                if isinstance(b, str) and b.strip():
                    return _clean_brand(b)
    return ""


def _extract_brand(html: str, page_url: str) -> str:
    """옷 브랜드 추출: JSON-LD brand → meta 태그 → 도메인별 휴리스틱."""
    brand = _brand_from_jsonld(html)
    if brand:
        return brand
    for key, attr in (
        ("product:brand", "property"),
        ("og:brand", "property"),
        ("brand", "name"),
        ("brand", "itemprop"),
    ):
        val = _meta_content(html, key, attr)
        if val:
            return _clean_brand(val)
    if "musinsa" in _host_of(page_url):
        m = re.search(r'<a[^>]+href=["\'][^"\']*/brand[^"\']*["\'][^>]*>([^<]+)</a>', html, re.I)
        if m and m.group(1).strip():
            return _clean_brand(m.group(1))
    return ""


def _detect_store(page_url: str, brand: str = "") -> str:
    """구매처는 URL(도메인) 기준으로 판별.

    1) 알려진 플랫폼 도메인 → 플랫폼명 (무신사·지그재그·에이블리 등)
    2) 그 외(개별 브랜드몰) → '{브랜드} 공식 홈페이지'
    3) 브랜드도 모르면 → URL 그대로 (클릭해서 직접 확인할 수 있게)

    og:site_name은 사이트마다 제각각(상품명을 넣는 곳도 있음)이라 쓰지 않는다.
    """
    host = _host_of(page_url)
    for dom, name in STORE_DOMAINS:
        if host == dom or host.endswith("." + dom):
            return name
    if brand and brand.strip():
        return f"{brand.strip()} 공식 홈페이지"
    return page_url


def _fetch_product_meta(page_url: str) -> tuple[bytes, str, dict[str, str]]:
    """상품 이미지 바이트 + (brand, store, title) 컨텍스트."""
    headers = {"User-Agent": "Mozilla/5.0 (LOOKBOX bot)"}
    html = requests.get(page_url, headers=headers, timeout=15).text
    brand = _extract_brand(html, page_url)
    store = _detect_store(page_url, brand)
    title = _meta_content(html, "og:title") or _meta_content(html, "twitter:title", "name")
    tm = re.search(r"<title[^>]*>([^<]+)</title>", html, re.I)
    doc_title = tm.group(1).strip() if tm else ""
    if not title:
        title = doc_title
    # og:title에 색이 없고 <title>에 '_삭스'만 있는 경우도 흡수
    title, color = _split_color_from_title(title)
    if not color and doc_title:
        t2, c2 = _split_color_from_title(doc_title)
        if c2:
            color = c2
            if title.endswith("_" + c2):
                title = title[: -(len(c2) + 1)].strip()
            elif title == doc_title:
                title = t2
    if not color:
        color = _extract_page_color(html)
        if color and title.endswith("_" + color):
            title = title[: -(len(color) + 1)].strip()
    match = re.search(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']', html, re.I)
    if not match:
        match = re.search(r'<img[^>]+src=["\']([^"\']+\.(?:jpg|jpeg|png|webp)[^"\']*)["\']', html, re.I)
    if not match:
        raise HTTPException(status_code=422, detail="상품 이미지를 찾지 못했어요")
    img_url = match.group(1)
    if img_url.startswith("//"):
        img_url = "https:" + img_url
    resp = requests.get(img_url, headers=headers, timeout=15)
    resp.raise_for_status()
    meta = {"brand": brand, "store": store, "title": title[:120], "color": color}
    return resp.content, resp.headers.get("content-type", "image/jpeg"), meta


@app.get("/api/live/extraction-stats")
def live_extraction_stats() -> dict[str, Any]:
    """추출 소요시간 평균 (소스·개수별). 나중에 FE 대기 안내에 사용."""
    rows = (
        supabase_admin.table("extraction_timings")
        .select("source,item_count,duration_ms")
        .limit(10000)
        .execute()
        .data
        or []
    )
    by_count: dict[tuple[str, int], list[int]] = {}
    by_source: dict[str, list[int]] = {}
    for r in rows:
        src = r.get("source") or "unknown"
        cnt = int(r.get("item_count") or 0)
        ms = int(r.get("duration_ms") or 0)
        by_count.setdefault((src, cnt), []).append(ms)
        by_source.setdefault(src, []).append(ms)

    def _avg(v: list[int]) -> float:
        return round(sum(v) / len(v), 1) if v else 0.0

    return {
        "by_count": [
            {"source": s, "item_count": c, "n": len(v), "avg_ms": _avg(v)}
            for (s, c), v in sorted(by_count.items())
        ],
        "by_source": [
            {"source": s, "n": len(v), "avg_ms": _avg(v)} for s, v in sorted(by_source.items())
        ],
    }


@app.get("/api/live/wardrobe")
def live_wardrobe(status: str = "owned", user: UserContext = Depends(current_user)) -> dict[str, Any]:
    target = LIVE_STATUS_MAP.get(status, status)
    rows = (
        supabase_admin.table("wardrobe_items")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", target)
        .order("created_at", desc=True)
        .execute()
        .data
        or []
    )
    return {"items": [live_item_payload(row) for row in rows]}


@app.patch("/api/live/items/{item_id}")
def live_update_item(item_id: str, body: LiveItemUpdate, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    rows = (
        supabase_admin.table("wardrobe_items")
        .select("*")
        .eq("id", item_id)
        .eq("user_id", user.id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rows:
        raise HTTPException(status_code=404, detail="item_not_found")
    row = rows[0]
    meta = dict(row.get("metadata") or {})
    patch: dict[str, Any] = {}
    if body.name is not None:
        patch["name"] = body.name
    if body.color is not None:
        patch["color"] = body.color
    if body.note is not None:
        patch["note"] = body.note
    if body.brand is not None:
        meta["brand"] = body.brand
    if body.size is not None:
        meta["size"] = body.size
    if body.store is not None:
        meta["store"] = body.store
    if body.brand is not None or body.size is not None or body.store is not None:
        patch["metadata"] = meta
    if not patch:
        return {"item": live_item_payload(row)}
    updated = (
        supabase_admin.table("wardrobe_items")
        .update(patch)
        .eq("id", item_id)
        .eq("user_id", user.id)
        .execute()
        .data
        or []
    )
    return {"item": live_item_payload(updated[0] if updated else {**row, **patch})}


@app.post("/api/live/wardrobe/normalize-bg")
def live_normalize_bg(user: UserContext = Depends(current_user)) -> dict[str, Any]:
    """기존 제품 컷의 흰/연회색 판을 투명 컷아웃으로 정규화."""
    require_supabase()
    rows = (
        supabase_admin.table("wardrobe_items")
        .select("*")
        .eq("user_id", user.id)
        .neq("status", "deleted")
        .execute()
        .data
        or []
    )
    updated = 0
    skipped = 0
    for row in rows:
        meta = dict(row.get("metadata") or {})
        if meta.get("bg_norm") == "cutout_v2":
            skipped += 1
            continue
        path = row.get("storage_path")
        if not path:
            skipped += 1
            continue
        try:
            raw = supabase_admin.storage.from_(SUPABASE_BUCKET).download(path)
            fixed = make_transparent_cutout(raw)
            new_path = f"{user.id}/items/{uuid.uuid4().hex}.png"
            image_url = upload_bytes(new_path, fixed, "image/png")
            meta["bg_norm"] = "cutout_v2"
            supabase_admin.table("wardrobe_items").update(
                {"image_url": image_url, "storage_path": new_path, "metadata": meta}
            ).eq("id", row["id"]).eq("user_id", user.id).execute()
            updated += 1
        except Exception as exc:  # noqa: BLE001
            print(f"[normalize-bg] skip {row.get('id')}: {exc}", flush=True)
            skipped += 1
    return {"updated": updated, "skipped": skipped}


@app.post("/api/live/import/photo")
async def live_import_photo(
    status: str = "owned",
    image: UploadFile = File(...),
    user: UserContext = Depends(current_user),
) -> dict[str, Any]:
    require_supabase()
    t0 = time.perf_counter()
    suffix = os.path.splitext(image.filename or "image.jpg")[1] or ".jpg"
    raw = await image.read()
    row = _store_uploaded_item(user.id, raw, suffix, image.content_type or "image/jpeg", status)
    items = [live_item_payload(row)]
    _record_extraction_timing(user.id, "photo", len(items), (time.perf_counter() - t0) * 1000)
    return {"items": items, "primary_idx": 0}


@app.post("/api/live/import/url")
def live_import_url(body: LiveImportUrl, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    require_supabase()
    if not body.url.strip():
        raise HTTPException(status_code=400, detail="상품 URL을 입력해주세요")
    url = body.url.strip()
    t0 = time.perf_counter()
    raw, content_type, meta = _fetch_product_meta(url)
    suffix = ".png" if "png" in content_type else ".jpg"
    row = _store_uploaded_item(
        user.id,
        raw,
        suffix,
        content_type,
        body.status,
        source="url",
        name_override=meta.get("title") or None,
        source_url=url,
        brand=meta.get("brand") or None,
        store=meta.get("store") or None,
        color_override=meta.get("color") or None,
    )
    items = [live_item_payload(row)]
    _record_extraction_timing(user.id, "url", len(items), (time.perf_counter() - t0) * 1000)
    return {"items": items, "primary_idx": 0}


@app.post("/api/live/coordinate")
def live_coordinate(body: LiveCoordinate, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    owned = (
        supabase_admin.table("wardrobe_items")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "owned")
        .order("created_at", desc=True)
        .execute()
        .data
        or []
    )
    anchor = None
    if body.anchor_id:
        anchor_rows = (
            supabase_admin.table("wardrobe_items")
            .select("*")
            .eq("id", body.anchor_id)
            .eq("user_id", user.id)
            .limit(1)
            .execute()
            .data
            or []
        )
        anchor = anchor_rows[0] if anchor_rows else None
    pool = [anchor, *owned] if anchor else owned[:]
    pool = [row for row in pool if row]
    if len(pool) < 2:
        raise HTTPException(status_code=400, detail="코디를 만들려면 옷장에 옷이 2개 이상 필요해요")
    combos = recommend_text(
        user.id,
        anchor,
        pool,
        body.style,
        min(max(body.max_combos, 1), 10),
        body.exclude_item_ids or [],
        body.styles or None,
    )
    by_id = {row["id"]: row for row in pool}
    outfits, used = [], {}
    for idx, combo in enumerate(combos):
        ids = [item_id for item_id in combo["item_ids"] if item_id in by_id]
        for item_id in ids:
            used[item_id] = by_id[item_id]
        outfits.append(
            {
                "id": f"live-{uuid.uuid4().hex[:8]}",
                "label": combo.get("label") or f"추천 코디 {idx + 1}",
                "mood": combo.get("mood") or "",
                "styles": combo.get("styles") or [],
                "itemIds": ids,
                "lookImg": None,
            }
        )
    return {"outfits": outfits, "items": [live_item_payload(row) for row in used.values()]}


@app.post("/api/live/items/status")
def live_items_status(body: LiveStatus, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    if not body.ids:
        return {"items": []}
    target = LIVE_STATUS_MAP.get(body.status, "owned")
    (
        supabase_admin.table("wardrobe_items")
        .update({"status": target})
        .in_("id", body.ids)
        .eq("user_id", user.id)
        .execute()
    )
    if target == "deleted":
        return {"items": []}
    rows = (
        supabase_admin.table("wardrobe_items")
        .select("*")
        .in_("id", body.ids)
        .eq("user_id", user.id)
        .execute()
        .data
        or []
    )
    return {"items": [live_item_payload(row) for row in rows]}
