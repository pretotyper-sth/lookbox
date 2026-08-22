import base64
import hashlib
import html as html_lib
import inspect
import io
import json
import os
import re
import tempfile
import threading
import time
import uuid
from collections import deque
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Iterator
from urllib.parse import parse_qs, urlparse

import requests
import truststore

from dotenv import load_dotenv

# HTTPS 검증에 OS 신뢰 저장소를 쓴다. 사내 프록시가 TLS를 가로채는 망에서는 인증서
# 체인에 사설 루트가 끼는데, certifi 번들만 보는 httpx는 이걸 모른다. 그러면 Supabase·
# OpenAI 호출이 전부 CERTIFICATE_VERIFY_FAILED로 끊기고, 토큰 검증 실패로 이어져
# 화면에는 멀쩡한 세션이 invalid_session으로 보인다. 클라이언트를 만들기 전에 실행해야 한다.
truststore.inject_into_ssl()
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from openai import APIConnectionError, APITimeoutError, OpenAI
from PIL import Image, ImageChops, ImageFilter
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
# 로고·글자가 있는 옷을 '다시 그려야' 할 때 쓰는 모델. 실측 비교(같은 원본, medium):
# gpt-image-1은 "IAB"의 B를 뭉갠 글자로 그렸고(25초), gpt-image-2는 철자·자간을 그대로
# 살렸다(39초). 대신 gpt-image-2는 background="transparent"를 거부하므로(400
# invalid_value·param=background) 불투명으로 받아 우리 컷아웃을 돌린다.
# 상품컷이면 애초에 다시 그리지 않고 배경만 지우니(studio cutout) 이 경로는 재생성이
# 꼭 필요한 사진에만 쓰인다.
OPENAI_IMAGE_MODEL_TEXT = os.environ.get("OPENAI_IMAGE_MODEL_TEXT", "gpt-image-2")
# 투명 배경을 지원하지 않는 모델. 이 모델을 쓰면 불투명 결과를 받아 우리 컷아웃을 돌린다.
_NO_TRANSPARENT_MODELS = ("gpt-image-2",)


def _supports_transparent(model: str) -> bool:
    return not any(m in (model or "") for m in _NO_TRANSPARENT_MODELS)
# 비용 설계: 첫 추출은 medium($0.063/장) — 단색 상품컷은 어차피 로컬 컷아웃($0)으로 빠짐.
# 마음에 안 들어 다시 시도하는 재추출/이미지 변경만 high($0.25/장)로 올린다.
OPENAI_IMAGE_QUALITY = os.environ.get("OPENAI_IMAGE_QUALITY", "medium")
# gpt-image-2는 medium에서도 글자를 정확히 그리고 high(93초)보다 훨씬 빠르다(39초).
OPENAI_IMAGE_QUALITY_TEXT = os.environ.get("OPENAI_IMAGE_QUALITY_TEXT", "medium")
OPENAI_IMAGE_QUALITY_RETRY = os.environ.get("OPENAI_IMAGE_QUALITY_RETRY", "high")
# 착용컷·스크린샷처럼 배경이 지저분한 소스는 medium이면 질감이 뭉개져 재시도만 유발 → 처음부터 high
OPENAI_IMAGE_QUALITY_HARD = os.environ.get("OPENAI_IMAGE_QUALITY_HARD", "high")
# UX/UI 테스트용 저비용 모드: 켜면 이미지 생성·추천 등 비싼 OpenAI 호출은 폴백.
# 패션 여부 분류(classify_item)는 키가 있으면 그대로 돌려 고양이 등 비패션을 거른다.
# 켜기: .env에 AI_TEST_MODE=1  /  끄기: 지우거나 0
AI_TEST_MODE = os.environ.get("AI_TEST_MODE", "").strip().lower() in ("1", "true", "yes", "on")
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
# 일반 추출은 60초 안에 끝내고, 실제 고난도 케이스만 120초 예산을 준다.
# 에러 코드(상태코드·OpenAI 에러코드·request_id)를 사용자 화면에 붙일지. 라이브(production)에서는
# 감추고 로그·ai_usage_logs에만 남긴다. 로컬·스테이징에서는 그대로 보여 디버깅에 쓴다.
SHOW_ERROR_CODES = os.environ.get("APP_ENV", "dev").strip().lower() not in ("production", "prod", "live")
OPENAI_IMAGE_TIMEOUT = float(os.environ.get("OPENAI_IMAGE_TIMEOUT", "120"))
OPENAI_IMAGE_TIMEOUT_FAST = float(os.environ.get("OPENAI_IMAGE_TIMEOUT_FAST", "60"))
# 분류·로고 감지(비전 채팅)는 평소 2~8초짜리 호출 — 이미지 생성용 130초를 공유하면
# OpenAI가 느린 날 분류에서만 몇 분을 태워 전체 요청이 프론트 제한(210초)을 넘는다.
OPENAI_VISION_TIMEOUT = float(os.environ.get("OPENAI_VISION_TIMEOUT", "25"))
openai_client = (
    OpenAI(api_key=OPENAI_API_KEY, timeout=OPENAI_IMAGE_TIMEOUT, max_retries=0)
    if OPENAI_API_KEY
    else None
)
if AI_TEST_MODE:
    print("=" * 60, flush=True)
    print("[AI_TEST_MODE] ON — 이미지 생성·추천 등 고비용 호출 폴백 (과금 최소)", flush=True)
    print("  패션 여부 분류(classify)는 API 키가 있으면 그대로 실행됩니다.", flush=True)
    print("  끄려면 .env에서 AI_TEST_MODE 삭제/0 후 서버 재시작", flush=True)
    print("=" * 60, flush=True)


def _vision_client():
    """짧은 타임아웃의 분류/감지용 클라이언트. 타임아웃 시 각자 폴백으로 진행."""
    return openai_client.with_options(timeout=OPENAI_VISION_TIMEOUT)

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


# 업로드 진행 단계. (라벨, 시작 %, 끝 %, 이 단계의 평소 소요 초).
# 시작/끝 %는 서버가 확정하고, 그 사이 % 움직임은 프론트가 eta로 보간한다 —
# AI 추출은 내부 진행률을 알 수 없어서, 단계 경계만 사실로 두는 편이 정직하다.
# 구간은 프론트의 send 단계(0~10)에 이어서 빈틈 없이 붙인다. 한 단계의 끝 %가
# 다음 단계의 시작 %보다 크면, 앞 단계가 끝까지 차오른 뒤 다음 이벤트가 오는 순간
# 진행률이 뒤로 간다 (예: send가 10까지 갔는데 fetch가 2에서 시작).
_IMPORT_STEPS: dict[str, tuple[str, int, int, int]] = {
    "fetch": ("상품 페이지를 읽고 있어요", 10, 16, 6),
    "cache": ("전에 본 사진인지 확인하고 있어요", 16, 20, 1),
    "classify": ("어떤 옷인지 알아보고 있어요", 20, 40, 8),
    "upload": ("원본 사진을 보관하고 있어요", 40, 48, 3),
    "cutout": ("배경에서 옷만 오려내고 있어요", 48, 88, 55),
    "polish": ("테두리를 깔끔하게 다듬고 있어요", 88, 95, 2),
    # 이 단계에서 옷장에 확정되는 게 아니다 — 사용자가 확인 화면에서 담기로
    # 결정해야 반영된다. 이미지 변경은 commit=false라 아예 저장하지 않는다.
    "save": ("결과를 정리하고 있어요", 95, 99, 3),
}


def stream_with_keepalive(work) -> StreamingResponse:
    """오래 걸리는 작업(AI 추출 등)을 SSE 스트리밍 응답으로 감싼다.

    Render 프록시는 응답이 시작되지 않은 요청을 ~100초에 끊지만, 스트리밍은
    100분까지 허용한다. 작업이 도는 동안 진행 단계를 흘려 연결을 유지하고
    (`data: {"_step": ...}`), 끝나면 마지막 이벤트로 결과 JSON을 보낸다.
    스트림 시작 후엔 상태코드를 바꿀 수 없으므로 에러는 {"error": ...} 본문으로
    전달한다 (프론트 liveJSON이 던져줌).

    text/event-stream을 쓰는 이유: 이 서비스는 Cloudflare 뒤에 있고, 일반
    content-type + 압축이 걸린 응답은 프록시가 버퍼링해서 단계 이벤트가 작업이
    끝난 뒤 한꺼번에 도착한다(진행률이 0%에서 100%로 점프). SSE는 버퍼링 대상이
    아니고, no-transform으로 압축까지 끄고, 앞에 패딩 코멘트를 흘려 남은 고정
    버퍼도 밀어낸다.

    work가 인자를 하나 받으면 `report(step_key)`를 넘겨준다.
    """
    def gen():
        result: dict[str, Any] = {}
        error: list[str] = []
        steps: deque[str] = deque()
        wants_report = bool(inspect.signature(work).parameters)

        def run() -> None:
            try:
                result["data"] = work(steps.append) if wants_report else work()
            except HTTPException as exc:
                error.append(str(exc.detail))
            except Exception as exc:  # noqa: BLE001
                # 예상 못한 예외도 어떤 종류였는지는 알려준다 — 문구만 보고는
                # 사용자도, 우리도 원인을 좁힐 수 없다(호스팅 로그를 봐야 했다).
                print(f"[stream] work failed: {type(exc).__name__}: {exc}", flush=True)
                detail = f" (코드: {type(exc).__name__})" if SHOW_ERROR_CODES else ""
                error.append(f"처리 중 문제가 생겼어요{detail}. 잠시 후 다시 시도해 주세요.")

        def event(payload: dict[str, Any]) -> str:
            return "data: " + json.dumps(payload, ensure_ascii=False, default=str) + "\n\n"

        def drain() -> Iterator[str]:
            while steps:
                key = steps.popleft()
                spec = _IMPORT_STEPS.get(key)
                if not spec:
                    continue
                label, pct, until, eta = spec
                yield event(
                    {"_step": {"key": key, "label": label, "pct": pct, "until": until, "eta": eta}}
                )

        yield ": " + " " * 2048 + "\n\n"  # 프록시 고정 버퍼 밀어내기
        t = threading.Thread(target=run, daemon=True)
        t.start()
        idle = 0.0
        while t.is_alive():
            t.join(timeout=0.4)
            yield from drain()
            idle += 0.4
            if t.is_alive() and idle >= 10:
                idle = 0.0
                yield ": ping\n\n"  # 단계 변화가 없어도 연결 유지
        yield from drain()
        yield event({"error": error[0]} if error else (result.get("data") or {}))

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
        },
    )


CATEGORY_KO = {
    "top": "상의",
    "bottom": "하의",
    "outer": "아우터",
    "dress": "원피스",
    "skirt": "스커트",
    "shoes": "신발",
    "bag": "가방",
    "hat": "모자",
    "misc": "소품",
}
CATEGORY_EN = {v: k for k, v in CATEGORY_KO.items()}
# 구버전 데이터 호환: 이전엔 가방·모자·소품을 전부 'accessory' 하나로 저장했음.
# CATEGORY_KO에는 안 넣는다 — 넣으면 KO 값이 겹쳐 CATEGORY_EN 역매핑이 애매해짐.
_LEGACY_CATEGORY_KO = {"accessory": "소품"}


def _category_display(category: str | None) -> str:
    cat = category or ""
    return CATEGORY_KO.get(cat) or _LEGACY_CATEGORY_KO.get(cat) or cat or "상의"

# 계절(다중 선택 가능) — 마이페이지 퍼스널컬러의 'autumn' 표기와 맞춤(fall 아님)
SEASON_KO = {
    "spring": "봄",
    "summer": "여름",
    "autumn": "가을",
    "winter": "겨울",
}
VALID_SEASONS = set(SEASON_KO)


def _clean_seasons(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    seen: set[str] = set()
    out: list[str] = []
    for v in value:
        s = str(v or "").strip().lower()
        if s in VALID_SEASONS and s not in seen:
            seen.add(s)
            out.append(s)
    return out


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
        raise HTTPException(status_code=500, detail="서버 설정이 아직 안 됐어요. 잠시 후 다시 시도해 주세요.")


async def current_user(authorization: str | None = Header(default=None)) -> UserContext:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="로그인이 필요해요.")
    token = authorization.split(" ", 1)[1]
    try:
        result = supabase_user.auth.get_user(token)
        user = result.user
    except Exception as exc:
        raise HTTPException(status_code=401, detail="로그인이 만료됐어요. 다시 로그인해 주세요.") from exc
    if not user:
        raise HTTPException(status_code=401, detail="로그인이 만료됐어요. 다시 로그인해 주세요.")
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


# 옷장 그리드는 한 칸이 140~200px인데 지금까지 1024px 원본을 그대로 내려받았다.
# 옷이 늘수록 첫 화면이 느려지는 가장 큰 이유라, 목록용 썸네일을 따로 만들어 둔다.
_THUMB_SIDE = 360
_THUMB_QUALITY = 72


def make_thumb(webp_bytes: bytes) -> bytes | None:
    try:
        img = Image.open(io.BytesIO(webp_bytes)).convert("RGBA")
        img.thumbnail((_THUMB_SIDE, _THUMB_SIDE), Image.LANCZOS)
        out = io.BytesIO()
        img.save(out, format="WEBP", quality=_THUMB_QUALITY, method=4)
        return out.getvalue()
    except Exception as exc:  # noqa: BLE001
        print(f"[thumb] failed: {exc}", flush=True)
        return None


def save_product_image(user_id: str, product_bytes: bytes) -> tuple[str, str]:
    """제품 컷을 WebP로 저장하고 (storage_path, public_url) 반환."""
    data = to_webp(product_bytes)
    path = f"{user_id}/items/{uuid.uuid4().hex}.webp"
    return path, upload_bytes(path, data, "image/webp")


def save_product_image_set(user_id: str, product_bytes: bytes) -> tuple[str, str, str]:
    """제품 컷 + 목록용 썸네일을 함께 저장하고 (storage_path, url, thumb_url) 반환."""
    data = to_webp(product_bytes)
    key = uuid.uuid4().hex
    path = f"{user_id}/items/{key}.webp"
    url = upload_bytes(path, data, "image/webp")
    thumb = make_thumb(data)
    thumb_url = ""
    if thumb:
        try:
            thumb_url = upload_bytes(f"{user_id}/items/{key}_t.webp", thumb, "image/webp")
        except Exception as exc:  # noqa: BLE001
            print(f"[thumb] upload failed: {exc}", flush=True)
    return path, url, thumb_url


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


# ---- 요금제 · 크레딧 ------------------------------------------------------------
# AI를 쓰는 작업마다 실측 원가가 다르다(아래 주석의 값은 이 저장소에서 직접 잰 것).
# 사용자에게는 '크레딧 N개'라는 한 가지 단위로만 보여주고, 무거운 작업일수록 많이 깎는다.
#
#   상품컷 URL 등록      분류 $0.0055 + 로컬 컷아웃 $0        → 1
#   사진 등록            분류 $0.0055 + AI 추출 $0.07~0.25    → 2
#   이미지 다시 만들기    위와 동일                            → 2
#   코디 추천 1회        gpt-4o $0.010 (여러 벌 한 번에)       → 1
#   AI 착장 이미지        이미지 생성 $0.25                    → 5
#
# 크레딧당 원가는 가벼운 작업 $0.006, 무거운 작업 $0.05 수준이다. 요금은 '평균 사용'을
# 기준으로 잡았고(등록은 초반에 몰리고 그 뒤엔 추천 위주), 크레딧 상한이 손실의 뚜껑 역할을 한다.
CREDIT_COSTS = {
    "import_url": 1,
    "import_photo": 2,
    "replace_image": 2,
    "coordinate": 1,
    "model_look": 5,
}
# 크레딧을 받지 않는 작업 중 원가가 있는 것(바로 보기 전신 이미지)은 횟수만 막는다.
# 요금제에 넣으면 '카메라로 대보는 기능이 유료'처럼 보이는데, 실제로 그 기능은 기기에서
# 돌고 API를 부르지 않는다. 정상 사용은 한두 번이면 끝나므로 상한만 두면 충분하다.
MONTHLY_LIMITS = {
    "tryon_body": 5,
}
CREDIT_LABELS = {
    "import_url": "URL·구매내역으로 옷 등록",
    "import_photo": "사진으로 옷 등록",
    "replace_image": "옷 사진 다시 만들기",
    "coordinate": "코디 추천",
    "model_look": "AI 착장 이미지",
}

# 요금제는 둘이면 충분하다. 세 단계로 나눠 봤자 실질 차이는 크레딧 수뿐이라
# 고르는 데 시간만 든다. 기능은 무료에서도 전부 열려 있고, 유일한 차이는
# 'AI가 코디를 입은 모습을 그려주는 것'과 매달 주어지는 크레딧 양이다.
PLANS: dict[str, dict[str, Any]] = {
    "free": {
        "id": "free",
        "name": "무료",
        "price_krw": 0,
        "credits": 60,
        "model_look": False,
        "blurb": "광고 포함 · 지금은 광고가 거의 없어요",
    },
    "pro": {
        "id": "pro",
        "name": "프로",
        "price_krw": 9900,
        "credits": 400,
        "model_look": True,
        "blurb": "넉넉하게 쓰기",
    },
    # 예전에 베이직을 쓰던 계정이 남아 있을 수 있어 정의만 유지한다(목록에는 안 보인다).
    "basic": {
        "id": "basic",
        "name": "베이직",
        "price_krw": 5900,
        "credits": 250,
        "model_look": False,
        "blurb": "",
        "hidden": True,
    },
}
DEFAULT_PLAN = "free"


def plan_perks(plan: dict[str, Any]) -> list[str]:
    """요금제 카드에 쓸 문장. '크레딧 N개'만으로는 얼마인지 감이 안 오니,
    그 크레딧으로 실제로 뭘 몇 번 할 수 있는지로 바꿔 적는다."""
    credits = plan["credits"]
    photos = credits // CREDIT_COSTS["import_photo"]
    links = credits // CREDIT_COSTS["import_url"]
    coords = credits // CREDIT_COSTS["coordinate"]
    perks = [
        f"매달 {credits}크레딧",
        f"사진 {photos}벌 · 링크 {links}벌",
        f"코디 추천 {coords}번",
    ]
    if not plan.get("price_krw"):
        perks.append("광고 포함")
    else:
        perks.append("광고 없음")
    return perks


def _period_key(now: datetime | None = None) -> str:
    """크레딧이 초기화되는 주기(달)."""
    d = now or datetime.now(timezone.utc)
    return f"{d.year:04d}-{d.month:02d}"


def _period_end(period: str) -> str:
    year, month = (int(x) for x in period.split("-"))
    nxt = datetime(year + (month // 12), (month % 12) + 1, 1, tzinfo=timezone.utc)
    return nxt.isoformat()


def _ledger_rows(user_id: str) -> list[dict[str, Any]]:
    try:
        return (
            supabase_admin.table("credit_ledger")
            .select("delta,reason,metadata,created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=False)
            .limit(5000)
            .execute()
            .data
            or []
        )
    except Exception as exc:  # noqa: BLE001
        print(f"[billing] ledger read failed: {exc}", flush=True)
        return []


def _plan_of(rows: list[dict[str, Any]]) -> str:
    plan = DEFAULT_PLAN
    for row in rows:
        if row.get("reason") == "plan":
            candidate = str((row.get("metadata") or {}).get("plan") or "")
            if candidate in PLANS:
                plan = candidate
    return plan


def billing_state(user_id: str) -> dict[str, Any]:
    """이번 달 크레딧 상태. 달이 바뀌면 첫 조회 때 자동으로 새 크레딧을 넣는다."""
    rows = _ledger_rows(user_id)
    plan_id = _plan_of(rows)
    plan = PLANS[plan_id]
    period = _period_key()

    granted = sum(
        int(r.get("delta") or 0)
        for r in rows
        if r.get("reason") == "grant" and (r.get("metadata") or {}).get("period") == period
    )
    if granted <= 0:
        # 이번 달 지급분이 없다 → 지금 넣는다(월초 배치 없이도 정확히 동작한다).
        try:
            supabase_admin.table("credit_ledger").insert({
                "user_id": user_id,
                "delta": plan["credits"],
                "reason": "grant",
                "metadata": {"period": period, "plan": plan_id},
            }).execute()
            granted = plan["credits"]
            rows.append({"delta": plan["credits"], "reason": "grant",
                         "metadata": {"period": period, "plan": plan_id}})
        except Exception as exc:  # noqa: BLE001
            print(f"[billing] grant failed: {exc}", flush=True)
            granted = plan["credits"]

    used_rows = [
        r for r in rows
        if int(r.get("delta") or 0) < 0 and (r.get("metadata") or {}).get("period") == period
    ]  # delta 0(무료 작업)은 사용 내역에 넣지 않는다 — 크레딧을 쓴 것만 보여준다
    used = -sum(int(r.get("delta") or 0) for r in used_rows)
    by_action: dict[str, dict[str, int]] = {}
    for r in used_rows:
        key = r.get("reason") or "etc"
        slot = by_action.setdefault(key, {"count": 0, "credits": 0})
        slot["count"] += 1
        slot["credits"] += -int(r.get("delta") or 0)
    return {
        "plan": plan_id,
        "planName": plan["name"],
        "priceKrw": plan["price_krw"],
        "modelLook": plan["model_look"],
        "granted": granted,
        "used": used,
        "remaining": max(0, granted - used),
        "period": period,
        "resetsAt": _period_end(period),
        "byAction": [
            {"action": k, "label": CREDIT_LABELS.get(k, k), **v}
            for k, v in sorted(by_action.items(), key=lambda kv: -kv[1]["credits"])
        ],
    }


def monthly_count(user_id: str, action: str) -> int:
    """이번 달에 이 작업을 몇 번 했는지(크레딧이 0인 작업도 원장에 기록해 둔다)."""
    period = _period_key()
    return sum(
        1 for r in _ledger_rows(user_id)
        if r.get("reason") == action and (r.get("metadata") or {}).get("period") == period
    )


def ensure_within_limit(user_id: str, action: str) -> None:
    """무료지만 원가가 있는 작업의 월 상한. 넘으면 막는다(어뷰징 차단용)."""
    limit = MONTHLY_LIMITS.get(action, 0)
    if not limit:
        return
    if monthly_count(user_id, action) >= limit:
        raise HTTPException(
            status_code=429,
            detail=(
                f"전신 이미지는 한 달에 {limit}번까지예요. "
                f"{_reset_day(billing_state(user_id))}부터 다시 만들 수 있어요."
            ),
        )


def note_usage(user_id: str, action: str, metadata: dict[str, Any] | None = None) -> None:
    """크레딧이 들지 않는 작업의 사용 기록. 상한 계산에만 쓴다."""
    try:
        supabase_admin.table("credit_ledger").insert({
            "user_id": user_id, "delta": 0, "reason": action,
            "metadata": {**(metadata or {}), "period": _period_key(), "free": True},
        }).execute()
    except Exception as exc:  # noqa: BLE001
        print(f"[billing] note failed ({action}): {exc}", flush=True)


def _reset_day(state: dict[str, Any]) -> str:
    """'9월 1일'처럼 언제 다시 채워지는지. 문구에 날짜가 있어야 기다릴지 결정할 수 있다."""
    try:
        d = datetime.fromisoformat(str(state.get("resetsAt")).replace("Z", "+00:00"))
        return f"{d.month}월 {d.day}일"
    except Exception:  # noqa: BLE001
        return "다음 달"


class CreditError(HTTPException):
    """크레딧이 모자랄 때. 프론트가 요금제 안내를 띄울 수 있게 상태를 함께 들고 다닌다."""

    def __init__(self, action: str, state: dict[str, Any], need: int | None = None):
        need = CREDIT_COSTS.get(action, 1) if need is None else need
        upgrade = "" if state.get("plan") != DEFAULT_PLAN else " 지금 이어서 쓰려면 프로로 바꾸면 돼요."
        super().__init__(
            status_code=402,
            detail=f"이번 달 크레딧을 다 썼어요. {_reset_day(state)}에 다시 채워져요.{upgrade}",
        )
        self.action = action
        self.state = state


def ensure_credits(user_id: str, action: str) -> dict[str, Any]:
    """작업 전에 잔액을 확인한다. 모자라면 402로 막는다(돈이 나가기 전에)."""
    need = CREDIT_COSTS.get(action, 1)
    state = billing_state(user_id)
    if state["remaining"] < need:
        raise CreditError(action, state, need)
    return state


def spend_credits(user_id: str, action: str, metadata: dict[str, Any] | None = None) -> None:
    """성공한 작업만 차감한다. 실패한 요청에까지 돈을 물리지 않는다.

    """
    need = CREDIT_COSTS.get(action, 1)
    if need <= 0:
        return
    try:
        supabase_admin.table("credit_ledger").insert({
            "user_id": user_id,
            "delta": -need,
            "reason": action,
            "metadata": {**(metadata or {}), "period": _period_key()},
        }).execute()
    except Exception as exc:  # noqa: BLE001
        # 기록에 실패해도 사용자 요청은 이미 성공했다. 막지 않는다(수익보다 신뢰).
        print(f"[billing] spend failed ({action}): {exc}", flush=True)


def plan_allows(user_id: str, feature: str) -> bool:
    state = billing_state(user_id)
    return bool(PLANS[state["plan"]].get(feature))


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


# 1M 토큰당 USD. gpt-image-1은 입력 텍스트·입력 이미지·출력 이미지 단가가 다르다.
_AI_PRICES: dict[str, dict[str, float]] = {
    "gpt-image-1": {"text_in": 5.0, "image_in": 10.0, "out": 40.0},
    "gpt-image-2": {"text_in": 5.0, "image_in": 10.0, "out": 40.0},
    "gpt-4o": {"text_in": 2.5, "image_in": 2.5, "out": 10.0},
    "gpt-4o-mini": {"text_in": 0.15, "image_in": 0.15, "out": 0.6},
}


def _usage_dict(usage: Any) -> dict[str, int]:
    """SDK usage 객체에서 토큰 수만 뽑는다. 필드 이름이 API마다 달라 둘 다 본다."""
    if usage is None:
        return {}
    get = (lambda k: getattr(usage, k, None)) if not isinstance(usage, dict) else usage.get
    total_in = get("input_tokens")
    if total_in is None:
        total_in = get("prompt_tokens")
    out = get("output_tokens")
    if out is None:
        out = get("completion_tokens")
    detail = get("input_tokens_details")
    image_in = None
    text_in = None
    if detail is not None:
        dget = (lambda k: getattr(detail, k, None)) if not isinstance(detail, dict) else detail.get
        image_in = dget("image_tokens")
        text_in = dget("text_tokens")
    if image_in is None and text_in is None and total_in is not None:
        text_in = total_in
    return {
        "text_in": int(text_in or 0),
        "image_in": int(image_in or 0),
        "out": int(out or 0),
    }


def _ai_cost_usd(model: str, tokens: dict[str, int]) -> float:
    """토큰 수 × 공개 단가. 모르는 모델은 0 — 추측한 값을 기록하지 않는다."""
    price = _AI_PRICES.get(model)
    if not price or not tokens:
        return 0.0
    return round(
        sum(tokens.get(k, 0) * price[k] for k in ("text_in", "image_in", "out")) / 1_000_000,
        6,
    )


def log_ai_usage(
    user_id: str | None, feature: str, model: str, metadata: dict[str, Any], usage: Any = None
) -> None:
    """AI 호출 1건 기록. usage를 넘기면 실제 토큰 수와 비용까지 함께 남긴다.

    비용을 추산하려면 대시보드에서 호출 수 × 가정 단가를 곱해야 했는데, 이미지
    생성은 입력 이미지 토큰이 원본 크기와 input_fidelity에 따라 크게 달라져서
    추산 오차가 그대로 총액 오차가 됐다. 응답의 usage를 그대로 저장해 둔다.
    """
    payload: dict[str, Any] = dict(metadata)
    if usage is not None:
        tokens = _usage_dict(usage)
        payload["tokens"] = tokens
        payload["cost_usd"] = _ai_cost_usd(model, tokens)
    try:
        supabase_admin.table("ai_usage_logs").insert(
            {"user_id": user_id, "feature": feature, "model": model, "metadata": payload}
        ).execute()
    except Exception as exc:  # noqa: BLE001
        # 기록 실패가 사용자 요청을 깨뜨리면 안 된다.
        print(f"[ai-usage] log failed ({feature}): {exc}", flush=True)


_TIMING_EXTRA_OK = True


def _record_extraction_timing(
    user_id: str | None, source: str, item_count: int, duration_ms: float, details: dict[str, Any] | None = None
) -> None:
    """추출(사진·URL) 소요시간 기록 — 개수별 평균 산출용. 실패해도 요청은 계속."""
    ms = int(duration_ms)
    base = {"user_id": user_id, "source": source, "item_count": int(item_count), "duration_ms": ms}
    extra: dict[str, Any] = {}
    if details:
        extra = {
            "classify_ms": int(details.get("classify_ms") or 0),
            "extract_ms": int(details.get("extract_ms") or 0),
            "cache_hit": bool(details.get("cache_hit")),
            "policy": details.get("policy") or {},
        }
    # 확장 컬럼은 schema.sql에는 있지만 라이브 DB에 적용되지 않은 환경이 있다. 그 경우
    # insert가 통째로 실패해 소요시간이 아예 안 남았다. 한 번 실패하면 기본 컬럼만으로
    # 다시 넣고, 이후 호출은 시도하지 않는다 (마이그레이션 후엔 자동으로 다시 붙는다).
    global _TIMING_EXTRA_OK
    for payload in ([{**base, **extra}] if (extra and _TIMING_EXTRA_OK) else []) + [base]:
        try:
            supabase_admin.table("extraction_timings").insert(payload).execute()
            return
        except Exception as exc:  # noqa: BLE001
            if payload is base:
                print(f"[timing] record failed: {exc}", flush=True)
            else:
                _TIMING_EXTRA_OK = False
                print(f"[timing] 확장 컬럼 없음 → 기본 컬럼만 기록 ({exc})", flush=True)
    print(f"[timing] source={source} items={item_count} duration_ms={ms} ({ms / 1000:.1f}s)", flush=True)


def _record_recommendation_timing(user_id: str | None, pool_size: int, combo_count: int, duration_ms: float) -> None:
    """코디 추천(live_coordinate) 소요시간 기록 — 옷장 크기별 평균 산출용. 실패해도 요청은 계속."""
    ms = int(duration_ms)
    try:
        supabase_admin.table("recommendation_timings").insert(
            {"user_id": user_id, "pool_size": int(pool_size), "combo_count": int(combo_count), "duration_ms": ms}
        ).execute()
    except Exception as exc:  # noqa: BLE001
        print(f"[timing] recommend record failed: {exc}", flush=True)
    print(
        f"[timing] recommend pool={pool_size} combos={combo_count} duration_ms={ms} ({ms / 1000:.1f}s)",
        flush=True,
    )


# 코디를 짤 때만 쓰는 숨은 속성. 사용자 화면에는 안 나오고, 추천 프롬프트와
# 규칙 기반 페어링(fallback)에서 쓴다. 이름에 '카고'가 없어도 카고면 카고로 다룬다.
_STYLE_IDS = (
    "dandy", "minimal", "casual", "office", "street", "chic", "sporty",
    "classic", "amekaji", "gorpcore", "hiphop", "y2k", "preppy",
)
_FITS = ("slim", "regular", "relaxed", "oversized", "wide", "crop", "skinny")
_PATTERNS = ("solid", "stripe", "check", "floral", "graphic", "logo", "camo", "dot", "other")
_MATERIALS = (
    "cotton", "denim", "linen", "wool", "knit", "leather", "nylon", "corduroy", "fleece", "blend",
)


def _pick(value: Any, allowed: tuple[str, ...]) -> str:
    v = str(value or "").strip().lower()
    return v if v in allowed else ""


def _clean_style_attrs(raw: Any) -> dict[str, Any]:
    """모델이 준 style 블록을 정해진 값으로만 남긴다. 없는 값은 비워 둔다."""
    if not isinstance(raw, dict):
        return {}
    out: dict[str, Any] = {}
    subtype = str(raw.get("subtype") or "").strip()[:30]
    if subtype:
        out["subtype"] = subtype
    for key, allowed in (("fit", _FITS), ("pattern", _PATTERNS), ("material", _MATERIALS)):
        picked = _pick(raw.get(key), allowed)
        if picked:
            out[key] = picked
    for key, allowed in (
        ("tone", ("warm", "cool", "neutral")),
        ("depth", ("light", "mid", "deep")),
        ("chroma", ("vivid", "muted")),
    ):
        picked = _pick(raw.get(key), allowed)
        if picked:
            out[key] = picked
    try:
        formality = int(raw.get("formality"))
        if 1 <= formality <= 5:
            out["formality"] = formality
    except (TypeError, ValueError):
        pass
    styles = [_pick(s, _STYLE_IDS) for s in (raw.get("styles") or [])]
    styles = [s for s in styles if s][:3]
    if styles:
        out["styles"] = styles
    details = [str(d).strip()[:24] for d in (raw.get("details") or []) if str(d).strip()]
    if details:
        out["details"] = details[:3]
    return out


def classify_item(path: str, extract_hint: str = "", user_id: str | None = None) -> dict[str, Any]:
    fallback = {
        "name": "새로 추가한 옷",
        "category": "top",
        "color": "neutral",
        "tags": [],
        "has_text_logo": False,
        "logo_text": "",
        "seasons": [],
        "other_items": [],
        # AI 없을 때만 통과. 테스트 모드라도 키가 있으면 아래에서 Vision으로 패션 여부를 본다.
        "is_fashion_item": True,
        "reject_code": "",
        "shot": "product",
        "angle": "front",
        "front_ok": True,
        "style": {},
    }
    # 컷아웃·이미지 생성은 AI_TEST_MODE에서 막지만, 패션 거절은 값싼 분류만으로도
    # 가능해야 한다. (바로 보기는 클라 FaceDetector로 거르고, 옷장은 여기가 게이트)
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
  "is_fashion_item": true,
  "reject_code": "",
  "name": "한국어 이름",
  "category": "top|bottom|skirt|outer|dress|shoes|bag|hat|misc",
  "color": "대표 색상",
  "tags": ["키워드"],
  "has_text_logo": false,
  "logo_text": "",
  "seasons": ["spring|summer|autumn|winter 중 해당하는 것만, 1~2개"],
  "other_items": ["주 아이템 외에 함께 보이는 착용 아이템의 짧은 한국어 이름"],
  "shot": "product|worn|detail",
  "angle": "front|side|back|unclear",
  "front_ok": true,
  "style": {
    "subtype": "카고 팬츠 · 옥스퍼드 셔츠처럼 옷의 성격을 드러내는 짧은 종류명",
    "fit": "slim|regular|relaxed|oversized|wide|crop|skinny 중 하나",
    "pattern": "solid|stripe|check|floral|graphic|logo|camo|dot|other 중 하나",
    "material": "cotton|denim|linen|wool|knit|leather|nylon|corduroy|fleece|blend 중 하나",
    "tone": "warm|cool|neutral (원단 색의 웜/쿨)",
    "depth": "light|mid|deep (명도)",
    "chroma": "vivid|muted (채도)",
    "formality": 1,
    "styles": ["dandy|minimal|casual|office|street|chic|sporty|classic|amekaji|gorpcore|hiphop|y2k|preppy 중 이 옷이 실제로 잘 어울리는 무드만 1~3개"],
    "details": ["카고 포켓·와이드 실루엣처럼 코디에 영향을 주는 특징 0~3개"]
  }
}
패션 여부(최우선):
- is_fashion_item true: 상의·하의·원피스·아우터·신발·가방·모자·잡화 등 착용/소지 가능한 패션 아이템이 주 피사체.
  동물·캐릭터 프린트/자수가 옷·가방 등에 있어도 true (예: 고양이 그림 티셔츠).
- is_fashion_item false: 살아 있는 동물, 동물 콜라주/스티커/무드보드, 풍경, 음식, 밈/스크린샷,
  옷 상품컷이 아닌 셀카, 가구·전자기기, 텍스트·낙서가 많은 그래픽 등.
  애매하면 false. 옷이 분명히 주 피사체일 때만 true.
- reject_code: is_fashion_item이 false일 때만 "not_fashion" 또는 "unclear". true면 "".
  not_fashion = 패션이 아님. unclear = 아이템이 너무 작거나 가려져 무엇인지 알기 어려움.
규칙:
- 여러 아이템이 함께 보이면(착용컷 등) '주 아이템' 하나를 기준으로 name/category/color를 정한다.
  주 아이템 = 사진에서 차지하는 면적이 가장 크고 프레이밍의 중심인 것.
  예: 상반신이 프레임에서 잘리고 바지가 화면 대부분이면 주 아이템은 바지 (신발·상의가 아님).
- other_items: 주 아이템 외에 부분적으로라도 보이는 착용 아이템 전부 (예: ["화이트 셔츠", "블랙 부츠"]). 없으면 [].
- color: 패션 음차만 사용 (블랙, 화이트, 그레이, 네이비, 블루, 베이지…). 검정/회색/흰색/남색 같은 일상어·영어(Black) 금지.
- category: 치마·스커트류는 반드시 skirt(하의 bottom과 구분). 원피스·드레스는 dress.
  가방(백팩·크로스백·클러치 등)은 반드시 bag. 모자(캡·버킷햇·비니 등)는 반드시 hat.
  벨트·시계·주얼리·스카프·장갑·양말·선글라스 등 나머지 소품은 misc.
  신발·슬리퍼·쪼리·스니커·샌들이면 반드시 shoes.
- 신발이 한 쌍으로 찍혀 있어도 아이템은 1개(신발 카테고리)로 본다. name에는 '슬리퍼'처럼 제품명만.
- has_text_logo: 가슴·등·소매 등 원단 겉면에 읽을 수 있는 브랜드명·슬로건(글자 3자 이상)이 크게 인쇄·자수된 경우만 true.
  false로 둘 것: 안쪽 목·허리의 브랜드 라벨/택, 작은 모노그램/이니셜 1~2자, 케어라벨·사이즈택, 추상 마크(글자 없음), 가격표·워터마크·UI, 애매하면 false.
- logo_text: has_text_logo가 true일 때만 원문 철자 (예: "IAB STUDIO"). 아니면 "".
- seasons: 원단 두께·소재·기장·보온성으로 판단. 반팔/린넨/메시 → summer. 니트/코듀로이/기모 → winter.
  얇은 셔츠·가디건처럼 여러 계절에 걸치면 2개까지. 판단하기 애매하면 빈 배열 [].
- is_fashion_item이 false여도 JSON 형식은 유지하되 name은 짧은 설명(예: "고양이 사진"), category는 misc.
촬영 형태(옷장 카드를 정면 상품컷으로 통일하는 데 쓰인다):
- shot: product = 사람 없이 옷만 있는 상품컷·플랫레이. worn = 사람이 입거나 들고 있음(마네킹 포함).
  detail = 원단·디테일 부분 확대라 아이템 전체 형태가 안 보임.
- angle: 주 아이템을 보는 방향. 조금이라도 틀어져 있으면 front가 아니다.
  front = 앞판 전체가 정면으로 보이고 좌우가 거의 대칭. 바지면 두 가랑이가 나란히 벌어져 보이고
    양쪽 다리 폭이 비슷하다. 상의면 양 소매가 좌우로 다 보이고 앞단추·지퍼 라인이 화면 중앙에 수직.
  side = 측면이거나 3/4 사선. 다음 중 하나라도 해당하면 side다:
    · 바지: 두 다리가 겹쳐 보이거나 한쪽 다리만 보인다 / 옆선(사이드 심)이 실루엣 윤곽으로 보인다
      / 허리 앞단추가 중앙이 아니라 한쪽으로 치우쳐 있다 / 밑단이 사선으로 어긋나 있다
    · 상의: 한쪽 어깨·소매만 보인다 / 앞단추 라인이 중앙에서 벗어나 기울어 있다 / 옆구리 실루엣이 보인다
    · 신발: 옆모습(프로파일)만 보인다
  back = 뒷면(등판·뒤포켓 위주). unclear = 접혀 있거나 가려져 방향 판단 불가.
- front_ok: 이 사진만 보고 '정면에서 본 이 아이템의 상품컷'을 그려낼 수 있는지.
  true: 아이템 전체 실루엣과 색·패턴·주요 디테일이 충분히 보인다 (측면·착장이어도 형태가 파악되면 true).
  false: 심하게 가려짐·잘림, 너무 어둡거나 흐림, 부분 확대뿐, 겹쳐 접혀 형태 불명 — 정면 모습을 지어내야 하는 수준.
스타일 속성(style) — 사용자에게 보이지 않고 코디를 짤 때만 쓰는 값이다. 이름에 안 적혀 있어도 이미지로 판단해서 채운다:
- subtype: 이름이 '팬츠'뿐이어도 카고 포켓이 보이면 "카고 팬츠", 주름·센터프레스면 "슬랙스"처럼 성격을 적는다.
- fit: 실루엣 기준. 통이 넓으면 wide, 품이 크면 oversized, 기장이 짧으면 crop.
- formality: 1~5 정수. 1 = 운동복·트레이닝, 2 = 데일리 캐주얼, 3 = 스마트 캐주얼, 4 = 오피스, 5 = 정장·예식.
- tone/depth/chroma: 퍼스널 컬러 매칭에 쓴다. 아이보리·카멜·올리브는 warm, 애쉬·네이비·버건디는 cool, 블랙·화이트·그레이는 neutral.
- styles: 그 옷이 실제로 어울리는 무드만. 애매하면 1개만.
- details: 코디 판단에 영향을 주는 것만 (예: "카고 포켓", "크롭 기장", "광택 소재"). 없으면 [].
"""
    try:
        response = _vision_client().chat.completions.create(
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
        log_ai_usage(
            user_id, "classify", OPENAI_CLASSIFY_MODEL, {"hint": bool(extract_hint)},
            usage=getattr(response, "usage", None),
        )
        data = json.loads(response.choices[0].message.content or "{}")
        if data.get("category") not in CATEGORY_KO:
            data["category"] = fallback["category"]
        data["logo_text"] = str(data.get("logo_text") or "").strip()[:80]
        data["has_text_logo"] = _significant_garment_logo(
            bool(data.get("has_text_logo")), data["logo_text"]
        )
        if not data["has_text_logo"]:
            data["logo_text"] = ""
        data["seasons"] = _clean_seasons(data.get("seasons"))
        shot = str(data.get("shot") or "").strip().lower()
        data["shot"] = shot if shot in ("product", "worn", "detail") else "product"
        angle = str(data.get("angle") or "").strip().lower()
        data["angle"] = angle if angle in ("front", "side", "back", "unclear") else "front"
        raw_front = data.get("front_ok", True)
        data["front_ok"] = (
            raw_front.strip().lower() in ("1", "true", "yes", "y")
            if isinstance(raw_front, str) else bool(raw_front)
        )
        data["style"] = _clean_style_attrs(data.get("style"))
        raw_others = data.get("other_items") if isinstance(data.get("other_items"), list) else []
        data["other_items"] = [str(o).strip()[:40] for o in raw_others if str(o).strip()][:6]
        raw_fashion = data.get("is_fashion_item", True)
        if isinstance(raw_fashion, str):
            data["is_fashion_item"] = raw_fashion.strip().lower() in ("1", "true", "yes", "y")
        else:
            data["is_fashion_item"] = bool(raw_fashion)
        code = str(data.get("reject_code") or "").strip()
        if data["is_fashion_item"]:
            data["reject_code"] = ""
        elif code not in ("not_fashion", "unclear"):
            data["reject_code"] = "not_fashion"
        else:
            data["reject_code"] = code
        return {**fallback, **data}
    except Exception:
        return fallback


_FASHION_REJECT_MSG = {
    "not_fashion": "옷이 잘 보이는 사진으로 올려 주세요.",
    "unclear": "어떤 옷인지 알아보기 어려워요. 옷이 크게 나온 사진으로 다시 올려 주세요.",
    "no_front": "옷 앞모습이 잘 보이는 사진으로 올려 주세요. 지금 사진은 가려지거나 일부만 보여요.",
}


def require_fashion_item(meta: dict[str, Any]) -> None:
    """컷아웃 전에 거절할 이미지를 걸러낸다. 사용자 문구는 서버 고정.

    비패션 외에, '정면 상품컷을 만들 수 없는 원본'도 여기서 막는다. 이미지 생성은
    한 장에 수십 초와 실제 비용이 들기 때문에, 앞모습을 지어내야 하는 수준의
    사진이면 값싼 분류 단계에서 되돌리는 편이 낫다.
    """
    if not meta.get("is_fashion_item", True):
        code = str(meta.get("reject_code") or "not_fashion")
        raise HTTPException(
            status_code=422,
            detail=_FASHION_REJECT_MSG.get(code) or _FASHION_REJECT_MSG["not_fashion"],
        )
    if not meta.get("front_ok", True):
        raise HTTPException(status_code=422, detail=_FASHION_REJECT_MSG["no_front"])


def _significant_garment_logo(has_text_logo: bool, logo_text: str) -> bool:
    """gpt-image-2가 필요한 실질 텍스트 로고만 통과. 애매·미세 텍스트는 제외."""
    if not has_text_logo:
        return False
    chars = re.sub(r"[^A-Za-z0-9가-힣]", "", logo_text or "")
    return len(chars) >= 3


def detect_garment_text(path: str, user_id: str | None = None) -> dict[str, Any]:
    """옷 표면 인쇄/자수 텍스트·로고만 감지 (분류 메타에 없을 때 재추출·교체용)."""
    empty = {"has_text_logo": False, "logo_text": ""}
    if not openai_client or AI_TEST_MODE:
        return empty
    prompt = """이 이미지의 주요 옷에 '읽을 수 있는 브랜드명·슬로건'이 크게 인쇄/자수되어 있는지 보세요.
true 조건: 가슴·등·소매 등 원단 겉면에 눈에 띄는 글자 3자 이상 (예: IAB STUDIO, NIKE).
false 조건: 안쪽 목·허리 브랜드 라벨/택, 작은 이니셜, 케어라벨, 사이즈택, 글자 없는 마크, 가격표/워터마크/UI, 애매함.
JSON만 응답:
{"has_text_logo": false, "logo_text": ""}
logo_text는 true일 때만 원문 철자, 아니면 "".
"""
    try:
        response = _vision_client().chat.completions.create(
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
        log_ai_usage(
            user_id, "detect_text", OPENAI_CLASSIFY_MODEL, {},
            usage=getattr(response, "usage", None),
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
_RIM_DEPTH = 7  # 스튜디오 컷 경계 띠를 연속 알파로 되찾는 최대 깊이(px)
_ALPHA_RAMP = 110  # 알파 재임계 램프 폭 — 좁으면 계단이 남고, 넓으면 테두리가 번진다
_BLEED_DEPTH = 8  # 리샘플 보간 커널이 닿는 범위를 덮을 만큼 원단 색을 투명 쪽으로 번지게
_BG_NORM_VERSION = "cutout_v11"  # v11: 레터박스 트리밍 + 불투명 결과도 스튜디오 컷아웃
_EXTRACTION_PROFILE = "extract_v13"  # v13: 상품컷은 누끼만, 글자 재생성은 gpt-image-2

# 추출 컷 정규화 캔버스: 경로·모델마다 여백이 제각각이라 카드 크기가 들쭉날쭉해지는 것 방지.
# 값 = 정사각 캔버스에서 아이템의 긴 변이 차지하는 비율 (같은 카테고리 = 같은 체감 크기)
#
# 주의: 이 값은 옷장 카드가 꽉 차 보이게 맞춘 것이라 실제 옷 크기와는 무관하다
# (그래서 셔츠와 청바지가 캔버스에서 같은 높이로 그려진다). 코디 합성은
# frontend/src/proto/05-screens-cde.jsx의 LOOK_SLOT에서 이 비율을 되돌린 뒤
# 실제 크기로 다시 잡는다. 여기를 고치면 저쪽 size도 같이 맞춰야 한다.
_CANVAS_SIZE = 1024
_CATEGORY_FILL = {
    "top": 0.90,
    "outer": 0.90,
    "dress": 0.9,
    "bottom": 0.9,
    "skirt": 0.8,
    "shoes": 0.62,
    "bag": 0.74,
    "hat": 0.56,
    "misc": 0.66,
    "accessory": 0.66,  # 레거시 키
}


def normalize_product_canvas(png_bytes: bytes, category: str | None) -> bytes:
    """추출 컷을 알파 bbox로 트리밍한 뒤 카테고리 비율로 정사각 캔버스에 중앙 배치.

    AI가 작게 그려준 컷은 확대(LANCZOS)까지 해서 채우므로, 어떤 추출 경로를
    타든 같은 카테고리는 옷장 카드·코디 합성에서 같은 크기로 보인다.
    """
    try:
        img = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
        # AI 투명 PNG의 가장자리 알파 노이즈/그림자는 본체 크기에 포함하지 않는다.
        # 같은 셔츠가 경로마다 작아지는 문제를 막기 위해 보이는 본체(알파≥64)만 쓴다.
        bbox = img.getchannel("A").point(lambda a: 255 if a >= 64 else 0).getbbox()
        if bbox:
            pad = 8  # 아래 bleed가 살아남도록 여백을 두고 자른다
            img = img.crop((
                max(0, bbox[0] - pad), max(0, bbox[1] - pad),
                min(img.width, bbox[2] + pad), min(img.height, bbox[3] + pad),
            ))
        # 리샘플 전에 투명 영역 RGB를 원단 색으로 채운다 — 안 하면 LANCZOS가
        # 알파를 무시하고 RGB를 섞어 실루엣 주변에 테두리를 만든다.
        _bleed_edge_colors(img, _BLEED_DEPTH)
        fill = _CATEGORY_FILL.get((category or "").strip(), 0.8)
        target = int(_CANVAS_SIZE * fill)
        w, h = img.size
        scale = target / max(w, h)
        nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
        img = img.resize((nw, nh), Image.LANCZOS)
        canvas = Image.new("RGBA", (_CANVAS_SIZE, _CANVAS_SIZE), (0, 0, 0, 0))
        # 마스크를 주면 안 된다: PIL의 masked paste는 RGB와 알파를 캔버스(투명 검정)와
        # 섞어서, 반투명 가장자리 RGB를 검정 쪽으로 끌어내리고 알파는 a²/255로 만든다.
        # 빈 캔버스의 겹치지 않는 자리에 넣는 것이므로 RGBA를 그대로 복사하면 된다.
        canvas.paste(img, ((_CANVAS_SIZE - nw) // 2, (_CANVAS_SIZE - nh) // 2))
        buf = io.BytesIO()
        canvas.save(buf, format="PNG")
        return buf.getvalue()
    except Exception:
        return png_bytes


def make_transparent_cutout(png_bytes: bytes, *, aggressive: bool = False) -> bytes:
    """가장자리에서 이어진 순백·연회색 스튜디오 배경을 투명으로 바꿔 옷만 남김.

    gpt-image-2 등이 불투명 흰 판을 남기는 경우가 있어, aggressive=True면 임계를 더 낮춤.

    흰/오프화이트 옷은 원단 밝기가 배경과 거의 같아서(픽셀 값이 실제로 겹침) 색상만으로는
    옷과 배경을 구분할 방법이 없다 — 그대로 두면 플러드필이 가장자리에서 옷 안쪽까지 그대로
    뚫고 들어가 옷을 거의 다 지워버린다. 그래서 가장자리 기준 진입 깊이(BFS hop)에
    상한(max_depth)을 둬서, 실제 스튜디오 배경 여백보다는 넓지만 옷 내부까지는 못 뚫도록
    막는다. 그 상한 경계에서 생기는 계단(zigzag) 모양은 알파 채널에 약한 미디언 필터로 다듬는다.
    """
    img = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    w, h = img.size
    if w < 2 or h < 2:
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()
    px = img.load()
    visited = [[False] * w for _ in range(h)]
    q: deque[tuple[int, int, int]] = deque()
    white_floor = 235 if aggressive else 242
    gray_floor = 200 if aggressive else 218
    chroma_max = 18 if aggressive else 14
    # 가장자리에서 이 깊이(픽셀 hop)보다 더 들어가면 배경이 아니라 옷 내부로 본다.
    max_depth = int(min(w, h) * (0.34 if aggressive else 0.30))

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
            q.append((x, y, 0))
    while q:
        x, y, depth = q.popleft()
        r, g, b, _a = px[x, y]
        px[x, y] = (r, g, b, 0)
        if depth >= max_depth:
            continue
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not visited[ny][nx] and is_plate(nx, ny):
                visited[ny][nx] = True
                q.append((nx, ny, depth + 1))
    # max_depth 경계에서 생기는 계단 모양을 완화 (실제 옷 윤곽선은 거의 안 건드림)
    img.putalpha(img.getchannel("A").filter(ImageFilter.MedianFilter(size=7)))
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


# 알파 스무딩 반경(px, 1024~1536 기준). 의류는 2~4px 구조가 없어 넉넉히 뭉갤 수
# 있지만, 시계 브레이슬릿 링크 틈·안경 다리·샌들 스트랩처럼 얇은 구조는 그 반경에
# 지워진다. 그래서 얇은 디테일이 몰려 있는 카테고리는 약하게만 건다.
_ALPHA_SMOOTH_STRONG = frozenset({"top", "outer", "dress", "bottom", "skirt"})
# 가방·신발·모자는 옷보다 윤곽이 작고 곡선이 많아 계단이 더 눈에 띈다. 옷만큼 뭉개면
# 버클·끈 같은 얇은 디테일이 뭉치므로 중간 세기로 둔다.
_ALPHA_SMOOTH_MID = frozenset({"shoes", "bag", "hat", "misc", "accessory"})


def _polish_cutout_alpha(png_bytes: bytes, category: str | None = None) -> bytes:
    """컷아웃 알파의 계단을 다듬고 반투명 테두리의 배경색 오염을 없앤다.

    OpenAI가 background="transparent"로 준 알파는 사실상 이진이다(실측: 반투명
    픽셀 0.5%, a=11에서 a=241로 한 픽셀에 점프). 안티에일리어싱이 없는데다 윤곽
    자체가 여러 픽셀짜리 계단으로 그려져서, 옷장 카드나 확대 보기에서 실루엣이
    블록처럼 깨져 보인다. 게다가 그 경계 픽셀은 배경 회색을 그대로 물고 있다.

    계단은 1픽셀짜리가 아니라 서브픽셀 블러나 미디언으로는 안 없어진다. 알파를
    한 번 뭉갠 뒤(GaussianBlur) 128 근처에서 완만한 램프로 다시 세우면
    (soft re-threshold) 블러 반경보다 작은 계단은 사라지고 실루엣과 bbox는 그대로
    남으면서 1~2px 안티에일리어싱이 생긴다. 새로 반투명이 된 픽셀의 색은 안쪽
    불투명 색을 퍼뜨려 덮는다 — 원단 픽셀 자체는 건드리지 않는다.
    """
    try:
        img = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    except Exception:
        return png_bytes
    alpha = img.getchannel("A")
    if not alpha.getbbox():
        return png_bytes
    w, h = img.size
    cat = (category or "").strip()
    ceiling = 2.4 if cat in _ALPHA_SMOOTH_STRONG else (1.6 if cat in _ALPHA_SMOOTH_MID else 1.0)
    radius = max(1.0, min(ceiling, min(w, h) / 450.0))
    lo, hi = 128 - _ALPHA_RAMP // 2, 128 + _ALPHA_RAMP // 2
    alpha = alpha.filter(ImageFilter.GaussianBlur(radius)).point(
        lambda v: 0 if v <= lo else (255 if v >= hi else int((v - lo) * 255 / (hi - lo)))
    )
    img.putalpha(alpha)
    rim_mask = alpha.point(lambda v: 255 if 0 < v < 250 else 0).tobytes()
    rim = [(i % w, i // w) for i, v in enumerate(rim_mask) if v]
    if rim:
        _repair_rim_colors(img.load(), rim, w, h)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def finalize_cutout(
    png_bytes: bytes,
    *,
    already_transparent: bool = False,
    protect_light_garment: bool = False,
    category: str | None = None,
) -> bytes:
    """1차 컷아웃 후 가장자리에 흰 판이 남으면 더 강하게 한 번 더.

    already_transparent=True는 OpenAI images.edit에 background="transparent"로
    요청해 AI가 이미 알파를 만든 결과라는 뜻. 우리 쪽 색상 기반 플러드필은 흰/
    오프화이트 원단을 배경으로 오인해 옷 자체를 지워버릴 수 있어서(원단과 배경
    밝기가 겹쳐 색으로는 구분이 안 되는 경우), AI가 만든 가장자리가 이미
    깨끗하면 우리가 다시 손대지 않고 그대로 믿는다. gpt-image-2 등이 가끔
    남기는 불투명 판이 실제로 있을 때만(에지에 판이 남아 있을 때만) 복구한다.
    """
    if already_transparent and (protect_light_garment or _edge_plate_ratio(png_bytes) < 0.12):
        print("[cutout] already clean (AI transparent bg) — skip flood-fill repair", flush=True)
        # 플러드필은 건너뛰더라도 알파 경계는 다듬는다 — AI 알파는 이진이라
        # 그대로 두면 확대 단계에서 계단이 그대로 커진다.
        return _polish_cutout_alpha(png_bytes, category)
    # 불투명 결과(예: 투명 배경을 지원하지 않는 모델)는 스튜디오 컷아웃을 먼저 쓴다.
    # 생성된 배경은 균일한 판이라 이 경로가 잘 맞고, 갇힌 배경(밑단 그림자 등)도 지운다.
    try:
        studio = _studio_cutout_from_image(
            _trim_letterbox(Image.open(io.BytesIO(png_bytes)).convert("RGBA")),
            # 밝은 원단은 판과 구분이 안 돼 넓히면 옷이 지워진다. 그 외에는 AI가 깔아 둔
            # 옅은 그림자까지 배경으로 본다.
            tol_boost=0 if protect_light_garment else 16,
        )
    except Exception:  # noqa: BLE001
        studio = None
    if studio:
        print("[cutout] opaque result → studio cutout", flush=True)
        return studio
    out = make_transparent_cutout(png_bytes, aggressive=False)
    if _edge_plate_ratio(out) >= 0.12:
        out = make_transparent_cutout(out, aggressive=True)
    return _polish_cutout_alpha(out, category)


def local_product_cutout(path: str, category: str | None = None) -> bytes | None:
    """AI 추출 실패 시에도 원본 스튜디오 배경을 걷어 카드 톤을 맞춤."""
    try:
        return finalize_cutout(read_image_as_png_bytes(path), category=category)
    except Exception:
        return None


def _line_stats(rgb: Image.Image, index: int, horizontal: bool) -> tuple[tuple[int, int, int], int]:
    """한 줄(행 또는 열)의 대표색과 색 퍼짐 폭."""
    w, h = rgb.size
    box = (0, index, w, index + 1) if horizontal else (index, 0, index + 1, h)
    line = rgb.crop(box)
    ext = line.getextrema()
    mid = tuple((lo + hi) // 2 for lo, hi in ext)
    spread = max(hi - lo for lo, hi in ext)
    return mid, spread  # type: ignore[return-value]


def _trim_letterbox(img: Image.Image) -> Image.Image:
    """사진 가장자리에 붙은 균일한 띠(검은 레터박스·색 패딩)를 잘라낸다.

    쇼핑몰 상품컷을 그대로 저장하면 위아래에 검은 띠가 붙어 있는 경우가 많다.
    그 띠 때문에 '테두리가 균일한 스튜디오 판인가' 판정이 실패해서, 배경만 지우면
    되는 상품컷이 AI 재생성 경로로 넘어갔다. 로고·글자가 있는 옷일수록 손해가 크다
    (다시 그리면 글자가 바뀔 수 있다). 띠만 걷어내고 판정을 다시 받게 한다.
    """
    rgb = img.convert("RGB")
    w, h = rgb.size
    if w < 32 or h < 32:
        return img

    def scan(horizontal: bool, from_end: bool) -> int:
        total = h if horizontal else w
        first = total - 1 if from_end else 0
        edge_color, edge_spread = _line_stats(rgb, first, horizontal)
        if edge_spread > 8:
            return 0                                  # 가장자리가 이미 균일하지 않다
        limit = int(total * 0.4)
        step = -1 if from_end else 1
        k = 0
        idx = first
        while 0 <= idx < total and k < limit:
            color, spread = _line_stats(rgb, idx, horizontal)
            if spread > 8 or max(abs(color[c] - edge_color[c]) for c in range(3)) > 8:
                break
            k += 1
            idx += step
        if k == 0 or k >= limit:
            return 0                                  # 전체가 같은 판이면 띠가 아니다
        if not (0 <= idx < total):
            return 0
        inner, inner_spread = _line_stats(rgb, idx, horizontal)
        # 띠가 끝난 자리도 균일해야 진짜 레터박스다. 단색 판 위에 옷이 놓인 사진은
        # 이 자리에서 옷이 걸려 색이 섞이므로(퍼짐 큼) 자르지 않는다 — 판 여백을
        # 잘라내면 테두리 판정이 옷에 걸려 오히려 스튜디오 경로를 잃는다.
        if inner_spread > 8:
            return 0
        if max(abs(inner[c] - edge_color[c]) for c in range(3)) <= 24:
            return 0                                  # 안쪽과 색이 비슷하면 띠가 아니다
        return k

    top = scan(True, False)
    bottom = scan(True, True)
    left = scan(False, False)
    right = scan(False, True)
    if not (top or bottom or left or right):
        return img
    box = (left, top, w - right, h - bottom)
    if box[2] - box[0] < w * 0.4 or box[3] - box[1] < h * 0.4:
        return img
    print(f"[cutout] letterbox trimmed t={top} b={bottom} l={left} r={right}", flush=True)
    return img.crop(box)


def _open_source_image(path: str) -> Image.Image:
    """컷아웃·판정용으로 원본을 열고 레터박스 띠를 걷어낸다."""
    return _trim_letterbox(Image.open(io.BytesIO(read_image_as_png_bytes(path))).convert("RGBA"))


def _border_bg_stats(img: Image.Image) -> tuple[bool, tuple[int, int, int], float]:
    """테두리 픽셀 분석: (스튜디오 판으로 볼 수 있는지, 대표 배경색, 국소 편차 p90).

    예전 판정은 테두리 샘플의 97%가 중앙값 ±10 안에 들 것을 요구했다. 실제
    상품 촬영본은 거의 항상 옅은 비네팅이나 위아래 그라데이션이 있어서 이 조건에
    걸려 탈락했고, 그러면 AI 재생성 경로로 넘어가 원단 잔주름·질감이 뭉개진
    그림이 나왔다. 스튜디오 판에서 중요한 건 '완전히 균일한가'가 아니라
    '매끄러운가' — 옆 샘플과의 차이가 작으면 그라데이션이 있어도 판이다.
    """
    rgb = img.convert("RGB")
    w, h = rgb.size
    px = rgb.load()
    samples: list[tuple[int, int, int]] = []
    step = max(1, min(w, h) // 80)
    for x in range(0, w, step):
        samples.append(px[x, 0])
        samples.append(px[x, h - 1])
    for y in range(0, h, step):
        samples.append(px[0, y])
        samples.append(px[w - 1, y])
    n = len(samples)
    med = tuple(sorted(s[i] for s in samples)[n // 2] for i in range(3))
    # 국소 편차: 인접 샘플 간 변화량. 그라데이션은 통과, 옷·소품이 테두리에
    # 걸쳐 있으면 큰 점프가 생겨 탈락한다.
    steps = sorted(
        max(abs(samples[i][c] - samples[i - 1][c]) for c in range(3)) for i in range(1, n)
    )
    local = float(steps[int((n - 1) * 0.9)])
    smooth = local <= 8 and steps[-1] <= 42
    # 밝은 판만 대상 (어두운 배경은 옷과 구분이 어려워 AI 경로 유지)
    bright = min(med) >= 216 and (max(med) - min(med)) <= 20
    return (smooth and bright), med, local


def _estimate_plate(rgb: Image.Image) -> Image.Image:
    """테두리 픽셀만으로 스튜디오 판의 밝기 분포를 추정한다.

    상품 촬영본의 배경은 완전한 단색이 아니라 옅은 비네팅이나 위아래 그라데이션이
    있다. 전역 임계 하나로 재면 한쪽 끝은 배경이 남고 반대쪽은 옷을 파먹는다.
    테두리 네 변의 값을 가로·세로로 이어 붙여(양선형) 판을 추정하면, 판이 실제로
    어떻게 변하는지 따라가면서 옷이 있는 가운데는 테두리 값으로 외삽된다.
    """
    w, h = rgb.size
    # 4변을 얇게 떠서 각각 한 줄/한 칸으로 줄인 뒤 다시 늘려 겹친다
    top = rgb.crop((0, 0, w, max(1, h // 64))).resize((w, 1), Image.BOX)
    bottom = rgb.crop((0, h - max(1, h // 64), w, h)).resize((w, 1), Image.BOX)
    left = rgb.crop((0, 0, max(1, w // 64), h)).resize((1, h), Image.BOX)
    right = rgb.crop((w - max(1, w // 64), 0, w, h)).resize((1, h), Image.BOX)
    vertical = Image.new("RGB", (w, 2))
    vertical.paste(top, (0, 0))
    vertical.paste(bottom, (0, 1))
    horizontal = Image.new("RGB", (2, h))
    horizontal.paste(left, (0, 0))
    horizontal.paste(right, (1, 0))
    return Image.blend(
        vertical.resize((w, h), Image.BILINEAR),
        horizontal.resize((w, h), Image.BILINEAR),
        0.5,
    )


def _bleed_edge_colors(img: Image.Image, depth: int) -> None:
    """불투명 픽셀의 RGB를 투명한 쪽으로 depth px 번지게 한다 (제자리 수정).

    투명 픽셀의 RGB에는 아무 값이나 들어 있다 — OpenAI 투명 PNG는 검정에 가깝고
    (실측 (0,0,0,0)·(43,42,42,0)), 색상 기반 누끼는 배경색을 그대로 남긴다.
    그 상태로 RGBA를 리샘플하면 보간이 알파를 무시하고 RGB를 섞기 때문에,
    normalize_product_canvas의 축소·확대만으로도 실루엣 주변에 어두운(또는 밝은)
    테두리가 다시 생긴다. 미리 원단 색으로 채워두면 무엇과 섞여도 원단 색이라
    테두리가 생기지 않는다. 알파는 건드리지 않으므로 실루엣은 그대로다.
    """
    w, h = img.size
    px = img.load()
    # 시드는 '불투명 경계'만 — 전체 스캔은 백만 픽셀짜리 파이썬 루프가 되므로
    # 침식 차분으로 경계를 C 쪽에서 뽑고 그 좌표만 순회한다.
    opaque = img.getchannel("A").point(lambda v: 255 if v >= 250 else 0)
    edge = ImageChops.difference(opaque, opaque.filter(ImageFilter.MinFilter(3))).tobytes()
    filled = bytearray(opaque.tobytes())  # 불투명 픽셀은 채울 대상이 아니다
    frontier: deque[tuple[int, int, int]] = deque(
        (i % w, i // w, 0) for i, v in enumerate(edge) if v
    )
    while frontier:
        x, y, dep = frontier.popleft()
        if dep >= depth:
            continue
        r, g, b, _a = px[x, y]
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if not (0 <= nx < w and 0 <= ny < h) or filled[ny * w + nx]:
                continue
            filled[ny * w + nx] = 1
            px[nx, ny] = (r, g, b, px[nx, ny][3])
            frontier.append((nx, ny, dep + 1))


def _repair_rim_colors(px: Any, rim: list[tuple[int, int]], w: int, h: int) -> None:
    """반투명 경계 픽셀의 RGB를 안쪽 불투명 픽셀 색으로 채운다.

    경계 픽셀의 원래 색은 원단과 배경이 섞인 값이다. 그대로 두면 밝은 배경색이
    테두리로 번지고, 배경색을 역산하면 알파가 작을수록 노이즈가 증폭돼 어두운
    실선이 생긴다. 둘 다 피하려면 색을 추정하지 말고 이웃한 원단 색을 그대로
    가져오면 된다 — 알파가 실루엣을 만들고 색은 원단과 이어진다.
    """
    pending = set(rim)
    frontier: deque[tuple[int, int]] = deque()
    for x, y in rim:
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] >= 250:
                r, g, b, _a = px[nx, ny]
                px[x, y] = (r, g, b, px[x, y][3])
                pending.discard((x, y))
                frontier.append((x, y))
                break
    while frontier and pending:
        x, y = frontier.popleft()
        r, g, b, _a = px[x, y]
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if (nx, ny) in pending:
                pending.discard((nx, ny))
                px[nx, ny] = (r, g, b, px[nx, ny][3])
                frontier.append((nx, ny))


def studio_product_cutout(path: str) -> bytes | None:
    """밝고 균일한 스튜디오 배경의 '흰/밝은 옷 상품컷'은 AI 재생성 없이
    원본 픽셀 그대로 배경만 제거한다.

    images.edit는 이미지를 다시 그리기 때문에 흰 셔츠에서 칼라가 들리거나
    포켓·실루엣이 미묘하게 달라지는 왜곡을 프롬프트로 완전히 못 막는다.
    배경이 진짜 단색 판이면 색상 기반 제거가 원본을 100% 보존한다.

    흰 원단은 배경과 픽셀 값이 부분적으로 겹쳐 단순 플러드필은 옷 안으로
    샌다(스트릭 형태 구멍). 그래서 배경 후보 마스크를 침식(MinFilter)해
    좁은 누수 통로를 끊은 뒤 테두리에서 플러드필하고, 침식으로 깎인 경계
    띠는 제한 팽창(≤RIM_DEPTH)으로 복원한다. 판정이 애매하면 None → 기존 AI 경로.

    경계 처리가 품질을 좌우한다. 고정 임계(tol=3) + 이진 알파는 실제 촬영본에서
    두 가지 잔상을 남겼다: (1) 센서 노이즈·JPEG 링잉·비네팅 때문에 배경인데도
    임계를 넘는 픽셀이 옷 주변에 얼룩덜룩 불투명하게 남고, (2) 드롭섀도가
    임계에서 막혀 옷 실루엣이 회색 유령처럼 한 겹 더 보인다. 그래서
    임계를 테두리에서 측정한 실제 노이즈(spread)에 맞춰 적응시키고, 경계 띠는
    0/255가 아니라 배경 거리에 비례한 연속 알파로 되찾는다.

    다만 그 알파 램프의 상한(hi)이 원단이 배경에서 떨어진 거리(sep)보다 넓으면
    원단 픽셀이 램프 중간에 걸려 반투명해지고, 원단 노이즈 때문에 알파가
    위아래로 튀면서 실루엣이 지글거린다(글리치). 그래서 hi를 sep에서 역산해
    램프가 항상 원단보다 안쪽에서 끝나게 한다. 반투명 픽셀의 색은 배경색을
    역산하지 않는다 — 알파가 작을수록 노이즈가 증폭돼 실루엣에 어두운 실선이
    생기기 때문. 대신 안쪽 불투명 원단 색을 밖으로 퍼뜨려(color repair) 채운다.
    """
    try:
        img = _open_source_image(path)
    except Exception:
        return None
    return _studio_cutout_from_image(img)


def _studio_cutout_from_image(img: Image.Image, tol_boost: int = 0) -> bytes | None:
    """studio_product_cutout의 본체. 이미 열려 있는(그리고 레터박스를 걷어낸) 이미지용.

    AI가 만들어 준 불투명 결과(투명 배경을 지원하지 않는 모델)도 같은 알고리즘으로
    자를 수 있게 분리했다. 생성된 배경판은 균일해서 이 경로가 특히 잘 맞는다 —
    옛 플러드필과 달리 밑단 그림자처럼 갇힌 배경까지 지운다.

    tol_boost: 배경으로 볼 색 차이를 넓힌다. AI가 그린 판에는 옷 밑에 옅은 그림자가
    깔려 있어서(판 색에서 10~20 정도 어두운 회색) 촬영본 기준 임계로는 그 그림자가
    옷으로 남고, 임계선을 오가며 픽셀이 번갈아 지워져 체크무늬처럼 보였다.
    밝은 원단은 이 값을 올리면 옷이 지워질 수 있으므로 호출부에서 0을 준다.
    """
    clean, _bg, local = _border_bg_stats(img)
    if not clean:
        return None
    w, h = img.size
    if w < 16 or h < 16:
        return None
    # tol: 확신 배경(연결성 판정용). hi는 본체 거리(sep)를 재고 나서 정한다.
    tol = max(3, min(9, int(local) + 3)) + max(0, int(tol_boost))

    # 배경색과 거의 같은 픽셀 마스크(255=배경 후보) → 침식으로 누수 통로 차단.
    # 비네팅·그라데이션이 있는 판은 전역 임계 하나로는 한쪽 끝이 잘려나가므로,
    # 판정 기준을 테두리에서 추정한 국소 배경(bgmap)으로 둔다.
    rgb = img.convert("RGB")
    bgmap = _estimate_plate(rgb)
    diff_bands = ImageChops.difference(rgb, bgmap).split()
    maxdiff = ImageChops.lighter(ImageChops.lighter(diff_bands[0], diff_bands[1]), diff_bands[2])
    cand = maxdiff.point(lambda v: 255 if v <= tol else 0)
    core = cand.filter(ImageFilter.MinFilter(5))

    core_px = core.load()
    diff_px = maxdiff.load()
    visited = bytearray(w * h)
    q: deque[tuple[int, int]] = deque()

    def seed(x: int, y: int) -> None:
        if core_px[x, y] and not visited[y * w + x]:
            visited[y * w + x] = 1
            q.append((x, y))

    for x in range(w):
        seed(x, 0)
        seed(x, h - 1)
    for y in range(h):
        seed(0, y)
        seed(w - 1, y)
    bg_set = bytearray(w * h)
    boundary: deque[tuple[int, int, int]] = deque()
    while q:
        x, y = q.popleft()
        bg_set[y * w + x] = 1
        boundary.append((x, y, 0))
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not visited[ny * w + nx] and core_px[nx, ny]:
                visited[ny * w + nx] = 1
                q.append((nx, ny))
    if not boundary:
        return None

    # 테두리와 이어지지 않은 배경 — 토트백 손잡이 안쪽, 링·팔찌 가운데처럼 제품이
    # 둘러싼 흰 구멍은 위 플러드필로는 남는다(상품컷인데 가운데에 흰 판이 그대로).
    # 흰 프린트·로고를 구멍으로 오인하면 옷에 구멍이 뚫리므로 조건을 좁게 잡는다:
    #   ① 판 색과 거의 정확히 같고(tol-4), ② 사방이 막혀 있고(테두리에 닿지 않음),
    #   ③ 본체보다 충분히 작고, ④ 진짜 배경에서 reach px 안에 있을 때만.
    # ④는 손잡이 끈 두께만큼만 떨어진 구멍과, 옷 한복판에 박힌 프린트를 가른다.
    hole_set = bytearray(w * h)
    obj_area = (w * h) - sum(bg_set)
    if obj_area > 0:
        hole_tol = max(2, tol - 4)
        tight_bytes = maxdiff.point(lambda v: 255 if v <= hole_tol else 0).tobytes()
        hole_cap = int(obj_area * 0.15)
        reach = max(5, int(min(w, h) * 0.03))
        holes_total = 0
        # 두 번 돈다: 첫 번째에 손잡이 안쪽이 열리면, 끈이 겹쳐 만든 더 안쪽 틈이
        # 그때 비로소 '배경에 가까운' 구멍이 된다.
        for _pass in (0, 1):
            # '배경에서 reach px 안'은 1/4 축소판에서 팽창시켜 구한다. 원본 크기로
            # MaxFilter를 수십 번 돌리면 1500px 이미지에서 1초 이상 걸린다.
            shrink = 4
            sw, sh = max(1, w // shrink), max(1, h // shrink)
            near = (
                Image.frombytes("L", (w, h), bytes(bg_set))
                .point(lambda v: 255 if v else 0)
                .resize((sw, sh), Image.BOX)
                .point(lambda v: 255 if v else 0)
            )
            for _ in range(max(1, (reach // shrink + 1) // 2)):
                near = near.filter(ImageFilter.MaxFilter(5))
            near_bytes = near.resize((w, h), Image.NEAREST).tobytes()
            seen = bytearray(w * h)
            found = 0
            for idx, v in enumerate(tight_bytes):
                if not v or bg_set[idx] or seen[idx]:
                    continue
                comp = [idx]
                seen[idx] = 1
                touches_border = False
                dq: deque[int] = deque(comp)
                while dq:
                    i = dq.popleft()
                    ix, iy = i % w, i // w
                    if ix == 0 or iy == 0 or ix == w - 1 or iy == h - 1:
                        touches_border = True
                    for nx, ny in ((ix + 1, iy), (ix - 1, iy), (ix, iy + 1), (ix, iy - 1)):
                        if not (0 <= nx < w and 0 <= ny < h):
                            continue
                        j = ny * w + nx
                        if seen[j] or bg_set[j] or not tight_bytes[j]:
                            continue
                        seen[j] = 1
                        comp.append(j)
                        dq.append(j)
                if touches_border or len(comp) < 12 or len(comp) > hole_cap:
                    continue
                if holes_total + len(comp) > obj_area * 0.2:
                    continue
                if not any(near_bytes[i] for i in comp):
                    continue  # 옷 안쪽 프린트 — 배경이 아니다
                holes_total += len(comp)
                found += len(comp)
                for i in comp:
                    bg_set[i] = 1
                    hole_set[i] = 1
                    boundary.append((i % w, i // w, 0))
            if not found:
                break

    px = img.load()
    removed = 0
    for y in range(h):
        base = y * w
        for x in range(w):
            if bg_set[base + x]:
                r, g, b, _a = px[x, y]
                px[x, y] = (r, g, b, 0)
                removed += 1

    # sep: 본체 원단이 배경색에서 떨어진 대표 거리. 램프 상한을 이 안쪽에 두어야
    # 원단이 반투명해지지 않는다. 경계 띠는 본체에서 아주 작은 비중이라 중앙값이면 충분.
    body = [
        diff_px[x, y]
        for y in range(0, h, max(1, min(w, h) // 90))
        for x in range(0, w, max(1, min(w, h) // 90))
        if not bg_set[y * w + x]
    ]
    if not body:
        return None
    sep = sorted(body)[len(body) // 2]
    hi = max(tol + 2, min(tol + 16, max(int(sep * 0.6), tol + 2)))
    span = float(hi - tol)
    soft_px = maxdiff.point(lambda v: 255 if v <= hi else 0).load()

    # 제한 팽창: 침식으로 깎인 경계 띠 복원 (옷 쪽으로는 최대 RIM_DEPTH px).
    # 이진 0이 아니라 배경 거리 비례 알파를 준다. 색은 여기서 건드리지 않고,
    # 아래 color repair에서 안쪽 원단 색으로 채운다.
    rim: list[tuple[int, int]] = []
    while boundary:
        x, y, dep = boundary.popleft()
        if dep >= _RIM_DEPTH:
            continue
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if not (0 <= nx < w and 0 <= ny < h) or bg_set[ny * w + nx] or not soft_px[nx, ny]:
                continue
            bg_set[ny * w + nx] = 1
            boundary.append((nx, ny, dep + 1))
            a = int(max(0.0, min(1.0, (diff_px[nx, ny] - tol) / span)) * 255)
            r, g, b, _a = px[nx, ny]
            px[nx, ny] = (r, g, b, a)
            if a < 128:
                removed += 1
            if a > 0:
                rim.append((nx, ny))

    # color repair: 반투명 픽셀의 색을 안쪽 불투명 원단 색으로 덮는다. 배경색을
    # 역산(unpremultiply)하면 알파가 작을 때 노이즈가 증폭돼 어두운 실선이 생긴다.
    _repair_rim_colors(px, rim, w, h)

    # ---- 검증: 실패로 보이면 None을 돌려 기존 AI 경로로 넘긴다 ----
    fg_frac = 1.0 - removed / (w * h)
    if not (0.06 <= fg_frac <= 0.9):
        return None
    alpha = img.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        return None
    # 옷 중심부가 뚫려 있으면(배경 제거가 원단으로 샌 흔적) 신뢰하지 않는다
    bx0, by0, bx1, by1 = bbox
    cw, ch = bx1 - bx0, by1 - by0
    hole = 0
    total_c = 0
    step_c = max(1, min(cw, ch) // 60)
    for y in range(by0 + ch // 4, by1 - ch // 4, step_c):
        for x in range(bx0 + cw // 4, bx1 - cw // 4, step_c):
            total_c += 1
            if px[x, y][3] < 128 and not hole_set[y * w + x]:
                hole += 1
    if total_c and hole / total_c > 0.1:
        return None

    # 알파만 정리: 미디언으로 1px 톱니·튀는 점을 없애고(실루엣은 유지) 살짝 흐려
    # 안티에일리어싱을 준다. 색은 이미 원단 색이므로 번짐이 생기지 않는다.
    # 미디언은 1px 톱니를 없애주지만, 손잡이 사이처럼 폭이 2~3px인 투명한 틈도 주변
    # 불투명 픽셀이 다수라 다시 메워버린다(가운데 흰 선이 남던 원인). 그래서 미디언
    # 뒤에 '지운 배경은 지운 채로' 다시 눌러주고, 블러는 그 다음에 걸어 경계만 부드럽게 한다.
    # 블러 반경은 이미지 크기에 맞춘다 — 0.6 고정은 큰 원본(1024px+)에서 계단이 남았다.
    alpha_out = img.getchannel("A").filter(ImageFilter.MedianFilter(3))
    if any(hole_set):
        alpha_out = ImageChops.darker(
            alpha_out,
            Image.frombytes("L", (w, h), bytes(hole_set)).point(lambda v: 0 if v else 255),
        )
    img.putalpha(alpha_out.filter(ImageFilter.GaussianBlur(max(0.6, min(1.3, min(w, h) / 900.0)))))
    bbox = img.getchannel("A").getbbox() or bbox
    pad = round(0.04 * max(w, h))
    img = img.crop((
        max(0, bbox[0] - pad), max(0, bbox[1] - pad),
        min(w, bbox[2] + pad), min(h, bbox[3] + pad),
    ))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _source_is_whiteish(path: str) -> bool:
    """원본 중앙부(옷이 있을 자리)가 대체로 밝고 채도 낮은지 — 흰 옷 판정 휴리스틱."""
    try:
        rgb = Image.open(path).convert("RGB")
    except Exception:
        return False
    rgb.thumbnail((160, 160))
    w, h = rgb.size
    px = rgb.load()
    x0, y0, x1, y1 = int(w * 0.2), int(h * 0.2), int(w * 0.8), int(h * 0.8)
    light = 0
    total = 0
    for y in range(y0, y1):
        for x in range(x0, x1):
            r, g, b = px[x, y]
            total += 1
            if (r + g + b) >= 3 * 180 and (max(r, g, b) - min(r, g, b)) <= 32:
                light += 1
    return total > 0 and light / total >= 0.5


def _fast_extract_triage(path: str, hint: str) -> dict[str, Any]:
    """LLM 호출 전, 스튜디오 컷·배경 난이도·밝은 원단을 빠르게 판별한다."""
    clean_plate = False
    try:
        clean_plate = _border_bg_stats(_open_source_image(path))[0]
    except Exception:
        pass
    return {
        "clean_plate": clean_plate,
        "messy_background": not clean_plate,
        "whiteish": _source_is_whiteish(path),
        "studio": studio_product_cutout(path) if not hint and clean_plate else None,
    }


def _resolve_extract_policy(meta: dict[str, Any], triage: dict[str, Any], hint: str) -> dict[str, Any]:
    """기본은 medium, 로고·사용자 지시·복잡한 배경만 고품질로 승격한다."""
    has_text = bool(meta.get("has_text_logo"))
    override = str(meta.get("_quality_override") or "").strip()
    messy_background = bool(triage.get("messy_background"))
    # 정면으로 다시 세워 그리는 건 배경만 지우는 것보다 훨씬 어렵다 → 고품질로
    needs_front = (
        str(meta.get("shot") or "product") != "product"
        or str(meta.get("angle") or "front") != "front"
    )
    if override:
        tier, quality, timeout = "retry", override, OPENAI_IMAGE_TIMEOUT
    elif has_text:
        tier, quality, timeout = "text", OPENAI_IMAGE_QUALITY_TEXT, OPENAI_IMAGE_TIMEOUT
    elif needs_front:
        tier, quality, timeout = "reframe_front", OPENAI_IMAGE_QUALITY_HARD, OPENAI_IMAGE_TIMEOUT
    elif hint:
        tier, quality, timeout = "hint", OPENAI_IMAGE_QUALITY_HARD, OPENAI_IMAGE_TIMEOUT
    elif messy_background:
        tier, quality, timeout = "hard_background", OPENAI_IMAGE_QUALITY_HARD, OPENAI_IMAGE_TIMEOUT
    else:
        tier, quality, timeout = "standard", OPENAI_IMAGE_QUALITY, OPENAI_IMAGE_TIMEOUT_FAST
    return {
        "tier": tier,
        "model": OPENAI_IMAGE_MODEL_TEXT if has_text else OPENAI_IMAGE_MODEL,
        "quality": quality,
        "timeout_s": timeout,
        "difficulty": [name for name, enabled in (
            ("text", has_text),
            ("hint", bool(hint)),
            ("messy_background", messy_background),
            ("light", bool(triage.get("whiteish"))),
            ("reframe_front", needs_front),
        ) if enabled],
    }


def generate_product_image(
    user_id: str, path: str, meta: dict[str, Any], triage: dict[str, Any] | None = None
) -> bytes | None:
    """이미지 + 프롬프트로 images.edit. 힌트면 사용자 문장 우선(ChatGPT와 동일)."""
    if not openai_client:
        print("[extract] openai client missing", flush=True)
        meta["_extract_fail"] = "no_openai"
        return None
    if AI_TEST_MODE:
        print("[extract] TEST MODE — 로컬 컷아웃만, AI 미호출 ($0)", flush=True)
        meta["_extract_mode"] = "test_local_cutout"
        meta["_extract_policy"] = {"tier": "test", "quality": "local", "timeout_s": 0}
        return local_product_cutout(path, meta.get("category"))
    # 크레딧 게이트 비활성(테스트). charge는 no-op이지만 호출해 ledger 경로를 유지하지 않음.
    charge_credit(user_id, "product_image", {"name": meta.get("name")})
    if "has_text_logo" not in meta:
        meta.update(detect_garment_text(path, user_id=user_id))
    else:
        logo_text = str(meta.get("logo_text") or "").strip()
        meta["has_text_logo"] = _significant_garment_logo(bool(meta.get("has_text_logo")), logo_text)
        if not meta["has_text_logo"]:
            meta["logo_text"] = ""
    has_text = bool(meta.get("has_text_logo"))
    logo_text = str(meta.get("logo_text") or "").strip()
    hint = str(meta.get("extract_hint") or "").strip()[:500]
    name = meta.get("name") or "패션 아이템"

    # 정면 상품컷일 때만 로컬 누끼를 쓴다. 측면·착장 사진을 그대로 오려내면 옷장에
    # 측면 컷이 들어가 카드가 제각각이 된다(정면으로 다시 그려야 한다).
    needs_front = str(meta.get("shot") or "product") != "product" or str(meta.get("angle") or "front") != "front"
    triage = triage or _fast_extract_triage(path, hint)
    studio = None if needs_front else triage.get("studio")
    if studio:
        print("[extract] studio cutout — skip AI", flush=True)
        meta["_extract_mode"] = "studio_cutout"
        meta["_extract_policy"] = {"tier": "studio", "quality": "local", "timeout_s": 0}
        return studio

    policy = _resolve_extract_policy(meta, triage, hint)
    model = str(policy["model"])
    quality = str(policy["quality"])
    request_timeout = float(policy["timeout_s"])
    whiteish = bool(triage.get("whiteish"))
    meta["_extract_policy"] = policy

    if hint:
        # ChatGPT에 넣던 것과 같이: 사용자 요청이 본체, 톤은 짧게
        prompt = f"""{hint}

쇼핑몰 상품 컷처럼 요청한 아이템만 단독으로 뽑아줘. 배경은 완전히 투명하게(투명 PNG, 흰색·회색 배경 판 남기지 말 것). 사람·팔·다른 옷은 넣지 마.
원본 이미지를 최대한 해치지 않는 선에서: 색상·포켓·라벨/택·단추·스티치 같은 디테일을 하나도 빠뜨리거나 바꾸지 마. 니트 조직·멜란지·데님 워싱 같은 원단 질감도 뭉개지 말고 그대로. 원본에 신발이 두 짝이면 두 짝 모두, 한 짝이면 한 짝 그대로.
"""
    elif needs_front:
        # 측면·뒷면·착장 사진. 여기서 '원본을 해치지 말라'고 하면 모델이 각도를 그대로
        # 유지해서 측면 컷이 나온다. 그래서 이 경로만은 '정면으로 다시 세워 그려라'를
        # 지시의 본체로 두고, 보존해야 할 것(색·패턴·핏·디테일)을 따로 못박는다.
        category = str(meta.get("category") or "")
        others = [str(o).strip() for o in (meta.get("other_items") or []) if str(o).strip()][:6]
        prompt = f"""이 사진에 있는 {name}을 **정면에서 본 쇼핑몰 상품컷**으로 다시 그려줘.

- 사진이 측면·사선·뒷면이거나 사람이 입고 있어도, 결과는 옷을 정면에서 평평하게 펼쳐 놓은 상품컷이어야 함
- 사람·마네킹·손·다리·배경은 모두 제거. 옷만 단독으로
- 원단 색상·워싱·패턴, 실루엣과 핏(오버사이즈/와이드 등), 기장 비율은 사진과 같게 유지
- 보이는 디테일은 정면 상품컷에 맞게 옮겨 그릴 것: 포켓 위치·개수, 단추·지퍼, 스티치 색, 밑단·커프스 처리, 허리 밴드
- 사진에서 가려져 보이지 않는 부분은 같은 종류의 옷에서 자연스러운 형태로 채우되, 없는 장식을 새로 만들지 말 것
- 원단 질감(데님 워싱, 니트 조직, 코듀로이 골)은 매끈하게 뭉개지 말고 살릴 것
- 배경은 완전히 투명하게 (흰색·회색 배경 판 금지), 아이템 전체가 잘리지 않게 중앙 배치
- 결과에는 {name}만: 함께 착용된 다른 아이템과 사람은 포함하지 말 것
"""
        if others:
            prompt += f"- 사진에 함께 보이는 {', '.join(others)}은(는) 추출 대상이 아님. 일부라도 넣지 말 것\n"
        if category == "shoes":
            prompt += "- 신발은 정면에서 본 한 쌍으로. 좌우가 나란히 보이게\n"
    else:
        # ChatGPT에 사용자가 직접 넣는 문장과 같은 구조: '상품컷처럼 만들어줘 +
        # 원본을 해치지 않는 선에서'. 금지 조항을 길게 쌓으면 모델이 소극적으로
        # 원본의 흐릿함까지 복사하므로, 선명한 상품컷으로 재구성할 여지를 준다.
        category = str(meta.get("category") or "")
        others = [str(o).strip() for o in (meta.get("other_items") or []) if str(o).strip()][:6]
        prompt = f"""여기 있는 {name}만 추출해서 쇼핑몰 상품컷 이미지처럼 만들어줘. 원본 이미지를 최대한 해치지 않는 선에서.

- 원단 색상·워싱, 실루엣, 디테일(포켓, 단추 개수·위치, 스티치, 밑단 처리)을 원본 그대로 유지하고 없는 요소를 추가하지 말 것
- 원단 질감을 살릴 것: 니트 조직·멜란지 얼룩·데님 워싱·코듀로이 골 같은 표면의 결과 노이즈를 매끈하게 뭉개거나 단색으로 펴바르지 말고 원본처럼 표현
- 결과에는 {name}만: 함께 착용된 다른 아이템(상의·하의·신발·양말·벨트·모자 등)과 사람·마네킹은 포함하지 말 것. 바지·스커트는 밑단에서 끝나야 함
- 배경은 완전히 투명하게 (흰색·회색 배경 판 금지), 아이템 전체가 잘리지 않게 중앙 배치
- 옷에 인쇄·자수된 로고/글자는 철자·위치 그대로 유지. 가격표·워터마크·화면 UI는 제거
"""
        if others:
            prompt += f"- 사진에 함께 보이는 {', '.join(others)}은(는) 추출 대상이 아님. 일부라도 넣지 말 것\n"
        if category == "shoes":
            prompt += "- 신발은 원본에 보이는 대로 (두 짝이면 두 짝, 한 짝이면 한 짝) 유지. 짝을 새로 만들거나 지우지 말 것\n"
    if has_text:
        prompt += "\n- CRITICAL: This garment has printed/embroidered text or a logo on the fabric. Preserve it pixel-faithfully. Do not redraw, invent, or alter any letter."
        if logo_text:
            prompt += f'\n- The visible logo/text must remain exactly: "{logo_text}" (same spelling, spacing, and layout).'

    print(
        f"[extract] start hint={bool(hint)!r} hint_text={hint[:60]!r} model={model} quality={quality}",
        flush=True,
    )

    def _edit(use_model: str, *, transparent: bool) -> tuple[bytes, bool]:
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
        # 지원하지 않는 모델에 transparent를 넣으면 400으로 끝난다. 조용히 빼고,
        # 대신 결과를 우리 컷아웃(플러드필)으로 처리한다.
        want_transparent = transparent and _supports_transparent(use_model)
        if want_transparent:
            kwargs["background"] = "transparent"
        # input_fidelity=high: 포켓·택·정확한 색상 같은 원본 디테일을 훨씬 잘 보존한다.
        # gpt-image-2는 이 파라미터를 안 받고 항상 고충실도로 처리하므로 gpt-image-1류에만 지정.
        if "gpt-image-2" not in use_model:
            kwargs["input_fidelity"] = "high"
        result = openai_client.with_options(timeout=request_timeout).images.edit(**kwargs)
        log_ai_usage(
            user_id,
            "product_image",
            use_model,
            {
                "quality": quality,
                "has_text_logo": has_text,
                "logo_text": logo_text[:40],
                "extract_hint": hint[:80],
                "transparent": want_transparent,
            },
            usage=getattr(result, "usage", None),
        )
        return base64.b64decode(result.data[0].b64_json), want_transparent

    # 투명 배경 요청 한 번만 사용한다. 과거의 불투명 재시도는 다시 플러드필을 타
    # 흰 원단을 지우고 최대 대기 시간을 두 배로 만들었다.
    # 일시적 실패(429·5xx)는 한 번 더 시도한다. OpenAI 클라이언트를 max_retries=0으로
    # 두었기 때문에 gpt-image-1이 자주 뱉는 일회성 500이 그대로 사용자 에러가 됐다.
    started = time.monotonic()
    for attempt in (0, 1):
        try:
            raw, was_transparent = _edit(model, transparent=True)
            print(
                f"[extract] ok model={model} transparent={was_transparent} attempt={attempt + 1}",
                flush=True,
            )
            meta["_extract_mode"] = "ai"
            return finalize_cutout(
                raw,
                already_transparent=was_transparent,
                protect_light_garment=whiteish,
                category=meta.get("category"),
            )
        except (APITimeoutError, APIConnectionError) as exc:
            # 이미 제한 시간(120초)을 다 쓴 상태라 재시도하지 않는다.
            info = _openai_error_info(exc)
            meta["_extract_fail"] = "timeout" if isinstance(exc, APITimeoutError) else "network"
            meta["_extract_fail_info"] = info
            print(f"[extract] timeout/conn model={model}: {_fail_log(info)}", flush=True)
            break
        except Exception as exc:  # noqa: BLE001
            info = _openai_error_info(exc)
            key = _openai_fail_key(info)
            # 모델이 투명 배경을 안 받는 경우(목록에 없던 새 모델 포함) 불투명으로 한 번 더.
            if info.get("param") == "background" and attempt == 0:
                print(f"[extract] transparent unsupported on {model} — retry opaque", flush=True)
                try:
                    raw, _ = _edit(model, transparent=False)
                    meta["_extract_mode"] = "ai_opaque"
                    return finalize_cutout(
                        raw,
                        already_transparent=False,
                        protect_light_garment=whiteish,
                        category=meta.get("category"),
                    )
                except Exception as exc2:  # noqa: BLE001
                    info = _openai_error_info(exc2)
                    key = _openai_fail_key(info)
            retryable = key in ("rate_limit", "upstream")
            if retryable and attempt == 0 and (time.monotonic() - started) < 45:
                print(f"[extract] retry after {_fail_log(info)}", flush=True)
                time.sleep(3)
                continue
            meta["_extract_fail"] = key
            meta["_extract_fail_info"] = info
            print(f"[extract] edit failed model={model}: {_fail_log(info)}", flush=True)
            break
    # 실패도 남긴다 — 라이브에서 어떤 에러였는지 로그 없이 확인할 수 있어야 한다.
    log_ai_usage(
        user_id,
        "product_image_error",
        model,
        {
            "quality": quality,
            "tier": policy.get("tier"),
            "fail": meta.get("_extract_fail"),
            "error": meta.get("_extract_fail_info") or {},
            "extract_hint": hint[:80],
            "has_text_logo": has_text,
        },
    )
    meta["_extract_fail"] = meta.get("_extract_fail") or "edit_failed"
    return None


def _openai_error_info(exc: Exception) -> dict[str, Any]:
    """OpenAI 예외에서 사람이 읽을 수 있는 정보를 뽑는다.

    지금까지는 실패를 전부 'api_error' 하나로 뭉개고 원문은 서버 로그에만 남겨서,
    사용자가 '오류가 났어요'를 보고 물어와도 이유를 알 수 없었다(호스팅 로그를
    봐야 했다). 상태코드·코드·request_id를 남겨 화면과 DB 양쪽에서 확인한다.
    """
    status = getattr(exc, "status_code", None)
    body = getattr(exc, "body", None)
    # SDK는 {"error": {...}} 로 감싼 형태와 error 객체를 그대로 준 형태가 둘 다 나온다.
    err: dict[str, Any] = {}
    if isinstance(body, dict):
        err = body.get("error") if isinstance(body.get("error"), dict) else body
    return {
        "type": type(exc).__name__,
        "status": int(status) if isinstance(status, int) else None,
        "code": str(err.get("code") or err.get("type") or "") or None,
        "param": str(err.get("param") or "") or None,
        "request_id": getattr(exc, "request_id", None),
        "message": str(err.get("message") or getattr(exc, "message", "") or exc)[:300],
    }


def _openai_fail_key(info: dict[str, Any]) -> str:
    """상태코드·에러코드를 사용자 문구 키로 옮긴다."""
    status = info.get("status")
    code = str(info.get("code") or "").lower()
    text = str(info.get("message") or "").lower()
    if "moderation" in code or "content_policy" in code or "safety" in text:
        return "moderation"
    if "insufficient_quota" in code or "billing" in code:
        return "quota"
    if status == 429:
        return "rate_limit"
    if status in (401, 403):
        return "auth"
    if status == 413 or "too_large" in code or "too large" in text:
        return "too_large"
    if isinstance(status, int) and status >= 500:
        return "upstream"
    if status == 400:
        # param이 있으면 사진이 아니라 우리가 보낸 요청이 잘못된 것이다. 사용자에게
        # '다른 사진으로'라고 안내하면 아무리 좋은 사진을 넣어도 계속 실패한다.
        return "bad_setup" if info.get("param") else "bad_request"
    return "api_error"


def _fail_code(info: dict[str, Any]) -> str:
    """사용자가 그대로 옮겨 적을 수 있는 짧은 코드."""
    parts = [str(info.get("status") or info.get("type") or "?")]
    if info.get("code"):
        parts.append(str(info["code"]))
    req = str(info.get("request_id") or "")
    if req:
        parts.append(req[-8:])
    return "·".join(parts)


def _fail_log(info: dict[str, Any]) -> str:
    return (
        f"type={info.get('type')} status={info.get('status')} code={info.get('code')} "
        f"param={info.get('param')} req={info.get('request_id')} msg={info.get('message')}"
    )


# 사용자가 읽고 다음 행동을 정할 수 있는 문구만 둔다. 원인이 우리 쪽이면 사진을
# 바꾸라고 하지 않고(바꿔도 안 되니까) 잠시 후 다시 시도하도록 안내한다.
_EXTRACT_FAIL_MSG = {
    "timeout": "이미지를 만드는 데 너무 오래 걸려서 멈췄어요. 잠시 후 다시 시도해 주세요.",
    "network": "서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.",
    "rate_limit": "지금 요청이 몰려 있어요. 1~2분 뒤에 다시 시도해 주세요.",
    "moderation": "이 사진은 처리할 수 없어요. 다른 사진으로 시도해 주세요.",
    "too_large": "사진 용량이 너무 커요. 조금 작은 사진으로 다시 올려 주세요.",
    "bad_request": "이 사진에서는 옷을 알아보기 어려웠어요. 옷이 크고 또렷하게 나온 사진으로 다시 올려 주세요.",
    "upstream": "이미지 서버가 잠시 불안정해요. 조금 뒤에 다시 시도해 주세요.",
    # 아래는 우리 쪽 문제 — 사진을 바꿔도 해결되지 않으니 그런 말은 하지 않는다.
    "auth": "지금은 이미지를 만들 수 없어요. 잠시 후 다시 시도해 주세요.",
    "quota": "지금은 이미지를 만들 수 없어요. 잠시 후 다시 시도해 주세요.",
    "bad_setup": "지금은 이미지를 만들 수 없어요. 잠시 후 다시 시도해 주세요.",
    "no_openai": "지금은 이미지를 만들 수 없어요. 잠시 후 다시 시도해 주세요.",
    "api_error": "이미지를 만들지 못했어요. 잠시 후 다시 시도해 주세요.",
    "edit_failed": "이미지를 만들지 못했어요. 잠시 후 다시 시도해 주세요.",
}


def resolve_product_image(
    user_id: str,
    path: str,
    meta: dict[str, Any],
    triage: dict[str, Any] | None = None,
    report: Callable[[str], None] | None = None,
) -> bytes | None:
    """AI 추출. 실패한 결과를 색상 기반 로컬 컷아웃으로 덮어쓰지 않는다."""
    hint = str(meta.get("extract_hint") or "").strip()
    product = generate_product_image(user_id, path, meta, triage)
    if product:
        if report:
            report("polish")
        return normalize_product_canvas(product, meta.get("category"))
    fail = meta.get("_extract_fail") or "edit_failed"
    msg = _EXTRACT_FAIL_MSG.get(fail, _EXTRACT_FAIL_MSG["edit_failed"])
    info = meta.get("_extract_fail_info") or {}
    # 코드는 개발용이다. 라이브에서는 사용자에게 보여주지 않고 로그·DB에만 남긴다.
    if info and SHOW_ERROR_CODES:
        msg = f"{msg} (코드: {_fail_code(info)})"
    # 흰 옷·저대비 원단은 로컬 색상 제거로 대체하면 결과가 빠르게 나와도 일부가
    # 사라질 수 있다. 원본은 이미 보관되어 있으므로 안전하게 실패를 돌려준다.
    print(f"[extract] failed ({fail}) — preserve original, no local fallback :: {_fail_log(info)}", flush=True)
    status = 504 if fail in ("timeout", "network") else (429 if fail == "rate_limit" else 502)
    raise HTTPException(status_code=status, detail=msg)


def item_payload(row: dict[str, Any]) -> dict[str, Any]:
    raw_color = (row.get("color") or "").strip()
    return {
        "id": row["id"],
        "name": row.get("name") or "옷",
        "category": _category_display(row.get("category")),
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


# ---- 코디 감각: 숨은 속성 + 사용자 프로필을 추천에 실제로 먹인다 ----
# 지금까지 모델에 준 건 "카테고리 | 색 | 이름" 뿐이었다. 핏·소재·패턴·격식·톤을
# 모르면 정장 슬랙스에 러닝화를 붙이고, 퍼스널 컬러는 아예 반영되지 않았다.

_PC_GUIDE = {
    "spring": ("봄 웜", "warm", "light", "vivid"),
    "summer": ("여름 쿨", "cool", "light", "muted"),
    "autumn": ("가을 웜", "warm", "deep", "muted"),
    "winter": ("겨울 쿨", "cool", "deep", "vivid"),
}
_FIT_KO = {
    "slim": "슬림", "regular": "레귤러", "relaxed": "릴랙스", "oversized": "오버사이즈",
    "wide": "와이드", "crop": "크롭", "skinny": "스키니",
}
_SEASON_KO = {"spring": "봄", "summer": "여름", "autumn": "가을", "winter": "겨울"}


def _row_style(row: dict[str, Any]) -> dict[str, Any]:
    meta = row.get("metadata") or {}
    style = meta.get("style")
    return style if isinstance(style, dict) else {}


def _catalog_line(row: dict[str, Any]) -> str:
    """추천 프롬프트에 넣는 한 줄. 숨은 속성까지 붙여 판단 근거를 준다."""
    meta = row.get("metadata") or {}
    st = _row_style(row)
    bits = [
        f"id={row['id']}",
        _category_display(row.get("category")),
        row.get("color") or "뉴트럴",
        (row.get("name") or "옷")[:40],
    ]
    if st.get("subtype"):
        bits.append(st["subtype"])
    attrs = []
    if st.get("fit"):
        attrs.append(f"핏={_FIT_KO.get(st['fit'], st['fit'])}")
    if st.get("material"):
        attrs.append(f"소재={st['material']}")
    if st.get("pattern") and st["pattern"] != "solid":
        attrs.append(f"패턴={st['pattern']}")
    tone_bits = [st.get("tone"), st.get("depth"), st.get("chroma")]
    tone_bits = [t for t in tone_bits if t]
    if tone_bits:
        attrs.append("톤=" + "/".join(tone_bits))
    if st.get("formality"):
        attrs.append(f"격식={st['formality']}")
    if st.get("styles"):
        attrs.append("무드=" + ",".join(st["styles"]))
    seasons = [_SEASON_KO.get(x, x) for x in (meta.get("seasons") or [])]
    if seasons:
        attrs.append("계절=" + ",".join(seasons))
    if st.get("details"):
        attrs.append("특징=" + ",".join(st["details"]))
    if attrs:
        bits.append(" ".join(attrs))
    return " | ".join(bits)


def _profile_block(profile: dict[str, Any] | None) -> str:
    """마이페이지에서 설정한 값 중 코디 판단에 쓰이는 것만 문장으로."""
    p = profile or {}
    lines: list[str] = []
    who = [x for x in (str(p.get("gender") or "").strip(), str(p.get("age") or "").strip()) if x]
    if who:
        lines.append("사용자: " + " · ".join(who))
    pc = _PC_GUIDE.get(str(p.get("personal_color") or "").strip())
    if pc:
        name, tone, depth, chroma = pc
        lines.append(
            f"퍼스널 컬러: {name} — {tone}·{depth}·{chroma} 계열이 잘 맞는다. "
            "얼굴에 닿는 상의·아우터를 여기에 맞추고, 안 맞는 색은 하의·신발로 내린다."
        )
    fit = str(p.get("fit") or "").strip()
    if fit:
        lines.append(f"선호 실루엣: {fit}")
    body = [x for x in (
        f"{str(p.get('height')).strip()}cm" if str(p.get("height") or "").strip() else "",
        f"{str(p.get('weight')).strip()}kg" if str(p.get("weight") or "").strip() else "",
    ) if x]
    if body:
        lines.append(
            "체형: " + " · ".join(body)
            + " — 기장·핏이 이 체형에서 어떻게 떨어지는지 감안해 고른다(예: 크롭·와이드의 비율)."
        )
    palettes = [str(x).strip() for x in (p.get("palettes") or []) if str(x).strip()][:5]
    if palettes:
        lines.append("선호 색 계열: " + ", ".join(palettes))
    return ("\n".join(lines) + "\n") if lines else ""


_COORD_RULES = """감각 규칙(이걸 지켜야 '그냥 되는 조합'이 아니라 입을 만한 코디가 된다):
- 색: 한 코디에 3색 이내. 무채색(블랙·화이트·그레이·네이비) 위에 포인트 색 하나가 기본.
  웜톤과 쿨톤을 같이 쓸 땐 뉴트럴 아이템을 사이에 두고, 비슷한 채도끼리 묶는다.
- 격식(formality): 한 코디 안에서 차이가 2를 넘으면 안 된다. 격식 4~5 하의에 격식 1 운동화·트레이닝 금지.
- 패턴: 패턴 아이템은 코디당 1개. 나머지는 solid로 받친다. 로고/그래픽도 패턴으로 센다.
- 실루엣: 위아래를 모두 오버사이즈/와이드로 두지 않는다. 한쪽이 크면 다른 쪽은 슬림·레귤러.
- 계절: 여름 전용(린넨·메시·반팔)과 겨울 전용(니트·기모·코트)을 섞지 않는다.
- 소재: 광택·가죽은 코디당 1개까지. 캐주얼 데님 위에 정장 소재를 얹지 않는다.
- 퍼스널 컬러: 맞는 색은 얼굴 근처(상의·아우터)에, 애매한 색은 하의·신발·가방으로.
- label: 옷 이름을 나열하지 말고 그 코디를 한마디로 (예: "네이비로 정리한 출근룩").
- mood: 왜 어울리는지 한 문장(색·실루엣·격식 중 실제 근거 하나를 짚어서)."""


def _style_attr_prompt(rows: list[dict[str, Any]]) -> str:
    lines = "\n".join(
        f"{row['id']} | {_category_display(row.get('category'))} | {row.get('color') or ''} | {(row.get('name') or '')[:60]}"
        for row in rows
    )
    return f"""아래는 한 사용자의 옷장 목록이다. 각 아이템의 이름·카테고리·색만 보고 코디에 필요한 속성을 채워라.
이름에 단서가 있으면 반영한다 ("와이드"→fit=wide, "울"→material=wool, "카고"→subtype 카고 팬츠).
단서가 없으면 그 카테고리에서 가장 흔한 값을 쓰되, 확신이 없는 필드는 비운다.

목록(id | 카테고리 | 색 | 이름):
{lines}

각 id에 대해 아래 형식으로 JSON만 응답:
{{"items":[{{"id":"...","subtype":"","fit":"slim|regular|relaxed|oversized|wide|crop|skinny","pattern":"solid|stripe|check|floral|graphic|logo|camo|dot|other","material":"cotton|denim|linen|wool|knit|leather|nylon|corduroy|fleece|blend","tone":"warm|cool|neutral","depth":"light|mid|deep","chroma":"vivid|muted","formality":3,"styles":["minimal"],"details":[]}}]}}
- subtype: 한국어 종류명 ("카고 팬츠", "옥스퍼드 셔츠", "첼시 부츠"). 영어로 쓰지 말 것.
- formality: 1 운동복 · 2 데일리 캐주얼 · 3 스마트 캐주얼 · 4 오피스 · 5 정장.
- styles: 그 아이템이 실제로 어울리는 무드만 1~3개, 아이템마다 다르게 판단할 것.
  슬랙스·코트·로퍼 → office/classic/dandy, 데님·티셔츠 → casual/minimal,
  스니커·후디·카고 → street/casual/sporty, 니트·셔츠 → preppy/dandy 처럼 성격에 맞게.
  전부 minimal로 채우지 말 것."""


def style_attrs_from_image(image_url: str, name: str, category: str, color: str,
                           user_id: str | None = None) -> dict[str, Any]:
    """이미 저장된 아이템의 사진을 보고 숨은 스타일 속성을 뽑는다(백필용).

    새로 담는 아이템은 classify(비전)에서 같이 받지만, 예전에 담은 아이템은 이름
    기반 추론뿐이라 '카고'처럼 이름에 없는 성격을 놓친다. 사진을 다시 한 번 보면
    핏·소재·격식·톤이 정확해진다. 아이템당 비전 1회이므로 백필 스크립트에서만 쓴다.
    """
    if not openai_client:
        return {}
    prompt = f"""이 사진의 패션 아이템을 보고 코디에 필요한 속성만 채워라. 이름은 참고만 한다.
이름: {name} / 카테고리: {_category_display(category)} / 색: {color}

JSON만 응답:
{{"subtype":"한국어 종류명(예: 카고 팬츠, 옥스퍼드 셔츠, 첼시 부츠)","fit":"slim|regular|relaxed|oversized|wide|crop|skinny","pattern":"solid|stripe|check|floral|graphic|logo|camo|dot|other","material":"cotton|denim|linen|wool|knit|leather|nylon|corduroy|fleece|blend","tone":"warm|cool|neutral","depth":"light|mid|deep","chroma":"vivid|muted","formality":3,"styles":["어울리는 무드 1~3개: dandy|minimal|casual|office|street|chic|sporty|classic|amekaji|gorpcore|hiphop|y2k|preppy"],"details":["코디에 영향 주는 특징 0~3개"]}}
- 이름에 없어도 사진에서 보이면 반영한다: 카고 포켓, 센터프레스, 워싱, 광택, 크롭 기장, 절개.
- formality: 1 운동복 · 2 데일리 캐주얼 · 3 스마트 캐주얼 · 4 오피스 · 5 정장.
- tone: 원단 색이 웜(아이보리·카멜·올리브)/쿨(애쉬·네이비·버건디)/뉴트럴(블랙·화이트·그레이) 중 어디인지.
- 확신이 없는 필드는 비운다."""
    try:
        response = _vision_client().chat.completions.create(
            model=OPENAI_CLASSIFY_MODEL,
            messages=[{"role": "user", "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": image_url}},
            ]}],
            response_format={"type": "json_object"},
            temperature=0.2,
        )
        log_ai_usage(
            user_id, "style_attrs_image", OPENAI_CLASSIFY_MODEL, {"backfill": True},
            usage=getattr(response, "usage", None),
        )
        return _clean_style_attrs(json.loads(response.choices[0].message.content or "{}"))
    except Exception as exc:  # noqa: BLE001
        print(f"[style-attrs] image read failed: {exc}", flush=True)
        return {}


def _ensure_style_attrs(user_id: str, rows: list[dict[str, Any]], limit: int = 25) -> int:
    """style 속성이 없는 기존 아이템을 이름 기반으로 한 번에 채워 저장한다.

    새로 담는 아이템은 classify(비전)에서 채우지만, 이전에 담아둔 옷에는 없다.
    이미지를 다시 보려면 아이템마다 비전 호출이 필요해 비싸므로, 이름·색·카테고리로
    묶어서 한 번 추론한다("원워시드 와이드 데님"만으로도 fit·material이 나온다).
    한 번 저장하면 다음 추천부터는 호출이 없다. 한 번에 25개까지만 채운다 —
    옷장이 클 때 첫 추천이 통째로 느려지는 것보다, 두세 번에 걸쳐 채우는 게 낫다.
    """
    missing = [r for r in rows if not _row_style(r)][:limit]
    if not missing or not openai_client or AI_TEST_MODE:
        return 0
    try:
        response = openai_client.with_options(timeout=45).chat.completions.create(
            model=OPENAI_VISION_MODEL,
            messages=[{"role": "user", "content": _style_attr_prompt(missing)}],
            response_format={"type": "json_object"},
            temperature=0.2,
        )
        data = json.loads(response.choices[0].message.content or "{}")
        log_ai_usage(
            user_id, "style_attrs", OPENAI_VISION_MODEL, {"count": len(missing)},
            usage=getattr(response, "usage", None),
        )
    except Exception as exc:  # noqa: BLE001
        print(f"[style-attrs] failed: {exc}", flush=True)
        return 0
    by_id = {r["id"]: r for r in missing}
    updates: list[tuple[str, dict[str, Any]]] = []
    for entry in data.get("items") or []:
        row = by_id.get(str(entry.get("id") or ""))
        if not row:
            continue
        attrs = _clean_style_attrs(entry)
        if not attrs:
            continue
        meta = dict(row.get("metadata") or {})
        meta["style"] = attrs
        meta["style_source"] = "name"
        row["metadata"] = meta          # 이번 추천에 바로 반영
        updates.append((row["id"], meta))
    if not updates:
        return 0

    def _save(pair: tuple[str, dict[str, Any]]) -> None:
        item_id, meta = pair
        try:
            (
                supabase_admin.table("wardrobe_items")
                .update({"metadata": meta})
                .eq("id", item_id)
                .eq("user_id", user_id)
                .execute()
            )
        except Exception as exc:  # noqa: BLE001
            print(f"[style-attrs] save failed {item_id}: {exc}", flush=True)

    with ThreadPoolExecutor(max_workers=8) as pool:
        list(pool.map(_save, updates))
    print(f"[style-attrs] filled {len(updates)}/{len(missing)} items", flush=True)
    return len(updates)


def _include_note(include_ids: list[str] | None, items: list[dict[str, Any]]) -> str:
    """옷장에서 고른 아이템을 모든 코디에 넣으라는 지시."""
    ids = [str(i) for i in (include_ids or []) if i]
    if not ids:
        return ""
    by_id = {row["id"]: row for row in items}
    named = [f"{by_id[i].get('name')}(id={i})" for i in ids if i in by_id]
    if not named:
        return ""
    return (
        "\n[반드시 포함] 사용자가 옷장에서 고른 아이템: " + ", ".join(named) + "\n"
        "- 이 아이템은 모든 코디에 빠짐없이 넣는다. 이 옷을 살리는 방향으로 나머지를 고른다.\n"
    )


def _wish_note(wish_combos: int, max_combos: int) -> str:
    """옷장에 없는 아이템을 하나 끼운 코디를 몇 개 만들지."""
    n = max(0, min(int(wish_combos or 0), max_combos))
    if not n:
        return "\n- 옷장에 있는 아이템만 쓴다. 없는 아이템을 만들어 넣지 말 것.\n"
    return (
        f"\n[제안 아이템] {max_combos}개 중 {n}개는 '옷장에 없지만 있으면 훨씬 좋아질 아이템' 하나를 더해 만든다.\n"
        "- 그 코디의 wish에 제안 아이템을 적는다(name·category·color·reason). 나머지는 옷장 아이템으로 채운다.\n"
        "- 제안은 실제로 살 수 있는 보편적인 아이템으로, 이미 옷장에 있는 것과 겹치지 않게 한다.\n"
        "- name·color는 한국어로 (색은 블랙·아이보리처럼 패션 음차).\n"
        "- reason은 왜 이 옷장에 이 아이템이 필요한지 한 문장(한국어).\n"
        f"- 나머지 {max_combos - n}개는 옷장 아이템만으로 만든다.\n"
    )


_WISH_CATEGORIES = ("top", "bottom", "skirt", "outer", "dress", "shoes", "bag", "hat", "misc")


def _clean_wish(raw: Any) -> dict[str, Any] | None:
    """모델이 제안한 '옷장에 없는 아이템'을 정리한다. 카테고리가 없으면 버린다."""
    if not isinstance(raw, dict):
        return None
    category = str(raw.get("category") or "").strip().lower()
    if category not in _WISH_CATEGORIES:
        return None
    name = str(raw.get("name") or "").strip()[:40]
    if not name:
        return None
    raw_color = str(raw.get("color") or "").strip()[:20]
    return {
        "name": name,
        "category": category,
        # 옷장 아이템과 같은 표기로 맞춘다 (black → 블랙)
        "color": _canonicalize_color(raw_color) if raw_color else "",
        "reason": str(raw.get("reason") or "").strip()[:120],
    }


def recommend_text(
    user_id: str,
    anchor: dict[str, Any] | None,
    items: list[dict[str, Any]],
    style: str,
    max_combos: int,
    exclude_item_ids: list[list[str]] | None = None,
    styles: list[str] | None = None,
    profile: dict[str, Any] | None = None,
    include_ids: list[str] | None = None,
    wish_combos: int = 0,
) -> list[dict[str, Any]]:
    if not items:
        return []
    catalog = "\n".join(_catalog_line(item) for item in items)
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
    print(
        f"[recommend] start pool={len(items)} styles={uniq_styles} max_combos={max_combos} anchor={bool(anchor)}",
        flush=True,
    )
    if not openai_client or AI_TEST_MODE:
        print("[recommend] no openai client / TEST MODE — fallback ($0)", flush=True)
        return fallback_combos(items, anchor, max_combos, tone, exclude_keys, uniq_styles, profile, include_ids)
    prompt = f"""당신은 퍼스널 스타일리스트다. 사용자의 옷장 목록만 사용해 실제로 입고 나갈 만한 코디를 최대 {max_combos}개 만들어라.
사용자가 마이페이지에서 설정한 선호 무드 id: {style_id_note}
선호 무드 설명: {tone}
{_profile_block(profile)}{('기준 아이템 id=' + anchor['id']) if anchor else '기준 아이템 없음'}

옷장(id | 카테고리 | 색 | 이름 | 종류 | 속성):
{catalog}
{exclude_note}
{_COORD_RULES}
{_include_note(include_ids, items)}{_wish_note(wish_combos, max_combos)}
규칙:
- item_ids에는 위 목록에 있는 id만 넣기
- 한 코디에는 반드시 상의(또는 아우터/원피스)와 하의(또는 스커트/원피스)를 포함. 상의+신발만, 하의 없는 조합 금지
- 원피스 1벌이면 상의·하의 요건을 충족한 것으로 봄
- 그 외 신발·가방·모자·소품은 선택
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
{{"combos":[{{"label":"", "mood":"", "styles":["minimal"], "item_ids":["..."], "wish":{{"name":"","category":"top|bottom|skirt|outer|dress|shoes|bag|hat|misc","color":"","reason":""}}}}]}}
wish는 제안 아이템이 있는 코디에만 넣고, 나머지 코디에서는 아예 생략한다.
"""
    try:
        # 추천은 실패해도 fallback_combos가 있으니, Render 프록시(~100초)보다 짧게 제한
        response = openai_client.with_options(timeout=60).chat.completions.create(
            model=OPENAI_VISION_MODEL,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.35,
        )
        data = json.loads(response.choices[0].message.content or "{}")
        valid = {item["id"]: item for item in items}
        allowed_styles = set(uniq_styles)
        combos = []
        seen: set[tuple[str, ...]] = set(exclude_keys)
        must = [str(i) for i in (include_ids or []) if str(i) in valid]
        wish_left = max(0, min(int(wish_combos or 0), max_combos))
        for combo in data.get("combos") or []:
            ids = [item_id for item_id in combo.get("item_ids", []) if item_id in valid]
            if anchor and anchor["id"] not in ids:
                ids = [anchor["id"], *ids]
            # 옷장에서 고른 아이템은 빠지면 안 된다. 모델이 빼먹었으면 앞에 되돌려 넣는다.
            for keep in reversed(must):
                if keep not in ids:
                    ids = [keep, *ids]
            ids = ids[: max(4, len(must) + 1)]
            wish = _clean_wish(combo.get("wish")) if wish_left else None
            if not ids or (len(ids) < 2 and not wish):
                continue
            if must and not all(keep in ids for keep in must):
                continue
            if not _combo_has_top_and_bottom(ids, valid, wish):
                continue
            key = tuple(sorted(ids) + ([f"wish:{wish['category']}:{wish['name']}"] if wish else []))
            if key in seen:
                continue
            seen.add(key)
            if wish:
                wish_left -= 1
            combo_styles = [s for s in (combo.get("styles") or []) if s in allowed_styles][:2]
            if not combo_styles:
                combo_styles = [uniq_styles[len(combos) % len(uniq_styles)]]
            combos.append(
                {
                    "label": combo.get("label") or "추천 코디",
                    "mood": combo.get("mood") or _style_tone(combo_styles[0]),
                    "styles": combo_styles,
                    "item_ids": ids,
                    **({"wish": wish} if wish else {}),
                }
            )
            if len(combos) >= max_combos:
                break
        log_ai_usage(
            user_id, "recommend_text", OPENAI_VISION_MODEL, {"count": len(combos)},
            usage=getattr(response, "usage", None),
        )
        if not combos:
            print("[recommend] ai returned 0 usable combos — fallback", flush=True)
            return fallback_combos(items, anchor, max_combos, tone, exclude_keys, uniq_styles, profile, include_ids)
        # 모델이 max_combos개를 돌려줘도 중복·상하의 미충족으로 걸러지면 그만큼 비어 버린다.
        # 옷장에 남은 조합이 있는데 개수가 모자라면 결정적 페어링으로 채운다.
        if len(combos) < max_combos:
            short = max_combos - len(combos)
            for extra in fallback_combos(items, anchor, short, tone, seen, uniq_styles, profile, include_ids):
                key = tuple(sorted(extra["item_ids"]))
                if key in seen:
                    continue
                seen.add(key)
                combos.append(extra)
                if len(combos) >= max_combos:
                    break
            print(f"[recommend] topped up {len(combos) - (max_combos - short)} combo(s) from wardrobe pairs", flush=True)
        print(f"[recommend] ok via=ai combos={len(combos)}", flush=True)
        return combos
    except Exception as exc:  # noqa: BLE001
        print(f"[recommend] ai call failed: {exc} — fallback", flush=True)
        return fallback_combos(items, anchor, max_combos, tone, exclude_keys, uniq_styles, profile, include_ids)


def _item_bucket(item: dict[str, Any]) -> str:
    cat = (item.get("category") or "").lower()
    if cat in ("top", "상의", "outer", "아우터"):
        return "top"
    if cat in ("bottom", "하의", "skirt", "스커트"):
        return "bottom"
    if cat in ("dress", "원피스"):
        return "dress"
    if cat in ("shoes", "신발"):
        return "shoes"
    return "other"


def _combo_has_top_and_bottom(
    ids: list[str], by_id: dict[str, Any], wish: dict[str, Any] | None = None
) -> bool:
    """상의(또는 아우터/원피스) + 하의(또는 원피스) 필수. 제안 아이템도 한 자리로 센다."""
    buckets = [_item_bucket(by_id[i]) for i in ids if i in by_id]
    if wish:
        buckets.append(_item_bucket(wish))
    if "dress" in buckets:
        return True
    return ("top" in buckets) and ("bottom" in buckets)


_NEUTRAL_COLORS = ("블랙", "화이트", "그레이", "네이비", "아이보리", "베이지", "차콜")


def _pair_score(a: dict[str, Any], b: dict[str, Any], profile: dict[str, Any] | None) -> float:
    """두 아이템이 같은 코디에 들어갈 만한지 점수로 본다(규칙 기반 경로용).

    AI가 실패하거나 개수가 모자랄 때 쓰는 페어링이 '상의 목록 × 하의 목록 첫 조합'
    이어서, 정장 슬랙스에 트레이닝 후디가 붙는 식이었다. 숨은 속성으로 걸러낸다.
    """
    sa, sb = _row_style(a), _row_style(b)
    score = 0.0
    fa, fb = sa.get("formality"), sb.get("formality")
    if isinstance(fa, int) and isinstance(fb, int):
        gap = abs(fa - fb)
        score += 2.0 if gap <= 1 else (-1.0 if gap == 2 else -4.0)
    ta, tb = sa.get("tone"), sb.get("tone")
    if ta and tb:
        score += 1.0 if (ta == tb or "neutral" in (ta, tb)) else -1.5
    pa, pb = sa.get("pattern", "solid"), sb.get("pattern", "solid")
    if pa != "solid" and pb != "solid":
        score -= 2.0
    big = {"oversized", "wide", "relaxed"}
    if sa.get("fit") in big and sb.get("fit") in big:
        score -= 1.0
    seasons_a = set((a.get("metadata") or {}).get("seasons") or [])
    seasons_b = set((b.get("metadata") or {}).get("seasons") or [])
    if seasons_a and seasons_b and not (seasons_a & seasons_b):
        score -= 1.5
    # 퍼스널 컬러는 얼굴에 닿는 쪽(a=상의)만 본다
    pc = _PC_GUIDE.get(str((profile or {}).get("personal_color") or "").strip())
    if pc:
        _name, tone, depth, chroma = pc
        if sa.get("tone") == tone:
            score += 1.0
        if sa.get("depth") == depth:
            score += 0.5
        if sa.get("chroma") == chroma:
            score += 0.5
    # 색이 둘 다 튀면 감점, 한쪽이 무채색이면 가점
    ca, cb = str(a.get("color") or ""), str(b.get("color") or "")
    if any(n in ca for n in _NEUTRAL_COLORS) or any(n in cb for n in _NEUTRAL_COLORS):
        score += 0.5
    return score


def fallback_combos(
    items: list[dict[str, Any]],
    anchor: dict[str, Any] | None,
    max_combos: int,
    mood: str = "내 옷장 기반 추천",
    exclude_keys: set[tuple[str, ...]] | None = None,
    styles: list[str] | None = None,
    profile: dict[str, Any] | None = None,
    include_ids: list[str] | None = None,
) -> list[dict[str, Any]]:
    """상의×하의 고유 페어만 만든다. 부족하면 억지로 복제하지 않는다."""
    tops = [i for i in items if _item_bucket(i) in ("top", "dress")]
    bottoms = [i for i in items if _item_bucket(i) in ("bottom", "dress")]
    shoes = [i for i in items if _item_bucket(i) == "shoes"]
    by_id = {i["id"]: i for i in items}
    combos: list[dict[str, Any]] = []
    seen: set[tuple[str, ...]] = set(exclude_keys or ())
    style_cycle = [s for s in (styles or []) if s] or []

    must = [str(i) for i in (include_ids or []) if str(i) in by_id]

    def _push(ids: list[str], label: str) -> None:
        if len(ids) < 2:
            return
        if anchor and anchor["id"] not in ids:
            ids = [anchor["id"], *[x for x in ids if x != anchor["id"]]]
        for keep in reversed(must):
            if keep not in ids:
                ids = [keep, *ids]
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

    # 점수가 높은 페어부터. 같은 상의가 연달아 나오지 않게 살짝 흩는다.
    pairs = [
        (t, b, _pair_score(t, b, profile))
        for t in tops
        for b in bottoms
        if t["id"] != b["id"]
    ]
    pairs.sort(key=lambda x: -x[2])
    used_tops: dict[str, int] = {}
    for t, b, _score in pairs:
        seen_count = used_tops.get(t["id"], 0)
        if seen_count and len(combos) < max_combos - 1:
            continue  # 다른 상의를 먼저 보여준다
        ids = [t["id"], b["id"]]
        if shoes:
            best_shoe = max(shoes, key=lambda sh: _pair_score(b, sh, profile))
            ids.append(best_shoe["id"])
        before = len(combos)
        _push(ids, f"추천 코디 {len(combos) + 1}")
        if len(combos) > before:
            used_tops[t["id"]] = seen_count + 1
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
    if not AI_TEST_MODE and (
        not openai_client or not charge_credit(user_id, "look_image", {"cache_key": key})
    ):
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
        if AI_TEST_MODE:
            print("[look] TEST MODE — 로컬 콜라주만, AI 미호출 ($0)", flush=True)
            out = source.getvalue()  # 위에서 만든 콜라주 보드를 그대로 사용
        else:
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
        if not AI_TEST_MODE:
            log_ai_usage(user_id, "look_image", OPENAI_IMAGE_MODEL, {"quality": OPENAI_IMAGE_QUALITY})
        return image_url
    except Exception:
        return None


def _decode_data_url(data_url: str | None) -> bytes | None:
    """마이페이지 프로필 사진은 data URL로 넘어온다(서버에 따로 저장하지 않음)."""
    if not data_url or "," not in data_url:
        return None
    try:
        return base64.b64decode(data_url.split(",", 1)[1])
    except Exception:
        return None


def _model_look_board(face_bytes: bytes, items: list[dict[str, Any]]) -> bytes:
    """참고 보드 — 왼쪽 위에 얼굴, 나머지 칸에 이 코디의 옷."""
    board = Image.new("RGB", (1024, 1024), (242, 241, 238))
    face = Image.open(io.BytesIO(face_bytes)).convert("RGB")
    face.thumbnail((432, 432))
    board.paste(face, (40, 40))
    # 얼굴 자리(왼쪽 위)를 뺀 ㄱ자 영역에 옷을 채운다.
    slots = [
        (536, 40, 984, 488), (40, 536, 344, 840), (360, 536, 664, 840),
        (680, 536, 984, 840), (40, 856, 344, 1000), (360, 856, 664, 1000),
    ]
    for slot, item in zip(slots, items):
        try:
            raw = supabase_admin.storage.from_(SUPABASE_BUCKET).download(item["storage_path"])
            image = Image.open(io.BytesIO(raw)).convert("RGBA")
        except Exception:
            continue
        x1, y1, x2, y2 = slot
        image.thumbnail((x2 - x1, y2 - y1))
        board.paste(image, (x1 + ((x2 - x1) - image.width) // 2, y1 + ((y2 - y1) - image.height) // 2), image)
    buf = io.BytesIO()
    board.save(buf, format="PNG")
    return buf.getvalue()


_MODEL_LOOK_PROMPT = """왼쪽 위 인물 사진의 얼굴을 그대로 유지한 채, 나머지 참고 이미지의 옷을 모두 입은 전신 패션 화보를 만드세요.
- 인물 한 명, 정면 전신. 머리끝부터 신발까지 잘리지 않게
- 참고한 옷만 착용하고, 색·형태·프린트·디테일을 바꾸지 마세요
- 배경은 #F2F1EE 단색 스튜디오, 자연스러운 조명
- 텍스트, 로고, 워터마크, 프레임, 다른 사람 추가 금지
"""


def _body_note(profile: dict[str, Any] | None) -> str:
    """키·몸무게가 있으면 그림에 반영할 한 줄. 없으면 빈 문자열(아무 말도 하지 않는다)."""
    p = profile or {}
    h = str(p.get("height") or "").strip()
    w = str(p.get("weight") or "").strip()
    if not h and not w:
        return ""
    bits = " ".join(x for x in (f"키 {h}cm" if h else "", f"몸무게 {w}kg" if w else "") if x)
    return f"- 인물의 체형은 {bits} 정도로. 실제와 비슷한 비율로 그리고, 과장하지 마세요\n"


def generate_model_look_image(
    user_id: str, item_ids: list[str], items: list[dict[str, Any]], face_bytes: bytes,
    profile: dict[str, Any] | None = None,
) -> str | None:
    """프로필 사진 얼굴을 쓴 모델이 이 코디를 입은 전신 컷.

    플랫레이보다 비싼 경로라 마이페이지 토글이 켜진 사용자가 '코디 추천받기'를
    눌렀을 때만 탄다. 캐시 키에 얼굴 지문을 섞어, 프로필 사진을 바꾸면 같은
    조합이어도 다시 만든다(예전 얼굴이 남아 있으면 더 이상하다).
    """
    face_sig = hashlib.sha256(face_bytes).hexdigest()[:8]
    body_note = _body_note(profile)
    body_sig = hashlib.sha256(body_note.encode()).hexdigest()[:4] if body_note else "0000"
    key = f"model-{look_cache_key(item_ids)}-{face_sig}-{body_sig}"
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
    if not AI_TEST_MODE and (
        not openai_client or not charge_credit(user_id, "model_look", {"cache_key": key})
    ):
        return None
    try:
        board = _model_look_board(face_bytes, items)
        if AI_TEST_MODE:
            print("[model-look] TEST MODE — 참고 보드만, AI 미호출 ($0)", flush=True)
            out = board
        else:
            source = io.BytesIO(board)
            source.name = "model-look-reference.png"
            result = openai_client.images.edit(
                model=OPENAI_IMAGE_MODEL,
                image=source,
                prompt=_MODEL_LOOK_PROMPT + body_note,
                size="1024x1536",
                quality=OPENAI_IMAGE_QUALITY,
            )
            out = base64.b64decode(result.data[0].b64_json)
        storage_path = f"{user_id}/looks/{key}.png"
        image_url = upload_bytes(storage_path, out, "image/png")
        supabase_admin.table("generated_images").insert(
            {"user_id": user_id, "cache_key": key, "kind": "model_look", "storage_path": storage_path, "image_url": image_url}
        ).execute()
        if not AI_TEST_MODE:
            log_ai_usage(user_id, "model_look", OPENAI_IMAGE_MODEL, {"quality": OPENAI_IMAGE_QUALITY})
        return image_url
    except Exception as exc:  # noqa: BLE001
        print(f"[model-look] skip: {exc}", flush=True)
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
        require_fashion_item(meta)
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
        raise HTTPException(status_code=400, detail="어떤 옷과 맞춰 볼지 먼저 골라 주세요.")
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
        raise HTTPException(status_code=404, detail="고민 중인 옷을 찾지 못했어요. 다시 올려 주세요.")
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
        raise HTTPException(status_code=400, detail="코디를 만들려면 옷장에 옷이 2개 이상 필요해요.")
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
    # 이미 옷장에 있는 상품이면 추출·저장을 건너뛴다. 일괄 등록에서 특히 중요하다 —
    # 프론트가 걸러 주지 않더라도 여기서 막아야 중복도 비용도 막힌다.
    skip_duplicate: bool = True


class LiveCoordinate(BaseModel):
    max_combos: int = 4
    style: str = "dandy"
    # 마이페이지 선호 무드(복수 가능). 있으면 style보다 우선해 톤에 반영
    styles: list[str] = []
    anchor_id: str | None = None
    # 이미 보여준 조합(item id 목록) — 더 추천 시 중복 방지
    exclude_item_ids: list[list[str]] = []
    # 마이페이지 'AI 착장 이미지' 토글. 켜져 있으면 코디마다 전신 컷을 만든다(비용 큼).
    model_look: bool = False
    face_data_url: str | None = None
    # 오늘 코디의 날짜 선택 — 어느 날짜용으로 만든 코디인지 남긴다 (YYYY-MM-DD)
    for_date: str | None = None
    # 옷장에서 고른 아이템 — 모든 코디에 반드시 들어간다 (선택 기반 추천)
    include_item_ids: list[str] = []
    # 옷장에 없는 아이템 하나를 제안으로 끼운 코디 수 (0이면 옷장 안에서만)
    wish_combos: int = 0
    # 마이페이지 프로필 — 퍼스널 컬러·선호 실루엣·색 계열까지 코디에 반영한다
    personal_color: str | None = None
    fit: str | None = None
    palettes: list[str] = []
    gender: str | None = None
    age: str | None = None
    # 선택 입력. 있으면 착장 이미지와 코디 설명을 체형에 맞춘다.
    height: str | None = None
    weight: str | None = None


class LiveStatus(BaseModel):
    ids: list[str] = []
    status: str = "owned"


# ---- 중복 감지 -----------------------------------------------------------------
# 이미 등록한 옷을 구매내역에서 또 담으면 옷장이 지저분해지고 추출 비용도 두 번 든다.
# 주소만 비교하면 같은 상품을 다른 경로(모바일 도메인·단축 URL·다른 몰)로 담은 경우를
# 놓치므로, 신호를 여러 개 쓴다. 전부 AI 없이 계산한다(주소·상품코드·이름·사진 해시).

_DUP_STOPWORDS = {
    "유니섹스", "남성", "여성", "공용", "정품", "신상", "무료배송", "단독",
    "기획", "세트", "택배", "국내배송", "새상품", "미착용",
}
_SIZE_TOKEN = re.compile(r"^(xxs|xs|s|m|l|xl|xxl|2xl|3xl|free|\d{2,3}(cm|mm)?)$", re.I)


def _product_code(url: str) -> str:
    """상품 식별자. 쿼리(goodsNo=…)나 경로 끝의 긴 숫자."""
    try:
        u = urlparse(url)
    except Exception:  # noqa: BLE001
        return ""
    q = parse_qs(u.query or "")
    for key in ("goodsno", "productno", "itemid", "prdno", "goods_no", "product_id", "productid"):
        for k, vals in q.items():
            if k.lower() == key and vals and vals[0].strip():
                return f"{key}:{vals[0].strip()}"
    tail = [seg for seg in (u.path or "").split("/") if seg]
    for seg in reversed(tail):
        if re.fullmatch(r"\d{5,}", seg):
            return f"path:{seg}"
    return ""


def _url_key(url: str) -> str:
    """추적 파라미터·꼬리 슬래시·m. 서브도메인을 떼고 남는 주소."""
    try:
        u = urlparse(url if re.match(r"^https?://", url or "", re.I) else f"https://{url}")
    except Exception:  # noqa: BLE001
        return (url or "").strip().lower()
    host = (u.hostname or "").lower()
    host = re.sub(r"^(www|m|mobile|order|shop|store)\.", "", host)
    code = _product_code(url)
    path = (u.path or "").rstrip("/").lower()
    return f"{host}{path}" + (f"|{code}" if code else "")


def _name_tokens(name: str) -> set[str]:
    """이름을 비교 가능한 토큰으로. 대괄호·색·사이즈·판매문구는 버린다."""
    text = html_lib.unescape(str(name or ""))
    text = re.sub(r"[\[\(\{][^\]\)\}]*[\]\)\}]", " ", text)   # [유니섹스] (단독) 등
    text = text.split("_")[0] if "_" in text else text             # 이름_색상
    text = re.sub(r"[^0-9A-Za-z가-힣]+", " ", text).strip().lower()
    out = set()
    for tok in text.split():
        if len(tok) < 2 or tok in _DUP_STOPWORDS or _SIZE_TOKEN.match(tok):
            continue
        if _norm_color_token(tok) in {_norm_color_token(c) for c in COLOR_WORDS}:
            continue
        out.add(tok)
    return out


def _name_similarity(a: set[str], b: set[str]) -> float:
    """토큰 포함도. 한쪽이 다른 쪽을 거의 담고 있으면 같은 상품으로 본다."""
    if not a or not b:
        return 0.0
    inter = len(a & b)
    return inter / min(len(a), len(b))


def _content_crop(rgb: Image.Image) -> Image.Image:
    """상품컷은 대부분이 빈 배경이라 그대로 지문을 뜨면 서로 다 비슷해진다.
    배경색과 다른 영역(=옷)만 잘라 낸 뒤 비교한다."""
    w, h = rgb.size
    edge = rgb.crop((0, 0, w, max(1, h // 20)))
    ext = edge.getextrema()
    bg = tuple((lo + hi) // 2 for lo, hi in ext)
    diff = ImageChops.difference(rgb, Image.new("RGB", rgb.size, bg)).convert("L")
    box = diff.point(lambda v: 255 if v > 24 else 0).getbbox()
    if not box:
        return rgb
    bw, bh = box[2] - box[0], box[3] - box[1]
    if bw < w * 0.15 or bh < h * 0.15:
        return rgb
    return rgb.crop(box)


_FP_VERSION = 2
_FP_GRID = 16   # dHash 해상도(16×16 = 256bit). 64bit는 '흰 배경 + 어두운 옷'끼리 너무 쉽게 겹쳤다.
_FP_COLOR = 6   # 색 격자(6×6×3 = 108값)


def _image_fingerprint(raw: bytes) -> dict[str, Any] | None:
    """사진 지문: 형태(dHash 256bit) + 색(6×6 평균색).

    상품컷은 대부분 흰 배경이라 저해상도 해시로는 '어두운 상의'끼리 다 비슷해진다.
    해상도를 올리고 색까지 함께 봐야 '같은 옷 다른 색'과 '다른 옷 같은 배경'을 가른다.
    리사이즈·재압축·약한 크롭에는 견딘다."""
    try:
        rgb = _content_crop(Image.open(io.BytesIO(raw)).convert("RGB"))
    except Exception:  # noqa: BLE001
        return None
    gray = rgb.convert("L").resize((_FP_GRID + 1, _FP_GRID), Image.BILINEAR)
    px = gray.load()
    bits = 0
    for y in range(_FP_GRID):
        for x in range(_FP_GRID):
            bits = (bits << 1) | (1 if px[x, y] > px[x + 1, y] else 0)
    cells = rgb.resize((_FP_COLOR, _FP_COLOR), Image.BILINEAR)
    color = list(cells.tobytes())   # RGB 순서로 평탄화된 값
    return {"v": _FP_VERSION, "d": bits, "c": color}


def _hamming(a: int, b: int) -> int:
    return bin(a ^ b).count("1")


def _color_distance(a: list[int], b: list[int]) -> float:
    if not a or not b or len(a) != len(b):
        return 255.0
    return sum(abs(x - y) for x, y in zip(a, b)) / len(a)


def _fp_usable(fp: Any) -> bool:
    return isinstance(fp, dict) and fp.get("v") == _FP_VERSION and isinstance(fp.get("d"), int)


def _fp_match(a: dict[str, Any] | None, b: dict[str, Any] | None) -> str:
    """두 지문이 같은 사진인지. 'same'(확실) / 'near'(비슷) / ''(다름).

    256비트 중 8%(20비트) 이내 + 색 차이 10 이내면 같은 사진으로 본다. 쇼핑몰은 같은
    상품에 같은 사진을 쓰므로 이 정도면 리사이즈·재압축 차이만 흡수한다."""
    if not (_fp_usable(a) and _fp_usable(b)):
        return ""
    shape = _hamming(a["d"], b["d"])
    color = _color_distance(a.get("c") or [], b.get("c") or [])
    if shape <= 20 and color <= 10:
        return "same"
    if shape <= 40 and color <= 18:
        return "near"
    return ""


def _fetch_bytes(url: str, limit: int = 3_000_000) -> bytes | None:
    if not url:
        return None
    try:
        res = requests.get(url, timeout=8, stream=True)
        if res.status_code >= 400:
            return None
        raw = res.raw.read(limit + 1, decode_content=True)
        return raw if raw and len(raw) <= limit else (raw[:limit] if raw else None)
    except Exception:  # noqa: BLE001
        return None


def _wardrobe_dupe_index(user_id: str, with_hashes: bool = True) -> list[dict[str, Any]]:
    """중복 비교용 옷장 색인. 사진 해시는 metadata에 저장해 두고 재사용한다.

    지운 아이템은 넣지 않는다 — 사용자가 지웠으면 다시 담을 수 있어야 한다.
    보관(archived)은 넣는다 — 옷장에 있는 옷이다.
    """
    rows = (
        supabase_admin.table("wardrobe_items")
        .select("id,name,color,image_url,metadata,status")
        .eq("user_id", user_id)
        .neq("status", "deleted")
        .limit(1000)
        .execute()
        .data
        or []
    )
    index: list[dict[str, Any]] = []
    missing: list[dict[str, Any]] = []
    for row in rows:
        meta = row.get("metadata") or {}
        entry = {
            "id": row["id"],
            "name": row.get("name") or "",
            "tokens": _name_tokens(row.get("name")),
            "color": _norm_color_token(_split_color_from_title(row.get("name") or "")[1] or row.get("color") or ""),
            "brand": str(meta.get("brand") or "").strip().lower(),
            "store": str(meta.get("store") or "").strip().lower(),
            "url_key": _url_key(str(meta.get("source_url") or "")),
            "code": _product_code(str(meta.get("source_url") or "")),
            "fp": meta.get("img_fp") if _fp_usable(meta.get("img_fp")) else None,
            "meta": meta,
        }
        index.append(entry)
        if with_hashes and not _fp_usable(entry["fp"]):
            missing.append(entry)

    if missing:
        # 원본(쇼핑몰에서 받은 사진)을 해시한다. 컷아웃 결과는 배경이 지워져 있어
        # 쇼핑몰 썸네일과 비교되지 않는다.
        def fill(entry: dict[str, Any]) -> None:
            meta = entry["meta"]
            src = meta.get("original_url") or ""
            raw = _fetch_bytes(src)
            fp = _image_fingerprint(raw) if raw else None
            if not fp:
                return
            entry["fp"] = fp
            patch = dict(meta)
            patch["img_fp"] = fp
            try:
                (
                    supabase_admin.table("wardrobe_items")
                    .update({"metadata": patch})
                    .eq("id", entry["id"])
                    .eq("user_id", user_id)
                    .execute()
                )
            except Exception as exc:  # noqa: BLE001
                print(f"[dupe] hash save failed {entry['id']}: {exc}", flush=True)

        with ThreadPoolExecutor(max_workers=8) as pool:
            list(pool.map(fill, missing[:120]))
    return index


def _match_duplicate(
    index: list[dict[str, Any]],
    *,
    url: str = "",
    name: str = "",
    brand: str = "",
    store: str = "",
    color: str = "",
    fp: dict[str, Any] | None = None,
) -> tuple[dict[str, Any], str] | None:
    """후보 하나가 옷장의 어떤 아이템과 같은지 본다. (아이템, 이유) 또는 None."""
    url_key = _url_key(url) if url else ""
    code = _product_code(url) if url else ""
    tokens = _name_tokens(name)
    brand_l = str(brand or "").strip().lower()
    store_l = str(store or "").strip().lower()
    # 이름에 색이 붙어 오는 경우가 많다(…셔츠_블루). 색까지 알면 '같은 상품 다른 색'을 가른다.
    cand_color = _norm_color_token(_split_color_from_title(name or "")[1] or color or "")

    def color_conflict(row: dict[str, Any]) -> bool:
        return bool(cand_color and row.get("color") and cand_color != row["color"])
    best: tuple[dict[str, Any], str] | None = None
    for row in index:
        if url_key and row["url_key"] and url_key == row["url_key"]:
            return row, "same_url"
        if code and row["code"] and code == row["code"]:
            return row, "same_code"
        photo = _fp_match(fp, row.get("fp")) if fp else ""
        # 사진이 같아 보여도 이름이 완전히 다르면(공통 토큰 0) 단정하지 않는다 —
        # 흰 배경 상품컷끼리는 형태가 우연히 닮을 수 있다.
        if photo == "same" and len(tokens) >= 2 and row["tokens"] and _name_similarity(tokens, row["tokens"]) < 0.34:
            photo = "near"
        if photo == "same":
            return row, "same_photo"
        if photo == "near" and _name_similarity(tokens, row["tokens"]) >= 0.6 and not color_conflict(row):
            best = best or (row, "same_photo_name")
        # 이름만 같은 경우는 색이 다르면 다른 상품으로 둔다 — 같은 옷의 다른 색을
        # 일부러 둘 다 담아 둔 사람이 있다(주소·상품코드·사진이 같으면 위에서 이미 잡힌다).
        sim = _name_similarity(tokens, row["tokens"])
        if color_conflict(row):
            continue
        if sim >= 0.9 and len(tokens) >= 2:
            best = best or (row, "same_name")
        elif sim >= 0.75 and len(tokens) >= 2 and (
            (brand_l and brand_l == row["brand"]) or (store_l and store_l == row["store"])
        ):
            best = best or (row, "same_name_brand")
    return best


_DUP_REASON_KO = {
    "same_url": "같은 상품 주소예요",
    "same_code": "같은 상품이에요",
    "same_photo": "사진이 같아요",
    "same_photo_name": "사진과 이름이 거의 같아요",
    "same_name": "이름이 거의 같아요",
    "same_name_brand": "같은 브랜드의 같은 이름이에요",
}


def live_item_payload(row: dict[str, Any]) -> dict[str, Any]:
    meta = row.get("metadata") or {}
    raw_color = (row.get("color") or "").strip()
    return {
        "id": row["id"],
        "serverId": row["id"],
        "name": row.get("name") or "옷",
        "category": _category_display(row.get("category")),
        "color": _canonicalize_color(raw_color) if raw_color else "",
        "img": row.get("image_url"),
        # 목록용 작은 이미지. 없으면 원본을 쓴다(예전에 담은 아이템).
        "thumb": meta.get("thumb_url") or row.get("image_url"),
        "status": row.get("status"),
        "brand": meta.get("brand") or "",
        "size": meta.get("size") or "",
        "store": meta.get("store") or "",
        "note": row.get("note") or meta.get("note") or "",
        "sourceUrl": meta.get("source_url") or "",
        "extractWarning": meta.get("extract_warning") or "",
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
        "seasons": _clean_seasons(meta.get("seasons")),
    }


class LiveItemUpdate(BaseModel):
    name: str | None = None
    color: str | None = None
    brand: str | None = None
    size: str | None = None
    store: str | None = None
    note: str | None = None
    category: str | None = None  # KO('상의') 또는 EN('top')
    seasons: list[str] | None = None  # ["spring","autumn"] 등, 다중 선택


class ReplaceImageConfirm(BaseModel):
    storage_path: str
    image_url: str
    metadata: dict[str, Any] = {}


def _find_cached_extraction(user_id: str, source_hash: str, hint: str) -> dict[str, Any] | None:
    """같은 원본과 동일한 추출 규격의 성공 결과만 재사용한다."""
    try:
        rows = (
            supabase_admin.table("wardrobe_items")
            .select("name,category,color,image_url,storage_path,metadata")
            .eq("user_id", user_id)
            .neq("status", "deleted")
            .contains(
                "metadata",
                {
                    "source_hash": source_hash,
                    "extract_profile": _EXTRACTION_PROFILE,
                    "extract_hint": hint[:200],
                },
            )
            .limit(1)
            .execute()
            .data
            or []
        )
        row = rows[0] if rows else None
        return row if row and row.get("image_url") and row.get("storage_path") else None
    except Exception as exc:  # noqa: BLE001
        print(f"[extract] cache lookup skipped: {exc}", flush=True)
        return None


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
    report: Callable[[str], None] | None = None,
) -> dict[str, Any]:
    step = report or (lambda _key: None)
    hint = (extract_hint or "").strip()[:500]
    source_hash = hashlib.sha256(raw).hexdigest()
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(raw)
        tmp_path = tmp.name
    try:
        original_path = f"{user_id}/original/{uuid.uuid4().hex}{suffix}"
        step("cache")
        cached = _find_cached_extraction(user_id, source_hash, hint)
        if cached:
            # 같은 원본은 메타와 제품 컷을 재사용한다. Vision/이미지 생성을 다시
            # 호출하지 않는 것이 캐시의 핵심이며, 원본만 새 아이템에 연결해 둔다.
            cached_meta = dict(cached.get("metadata") or {})
            meta = {
                "name": cached.get("name") or "새 옷",
                "category": cached.get("category") or "top",
                "color": cached.get("color") or "neutral",
                "tags": cached_meta.get("tags") or [],
                "seasons": cached_meta.get("seasons") or [],
                "has_text_logo": bool(cached_meta.get("has_text_logo")),
                "logo_text": str(cached_meta.get("logo_text") or ""),
                "style": cached_meta.get("style") or {},
                "extract_hint": hint,
                "_extract_mode": "cache",
                "_extract_policy": {"tier": "cache", "quality": "cached", "timeout_s": 0},
            }
            original_url = upload_bytes(original_path, raw, content_type)
            classify_ms = 0
            extract_ms = 0
            triage: dict[str, Any] = {}
            product_bytes = None
            thumb_url = ""
        else:
            thumb_url = ""
            # 분류로 패션 여부를 먼저 본 뒤, 통과할 때만 업로드·트리아지·컷아웃.
            step("classify")
            classify_started = time.perf_counter()
            meta = classify_item(tmp_path, hint, user_id=user_id)
            classify_ms = int((time.perf_counter() - classify_started) * 1000)
            require_fashion_item(meta)
            step("upload")
            with ThreadPoolExecutor(max_workers=2) as pool:
                triage_future = pool.submit(_fast_extract_triage, tmp_path, hint)
                upload_future = pool.submit(upload_bytes, original_path, raw, content_type)
                triage = triage_future.result()
                original_url = upload_future.result()
            # URL 타이틀·비전 분류 모두 `_색상`이 이름에 붙을 수 있어 저장 직전 한 번 더 분리.
            item_name, item_color = _normalize_item_name_color(
                (name_override or "").strip() or meta.get("name") or "새 옷",
                (color_override or "").strip() or meta.get("color") or "neutral",
            )
            meta = {**meta, "name": item_name, "color": item_color, "extract_hint": hint}
            step("cutout")
            extract_started = time.perf_counter()
            product_bytes = resolve_product_image(user_id, tmp_path, meta, triage, report=report)
            extract_ms = int((time.perf_counter() - extract_started) * 1000)
        item_name, item_color = _normalize_item_name_color(
            (name_override or "").strip() or meta.get("name") or "새 옷",
            (color_override or "").strip() or meta.get("color") or "neutral",
        )
        meta["name"], meta["color"] = item_name, item_color
        step("save")
        image_path, image_url = original_path, original_url
        if cached:
            image_path, image_url = cached["storage_path"], cached["image_url"]
            meta["_extract_mode"] = "cache"
        elif product_bytes:
            image_path, image_url, thumb_url = save_product_image_set(user_id, product_bytes)
        # brand/store/source_url은 스키마 변경 없이 metadata(jsonb)에 저장.
        # original_* 는 이미지 재추출 시 원본 소스로 사용.
        item_metadata: dict[str, Any] = {
            "tags": meta.get("tags") or [],
            "seasons": _clean_seasons(meta.get("seasons")),
            # 코디 추천용 숨은 속성 (화면에는 안 쓴다)
            "style": _clean_style_attrs(meta.get("style")),
            "original_path": original_path,
            "original_url": original_url,
            "has_text_logo": bool(meta.get("has_text_logo")),
            "logo_text": str(meta.get("logo_text") or "").strip()[:80],
            "source_hash": source_hash,
            # 중복 비교용 사진 지문. 지금 원본 바이트를 들고 있으니 여기서 남겨 두면
            # 나중에 비교할 때 이미지를 다시 내려받지 않아도 된다.
            "img_fp": _image_fingerprint(raw),
            "thumb_url": thumb_url if (not cached and product_bytes) else (cached_meta.get("thumb_url") if cached else ""),
            "extract_profile": _EXTRACTION_PROFILE,
            "extraction_timing": {
                "classify_ms": classify_ms,
                "extract_ms": extract_ms,
                "cache_hit": bool(cached),
            },
        }
        if cached or product_bytes:
            item_metadata["bg_norm"] = _BG_NORM_VERSION
            if meta.get("_extract_mode"):
                item_metadata["extract_mode"] = meta["_extract_mode"]
            if meta.get("_extract_warning"):
                item_metadata["extract_warning"] = meta["_extract_warning"]
        item_metadata["extract_hint"] = hint[:200]
        if meta.get("_extract_policy"):
            item_metadata["extract_policy"] = meta["_extract_policy"]
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
        # 기본 색도 영어로 들어오는 경우가 있다(AI 제안 아이템 등)
        "brown": "브라운", "black": "블랙", "white": "화이트", "grey": "그레이",
        "gray": "그레이", "navy": "네이비", "blue": "블루", "green": "그린",
        "red": "레드", "pink": "핑크", "purple": "퍼플", "yellow": "옐로우",
        "orange": "오렌지", "neutral": "뉴트럴",
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
    # Content-Type에 charset이 없으면 requests는 text/*를 ISO-8859-1로 읽는다. 그러면
    # 한글 상품명이 깨져서(ìì´ë…) 그대로 이름·색으로 저장된다. 본문에서 인코딩을 추정하고,
    # 실패하면 UTF-8로 읽는다 — 국내 쇼핑몰은 사실상 전부 UTF-8이다.
    if "charset" not in (page.headers.get("content-type") or "").lower():
        page.encoding = page.apparent_encoding or "utf-8"
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
            detail="이 주소에서 상품 사진을 찾지 못했어요. 사진으로 올려 주세요.",
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
            .select("source,item_count,duration_ms,classify_ms,extract_ms,cache_hit,policy")
            .limit(10000)
            .execute()
            .data
            or []
        )
    except Exception as exc:  # noqa: BLE001
        # 코드가 먼저 배포되고 SQL 마이그레이션이 뒤따르는 동안에도 기존 이력은
        # 계속 읽을 수 있어야 한다. 새 세부 컬럼이 없으면 구 스키마로 폴백한다.
        try:
            rows = (
                supabase_admin.table("extraction_timings")
                .select("source,item_count,duration_ms")
                .limit(10000)
                .execute()
                .data
                or []
            )
            print(f"[timing] detailed stats unavailable, using legacy columns: {exc}", flush=True)
        except Exception as fallback_exc:  # noqa: BLE001
            return {"overall": {}, "by_count": [], "by_source": [], "by_policy": [], "error": str(fallback_exc)}
    by_count: dict[tuple[str, int], list[int]] = {}
    by_source: dict[str, list[int]] = {}
    by_policy: dict[str, list[int]] = {}
    all_ms: list[int] = []
    for r in rows:
        src = r.get("source") or "unknown"
        cnt = int(r.get("item_count") or 0)
        ms = int(r.get("duration_ms") or 0)
        by_count.setdefault((src, cnt), []).append(ms)
        by_source.setdefault(src, []).append(ms)
        policy = r.get("policy") or {}
        quality = str(policy.get("quality") or "legacy")
        by_policy.setdefault(quality, []).append(ms)
        all_ms.append(ms)

    def _avg(v: list[int]) -> float:
        return round(sum(v) / len(v), 1) if v else 0.0

    def _p95(v: list[int]) -> float:
        if not v:
            return 0.0
        s = sorted(v)
        return float(s[max(0, int(round(0.95 * (len(s) - 1))))])
    def _p50(v: list[int]) -> float:
        if not v:
            return 0.0
        s = sorted(v)
        return float(s[len(s) // 2])

    return {
        "overall": {
            "n": len(all_ms),
            "avg_ms": _avg(all_ms),
            "p50_ms": _p50(all_ms),
            "p95_ms": _p95(all_ms),
        },
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
        "by_policy": [
            {"quality": quality, "n": len(v), "avg_ms": _avg(v), "p50_ms": _p50(v), "p95_ms": _p95(v)}
            for quality, v in sorted(by_policy.items())
        ],
    }


@app.get("/api/live/recommend-stats")
def live_recommend_stats() -> dict[str, Any]:
    """코디 추천(live_coordinate) 소요시간 평균 (옷장 크기별) — 대기 안내·성능 판단용."""
    try:
        rows = (
            supabase_admin.table("recommendation_timings")
            .select("pool_size,combo_count,duration_ms")
            .limit(10000)
            .execute()
            .data
            or []
        )
    except Exception as exc:  # noqa: BLE001
        return {"overall": {}, "by_pool_size": [], "error": str(exc)}
    by_pool: dict[int, list[int]] = {}
    all_ms: list[int] = []
    for r in rows:
        pool = int(r.get("pool_size") or 0)
        ms = int(r.get("duration_ms") or 0)
        by_pool.setdefault(pool, []).append(ms)
        all_ms.append(ms)

    def _avg(v: list[int]) -> float:
        return round(sum(v) / len(v), 1) if v else 0.0

    def _p95(v: list[int]) -> float:
        if not v:
            return 0.0
        s = sorted(v)
        return float(s[max(0, int(round(0.95 * (len(s) - 1))))])

    return {
        "overall": {
            "n": len(all_ms),
            "avg_ms": _avg(all_ms),
            "p95_ms": _p95(all_ms),
            "max_ms": max(all_ms) if all_ms else 0,
        },
        "by_pool_size": [
            {
                "pool_size": pool,
                "n": len(v),
                "avg_ms": _avg(v),
                "p95_ms": _p95(v),
                "max_ms": max(v) if v else 0,
            }
            for pool, v in sorted(by_pool.items())
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
        raise HTTPException(status_code=404, detail="그 옷을 찾지 못했어요. 목록을 새로고침해 주세요.")
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
    if body.seasons is not None:
        meta["seasons"] = _clean_seasons(body.seasons)
    if body.brand is not None or body.size is not None or body.store is not None or body.seasons is not None:
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
def live_reextract_item(item_id: str, user: UserContext = Depends(current_user)) -> StreamingResponse:
    """이름·메타는 유지하고 제품 컷(이미지 추출)만 다시 생성."""
    require_supabase()
    ensure_credits(user.id, "replace_image")
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
        raise HTTPException(status_code=404, detail="그 옷을 찾지 못했어요. 목록을 새로고침해 주세요.")
    row = rows[0]
    if row.get("status") == "deleted":
        raise HTTPException(status_code=404, detail="그 옷을 찾지 못했어요. 목록을 새로고침해 주세요.")
    meta = dict(row.get("metadata") or {})
    source_path = (meta.get("original_path") or "").strip() or (row.get("storage_path") or "").strip()
    if not source_path:
        raise HTTPException(status_code=400, detail="원본 사진이 없어서 다시 만들 수 없어요. 사진을 새로 올려 주세요.")
    try:
        raw = supabase_admin.storage.from_(SUPABASE_BUCKET).download(source_path)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="원본 사진을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.") from exc
    suffix = os.path.splitext(source_path)[1] or ".png"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(raw)
        tmp_path = tmp.name
    uid = user.id

    def work() -> dict[str, Any]:
        try:
            gen_meta = {
                "name": row.get("name") or "옷",
                "category": row.get("category") or "top",
                "color": row.get("color") or "",
                "tags": meta.get("tags") or [],
                # 첫 추출이 마음에 안 들어 다시 시도하는 경우이므로 고품질로
                "_quality_override": OPENAI_IMAGE_QUALITY_RETRY,
            }
            # 예전 아이템은 메타에 없을 수 있음 → generate 안에서 감지
            if "has_text_logo" in meta:
                gen_meta["has_text_logo"] = bool(meta.get("has_text_logo"))
                gen_meta["logo_text"] = str(meta.get("logo_text") or "").strip()[:80]
            product_bytes = resolve_product_image(uid, tmp_path, gen_meta)
            if not product_bytes:
                raise HTTPException(status_code=502, detail="옷만 오려내지 못했어요. 잠시 후 다시 시도해 주세요.")
            new_path, image_url = save_product_image(uid, product_bytes)
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
                .eq("user_id", uid)
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

    return stream_with_keepalive(work)


@app.post("/api/live/items/{item_id}/replace-image")
async def live_replace_image(
    item_id: str,
    image: UploadFile | None = File(None),
    url: str | None = Form(None),
    extract_hint: str = Form(""),
    commit: bool = Form(True),
    user: UserContext = Depends(current_user),
) -> StreamingResponse:
    """새 사진/URL로 제품 컷만 교체. 이름·색상·브랜드 등 메타는 유지.

    commit=False면 추출까지만 하고 DB에는 반영하지 않는다 — 프론트에서 결과를
    보여주고 사용자가 "이대로 변경"을 눌러야 /replace-image/confirm으로 실제
    반영된다. 추출 결과가 마음에 안 들 때 옷장의 기존 이미지를 잃지 않기 위함.
    """
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
        raise HTTPException(status_code=404, detail="그 옷을 찾지 못했어요. 목록을 새로고침해 주세요.")
    row = rows[0]
    if row.get("status") == "deleted":
        raise HTTPException(status_code=404, detail="그 옷을 찾지 못했어요. 목록을 새로고침해 주세요.")

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
            raise HTTPException(status_code=400, detail="사진을 불러오지 못했어요. 다시 시도해 주세요.") from exc
    else:
        raise HTTPException(status_code=400, detail="사진이나 상품 주소를 넣어 주세요.")

    if not raw:
        raise HTTPException(status_code=400, detail="사진을 불러오지 못했어요. 다시 시도해 주세요.")

    meta = dict(row.get("metadata") or {})
    hint = (extract_hint or "").strip()[:500]
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(raw)
        tmp_path = tmp.name
    uid = user.id
    raw_bytes = raw

    def work(report: Callable[[str], None]) -> dict[str, Any]:
        try:
            report("classify")
            classified = classify_item(tmp_path, hint, user_id=uid)
            require_fashion_item(classified)
            report("upload")
            original_path = f"{uid}/original/{uuid.uuid4().hex}{suffix}"
            original_url = upload_bytes(original_path, raw_bytes, content_type)
            # 새 이미지 기준이므로 로고 여부를 다시 감지 (generate 안에서 처리)
            gen_meta = {
                "name": row.get("name") or "옷",
                "category": row.get("category") or "top",
                "color": row.get("color") or "",
                "tags": meta.get("tags") or [],
                "extract_hint": hint,
                "has_text_logo": bool(classified.get("has_text_logo")),
                "logo_text": str(classified.get("logo_text") or "").strip()[:80],
                # 새 사진의 촬영 형태를 넘겨야 측면·착장 사진이 정면으로 다시 그려진다
                "shot": classified.get("shot") or "product",
                "angle": classified.get("angle") or "front",
                "other_items": classified.get("other_items") or [],
            }
            report("cutout")
            product_bytes = resolve_product_image(uid, tmp_path, gen_meta, report=report)
            report("save")
            image_path, image_url = original_path, original_url
            if product_bytes:
                image_path, image_url, thumb_url = save_product_image_set(uid, product_bytes)
                meta["thumb_url"] = thumb_url
                meta["bg_norm"] = _BG_NORM_VERSION
            if "has_text_logo" in gen_meta:
                meta["has_text_logo"] = bool(gen_meta.get("has_text_logo"))
                meta["logo_text"] = str(gen_meta.get("logo_text") or "").strip()[:80]
            meta["original_path"] = original_path
            meta["original_url"] = original_url
            spend_credits(uid, "replace_image", {"item_id": item_id, "commit": commit})
            if not commit:
                # DB는 그대로 두고 미리보기만 반환. pending을 그대로 /confirm에 보내면 반영된다.
                return {
                    "item": live_item_payload({**row, "image_url": image_url, "storage_path": image_path, "metadata": meta}),
                    "pending": {"storagePath": image_path, "imageUrl": image_url, "metadata": meta},
                }
            updated = (
                supabase_admin.table("wardrobe_items")
                .update({"image_url": image_url, "storage_path": image_path, "metadata": meta})
                .eq("id", item_id)
                .eq("user_id", uid)
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

    return stream_with_keepalive(work)


@app.post("/api/live/items/{item_id}/replace-image/confirm")
def live_replace_image_confirm(
    item_id: str, body: ReplaceImageConfirm, user: UserContext = Depends(current_user)
) -> dict[str, Any]:
    """replace-image(commit=False) 미리보기를 사용자가 승인했을 때 실제로 반영."""
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
        raise HTTPException(status_code=404, detail="그 옷을 찾지 못했어요. 목록을 새로고침해 주세요.")
    row = rows[0]
    if row.get("status") == "deleted":
        raise HTTPException(status_code=404, detail="그 옷을 찾지 못했어요. 목록을 새로고침해 주세요.")
    patch = {"image_url": body.image_url, "storage_path": body.storage_path, "metadata": body.metadata}
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
        if meta.get("bg_norm") == _BG_NORM_VERSION:
            skipped += 1
            continue
        path = row.get("storage_path")
        if not path:
            skipped += 1
            continue
        try:
            raw = supabase_admin.storage.from_(SUPABASE_BUCKET).download(path)
            # 기존 이미지에는 흰 원단과 배경을 픽셀만으로 구분할 근거가 없다.
            # 마이그레이션이 옷을 지우는 것보다 기존 결과를 보존하는 편이 안전하다.
            fixed = normalize_product_canvas(raw, row.get("category"))
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


class AuthSignup(BaseModel):
    email: str
    password: str


@app.post("/api/live/auth/signup")
def live_auth_signup(body: AuthSignup) -> dict[str, Any]:
    """확인 메일 없이 계정을 만든다.

    Supabase 기본 메일 발송은 시간당 몇 통으로 제한된다. 확인 메일이 필요한 가입은
    그 한도에 걸리면 'email rate limit'으로 거절되고 계정이 아예 만들어지지 않아서,
    사용자는 왜 막혔는지 알 수 없다. 서비스 롤로 email_confirm=true로 만들면 메일
    발송 경로를 타지 않아 한도와 무관해진다. 비밀번호는 여기서 저장하지 않고
    Supabase가 해시한다.

    대신 이메일 소유 확인이 없다 — 남의 주소로도 가입할 수 있다. 지금은 사용자가
    소수인 프리토타입이라 받아들이지만, 공개 서비스로 갈 때는 SMTP를 붙이고
    Confirm email을 다시 켜서 이 경로를 닫아야 한다.
    """
    require_supabase()
    email = (body.email or "").strip().lower()
    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(status_code=400, detail="이메일 형식을 확인해 주세요.")
    if len(body.password or "") < 6:
        raise HTTPException(status_code=400, detail="비밀번호는 6자 이상이어야 해요.")
    try:
        supabase_admin.auth.admin.create_user(
            {"email": email, "password": body.password, "email_confirm": True}
        )
    except Exception as exc:  # noqa: BLE001
        msg = str(exc).lower()
        if "already" in msg or "registered" in msg or "exists" in msg or "duplicate" in msg:
            raise HTTPException(
                status_code=409, detail="이미 가입된 이메일이에요. 로그인해 주세요."
            ) from exc
        print(f"[auth] signup failed: {exc}", flush=True)
        raise HTTPException(
            status_code=502, detail="가입을 처리하지 못했어요. 잠시 후 다시 시도해 주세요."
        ) from exc
    print(f"[auth] created {email}", flush=True)
    return {"ok": True}


ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "").strip()


@app.get("/api/live/admin/ai-cost")
def live_admin_ai_cost(
    days: int = 30, x_admin_token: str = Header("", alias="X-Admin-Token")
) -> dict[str, Any]:
    """ai_usage_logs를 날짜·기능별 비용으로 집계. 관리자 대시보드용.

    ADMIN_TOKEN이 설정되지 않으면 열지 않는다 (기본 닫힘).
    """
    if not ADMIN_TOKEN or x_admin_token != ADMIN_TOKEN:
        raise HTTPException(status_code=404, detail="not_found")
    require_supabase()
    span = max(1, min(int(days or 30), 365))
    since = (datetime.now(timezone.utc) - timedelta(days=span - 1)).date().isoformat()
    rows = (
        supabase_admin.table("ai_usage_logs")
        .select("created_at,feature,model,metadata")
        .gte("created_at", since)
        .order("created_at", desc=False)
        .limit(20000)
        .execute()
        .data
        or []
    )
    by_day: dict[str, dict[str, float]] = {}
    by_feature: dict[str, dict[str, float]] = {}
    total = {"calls": 0, "cost_usd": 0.0, "priced_calls": 0}
    for r in rows:
        meta = r.get("metadata") or {}
        cost = float(meta.get("cost_usd") or 0.0)
        day = str(r.get("created_at") or "")[:10]
        key = f"{r.get('feature') or 'unknown'} · {r.get('model') or '?'}"
        for bucket, name in ((by_day, day), (by_feature, key)):
            slot = bucket.setdefault(name, {"calls": 0, "cost_usd": 0.0})
            slot["calls"] += 1
            slot["cost_usd"] = round(slot["cost_usd"] + cost, 6)
        total["calls"] += 1
        total["cost_usd"] = round(total["cost_usd"] + cost, 6)
        if meta.get("cost_usd") is not None:
            total["priced_calls"] += 1
    today = datetime.now(timezone.utc).date().isoformat()
    return {
        "days": span,
        "total": total,
        # 토큰을 기록하기 전 호출은 cost_usd가 없어 0으로 잡힌다 — 몇 건인지 같이 준다.
        "unpriced_calls": total["calls"] - total["priced_calls"],
        "today": by_day.get(today) or {"calls": 0, "cost_usd": 0.0},
        "by_day": [{"date": k, **v} for k, v in sorted(by_day.items())],
        "by_feature": sorted(
            ({"key": k, **v} for k, v in by_feature.items()),
            key=lambda x: -x["cost_usd"],
        ),
    }


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


class DupeCandidate(BaseModel):
    url: str = ""
    name: str = ""
    brand: str = ""
    store: str = ""
    color: str = ""
    thumb: str = ""


class DupeCheck(BaseModel):
    items: list[DupeCandidate] = []


@app.post("/api/live/import/check-duplicates")
def live_check_duplicates(body: DupeCheck, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    """구매내역 후보들이 이미 옷장에 있는지 본다. AI를 쓰지 않으므로 비용이 없다.

    주소·상품코드·이름·사진 지문을 함께 본다. 등록 전에 걸러 내면 추출 비용도 아낀다.
    """
    require_supabase()
    cands = (body.items or [])[:200]
    if not cands:
        return {"results": []}
    index = _wardrobe_dupe_index(user.id)

    # 후보 썸네일은 병렬로 받아 지문만 뽑는다(실패는 그냥 건너뛴다).
    def hash_of(c: DupeCandidate) -> int | None:
        raw = _fetch_bytes(c.thumb) if c.thumb else None
        return _image_fingerprint(raw) if raw else None

    with ThreadPoolExecutor(max_workers=8) as pool:
        prints = list(pool.map(hash_of, cands))

    results = []
    for c, fp in zip(cands, prints):
        hit = _match_duplicate(
            index, url=c.url, name=c.name, brand=c.brand, store=c.store, color=c.color, fp=fp
        )
        results.append({
            "url": c.url,
            "duplicate": bool(hit),
            "reason": _DUP_REASON_KO.get(hit[1], "") if hit else "",
            "reasonCode": hit[1] if hit else "",
            "matchedId": hit[0]["id"] if hit else "",
            "matchedName": hit[0]["name"] if hit else "",
        })
    dupes = sum(1 for r in results if r["duplicate"])
    print(f"[dupe] checked={len(results)} duplicate={dupes}", flush=True)
    return {"results": results, "duplicates": dupes}


_TRYON_BODY_PROMPT = """이 사진 속 인물의 얼굴을 그대로 유지한 채, 정면 전신 사진을 만드세요.
- 인물 한 명, 정면, 머리끝부터 발끝까지 잘리지 않게, 팔은 몸 옆에 자연스럽게
- 몸에 붙는 무채색 기본 이너(반팔 티 + 레깅스/슬랙스)만 착용. 무늬·로고 없이
- 배경은 #F2F1EE 단색, 그림자 최소, 자연스러운 실내 조명
- 텍스트·로고·워터마크·프레임·다른 사람 추가 금지
"""


class TryOnBody(BaseModel):
    face_data_url: str
    height: str | None = None
    weight: str | None = None


@app.post("/api/live/tryon/body")
def live_tryon_body(body: TryOnBody, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    """프로필 사진으로 '바로 보기'용 전신 이미지를 만든다.

    예전에는 사용자가 전신 사진을 직접 올려야 했다. 매장에서 쓰려면 결국 전신 사진이
    필요한데, 그걸 미리 찍어 둔 사람은 드물다. 퍼스널 컬러·AI 착장처럼 프로필 사진
    하나로 만들어 준다. 이미지 생성이라 크레딧을 받는다(원가 $0.25).
    """
    require_supabase()
    face = _decode_data_url(body.face_data_url)
    if not face:
        raise HTTPException(status_code=400, detail="프로필 사진을 먼저 등록해 주세요. 마이페이지에서 넣을 수 있어요.")
    ensure_within_limit(user.id, "tryon_body")

    note = _body_note({"height": body.height, "weight": body.weight})
    sig = hashlib.sha256(face).hexdigest()[:10]
    key = f"tryon-{sig}-{hashlib.sha256(note.encode()).hexdigest()[:4]}"
    cached = (
        supabase_admin.table("generated_images")
        .select("image_url")
        .eq("user_id", user.id)
        .eq("cache_key", key)
        .limit(1)
        .execute()
        .data
        or []
    )
    if cached:
        # 같은 얼굴·같은 체형이면 다시 만들지 않는다(크레딧도 받지 않는다).
        return {"imageUrl": cached[0]["image_url"], "cached": True}

    if not openai_client:
        raise HTTPException(status_code=503, detail="지금은 이미지를 만들 수 없어요. 잠시 후 다시 시도해 주세요.")
    try:
        source = io.BytesIO(face)
        source.name = "face.png"
        result = openai_client.with_options(timeout=OPENAI_IMAGE_TIMEOUT).images.edit(
            model=OPENAI_IMAGE_MODEL,
            image=source,
            prompt=_TRYON_BODY_PROMPT + note,
            size="1024x1536",
            quality=OPENAI_IMAGE_QUALITY,
            input_fidelity="high",
        )
        out = base64.b64decode(result.data[0].b64_json)
        log_ai_usage(user.id, "tryon_body", OPENAI_IMAGE_MODEL, {"quality": OPENAI_IMAGE_QUALITY},
                     usage=getattr(result, "usage", None))
    except Exception as exc:  # noqa: BLE001
        info = _openai_error_info(exc)
        print(f"[tryon] body failed: {_fail_log(info)}", flush=True)
        msg = _EXTRACT_FAIL_MSG.get(_openai_fail_key(info), _EXTRACT_FAIL_MSG["api_error"])
        raise HTTPException(status_code=502, detail=msg + (f" (코드: {_fail_code(info)})" if SHOW_ERROR_CODES else "")) from exc

    storage_path = f"{user.id}/tryon/{key}.png"
    image_url = upload_bytes(storage_path, out, "image/png")
    try:
        supabase_admin.table("generated_images").insert({
            "user_id": user.id, "cache_key": key, "kind": "tryon_body",
            "storage_path": storage_path, "image_url": image_url,
        }).execute()
    except Exception as exc:  # noqa: BLE001
        print(f"[tryon] cache save failed: {exc}", flush=True)
    note_usage(user.id, "tryon_body", {"key": key})
    return {"imageUrl": image_url, "cached": False}


@app.get("/api/live/billing")
def live_billing(user: UserContext = Depends(current_user)) -> dict[str, Any]:
    """마이페이지 '사용량'. 이번 달 크레딧과 요금제, 작업별 사용 내역을 그대로 준다."""
    require_supabase()
    state = billing_state(user.id)
    return {
        **state,
        "plans": [
            {
                "id": p["id"], "name": p["name"], "priceKrw": p["price_krw"],
                "credits": p["credits"], "modelLook": p["model_look"],
                "blurb": p["blurb"], "perks": plan_perks(p),
                "current": p["id"] == state["plan"],
            }
            for p in PLANS.values()
            if not p.get("hidden") or p["id"] == state["plan"]
        ],
        "costs": [
            {"action": k, "label": CREDIT_LABELS.get(k, k), "credits": v}
            for k, v in CREDIT_COSTS.items()
        ],
    }


class PlanChange(BaseModel):
    plan: str
    user_email: str | None = None


@app.post("/api/live/billing/plan")
def live_set_plan(
    body: PlanChange,
    user: UserContext = Depends(current_user),
    x_admin_token: str = Header("", alias="X-Admin-Token"),
) -> dict[str, Any]:
    """요금제 변경. 결제 연동 전이라 관리자 토큰이 있을 때만 바꿀 수 있다 —
    사용자가 스스로 프로로 올릴 수 있으면 요금제가 아니다."""
    require_supabase()
    if body.plan not in PLANS:
        raise HTTPException(status_code=400, detail="없는 요금제예요.")
    if not ADMIN_TOKEN or x_admin_token != ADMIN_TOKEN:
        raise HTTPException(status_code=403, detail="결제는 준비 중이에요. 열리면 바로 알려드릴게요.")
    target = user.id
    if body.user_email:
        found = None
        page = 1
        while page <= 20 and not found:
            res = supabase_admin.auth.admin.list_users(page=page, per_page=200)
            users = res if isinstance(res, list) else getattr(res, "users", [])
            if not users:
                break
            for u in users:
                if (getattr(u, "email", "") or "").lower() == body.user_email.lower():
                    found = u.id
                    break
            page += 1
        if not found:
            raise HTTPException(status_code=404, detail="그 이메일의 계정이 없어요.")
        target = found
    supabase_admin.table("credit_ledger").insert({
        "user_id": target, "delta": 0, "reason": "plan",
        "metadata": {"plan": body.plan, "by": "admin", "period": _period_key()},
    }).execute()
    # 요금제를 바꾸면 이번 달 지급분도 새 요금제 기준으로 맞춘다(차액만 추가 지급).
    state = billing_state(target)
    gap = PLANS[body.plan]["credits"] - state["granted"]
    if gap > 0:
        supabase_admin.table("credit_ledger").insert({
            "user_id": target, "delta": gap, "reason": "grant",
            "metadata": {"period": _period_key(), "plan": body.plan, "topup": True},
        }).execute()
    return billing_state(target)


@app.post("/api/live/import/photo")
async def live_import_photo(
    image: UploadFile = File(...),
    status: str = Form("owned"),
    extract_hint: str = Form(""),
    user: UserContext = Depends(current_user),
) -> StreamingResponse:
    require_supabase()
    ensure_credits(user.id, "import_photo")
    suffix = os.path.splitext(image.filename or "image.jpg")[1] or ".jpg"
    content_type = image.content_type or "image/jpeg"
    raw = await image.read()
    uid = user.id

    def work(report: Callable[[str], None]) -> dict[str, Any]:
        t0 = time.perf_counter()
        row = _store_uploaded_item(
            uid, raw, suffix, content_type, status, extract_hint=extract_hint, report=report
        )
        items = [live_item_payload(row)]
        meta = row.get("metadata") or {}
        timing = dict(meta.get("extraction_timing") or {})
        timing["policy"] = meta.get("extract_policy") or {}
        _record_extraction_timing(uid, "photo", len(items), (time.perf_counter() - t0) * 1000, timing)
        spend_credits(uid, "import_photo", {"items": len(items)})
        return {"items": items, "primary_idx": 0}

    # AI 추출(high)은 100초를 넘을 수 있는데 Render 프록시가 미응답 요청을 끊음 → keep-alive 스트리밍
    return stream_with_keepalive(work)


@app.post("/api/live/import/url")
def live_import_url(body: LiveImportUrl, user: UserContext = Depends(current_user)) -> StreamingResponse:
    require_supabase()
    if not body.url.strip():
        raise HTTPException(status_code=400, detail="상품 주소를 입력해 주세요.")
    url = _normalize_product_url(body.url)
    ensure_credits(user.id, "import_url")
    uid = user.id

    def work(report: Callable[[str], None]) -> dict[str, Any]:
        t0 = time.perf_counter()
        report("fetch")
        raw, content_type, meta = _fetch_product_meta(url)
        suffix = ".png" if "png" in content_type else ".jpg"
        if body.skip_duplicate:
            # 추출·생성 전에 본다. 여기서 걸리면 돈이 한 푼도 안 든다.
            hit = _match_duplicate(
                _wardrobe_dupe_index(uid),
                url=url,
                name=meta.get("title") or "",
                brand=meta.get("brand") or "",
                store=meta.get("store") or "",
                color=meta.get("color") or "",
                fp=_image_fingerprint(raw),
            )
            if hit:
                row, reason = hit
                print(f"[dupe] skip import ({reason}) — {row['name'][:30]}", flush=True)
                return {
                    "items": [],
                    "duplicate": True,
                    "reason": _DUP_REASON_KO.get(reason, "이미 옷장에 있어요"),
                    "reasonCode": reason,
                    "matchedId": row["id"],
                    "matchedName": row["name"],
                }
        row = _store_uploaded_item(
            uid,
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
            report=report,
        )
        items = [live_item_payload(row)]
        item_meta = row.get("metadata") or {}
        timing = dict(item_meta.get("extraction_timing") or {})
        timing["policy"] = item_meta.get("extract_policy") or {}
        _record_extraction_timing(uid, "url", len(items), (time.perf_counter() - t0) * 1000, timing)
        spend_credits(uid, "import_url", {"items": len(items)})
        return {"items": items, "primary_idx": 0}

    return stream_with_keepalive(work)


@app.post("/api/live/coordinate")
def live_coordinate(body: LiveCoordinate, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    t0 = time.perf_counter()
    ensure_credits(user.id, "coordinate")
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
        raise HTTPException(status_code=400, detail="코디를 만들려면 옷장에 옷이 2개 이상 필요해요.")
    # 이전에 담아둔 아이템에는 숨은 스타일 속성이 없다. 추천 전에 한 번 채운다
    # (이름 기반 일괄 추론 1회, 이후에는 저장돼 있어 호출이 없다).
    _ensure_style_attrs(user.id, pool)
    profile = {
        "personal_color": body.personal_color,
        "fit": body.fit,
        "palettes": body.palettes,
        "gender": body.gender,
        "age": body.age,
        "height": body.height,
        "weight": body.weight,
    }
    max_combos = min(max(body.max_combos, 1), 10)
    combos = recommend_text(
        user.id,
        anchor,
        pool,
        body.style,
        max_combos,
        body.exclude_item_ids or [],
        body.styles or None,
        profile,
        body.include_item_ids or None,
        body.wish_combos or 0,
    )
    by_id = {row["id"]: row for row in pool}
    outfits, used = [], {}
    wish_items: list[dict[str, Any]] = []
    for idx, combo in enumerate(combos):
        ids = [item_id for item_id in combo["item_ids"] if item_id in by_id]
        wish = combo.get("wish")
        if not _combo_has_top_and_bottom(ids, by_id, wish):
            continue
        for item_id in ids:
            used[item_id] = by_id[item_id]
        if wish:
            # 옷장에 없는 제안 아이템. DB에 넣지 않고 이 응답에서만 쓰는 가짜 아이템으로
            # 내려보낸다(프론트가 점선 자리로 그린다). 사용자가 산 뒤에 직접 담으면 된다.
            wish_id = f"wish-{uuid.uuid4().hex[:8]}"
            wish_items.append({
                "id": wish_id,
                "serverId": None,
                "name": wish["name"],
                "category": _category_display(wish["category"]),
                "color": wish.get("color") or "",
                "img": None,
                "status": "wish",
                "wish": True,
                "reason": wish.get("reason") or "",
                "seasons": [],
            })
            ids = [*ids, wish_id]
        outfits.append(
            {
                # 저장은 아래에서 한 번에 — 임시 id로 돌려주면 기기를 옮기는 순간 사라지고
                # 저장·착용 상태를 서버에 남길 방법도 없다.
                "id": None,
                "label": combo.get("label") or f"추천 코디 {idx + 1}",
                "mood": combo.get("mood") or "",
                "styles": combo.get("styles") or [],
                "itemIds": ids,
                "lookImg": None,
                **({"wish": wish} if wish else {}),
            }
        )
    _record_recommendation_timing(user.id, len(pool), len(outfits), (time.perf_counter() - t0) * 1000)
    if outfits:
        spend_credits(user.id, "coordinate", {"count": len(outfits)})

    # AI 착장 이미지 — 한 장에 20~30초라 4개를 순서대로 만들면 2분이 넘는다. 같이 돌린다.
    # 원가가 코디 추천의 25배라 요금제로 가르고, 만든 장수만큼 크레딧을 받는다.
    face_bytes = _decode_data_url(body.face_data_url) if body.model_look else None
    targets: list[dict[str, Any]] = []
    if face_bytes and outfits:
        state = billing_state(user.id)
        if not PLANS[state["plan"]]["model_look"]:
            face_bytes = None
            print(f"[billing] model_look blocked on plan={state['plan']}", flush=True)
        else:
            # 만들 수 있는 만큼만 만든다(남은 크레딧 안에서).
            budget = state["remaining"] // CREDIT_COSTS["model_look"]
            if budget < len(outfits):
                print(f"[billing] model_look limited to {budget}/{len(outfits)}", flush=True)
            targets = outfits[:budget]
        if face_bytes and targets:
            def _one(outfit: dict[str, Any]) -> str | None:
                members = [by_id[i] for i in outfit["itemIds"] if i in by_id]
                return generate_model_look_image(user.id, outfit["itemIds"], members, face_bytes, profile)

            with ThreadPoolExecutor(max_workers=4) as pool_ex:
                for outfit, url in zip(targets, pool_ex.map(_one, targets)):
                    if url:
                        outfit["lookImg"] = url
                        spend_credits(user.id, "model_look", {"outfit": outfit["label"][:40]})

    # 생성 결과를 저장한다. 실패해도 화면은 그대로 가게 하되(추천을 버리진 않는다)
    # id는 임시값으로 남아 저장·착용을 서버에 남길 수 없다는 걸 로그로 남긴다.
    for outfit in outfits:
        try:
            row = (
                supabase_admin.table("outfits")
                .insert({
                    "user_id": user.id,
                    "label": outfit["label"],
                    "mood": outfit["mood"],
                    "type": "daily",
                    "item_ids": [i for i in outfit["itemIds"] if not str(i).startswith("wish-")],
                    "look_image_url": outfit["lookImg"],
                    "metadata": {
                        "styles": outfit["styles"],
                        "for_date": body.for_date or None,
                        **({"wish": outfit["wish"]} if outfit.get("wish") else {}),
                    },
                })
                .execute()
                .data[0]
            )
            outfit["id"] = row["id"]
        except Exception as exc:  # noqa: BLE001
            print(f"[coordinate] outfit persist failed: {exc}", flush=True)
            outfit["id"] = f"live-{uuid.uuid4().hex[:8]}"
    return {
        "outfits": outfits,
        "items": [live_item_payload(row) for row in used.values()] + wish_items,
    }


@app.get("/api/live/outfits")
def live_list_outfits(user: UserContext = Depends(current_user)) -> dict[str, Any]:
    """저장한 코디(룩북)와 최근 생성된 코디를 아이템까지 함께 돌려준다.

    기기를 옮기거나 다시 로그인해도 룩북과 날짜별 코디가 그대로 보이려면 이게 필요하다.
    프론트는 localStorage 캐시로 먼저 그리고, 여기 응답으로 덮어쓴다.
    """
    require_supabase()
    rows = (
        supabase_admin.table("outfits")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", desc=True)
        .limit(200)
        .execute()
        .data
        or []
    )
    item_ids = sorted({i for r in rows for i in (r.get("item_ids") or [])})
    items: list[dict[str, Any]] = []
    if item_ids:
        items = (
            supabase_admin.table("wardrobe_items")
            .select("*")
            .eq("user_id", user.id)
            .in_("id", item_ids)
            .neq("status", "deleted")
            .execute()
            .data
            or []
        )
    alive = {i["id"] for i in items}
    out = []
    wish_items: list[dict[str, Any]] = []
    for r in rows:
        ids = [i for i in (r.get("item_ids") or []) if i in alive]
        meta = r.get("metadata") or {}
        # 제안 아이템(옷장에 없는 것)은 코디 메타에만 있다. 다시 가짜 아이템으로 복원해
        # 저장해 둔 코디가 기기를 옮겨도 같은 모습으로 보이게 한다.
        wish = _clean_wish(meta.get("wish"))
        if wish:
            wish_id = f"wish-{r['id'][:8]}"
            wish_items.append({
                "id": wish_id, "serverId": None, "name": wish["name"],
                "category": _category_display(wish["category"]), "color": wish.get("color") or "",
                "img": None, "status": "wish", "wish": True,
                "reason": wish.get("reason") or "", "seasons": [],
            })
            ids = [*ids, wish_id]
        # 아이템이 지워져 반쪽이 된 코디는 보여줄 수 없다
        if len(ids) < 2:
            continue
        out.append({
            "id": r["id"],
            "label": r.get("label") or "코디",
            "mood": r.get("mood") or "",
            "styles": meta.get("styles") or [],
            "itemIds": ids,
            "lookImg": r.get("look_image_url"),
            "saved": bool(r.get("saved")),
            "wornAt": r.get("worn_at"),
            "forDate": meta.get("for_date"),
            "manual": r.get("type") == "manual",
            "createdAt": r.get("created_at"),
        })
    return {"outfits": out, "items": [live_item_payload(i) for i in items] + wish_items}


class LiveOutfitState(BaseModel):
    saved: bool | None = None
    worn: bool | None = None


@app.post("/api/live/outfits/{outfit_id}/state")
def live_outfit_state(
    outfit_id: str, body: LiveOutfitState, user: UserContext = Depends(current_user)
) -> dict[str, Any]:
    """룩북 저장 여부·착용 기록. 기기와 무관하게 남아야 하는 값이라 서버에 쓴다."""
    require_supabase()
    patch: dict[str, Any] = {}
    if body.saved is not None:
        patch["saved"] = body.saved
    if body.worn is not None:
        patch["worn_at"] = now_iso() if body.worn else None
    if not patch:
        return {"ok": True}
    updated = (
        supabase_admin.table("outfits")
        .update(patch)
        .eq("id", outfit_id)
        .eq("user_id", user.id)
        .execute()
        .data
        or []
    )
    if not updated:
        raise HTTPException(status_code=404, detail="그 코디를 찾지 못했어요. 목록을 새로고침해 주세요.")
    return {"ok": True}


class LiveManualOutfit(BaseModel):
    label: str
    item_ids: list[str]


@app.post("/api/live/outfits/manual")
def live_create_manual_outfit(
    body: LiveManualOutfit, user: UserContext = Depends(current_user)
) -> dict[str, Any]:
    """직접 만든 코디도 서버에 남긴다 — 룩북에 담기는 값이라 기기를 넘어가야 한다."""
    require_supabase()
    ids = [i for i in (body.item_ids or []) if i][:6]
    if len(ids) < 2:
        raise HTTPException(status_code=400, detail="옷을 2개 이상 골라 주세요.")
    row = (
        supabase_admin.table("outfits")
        .insert({
            "user_id": user.id,
            "label": (body.label or "").strip() or "직접 만든 코디",
            "mood": "직접 만든 코디",
            "type": "manual",
            "item_ids": ids,
            "saved": True,
            "metadata": {"styles": []},
        })
        .execute()
        .data[0]
    )
    return {"id": row["id"]}


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


# ─────────────────────────────────────────────────────────────────────────────
# 로컬 개발용 옷장 시드 — .env의 DEV_SEED_SOURCE_USER가 있을 때만 열린다.
# 로컬은 접속할 때마다 새 익명 유저라 옷장이 비어 있어서, 기준 계정의 owned 아이템을
# 현재 유저 밑으로 복제해 실제 옷장처럼 쓴다(조합 추천·수정·삭제 모두 동작).
# 이 블록과 frontend/src/dev/ 폴더만 지우면 흔적 없이 제거된다.
# ─────────────────────────────────────────────────────────────────────────────
DEV_SEED_SOURCE_USER = os.environ.get("DEV_SEED_SOURCE_USER", "").strip()
_DEV_SEED_COLUMNS = ("name", "category", "color", "image_url", "storage_path", "source", "status", "note", "metadata")


def _dev_seed_source(user: UserContext) -> str:
    if not DEV_SEED_SOURCE_USER:
        raise HTTPException(status_code=404, detail="dev_seed_disabled")
    # 기준 계정 본인이면 원본을 건드릴 수 있으므로 무조건 막는다.
    if user.id == DEV_SEED_SOURCE_USER:
        raise HTTPException(status_code=400, detail="source_account_protected")
    require_supabase()
    return DEV_SEED_SOURCE_USER


@app.post("/api/live/dev/wardrobe/seed")
def dev_seed_wardrobe(user: UserContext = Depends(current_user)) -> dict[str, Any]:
    source = _dev_seed_source(user)
    rows = (
        supabase_admin.table("wardrobe_items")
        .select(",".join(_DEV_SEED_COLUMNS))
        .eq("user_id", source)
        .eq("status", "owned")
        .execute()
        .data
        or []
    )
    supabase_admin.table("wardrobe_items").delete().eq("user_id", user.id).execute()
    # 익명 세션이 바뀔 때마다 복제본이 쌓이지 않도록 지난 세션의 시드도 함께 걷어낸다.
    supabase_admin.table("wardrobe_items").delete().contains(
        "metadata", {"dev_seed": True}
    ).neq("user_id", source).execute()
    if not rows:
        return {"seeded": 0}
    # image_url/storage_path는 그대로 재사용한다. 버킷이 퍼블릭이고, 아이템 삭제가
    # status만 바꾸므로 복제본을 지워도 원본 이미지에는 영향이 없다.
    payload = [
        {
            **{col: row.get(col) for col in _DEV_SEED_COLUMNS},
            "user_id": user.id,
            "metadata": {**(row.get("metadata") or {}), "dev_seed": True},
        }
        for row in rows
    ]
    supabase_admin.table("wardrobe_items").insert(payload).execute()
    return {"seeded": len(payload)}


@app.post("/api/live/dev/wardrobe/clear")
def dev_clear_wardrobe(user: UserContext = Depends(current_user)) -> dict[str, Any]:
    _dev_seed_source(user)
    removed = supabase_admin.table("wardrobe_items").delete().eq("user_id", user.id).execute().data or []
    return {"cleared": len(removed)}
