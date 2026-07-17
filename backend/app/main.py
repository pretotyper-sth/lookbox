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
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Request, UploadFile
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
# 분류 전용(기본=비전과 동일). 싸게 A/B할 때만 OPENAI_CLASSIFY_MODEL로 덮어쓰기.
OPENAI_CLASSIFY_MODEL = os.environ.get("OPENAI_CLASSIFY_MODEL") or OPENAI_VISION_MODEL
OPENAI_IMAGE_MODEL = os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-1")
# 옷에 인쇄 텍스트/로고가 있을 때만 쓰는 상위 모델·품질 (비용↑, 글자 보존↑)
OPENAI_IMAGE_MODEL_TEXT = os.environ.get("OPENAI_IMAGE_MODEL_TEXT", "gpt-image-2")
OPENAI_IMAGE_QUALITY = os.environ.get("OPENAI_IMAGE_QUALITY", "medium")
OPENAI_IMAGE_QUALITY_TEXT = os.environ.get("OPENAI_IMAGE_QUALITY_TEXT", "high")
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
# 타임아웃을 명시해 이미지 생성이 지연돼도 연결을 오래 붙잡지 않게 한다.
# (무한 대기 시 Render/브라우저가 먼저 끊어 'Failed to fetch'가 발생)
openai_client = (
    OpenAI(api_key=OPENAI_API_KEY, timeout=90.0, max_retries=1)
    if OPENAI_API_KEY
    else None
)

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
CATEGORY_EN = {v: k for k, v in CATEGORY_KO.items()}


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
        # 파일명이 UUID로 고정(불변)이라 장기 캐시 안전 → 새로고침마다 재다운로드/깜빡임 방지.
        # 값은 초 단위만 넣는다(라이브러리가 max-age=<값>으로 감쌈). 1년 = 31536000초.
        file_options={
            "content-type": content_type,
            "upsert": "true",
            "cache-control": "31536000",
        },
    )
    return public_url(path)


def to_webp(png_bytes: bytes, max_side: int = 1024, quality: int = 82) -> bytes:
    """제품 컷을 WebP(알파 유지)로 변환 → 용량 대폭 축소로 로딩 버퍼 감소."""
    img = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    if max(img.size) > max_side:
        img.thumbnail((max_side, max_side))
    out = io.BytesIO()
    img.save(out, format="WEBP", quality=quality, method=6)
    return out.getvalue()


def save_product_image(user_id: str, product_bytes: bytes) -> tuple[str, str]:
    """제품 컷을 WebP로 저장하고 (storage_path, public_url) 반환."""
    data = to_webp(product_bytes)
    path = f"{user_id}/items/{uuid.uuid4().hex}.webp"
    return path, upload_bytes(path, data, "image/webp")


def read_image_as_png_bytes(path: str, max_side: int = 1024) -> bytes:
    image = Image.open(path).convert("RGBA")
    if max(image.size) > max_side:
        image.thumbnail((max_side, max_side))
    out = io.BytesIO()
    image.save(out, format="PNG")
    return out.getvalue()


def image_to_data_url(path: str, max_side: int = 768) -> str:
    # 분류(비전)용: 작은 JPEG로 보내 업로드·처리를 빠르게. (분류엔 고해상도 불필요)
    image = Image.open(path).convert("RGB")
    if max(image.size) > max_side:
        image.thumbnail((max_side, max_side))
    out = io.BytesIO()
    image.save(out, format="JPEG", quality=80)
    return "data:image/jpeg;base64," + base64.b64encode(out.getvalue()).decode("ascii")


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
    # BM/유료화 전까지 크레딧 제한·차감 비활성. 나중에 다시 켤 때 아래 블록 복구.
    # if credit_balance(user_id) <= 0:
    #     return False
    # supabase_admin.table("credit_ledger").insert(
    #     {"user_id": user_id, "delta": -1, "reason": reason, "metadata": metadata or {}}
    # ).execute()
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


def classify_item(path: str, extract_hint: str = "") -> dict[str, Any]:
    fallback = {
        "name": "새로 추가한 옷",
        "category": "top",
        "color": "neutral",
        "tags": [],
        "has_text_logo": False,
        "logo_text": "",
    }
    if not openai_client:
        return fallback
    hint = (extract_hint or "").strip()[:500]
    prompt = ""
    if hint:
        prompt += f"""사용자 지시(최우선·반드시 준수):
"{hint}"

위 지시에 해당하는 아이템 1개만 골라 분석하세요. 사람·팔·몸통·다른 옷·지시와 무관한 물건은 무시합니다.

"""
    prompt += """이미지의 패션 아이템을 분석하세요. JSON만 응답하세요.
형식:
{
  "name": "한국어 이름",
  "category": "top|bottom|outer|dress|shoes|bag|accessory",
  "color": "대표 색상",
  "tags": ["키워드"],
  "has_text_logo": false,
  "logo_text": ""
}
규칙:
- color: 패션 음차만 사용 (블랙, 화이트, 그레이, 네이비, 블루, 베이지…). 검정/회색/흰색/남색 같은 일상어·영어(Black) 금지.
- category: 가방이면 반드시 bag, 신발·슬리퍼·쪼리·스니커·샌들이면 반드시 shoes.
- 신발이 한 쌍으로 찍혀 있어도 아이템은 1개(신발 카테고리)로 본다. name에는 '슬리퍼'처럼 제품명만.
- has_text_logo: 가슴·등·소매 등에 읽을 수 있는 브랜드명·슬로건(글자 3자 이상)이 크게 인쇄·자수된 경우만 true.
  false로 둘 것: 작은 모노그램/이니셜 1~2자, 케어라벨·사이즈택, 추상 마크(글자 없음), 가격표·워터마크·UI, 애매하면 false.
- logo_text: has_text_logo가 true일 때만 원문 철자 (예: "IAB STUDIO"). 아니면 "".
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
        # 가방은 별도 카테고리가 없으므로 액세서리로 취급 (프론트에 '가방' 필터 없음 → 미분류 방지)
        if data.get("category") == "bag":
            data["category"] = "accessory"
        data["logo_text"] = str(data.get("logo_text") or "").strip()[:80]
        data["has_text_logo"] = _significant_garment_logo(
            bool(data.get("has_text_logo")), data["logo_text"]
        )
        if not data["has_text_logo"]:
            data["logo_text"] = ""
        return {**fallback, **data}
    except Exception:
        return fallback


def _significant_garment_logo(has_text_logo: bool, logo_text: str) -> bool:
    """gpt-image-2가 필요한 실질 텍스트 로고만 통과. 애매·미세 텍스트는 제외."""
    if not has_text_logo:
        return False
    chars = re.sub(r"[^A-Za-z0-9가-힣]", "", logo_text or "")
    return len(chars) >= 3


def detect_garment_text(path: str) -> dict[str, Any]:
    """옷 표면 인쇄/자수 텍스트·로고만 감지 (분류 메타에 없을 때 재추출·교체용)."""
    empty = {"has_text_logo": False, "logo_text": ""}
    if not openai_client:
        return empty
    prompt = """이 이미지의 주요 옷에 '읽을 수 있는 브랜드명·슬로건'이 크게 인쇄/자수되어 있는지 보세요.
true 조건: 가슴·등·소매 등 눈에 띄는 글자 3자 이상 (예: IAB STUDIO, NIKE).
false 조건: 작은 이니셜, 케어라벨, 사이즈택, 글자 없는 마크, 가격표/워터마크/UI, 애매함.
JSON만 응답:
{"has_text_logo": false, "logo_text": ""}
logo_text는 true일 때만 원문 철자, 아니면 "".
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
            temperature=0,
        )
        data = json.loads(response.choices[0].message.content or "{}")
        logo_text = str(data.get("logo_text") or "").strip()[:80]
        has_logo = _significant_garment_logo(bool(data.get("has_text_logo")), logo_text)
        return {
            "has_text_logo": has_logo,
            "logo_text": logo_text if has_logo else "",
        }
    except Exception:
        return empty


# 스튜디오/순백 판으로 보이는 밝은 배경 → 투명 처리 (코디 합성 시 카드처럼 안 보이게)
_STUDIO_BG = (243, 243, 241)  # #F3F3F1 — 이전에 굽던 연회색도 제거 대상
_BG_NORM_VERSION = "cutout_v4"


def make_transparent_cutout(png_bytes: bytes, *, aggressive: bool = False) -> bytes:
    """가장자리에서 이어진 순백·연회색 스튜디오 배경을 투명으로 바꿔 옷만 남김.

    gpt-image-2 등이 불투명 흰 판을 남기는 경우가 있어, aggressive=True면 임계를 더 낮춤.
    """
    img = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    w, h = img.size
    if w < 2 or h < 2:
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()
    px = img.load()
    visited = [[False] * w for _ in range(h)]
    q: deque[tuple[int, int]] = deque()
    white_floor = 235 if aggressive else 242
    gray_floor = 200 if aggressive else 218
    chroma_max = 18 if aggressive else 14

    def is_plate(x: int, y: int) -> bool:
        r, g, b, a = px[x, y]
        if a < 18:
            return True
        # 순백·거의 흰색 (image-2 불투명 흰 판)
        if r >= white_floor and g >= white_floor and b >= white_floor:
            return True
        # 밝고 채도 낮은 스튜디오 그레이/아이보리 판
        mx, mn = max(r, g, b), min(r, g, b)
        if mn >= gray_floor and (mx - mn) <= chroma_max:
            return True
        if mn >= 228 and (mx - mn) <= 24:
            return True
        return (
            abs(r - _STUDIO_BG[0]) <= 16
            and abs(g - _STUDIO_BG[1]) <= 16
            and abs(b - _STUDIO_BG[2]) <= 16
        )

    # 테두리 전체를 시드로 — 모서리만이면 얇은 테두리에 막힐 수 있음
    seeds: list[tuple[int, int]] = []
    for x in range(0, w, max(1, w // 64)):
        seeds.append((x, 0))
        seeds.append((x, h - 1))
    for y in range(0, h, max(1, h // 64)):
        seeds.append((0, y))
        seeds.append((w - 1, y))
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


def _edge_plate_ratio(png_bytes: bytes) -> float:
    """가장자리 픽셀 중 불투명 흰/회색 판 비율. 컷아웃 실패 감지용."""
    img = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    w, h = img.size
    px = img.load()
    samples: list[tuple[int, int]] = []
    step = max(1, min(w, h) // 40)
    for x in range(0, w, step):
        samples.append((x, 0))
        samples.append((x, h - 1))
    for y in range(0, h, step):
        samples.append((0, y))
        samples.append((w - 1, y))
    if not samples:
        return 0.0
    hits = 0
    for x, y in samples:
        r, g, b, a = px[x, y]
        if a < 18:
            continue
        if r >= 235 and g >= 235 and b >= 235:
            hits += 1
            continue
        mx, mn = max(r, g, b), min(r, g, b)
        if mn >= 200 and (mx - mn) <= 18:
            hits += 1
    return hits / len(samples)


def finalize_cutout(png_bytes: bytes) -> bytes:
    """1차 컷아웃 후 가장자리에 흰 판이 남으면 더 강하게 한 번 더."""
    out = make_transparent_cutout(png_bytes, aggressive=False)
    if _edge_plate_ratio(out) >= 0.12:
        out = make_transparent_cutout(out, aggressive=True)
    return out


def local_product_cutout(path: str) -> bytes | None:
    """AI 추출 실패 시에도 원본 스튜디오 배경을 걷어 카드 톤을 맞춤."""
    try:
        return finalize_cutout(read_image_as_png_bytes(path))
    except Exception:
        return None


def generate_product_image(user_id: str, path: str, meta: dict[str, Any]) -> bytes | None:
    """이미지 + 프롬프트로 images.edit. 힌트면 사용자 문장 우선(ChatGPT와 동일)."""
    if not openai_client:
        print("[extract] openai client missing", flush=True)
        meta["_extract_fail"] = "no_openai"
        return None
    # 크레딧 게이트 비활성(테스트). charge는 no-op이지만 호출해 ledger 경로를 유지하지 않음.
    charge_credit(user_id, "product_image", {"name": meta.get("name")})
    if "has_text_logo" not in meta:
        meta.update(detect_garment_text(path))
    else:
        logo_text = str(meta.get("logo_text") or "").strip()
        meta["has_text_logo"] = _significant_garment_logo(bool(meta.get("has_text_logo")), logo_text)
        if not meta["has_text_logo"]:
            meta["logo_text"] = ""
    has_text = bool(meta.get("has_text_logo"))
    logo_text = str(meta.get("logo_text") or "").strip()
    hint = str(meta.get("extract_hint") or "").strip()[:500]
    name = meta.get("name") or "패션 아이템"
    model = OPENAI_IMAGE_MODEL_TEXT if has_text else OPENAI_IMAGE_MODEL
    # 텍스트 로고/힌트가 있을 때만 고품질. 일반 추출은 low로 속도 우선.
    quality = OPENAI_IMAGE_QUALITY_TEXT if (has_text or hint) else "low"

    if hint:
        # ChatGPT에 넣던 것과 같이: 사용자 요청이 본체, 톤은 짧게
        prompt = f"""{hint}

쇼핑몰 상품 컷처럼 요청한 아이템만 흰 배경에 단독으로 뽑아줘. 사람·팔·다른 옷은 넣지 마.
원본 색·형태·재질은 그대로 유지해. 원본에 신발이 두 짝이면 두 짝 모두, 한 짝이면 한 짝 그대로.
"""
    else:
        prompt = f"""이 이미지에서 {name} 하나만 추출해 깔끔한 제품 컷으로 만들어주세요.
- 신발처럼 원본에 여러 짝이 보이면 보이는 대로 (두 짝이면 두 짝, 한 짝이면 한 짝) 유지. 짝을 새로 만들거나 지우지 말 것.
- 배경은 완전히 투명하게 (알파 채널). 흰색·회색 사각형 배경 판을 절대 남기지 말 것. 옷만 떠 있는 PNG처럼.
- 사람, 마네킹, 그림자, 가격표·워터마크·화면 UI 같은 떠 있는 오버레이 텍스트/스티커만 제거
- 옷에 인쇄·자수·패치로 들어간 로고·글자·그래픽은 절대 지우거나 다시 그리지 말 것. 철자·간격·위치·크기·색을 원본 그대로 유지
- 아이템 전체가 잘리지 않게 중앙 배치. 원본 JPEG 프레임/여백을 그대로 두지 말 것
- 원본 색상·실루엣·재질 디테일은 유지. 형태를 새로 창작하지 말 것
"""
    if has_text:
        prompt += "\n- CRITICAL: This garment has printed/embroidered text or a logo on the fabric. Preserve it pixel-faithfully. Do not redraw, invent, or alter any letter."
        if logo_text:
            prompt += f'\n- The visible logo/text must remain exactly: "{logo_text}" (same spelling, spacing, and layout).'

    print(
        f"[extract] start hint={bool(hint)!r} hint_text={hint[:60]!r} model={model} quality={quality}",
        flush=True,
    )

    def _edit(use_model: str, *, transparent: bool) -> bytes:
        img_bytes = read_image_as_png_bytes(path)
        buf = io.BytesIO(img_bytes)
        buf.name = "source.png"
        kwargs: dict[str, Any] = {
            "model": use_model,
            "image": buf,
            "prompt": prompt,
            "size": "1024x1536",
            "quality": quality,
        }
        if transparent:
            kwargs["background"] = "transparent"
        result = openai_client.images.edit(**kwargs)
        log_ai_usage(
            user_id,
            "product_image",
            use_model,
            {
                "quality": quality,
                "has_text_logo": has_text,
                "logo_text": logo_text[:40],
                "extract_hint": hint[:80],
                "transparent": transparent,
            },
        )
        return base64.b64decode(result.data[0].b64_json)

    # 한 요청이 오래 걸리지 않도록 시도는 최대 2회로 제한.
    attempts: list[tuple[str, bool]] = []
    if hint:
        attempts.append((model, False))
        if model != OPENAI_IMAGE_MODEL:
            attempts.append((OPENAI_IMAGE_MODEL, False))
    else:
        attempts.append((model, True))
        attempts.append((model, False))

    seen: set[tuple[str, bool]] = set()
    last_err = ""
    for use_model, transparent in attempts:
        key = (use_model, transparent)
        if key in seen:
            continue
        seen.add(key)
        try:
            raw = _edit(use_model, transparent=transparent)
            print(f"[extract] ok model={use_model} transparent={transparent}", flush=True)
            meta["_extract_mode"] = "ai"
            return finalize_cutout(raw)
        except Exception as exc:  # noqa: BLE001
            last_err = str(exc)
            print(f"[extract] edit failed model={use_model} transparent={transparent}: {exc}", flush=True)
    meta["_extract_fail"] = last_err or "edit_failed"
    return None


def resolve_product_image(user_id: str, path: str, meta: dict[str, Any]) -> bytes | None:
    """AI 추출. 힌트가 있으면 로컬 배경제거 폴백으로 가짜 성공을 만들지 않음."""
    hint = str(meta.get("extract_hint") or "").strip()
    product = generate_product_image(user_id, path, meta)
    if product:
        return product
    if hint:
        fail = meta.get("_extract_fail") or "edit_failed"
        print(f"[extract] hint extract failed ({fail}) — no local fallback", flush=True)
        raise HTTPException(
            status_code=502,
            detail="요청한 아이템을 추출하지 못했어요. 잠시 후 다시 시도해 주세요.",
        )
    local = local_product_cutout(path)
    if local:
        meta["_extract_mode"] = "local"
    return local


def item_payload(row: dict[str, Any]) -> dict[str, Any]:
    raw_color = (row.get("color") or "").strip()
    return {
        "id": row["id"],
        "name": row.get("name") or "옷",
        "category": CATEGORY_KO.get(row.get("category"), row.get("category") or "상의"),
        "categoryKey": row.get("category"),
        "color": _canonicalize_color(raw_color) if raw_color else "뉴트럴",
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
- 한 코디에는 반드시 상의(또는 아우터/원피스)와 하의(또는 원피스)를 포함. 상의+신발만, 하의 없는 조합 금지
- 원피스 1벌이면 상의·하의 요건을 충족한 것으로 봄
- 그 외 신발·액세서리는 선택
- 한 코디는 2~4개 구성
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
        valid = {item["id"]: item for item in items}
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
            if not _combo_has_top_and_bottom(ids, valid):
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


def _combo_has_top_and_bottom(ids: list[str], by_id: dict[str, Any]) -> bool:
    """상의(또는 아우터/원피스) + 하의(또는 원피스) 필수."""
    buckets = [_item_bucket(by_id[i]) for i in ids if i in by_id]
    if "dress" in buckets:
        return True
    return ("top" in buckets) and ("bottom" in buckets)


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
    by_id = {i["id"]: i for i in items}
    combos: list[dict[str, Any]] = []
    seen: set[tuple[str, ...]] = set(exclude_keys or ())
    style_cycle = [s for s in (styles or []) if s] or []

    def _push(ids: list[str], label: str) -> None:
        if len(ids) < 2:
            return
        if anchor and anchor["id"] not in ids:
            ids = [anchor["id"], *[x for x in ids if x != anchor["id"]]]
        if not _combo_has_top_and_bottom(ids, by_id):
            return
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

    # 원피스만으로 최소 조합
    dresses = [i for i in items if _item_bucket(i) == "dress"]
    for d in dresses:
        ids = [d["id"]]
        if shoes:
            ids.append(shoes[0]["id"])
        if len(ids) >= 2:
            _push(ids, f"추천 코디 {len(combos) + 1}")
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


DEPLOY_REV = os.environ.get("RENDER_GIT_COMMIT") or os.environ.get("GIT_COMMIT") or "dev"


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "openai": bool(openai_client),
        "supabase": bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY),
        "rev": (DEPLOY_REV or "")[:12],
        "credits_gated": False,
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
        item_name, item_color = _normalize_item_name_color(
            meta.get("name") or "새 옷",
            meta.get("color") or "neutral",
        )
        meta = {**meta, "name": item_name, "color": item_color}
        original_path = f"{user.id}/original/{uuid.uuid4().hex}{suffix}"
        original_url = upload_bytes(original_path, raw, content_type)
        product_bytes = resolve_product_image(user.id, tmp_path, meta)
        image_path = original_path
        image_url = original_url
        item_meta: dict[str, Any] = {
            "tags": meta.get("tags") or [],
            "has_text_logo": bool(meta.get("has_text_logo")),
            "logo_text": str(meta.get("logo_text") or "").strip()[:80],
            "original_path": original_path,
            "original_url": original_url,
        }
        if product_bytes:
            image_path, image_url = save_product_image(user.id, product_bytes)
            item_meta["bg_norm"] = _BG_NORM_VERSION
        row = (
            supabase_admin.table("wardrobe_items")
            .insert(
                {
                    "user_id": user.id,
                    "name": item_name,
                    "category": meta.get("category") or "top",
                    "color": item_color,
                    "image_url": image_url,
                    "storage_path": image_path,
                    "source": "upload",
                    "status": status if status in {"owned", "considering"} else "owned",
                    "metadata": item_meta,
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

LIVE_STATUS_MAP = {
    "owned": "owned",
    "considering": "considering",
    "pending": "pending",
    "archived": "archived",
    "delete": "deleted",
    "deleted": "deleted",
}


class LiveImportUrl(BaseModel):
    url: str
    status: str = "owned"
    extract_hint: str = ""


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
    raw_color = (row.get("color") or "").strip()
    return {
        "id": row["id"],
        "serverId": row["id"],
        "name": row.get("name") or "옷",
        "category": CATEGORY_KO.get(row.get("category"), row.get("category") or "상의"),
        "color": _canonicalize_color(raw_color) if raw_color else "",
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
    category: str | None = None  # KO('상의') 또는 EN('top')


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
    extract_hint: str | None = None,
) -> dict[str, Any]:
    hint = (extract_hint or "").strip()[:500]
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(raw)
        tmp_path = tmp.name
    try:
        meta = classify_item(tmp_path, extract_hint=hint)
        # URL 타이틀·비전 분류 모두 `_색상`이 이름에 붙을 수 있어 저장 직전 한 번 더 분리.
        item_name, item_color = _normalize_item_name_color(
            (name_override or "").strip() or meta.get("name") or "새 옷",
            (color_override or "").strip() or meta.get("color") or "neutral",
        )
        meta = {**meta, "name": item_name, "color": item_color, "extract_hint": hint}
        original_path = f"{user_id}/original/{uuid.uuid4().hex}{suffix}"
        original_url = upload_bytes(original_path, raw, content_type)
        product_bytes = resolve_product_image(user_id, tmp_path, meta)
        image_path, image_url = original_path, original_url
        if product_bytes:
            image_path, image_url = save_product_image(user_id, product_bytes)
        # brand/store/source_url은 스키마 변경 없이 metadata(jsonb)에 저장.
        # original_* 는 이미지 재추출 시 원본 소스로 사용.
        item_metadata: dict[str, Any] = {
            "tags": meta.get("tags") or [],
            "original_path": original_path,
            "original_url": original_url,
            "has_text_logo": bool(meta.get("has_text_logo")),
            "logo_text": str(meta.get("logo_text") or "").strip()[:80],
        }
        if product_bytes:
            item_metadata["bg_norm"] = _BG_NORM_VERSION
            if meta.get("_extract_mode"):
                item_metadata["extract_mode"] = meta["_extract_mode"]
        if hint:
            item_metadata["extract_hint"] = hint[:200]
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
                    "name": item_name,
                    "category": meta.get("category") or "top",
                    "color": item_color,
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

# '블루 스트라이프'처럼 색 + 패턴 수식
COLOR_MODIFIERS = (
    "스트라이프", "stripe", "striped", "체크", "check", "checked", "도트", "dot", "dotted",
    "솔리드", "solid", "멜란지", "헤링본", "플로럴", "프린트", "print", "페이즐리",
    "카모", "카무플라주", "무지", "단색",
)


def _norm_color_token(s: str) -> str:
    return re.sub(r"\s+", "", (s or "").strip().lower())


# 일상어·영어 → 패션 음차 표기 (블랙/그레이/화이트…)
_COLOR_CANONICAL_RAW: dict[str, str] = {
    "검정": "블랙", "검은색": "블랙", "검정색": "블랙", "흑색": "블랙", "black": "블랙",
    "흰색": "화이트", "하얀색": "화이트", "하양": "화이트", "백색": "화이트", "white": "화이트",
    "회색": "그레이", "쥐색": "그레이", "gray": "그레이", "grey": "그레이",
    "연회색": "라이트그레이", "진회색": "다크그레이", "lightgray": "라이트그레이",
    "lightgrey": "라이트그레이", "darkgray": "다크그레이", "darkgrey": "다크그레이",
    "남색": "네이비", "곤색": "네이비", "navy": "네이비", "navyblue": "네이비",
    "갈색": "브라운", "brown": "브라운",
    "빨강": "레드", "빨간색": "레드", "적색": "레드", "red": "레드",
    "파랑": "블루", "파란색": "블루", "청색": "블루", "blue": "블루",
    "하늘색": "스카이블루", "skyblue": "스카이블루", "lightblue": "라이트블루",
    "초록": "그린", "초록색": "그린", "녹색": "그린", "green": "그린",
    "노랑": "옐로우", "노란색": "옐로우", "황색": "옐로우", "yellow": "옐로우",
    "보라": "퍼플", "보라색": "퍼플", "purple": "퍼플",
    "분홍": "핑크", "분홍색": "핑크", "pink": "핑크",
    "주황": "오렌지", "주황색": "오렌지", "orange": "오렌지",
    "베이지색": "베이지", "beige": "베이지",
    "카키색": "카키", "khaki": "카키",
    "아이보리색": "아이보리", "ivory": "아이보리",
    "크림색": "크림", "cream": "크림",
    "카멜색": "카멜", "camel": "카멜",
    "차콜색": "차콜", "charcoal": "차콜",
    "와인색": "와인", "버건디색": "버건디",
    "멜란지그레이": "멜란지", "melangegray": "멜란지", "melangegrey": "멜란지",
    "neutral": "뉴트럴", "unknown": "뉴트럴", "없음": "뉴트럴", "none": "뉴트럴",
}
_COLOR_CANONICAL = {_norm_color_token(k): v for k, v in _COLOR_CANONICAL_RAW.items()}


def _canonicalize_color(color: str) -> str:
    """검정→블랙, gray→그레이 등 패션 음차로 통일."""
    c = (color or "").strip()
    if not c:
        return "뉴트럴"
    key = _norm_color_token(c)
    if key in _COLOR_CANONICAL:
        return _COLOR_CANONICAL[key]
    # 이미 음차 목록에 있으면 그대로(공백만 정리)
    for w in COLOR_WORDS:
        if _norm_color_token(w) == key and not re.fullmatch(r"[a-z]+", key):
            return w
    # 영어 단일어가 COLOR_WORDS에만 있으면 한글 음차로
    en_map = {
        "offwhite": "오프화이트", "charcoal": "차콜", "beige": "베이지", "sand": "샌드",
        "camel": "카멜", "khaki": "카키", "olive": "올리브", "sage": "세이지",
        "mint": "민트", "teal": "틸", "ivory": "아이보리", "cream": "크림",
        "ecru": "에크루", "oatmeal": "오트밀", "wine": "와인", "burgundy": "버건디",
        "maroon": "마룬", "rose": "로즈", "coral": "코랄", "mustard": "머스타드",
        "lavender": "라벤더", "lilac": "라일락", "denim": "데님", "indigo": "인디고",
        "tan": "탄", "mocha": "모카", "silver": "실버", "gold": "골드",
        "saxe": "삭스", "skyblue": "스카이블루", "lightblue": "라이트블루",
    }
    if key in en_map:
        return en_map[key]
    return c


_COLOR_NORM = {_norm_color_token(w) for w in COLOR_WORDS}
_COLOR_MOD_NORM = {_norm_color_token(w) for w in COLOR_MODIFIERS}
_COLOR_NORM_BY_LEN = sorted(_COLOR_NORM, key=len, reverse=True)


def _is_color_tail(tail: str) -> bool:
    """상품명 `_뒤` / 옵션 값이 색상(변형)명으로 보이는지. '블루 스트라이프' 포함."""
    t = (tail or "").strip()
    if not t or len(t) > 28:
        return False
    tn = _norm_color_token(t)
    if not tn or tn in NON_COLOR_TAILS:
        return False
    if tn in _COLOR_NORM:
        return True
    # 사이즈·SKU 제외
    if re.fullmatch(r"(?i)(xxs|xs|s|m|l|xl|xxl|2xl|3xl|4xl|[0-9]{1,2})$", t.strip()):
        return False
    if re.fullmatch(r"[A-Za-z]*\d{2,}[A-Za-z0-9]*", t.strip()):
        return False
    # 알려진 색상으로 시작하고 나머지가 패턴 수식(또는 짧은 한글)인 경우
    for cw in _COLOR_NORM_BY_LEN:
        if tn.startswith(cw) and len(tn) > len(cw):
            rest = tn[len(cw):]
            if rest in _COLOR_MOD_NORM or re.fullmatch(r"[가-힣a-z]{1,12}", rest):
                return True
            break
    # 브랜드몰 관례: '_삭스', '_세이지'처럼 짧은 한글(공백 무시)
    if re.fullmatch(r"[가-힣]{1,12}", tn):
        return True
    return False


def _split_color_from_title(title: str) -> tuple[str, str]:
    """'…셔츠_블루 스트라이프' → ('…셔츠', '블루 스트라이프'). 색상으로 보일 때만 분리."""
    t = html_lib.unescape((title or "").strip())
    t = t.replace("\\_", "_").replace("＿", "_")
    if "_" in t:
        head, _, tail = t.rpartition("_")
        head, tail = head.strip(), tail.strip()
        if head and _is_color_tail(tail):
            return head, tail
    m = re.search(r"^(.*?)[\s]*[\(\[]\s*([^\)\]]{1,28})\s*[\)\]]\s*$", t)
    if m and _is_color_tail(m.group(2)):
        return m.group(1).strip(), m.group(2).strip()
    return t, ""


def _normalize_item_name_color(name: str, color: str) -> tuple[str, str]:
    """저장 직전: 이름에 붙은 `_색상` 꼬리표를 분리. 모델이 통째로 넣어도 방어."""
    n = (name or "").strip() or "새 옷"
    c = (color or "").strip()
    clean, split_c = _split_color_from_title(n)
    if split_c:
        n = clean
        if not c or c.lower() in ("neutral", "unknown", "없음"):
            c = split_c
        elif _norm_color_token(c) == _norm_color_token(split_c):
            c = split_c
        elif split_c and _norm_color_token(split_c) not in _norm_color_token(c):
            # 이름에 있던 꼬리표가 더 구체적이면(블루 스트라이프) 그걸 색으로
            if len(split_c) >= len(c):
                c = split_c
    c = _canonicalize_color(c)
    return n, c


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
            return _canonicalize_color(c)
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


# URL로 상품 컷을 못 여는 대표 마켓(봇 차단·SPA). 여기선 실패 전 안내.
_MARKETPLACE_HOSTS = (
    "coupang.com",
    "smartstore.naver.com",
    "brand.naver.com",
    "shopping.naver.com",
    "11st.co.kr",
    "gmarket.co.kr",
    "auction.co.kr",
    "ssg.com",
    "kurly.com",
    "wemakeprice.com",
    "tmon.co.kr",
)
_URL_BLOCKED_MSG = "이미지 불러오기가 제한되는 URL이에요. 사진으로 추가해 주세요."
_BLOCKED_PAGE_HINTS = (
    "access denied",
    "요청이 차단",
    "비정상적인 접근",
    "captcha",
    "robot",
    "too many requests",
    "시스템오류",
    "에러페이지",
    "오류페이지",
    "error page",
)


def _normalize_product_url(url: str) -> str:
    u = (url or "").strip()
    if not u:
        return u
    if not re.match(r"^https?://", u, re.I):
        u = "https://" + u.lstrip("/")
    return u


def _is_marketplace_host(page_url: str) -> bool:
    host = _host_of(page_url)
    return any(host == d or host.endswith("." + d) for d in _MARKETPLACE_HOSTS)


def _page_looks_blocked(status: int, html: str) -> bool:
    if status in (401, 403, 429, 503):
        return True
    low = (html or "")[:12000].lower()
    return any(h in low for h in _BLOCKED_PAGE_HINTS)


def _fetch_product_meta(page_url: str) -> tuple[bytes, str, dict[str, str]]:
    """상품 이미지 바이트 + (brand, store, title) 컨텍스트."""
    page_url = _normalize_product_url(page_url)
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        ),
        "Accept-Language": "ko-KR,ko;q=0.9",
    }
    try:
        page = requests.get(page_url, headers=headers, timeout=15)
    except requests.RequestException as exc:
        raise HTTPException(status_code=422, detail=_URL_BLOCKED_MSG) from exc
    html = page.text or ""
    if _page_looks_blocked(page.status_code, html):
        raise HTTPException(status_code=422, detail=_URL_BLOCKED_MSG)

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
        # 마켓/차단 페이지는 '못 찾음'보다 원인(쇼핑몰 측 차단)을 짧게 안내
        if _is_marketplace_host(page_url) or _page_looks_blocked(page.status_code, html):
            raise HTTPException(status_code=422, detail=_URL_BLOCKED_MSG)
        raise HTTPException(
            status_code=422,
            detail="상품 이미지를 찾지 못했어요. 사진으로 추가해 주세요.",
        )
    img_url = match.group(1)
    if img_url.startswith("//"):
        img_url = "https:" + img_url
    try:
        resp = requests.get(img_url, headers=headers, timeout=15)
        resp.raise_for_status()
    except requests.RequestException as exc:
        raise HTTPException(status_code=422, detail=_URL_BLOCKED_MSG) from exc
    meta = {"brand": brand, "store": store, "title": (title or "")[:120], "color": color}
    return resp.content, resp.headers.get("content-type", "image/jpeg"), meta


@app.get("/api/live/extraction-stats")
def live_extraction_stats() -> dict[str, Any]:
    """추출 소요시간 평균 (소스·개수별). 나중에 FE 대기 안내에 사용."""
    try:
        rows = (
            supabase_admin.table("extraction_timings")
            .select("source,item_count,duration_ms")
            .limit(10000)
            .execute()
            .data
            or []
        )
    except Exception as exc:  # noqa: BLE001
        return {"by_count": [], "by_source": [], "error": str(exc)}
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

    def _p95(v: list[int]) -> float:
        if not v:
            return 0.0
        s = sorted(v)
        return float(s[max(0, int(round(0.95 * (len(s) - 1))))])

    return {
        "by_count": [
            {
                "source": s,
                "item_count": c,
                "n": len(v),
                "avg_ms": _avg(v),
                "p95_ms": _p95(v),
                "max_ms": max(v) if v else 0,
            }
            for (s, c), v in sorted(by_count.items())
        ],
        "by_source": [
            {
                "source": s,
                "n": len(v),
                "avg_ms": _avg(v),
                "p95_ms": _p95(v),
                "max_ms": max(v) if v else 0,
            }
            for s, v in sorted(by_source.items())
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
        patch["color"] = _canonicalize_color(body.color)
    if body.note is not None:
        patch["note"] = body.note
    if body.category is not None:
        cat = (body.category or "").strip()
        if cat in CATEGORY_KO:
            patch["category"] = cat
        elif cat in CATEGORY_EN:
            patch["category"] = CATEGORY_EN[cat]
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


@app.post("/api/live/items/{item_id}/reextract")
def live_reextract_item(item_id: str, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    """이름·메타는 유지하고 제품 컷(이미지 추출)만 다시 생성."""
    require_supabase()
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
    if row.get("status") == "deleted":
        raise HTTPException(status_code=404, detail="item_not_found")
    meta = dict(row.get("metadata") or {})
    source_path = (meta.get("original_path") or "").strip() or (row.get("storage_path") or "").strip()
    if not source_path:
        raise HTTPException(status_code=400, detail="원본 이미지가 없어 다시 추출할 수 없어요")
    try:
        raw = supabase_admin.storage.from_(SUPABASE_BUCKET).download(source_path)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="원본 이미지를 불러오지 못했어요") from exc
    suffix = os.path.splitext(source_path)[1] or ".png"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(raw)
        tmp_path = tmp.name
    try:
        gen_meta = {
            "name": row.get("name") or "옷",
            "category": row.get("category") or "top",
            "color": row.get("color") or "",
            "tags": meta.get("tags") or [],
        }
        # 예전 아이템은 메타에 없을 수 있음 → generate 안에서 감지
        if "has_text_logo" in meta:
            gen_meta["has_text_logo"] = bool(meta.get("has_text_logo"))
            gen_meta["logo_text"] = str(meta.get("logo_text") or "").strip()[:80]
        product_bytes = resolve_product_image(user.id, tmp_path, gen_meta)
        if not product_bytes:
            raise HTTPException(status_code=502, detail="이미지 추출에 실패했어요. 잠시 후 다시 시도해 주세요")
        new_path, image_url = save_product_image(user.id, product_bytes)
        meta["bg_norm"] = _BG_NORM_VERSION
        if "has_text_logo" in gen_meta:
            meta["has_text_logo"] = bool(gen_meta.get("has_text_logo"))
            meta["logo_text"] = str(gen_meta.get("logo_text") or "").strip()[:80]
        if not meta.get("original_path"):
            meta["original_path"] = source_path
        updated = (
            supabase_admin.table("wardrobe_items")
            .update({"image_url": image_url, "storage_path": new_path, "metadata": meta})
            .eq("id", item_id)
            .eq("user_id", user.id)
            .execute()
            .data
            or []
        )
        return {"item": live_item_payload(updated[0] if updated else {**row, "image_url": image_url, "storage_path": new_path, "metadata": meta})}
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass


@app.post("/api/live/items/{item_id}/replace-image")
async def live_replace_image(
    item_id: str,
    image: UploadFile | None = File(None),
    url: str | None = Form(None),
    extract_hint: str = Form(""),
    user: UserContext = Depends(current_user),
) -> dict[str, Any]:
    """새 사진/URL로 제품 컷만 교체. 이름·색상·브랜드 등 메타는 유지."""
    require_supabase()
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
    if row.get("status") == "deleted":
        raise HTTPException(status_code=404, detail="item_not_found")

    raw: bytes | None = None
    content_type = "image/jpeg"
    suffix = ".jpg"
    if image is not None and image.filename:
        raw = await image.read()
        content_type = image.content_type or "image/jpeg"
        suffix = os.path.splitext(image.filename or "image.jpg")[1] or ".jpg"
    elif (url or "").strip():
        try:
            page_url = _normalize_product_url(url.strip())
            raw, content_type, _meta = _fetch_product_meta(page_url)
            suffix = ".png" if "png" in (content_type or "") else ".jpg"
        except HTTPException:
            raise
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=400, detail="이미지를 불러오지 못했어요") from exc
    else:
        raise HTTPException(status_code=400, detail="사진 또는 URL을 넣어 주세요")

    if not raw:
        raise HTTPException(status_code=400, detail="이미지를 불러오지 못했어요")

    meta = dict(row.get("metadata") or {})
    hint = (extract_hint or "").strip()[:500]
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(raw)
        tmp_path = tmp.name
    try:
        original_path = f"{user.id}/original/{uuid.uuid4().hex}{suffix}"
        original_url = upload_bytes(original_path, raw, content_type)
        # 새 이미지 기준이므로 로고 여부를 다시 감지 (generate 안에서 처리)
        gen_meta = {
            "name": row.get("name") or "옷",
            "category": row.get("category") or "top",
            "color": row.get("color") or "",
            "tags": meta.get("tags") or [],
            "extract_hint": hint,
        }
        product_bytes = resolve_product_image(user.id, tmp_path, gen_meta)
        image_path, image_url = original_path, original_url
        if product_bytes:
            image_path, image_url = save_product_image(user.id, product_bytes)
            meta["bg_norm"] = _BG_NORM_VERSION
        if "has_text_logo" in gen_meta:
            meta["has_text_logo"] = bool(gen_meta.get("has_text_logo"))
            meta["logo_text"] = str(gen_meta.get("logo_text") or "").strip()[:80]
        meta["original_path"] = original_path
        meta["original_url"] = original_url
        updated = (
            supabase_admin.table("wardrobe_items")
            .update({"image_url": image_url, "storage_path": image_path, "metadata": meta})
            .eq("id", item_id)
            .eq("user_id", user.id)
            .execute()
            .data
            or []
        )
        return {
            "item": live_item_payload(
                updated[0]
                if updated
                else {**row, "image_url": image_url, "storage_path": image_path, "metadata": meta}
            )
        }
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass


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
        if meta.get("bg_norm") == _BG_NORM_VERSION:
            skipped += 1
            continue
        path = row.get("storage_path")
        if not path:
            skipped += 1
            continue
        try:
            raw = supabase_admin.storage.from_(SUPABASE_BUCKET).download(path)
            fixed = finalize_cutout(raw)
            new_path, image_url = save_product_image(user.id, fixed)
            meta["bg_norm"] = _BG_NORM_VERSION
            meta["cache_hdr"] = "v2"
            supabase_admin.table("wardrobe_items").update(
                {"image_url": image_url, "storage_path": new_path, "metadata": meta}
            ).eq("id", row["id"]).eq("user_id", user.id).execute()
            updated += 1
        except Exception as exc:  # noqa: BLE001
            print(f"[normalize-bg] skip {row.get('id')}: {exc}", flush=True)
            skipped += 1
    return {"updated": updated, "skipped": skipped}


@app.post("/api/live/wardrobe/refresh-cache")
def live_refresh_cache(user: UserContext = Depends(current_user)) -> dict[str, Any]:
    """기존 이미지 오브젝트를 같은 경로에 다시 올려 장기 캐시 헤더를 입힌다(URL 불변, OpenAI 미사용)."""
    require_supabase()
    rows = (
        supabase_admin.table("wardrobe_items")
        .select("id,storage_path,metadata")
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
        if meta.get("cache_hdr") == "v2":
            skipped += 1
            continue
        path = row.get("storage_path")
        if not path:
            skipped += 1
            continue
        try:
            raw = supabase_admin.storage.from_(SUPABASE_BUCKET).download(path)
            # 무거운 PNG → 가벼운 WebP로 재인코딩 + 장기 캐시 헤더 (URL은 바뀌므로 DB 갱신)
            new_path, image_url = save_product_image(user.id, raw)
            meta["cache_hdr"] = "v2"
            supabase_admin.table("wardrobe_items").update(
                {"image_url": image_url, "storage_path": new_path, "metadata": meta}
            ).eq("id", row["id"]).eq("user_id", user.id).execute()
            updated += 1
        except Exception as exc:  # noqa: BLE001
            print(f"[refresh-cache] skip {row.get('id')}: {exc}", flush=True)
            skipped += 1
    return {"updated": updated, "skipped": skipped}


@app.post("/api/live/import/photo")
async def live_import_photo(
    image: UploadFile = File(...),
    status: str = Form("owned"),
    extract_hint: str = Form(""),
    user: UserContext = Depends(current_user),
) -> dict[str, Any]:
    require_supabase()
    t0 = time.perf_counter()
    suffix = os.path.splitext(image.filename or "image.jpg")[1] or ".jpg"
    raw = await image.read()
    row = _store_uploaded_item(
        user.id,
        raw,
        suffix,
        image.content_type or "image/jpeg",
        status,
        extract_hint=extract_hint,
    )
    items = [live_item_payload(row)]
    _record_extraction_timing(user.id, "photo", len(items), (time.perf_counter() - t0) * 1000)
    return {"items": items, "primary_idx": 0}


@app.post("/api/live/import/url")
def live_import_url(body: LiveImportUrl, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    require_supabase()
    if not body.url.strip():
        raise HTTPException(status_code=400, detail="상품 URL을 입력해주세요")
    url = _normalize_product_url(body.url)
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
        extract_hint=body.extract_hint,
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
        if not _combo_has_top_and_bottom(ids, by_id):
            continue
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
