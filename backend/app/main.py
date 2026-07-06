import base64
import hashlib
import io
import json
import os
import re
import tempfile
import uuid
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
            model=OPENAI_VISION_MODEL,
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
        return base64.b64decode(result.data[0].b64_json)
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


def recommend_text(
    user_id: str,
    anchor: dict[str, Any] | None,
    items: list[dict[str, Any]],
    style: str,
    max_combos: int,
) -> list[dict[str, Any]]:
    if not items:
        return []
    catalog = "\n".join(
        f"id={item['id']} | {item.get('category')} | {item.get('color')} | {item.get('name')}"
        for item in items
    )
    style_map = {
        "dandy": "댄디하고 깔끔한 톤",
        "minimal": "절제된 미니멀 톤",
        "casual": "편한 데일리 캐주얼 톤",
        "office": "출근하기 좋은 오피스 톤",
    }
    if not openai_client:
        return fallback_combos(items, anchor, max_combos)
    prompt = f"""사용자의 옷장 목록만 사용해 실제로 어울리는 코디를 최대 {max_combos}개 추천하세요.
추천 톤: {style_map.get(style, style_map['dandy'])}
{('기준 아이템 id=' + anchor['id']) if anchor else '기준 아이템 없음'}

옷장:
{catalog}

규칙:
- item_ids에는 위 목록에 있는 id만 넣기
- 한 코디에는 상의/하의/신발 중심으로 2~4개 구성
- 기준 아이템이 있으면 반드시 포함
- JSON만 응답

형식:
{{"combos":[{{"label":"", "mood":"", "item_ids":["..."]}}]}}
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
        combos = []
        for combo in (data.get("combos") or [])[:max_combos]:
            ids = [item_id for item_id in combo.get("item_ids", []) if item_id in valid]
            if anchor and anchor["id"] not in ids:
                ids = [anchor["id"], *ids]
            if len(ids) >= 2:
                combos.append({"label": combo.get("label") or "추천 코디", "mood": combo.get("mood") or "", "item_ids": ids[:4]})
        log_ai_usage(user_id, "recommend_text", OPENAI_VISION_MODEL, {"count": len(combos)})
        return combos or fallback_combos(items, anchor, max_combos)
    except Exception:
        return fallback_combos(items, anchor, max_combos)


def fallback_combos(items: list[dict[str, Any]], anchor: dict[str, Any] | None, max_combos: int) -> list[dict[str, Any]]:
    ids = [item["id"] for item in items]
    if anchor and anchor["id"] not in ids:
        ids.insert(0, anchor["id"])
    combos = []
    for idx in range(min(max_combos, max(1, len(ids) - 1))):
        pick = ids[idx : idx + 4]
        if len(pick) < 2:
            pick = ids[:2]
        combos.append({"label": "데일리 조합", "mood": "내 옷장 기반 추천", "item_ids": pick})
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
    combos = recommend_text(user.id, anchor, pool, body.style, min(max(body.max_combos, 1), 6))
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
    max_combos: int = 3
    style: str = "dandy"
    anchor_id: str | None = None


class LiveStatus(BaseModel):
    ids: list[str] = []
    status: str = "owned"


def live_item_payload(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "serverId": row["id"],
        "name": row.get("name") or "옷",
        "category": CATEGORY_KO.get(row.get("category"), row.get("category") or "상의"),
        "color": row.get("color") or "",
        "img": row.get("image_url"),
        "status": row.get("status"),
    }


def _store_uploaded_item(user_id: str, raw: bytes, suffix: str, content_type: str, status: str) -> dict[str, Any]:
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
        row = (
            supabase_admin.table("wardrobe_items")
            .insert(
                {
                    "user_id": user_id,
                    "name": meta.get("name") or "새 옷",
                    "category": meta.get("category") or "top",
                    "color": meta.get("color") or "neutral",
                    "image_url": image_url,
                    "storage_path": image_path,
                    "source": "upload",
                    "status": LIVE_STATUS_MAP.get(status, "owned"),
                    "metadata": {"tags": meta.get("tags") or []},
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


def _extract_brand(html: str, page_url: str) -> str:
    patterns = [
        r'property=["\']product:brand["\'][^>]+content=["\']([^"\']+)["\']',
        r'property=["\']og:brand["\'][^>]+content=["\']([^"\']+)["\']',
        r'property=["\']og:site_name["\'][^>]+content=["\']([^"\']+)["\']',
        r'name=["\']author["\'][^>]+content=["\']([^"\']+)["\']',
    ]
    for pat in patterns:
        m = re.search(pat, html, re.I)
        if m and m.group(1).strip():
            return m.group(1).strip()
    host = re.sub(r"^www\.", "", urlparse(page_url).netloc)
    return host.split(".")[0].upper() if host else ""


def _fetch_product_image(page_url: str) -> tuple[bytes, str, str]:
    headers = {"User-Agent": "Mozilla/5.0 (LOOKBOX bot)"}
    html = requests.get(page_url, headers=headers, timeout=15).text
    brand = _extract_brand(html, page_url)
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
    return resp.content, resp.headers.get("content-type", "image/jpeg"), brand


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


@app.post("/api/live/import/photo")
async def live_import_photo(
    status: str = "owned",
    image: UploadFile = File(...),
    user: UserContext = Depends(current_user),
) -> dict[str, Any]:
    require_supabase()
    suffix = os.path.splitext(image.filename or "image.jpg")[1] or ".jpg"
    raw = await image.read()
    row = _store_uploaded_item(user.id, raw, suffix, image.content_type or "image/jpeg", status)
    return {"items": [live_item_payload(row)], "primary_idx": 0}


@app.post("/api/live/import/url")
def live_import_url(body: LiveImportUrl, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    require_supabase()
    if not body.url.strip():
        raise HTTPException(status_code=400, detail="상품 URL을 입력해주세요")
    raw, content_type, brand = _fetch_product_image(body.url.strip())
    suffix = ".png" if "png" in content_type else ".jpg"
    row = _store_uploaded_item(user.id, raw, suffix, content_type, body.status)
    item = live_item_payload(row)
    if brand:
        item["brand"] = brand
        item["store"] = brand
    return {"items": [item], "primary_idx": 0}


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
    combos = recommend_text(user.id, anchor, pool, body.style, min(max(body.max_combos, 1), 6))
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
