#!/usr/bin/env python3
"""
LOOKBOX Analytics Server
실행: uv run --with flask --with openai --with pillow --with beautifulsoup4 --with curl_cffi --with rembg --with onnxruntime python3 server.py

Landing:   http://localhost:8080
Dashboard: http://localhost:8080/dashboard  (ID: admin / PW: lookbox2026)
"""
import os, json, sqlite3, hashlib
from datetime import datetime
from functools import wraps
from flask import Flask, request, jsonify, send_from_directory, Response, abort

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, 'v2')
DATA_DIR   = os.environ.get('DATA_DIR', BASE_DIR)
DB_PATH    = os.path.join(DATA_DIR, 'tracker.db')
DASH_PW    = os.environ.get('DASHBOARD_PASSWORD', 'lookbox2026')

app = Flask(__name__, static_folder=None)

# ── DB ────────────────────────────────────────────────────────
# init_db() also called at module load so WSGI hosts (PythonAnywhere) initialize the schema.
def db():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c

def init_db():
    with db() as c:
        c.execute('''CREATE TABLE IF NOT EXISTS events (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id   TEXT,
            event_name   TEXT,
            properties   TEXT,
            page_url     TEXT,
            referrer     TEXT,
            user_agent   TEXT,
            ip_hash      TEXT,
            utm_source   TEXT,
            utm_medium   TEXT,
            utm_campaign TEXT,
            device       TEXT,
            created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
        )''')
        for col in ['event_name','session_id','created_at']:
            c.execute(f'CREATE INDEX IF NOT EXISTS idx_{col} ON events({col})')
        c.execute('''CREATE TABLE IF NOT EXISTS ip_blocklist (
            ip TEXT PRIMARY KEY,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )''')
        c.commit()

init_db()

# ── Wardrobe (MVP self-validation app) ────────────────────────
UPLOADS_DIR = os.path.join(DATA_DIR, 'uploads')
os.makedirs(UPLOADS_DIR, exist_ok=True)

def init_wardrobe():
    with db() as c:
        c.execute('''CREATE TABLE IF NOT EXISTS clothes (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            image_path    TEXT NOT NULL,
            source        TEXT,
            source_url    TEXT,
            title         TEXT,
            status        TEXT DEFAULT 'owned',
            category      TEXT,
            subcategory   TEXT,
            color         TEXT,
            pattern       TEXT,
            season        TEXT,
            tags          TEXT,
            size_standard TEXT,
            size_detail   TEXT,
            note          TEXT,
            last_worn     DATETIME,
            wear_count    INTEGER DEFAULT 0,
            rating_sum    INTEGER DEFAULT 0,
            rating_count  INTEGER DEFAULT 0,
            created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
        )''')
        c.execute('''CREATE TABLE IF NOT EXISTS outfits (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            item_ids      TEXT NOT NULL,
            base_id       INTEGER,
            considering_id INTEGER,
            reasoning     TEXT,
            rating        INTEGER,
            worn          INTEGER DEFAULT 0,
            created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
        )''')
        c.execute('CREATE INDEX IF NOT EXISTS idx_clothes_status ON clothes(status)')
        c.commit()

init_wardrobe()

# Optional Gemini Flash classification (free tier, vision-capable)
# .env 파일이 있으면 환경에 없는 키만 보충 로드 (의존성 없이)
_env_path = os.path.join(os.path.dirname(__file__), '.env')
if os.path.isfile(_env_path):
    try:
        with open(_env_path) as _fp:
            for _line in _fp:
                _line = _line.strip()
                if not _line or _line.startswith('#') or '=' not in _line: continue
                _k, _v = _line.split('=', 1)
                _k, _v = _k.strip(), _v.strip().strip('"').strip("'")
                if _k and _k not in os.environ: os.environ[_k] = _v
    except Exception as _e:
        print(f'[env] .env load failed: {_e}', flush=True)
GEMINI_KEY = os.environ.get('GEMINI_API_KEY')
GEMINI_AVAILABLE = False
_gemini_model = None
if GEMINI_KEY:
    try:
        import google.generativeai as _genai
        _genai.configure(api_key=GEMINI_KEY)
        # 실제 사용 가능한 모델 ID 목록을 받아서, 우선순위대로 가용한 첫 번째 선택
        try:
            _available = {m.name.split('/')[-1] for m in _genai.list_models()
                          if 'generateContent' in getattr(m, 'supported_generation_methods', [])}
        except Exception as _le:
            print(f'[ai] list_models 실패 ({_le}) → 우선 후보 그대로 시도')
            _available = None
        _candidates = ['gemini-3.5-flash', 'gemini-3-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-latest', 'gemini-flash-latest']
        for _name in _candidates:
            if _available is not None and _name not in _available:
                continue
            _gemini_model = _genai.GenerativeModel(_name)
            GEMINI_AVAILABLE = True
            print(f'[ai] Gemini enabled (model={_name})')
            break
        if not GEMINI_AVAILABLE and _available is not None:
            # 후보에 없으면 사용 가능한 flash 계열 중 아무거나
            for _name in sorted(_available):
                if 'flash' in _name.lower():
                    _gemini_model = _genai.GenerativeModel(_name)
                    GEMINI_AVAILABLE = True
                    print(f'[ai] Gemini enabled (fallback model={_name})')
                    break
        if not GEMINI_AVAILABLE:
            print(f'[ai] 사용 가능한 flash 모델 없음. 후보={_candidates} / 보유={_available}')
    except Exception as _e:
        print(f'[ai] Gemini unavailable: {_e}')

# Optional OpenAI — 키 있으면 분류(vision)·제품샷 생성(image edit) 모두 OpenAI 우선.
OPENAI_KEY             = os.environ.get('OPENAI_API_KEY')
OPENAI_VISION_MODEL    = os.environ.get('OPENAI_VISION_MODEL', 'gpt-4o')
OPENAI_IMAGE_MODEL     = os.environ.get('OPENAI_IMAGE_MODEL', 'gpt-image-1')
OPENAI_IMAGE_QUALITY   = os.environ.get('OPENAI_IMAGE_QUALITY', 'medium')  # low|medium|high|auto — 낮을수록 빠르고 저렴
OPENAI_AVAILABLE       = False
OPENAI_IMAGE_AVAILABLE = False
_openai_client = None
# DISABLE_OPENAI=1 → 임시로 OpenAI 끄고 Gemini 무료로만 동작 (비용 0 UX 테스트용)
if OPENAI_KEY and os.environ.get('DISABLE_OPENAI'):
    print('[ai] OpenAI 비활성 (DISABLE_OPENAI) → Gemini 사용')
elif OPENAI_KEY:
    try:
        from openai import OpenAI as _OpenAI
        _openai_client = _OpenAI(api_key=OPENAI_KEY)
        OPENAI_AVAILABLE = True
        OPENAI_IMAGE_AVAILABLE = True  # gpt-image-1: 조직 미인증이면 호출 시 자동 폴백
        print(f'[ai] OpenAI enabled (vision={OPENAI_VISION_MODEL}, image={OPENAI_IMAGE_MODEL})')
    except Exception as _e:
        print(f'[ai] OpenAI unavailable: {_e}')

# Optional Gemini 이미지 생성 (image-to-image): 사용자 사진 → 깔끔한 제품샷
IMAGE_GEN_AVAILABLE = False
_gemini_image_model = None
if GEMINI_AVAILABLE:
    try:
        _img_candidates = [
            # 사용자가 AI Studio에서 직접 잘 됐다고 한 모델 — 텍스트 flash가 IMAGE modality 지원하는지 시도
            'gemini-3.5-flash',
            # 그 다음 image 전용 flash 계열
            'gemini-3.1-flash-image', 'gemini-3.1-flash-image-preview',
            # pro: 더 고품질이지만 무료 한도 매우 빡빡
            'gemini-3-pro-image', 'gemini-3-pro-image-preview',
            'nano-banana-pro-preview',
            'gemini-2.5-flash-image', 'gemini-2.5-flash-image-preview',
            'gemini-2.0-flash-exp-image-generation', 'gemini-2.0-flash-preview-image-generation',
        ]
        # list_models 결과가 있으면 image 키워드 들어간 것만 우선 시도
        _img_pool = _img_candidates[:]
        if _available is not None:
            extra = sorted(n for n in _available if 'image' in n.lower() and 'flash' in n.lower())
            for n in extra:
                if n not in _img_pool: _img_pool.append(n)
        for _name in _img_pool:
            if _available is not None and _name not in _available: continue
            try:
                _gemini_image_model = _genai.GenerativeModel(_name)
                IMAGE_GEN_AVAILABLE = True
                print(f'[ai] Image-gen enabled (model={_name})')
                break
            except Exception as _em:
                print(f'[ai] image-gen {_name} 시도 실패: {_em}')
        if not IMAGE_GEN_AVAILABLE:
            print(f'[ai] image-gen 모델 못 찾음. pool={_img_pool} / available={_available}')
    except Exception as _e:
        print(f'[ai] image-gen 초기화 실패: {_e}')

# Optional rembg — cloth_seg는 사람에서 옷만 마스킹 / birefnet은 단품(신발/가방/악세서리)에 고품질
REMBG_AVAILABLE = False
_cloth_session = None
_general_session = None
_general_fallback_session = None
try:
    from rembg import remove as _rembg_remove, new_session as _rembg_session
    _cloth_session = _rembg_session('u2net_cloth_seg')   # 의류 전용 (3-class: upper/lower/full)
    _general_fallback_session = _rembg_session('u2net')  # 폴백
    try:
        _general_session = _rembg_session('birefnet-general-lite')  # 고품질 일반 (~44MB)
        print(f'[bg] rembg enabled (cloth_seg + birefnet-general-lite + u2net fallback)')
    except Exception as _e2:
        _general_session = _general_fallback_session
        print(f'[bg] birefnet 로드 실패 ({_e2}) → u2net로 폴백')
    REMBG_AVAILABLE = True
except Exception as _e:
    print(f'[bg] rembg unavailable: {_e}')

def _crop_to_content(path, padding=12, category=None, max_aspect=1.6):
    """투명 영역만 잘라내고 적당한 패딩 유지. 카테고리 휴리스틱 슬라이스 제거."""
    try:
        from PIL import Image
        img = Image.open(path)
        if img.mode != 'RGBA': img = img.convert('RGBA')
        bbox = img.getbbox()
        if not bbox: return
        W, H = img.size
        l, t, r, b = bbox
        l = max(0, l - padding); t = max(0, t - padding)
        r = min(W, r + padding); b = min(H, b + padding)
        cropped = img.crop((l, t, r, b))
        cropped.save(path, format='PNG')
    except Exception as e:
        print(f'[crop] failed: {e}', flush=True)

def _crop_to_bbox(path, bbox_norm, margin_pct=0.05):
    """Gemini가 준 정규화 bbox (0-1000, [ymin, xmin, ymax, xmax])로 크롭."""
    try:
        from PIL import Image
        if not bbox_norm or len(bbox_norm) != 4: return False
        y1, x1, y2, x2 = bbox_norm
        for v in (y1, x1, y2, x2):
            if not isinstance(v, (int, float)) or v < 0 or v > 1000: return False
        if y2 <= y1 or x2 <= x1: return False
        img = Image.open(path)
        w, h = img.size
        # 여백 추가 (이미지 비율 5%)
        m_x = (x2 - x1) * margin_pct; m_y = (y2 - y1) * margin_pct
        x1 = max(0, x1 - m_x); y1 = max(0, y1 - m_y)
        x2 = min(1000, x2 + m_x); y2 = min(1000, y2 + m_y)
        l, t = int(x1 / 1000 * w), int(y1 / 1000 * h)
        r, b = int(x2 / 1000 * w), int(y2 / 1000 * h)
        if (r - l) < 20 or (b - t) < 20: return False
        img.crop((l, t, r, b)).save(path)
        print(f'[bbox] cropped to {r-l}x{b-t} from {w}x{h}', flush=True)
        return True
    except Exception as e:
        print(f'[bbox] crop failed: {e}', flush=True)
        return False

def remove_bg(input_path, output_path=None, mode='cloth', category=None):
    """mode='cloth': 사람에서 의류만 / 'general': 단순 배경 제거.
    category 기반으로 풀바디 사진의 상의/하의 부분만 잘라냄."""
    if not REMBG_AVAILABLE: return False
    session = _cloth_session if mode == 'cloth' else _general_session
    target = output_path or input_path
    def _do(s, label):
        with open(input_path, 'rb') as fi: inp = fi.read()
        out = _rembg_remove(inp, session=s)
        with open(target, 'wb') as fo: fo.write(out)
        # 마스킹 영역이 너무 작으면 실패 처리 (cloth_seg가 사람 못 찾았을 때)
        from PIL import Image
        img = Image.open(target)
        if img.mode != 'RGBA': img = img.convert('RGBA')
        bbox = img.getbbox()
        if not bbox:
            print(f'[bg] {label}: empty result', flush=True)
            return False
        w, h = img.size
        bw, bh = bbox[2]-bbox[0], bbox[3]-bbox[1]
        if (bw*bh) < (w*h * 0.05):  # 콘텐츠 5% 미만 = 실패
            print(f'[bg] {label}: content too small ({bw}x{bh} of {w}x{h})', flush=True)
            return False
        return True
    # 우선순위 폴백 체인: 모드별로 시도 → 안 되면 다음 후보
    if mode == 'cloth':
        chain = [(_cloth_session, 'cloth_seg'), (_general_session, 'general'), (_general_fallback_session, 'u2net')]
    else:
        chain = [(_general_session, 'general'), (_general_fallback_session, 'u2net'), (_cloth_session, 'cloth_seg')]
    seen = set()
    for sess, label in chain:
        if sess is None or id(sess) in seen: continue
        seen.add(id(sess))
        try:
            if _do(sess, label):
                _crop_to_content(target, category=category)
                return True
        except Exception as e:
            print(f'[bg] {label} error: {e}', flush=True)
    return False

# 조합/표시용 정규화: 누끼 후 동일 배경(#EFEDE8)에 합성 → 타일 배경과 경계가 사라짐.
NORM_BG  = (244, 237, 232)  # #EFEDE8
NORM_DIR = os.path.join(UPLOADS_DIR, '.norm')
FLAT_DIR = os.path.join(UPLOADS_DIR, '.flat')

def normalized_upload(filename):
    """rembg로 배경 제거 → #EFEDE8 단색에 합성한 정규화본을 캐시 생성. 캐시(또는 폴백) fs 경로 반환."""
    src = os.path.join(UPLOADS_DIR, filename)
    if not os.path.exists(src):
        return None
    os.makedirs(NORM_DIR, exist_ok=True)
    stem  = os.path.splitext(filename)[0]
    cache = os.path.join(NORM_DIR, stem + '.png')
    if os.path.exists(cache) and os.path.getmtime(cache) >= os.path.getmtime(src):
        return cache
    from PIL import Image
    try:
        cut = None
        if REMBG_AVAILABLE:
            tmp = cache + '.cut.png'
            try:
                if remove_bg(src, tmp, mode='general'):
                    cut = Image.open(tmp).convert('RGBA')
            finally:
                if os.path.exists(tmp):
                    try: os.remove(tmp)
                    except Exception: pass
        if cut is None:
            cut = Image.open(src).convert('RGBA')  # 폴백: 원본 그대로 합성
        bg = Image.new('RGBA', cut.size, NORM_BG + (255,))
        bg.alpha_composite(cut)
        bg.convert('RGB').save(cache, 'PNG')
        return cache
    except Exception as e:
        print(f'[norm] 실패({filename}): {type(e).__name__}: {e}', flush=True)
        return src

def flatlay_upload(filename):
    """제품컷의 배경 캔버스를 제거하고 옷만 남긴 합성용 투명 PNG 캐시."""
    src = os.path.join(UPLOADS_DIR, filename)
    if not os.path.exists(src):
        return None
    os.makedirs(FLAT_DIR, exist_ok=True)
    stem = os.path.splitext(filename)[0]
    cache = os.path.join(FLAT_DIR, stem + '.v3.png')
    if os.path.exists(cache) and os.path.getmtime(cache) >= os.path.getmtime(src):
        return cache
    try:
        from PIL import Image
        from collections import deque
        img = Image.open(src).convert('RGBA')
        w, h = img.size
        px = img.load()

        # 제품컷은 보통 단색 배경 위 중앙에 옷이 있다. 가장자리에서 이어진
        # 유사 색상 영역만 배경으로 간주해 옷 자체의 흰색은 최대한 보존한다.
        samples = []
        for x, y in (
            (0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1),
            (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2),
        ):
            r, g, b, a = px[x, y]
            if a >= 16:
                samples.append((r, g, b))
        bg = tuple(sum(c[i] for c in samples) // len(samples) for i in range(3)) if samples else NORM_BG

        def color_dist(c1, c2):
            return sum((c1[i] - c2[i]) ** 2 for i in range(3)) ** 0.5

        def is_bg(x, y, tolerance):
            r, g, b, a = px[x, y]
            if a < 16:
                return True
            return color_dist((r, g, b), bg) < tolerance

        def flood(tolerance):
            seen = set()
            q = deque()
            for x in range(w):
                q.append((x, 0)); q.append((x, h - 1))
            for y in range(h):
                q.append((0, y)); q.append((w - 1, y))
            while q:
                x, y = q.popleft()
                if (x, y) in seen or x < 0 or y < 0 or x >= w or y >= h:
                    continue
                if not is_bg(x, y, tolerance):
                    continue
                seen.add((x, y))
                q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
            return seen

        best_seen, best_ratio = set(), 0
        for tol in (42, 34, 28, 22, 16, 10):
            seen = flood(tol)
            ratio = len(seen) / float(w * h)
            if 0.10 <= ratio <= 0.94:
                best_seen, best_ratio = seen, ratio
                break
            if ratio > best_ratio and ratio < 0.985:
                best_seen, best_ratio = seen, ratio

        if best_seen:
            for x, y in best_seen:
                r, g, b, a = px[x, y]
                px[x, y] = (r, g, b, 0)

            bbox = img.getbbox()
            if bbox:
                pad = max(8, int(min(w, h) * 0.04))
                l, t, r, b = bbox
                img = img.crop((max(0, l - pad), max(0, t - pad), min(w, r + pad), min(h, b + pad)))
        else:
            print(f'[flat] no usable background mask for {filename}; using original canvas', flush=True)
        img.save(cache, 'PNG')
        return cache
    except Exception as e:
        print(f'[flat] 실패({filename}): {type(e).__name__}: {e}', flush=True)
        return src

def _browser_headers():
    return {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
        'Referer': 'https://www.google.com/',
    }

KEYWORD_CATEGORY = [
    (['셔츠','티셔츠','t-shirt','tee','니트','맨투맨','후드','블라우스','sweater','크롭'], 'top'),
    (['청바지','데님','진','슬랙스','팬츠','스커트','반바지','쇼츠','jeans','pants','skirt'], 'bottom'),
    (['코트','자켓','재킷','블레이저','패딩','점퍼','가디건','coat','jacket'], 'outer'),
    (['원피스','드레스','dress'], 'dress'),
    (['스니커즈','운동화','로퍼','구두','샌들','부츠','슬리퍼','sneakers','shoes','boots'], 'shoes'),
    (['가방','백팩','크로스백','토트','bag','backpack','tote'], 'bag'),
    (['모자','목걸이','귀걸이','벨트','시계','선글라스','hat','cap','necklace','watch'], 'accessory'),
]
KEYWORD_COLOR = [
    (['검정','블랙','black'], 'black'), (['흰색','화이트','white','ivory','아이보리'], 'white'),
    (['베이지','크림','beige','cream'], 'beige'), (['네이비','navy','감색'], 'navy'),
    (['그레이','회색','gray','grey'], 'gray'), (['브라운','갈색','brown','khaki','카키'], 'brown'),
    (['핑크','분홍','pink'], 'pink'), (['레드','빨강','red'], 'red'),
    (['블루','파랑','blue'], 'blue'), (['그린','초록','green','olive','올리브'], 'green'),
]

def stub_classify(image_path=None, title=''):
    import random
    t = (title or '').lower()
    cat = next((c for kws,c in KEYWORD_CATEGORY if any(k in t for k in kws)),
               random.choice(['top','bottom','outer','shoes','bag']))
    color = next((c for kws,c in KEYWORD_COLOR if any(k in t for k in kws)), 'gray')
    return {'category': cat, 'subcategory': '', 'color': color,
            'pattern': 'solid', 'season': 'all', 'tags': []}

CLASSIFY_PROMPT = """이 사진에서 가장 주요한(가장 크게 보이는) 의류 아이템 하나를 분석하세요.
JSON으로만 답하세요. 다른 텍스트는 금지.

카테고리 정의 (반드시 이 중 하나):
- top: 셔츠 · 티셔츠 · 블라우스 · 니트 · 스웨터 · 후드 · 맨투맨 · 캐미솔 · 탱크탑
- bottom: 바지 · 청바지 · 슬랙스 · 치마 · 스커트 · 반바지 · 쇼츠
- outer: 자켓 · 코트 · 패딩 · 가디건 · 블레이저 · 점퍼
- dress: 원피스 · 점프수트
- shoes: 운동화 · 구두 · 로퍼 · 부츠 · 샌들 · 슬리퍼
- bag: 백팩 · 토트백 · 숄더백 · 크로스백 · 클러치
- accessory: 모자 · 벨트 · 시계 · 안경 · 목걸이 · 귀걸이

색상은 옷의 메인 색에서 가장 가까운 영어 단어.
사람이 입고 있어도 가장 큰 의류 1개에만 집중.
참고 정보(제목·설명·상세)가 있으면 거기서 사이즈·계절·패턴 정보 추출.

응답 형식 (모든 필드 반드시 채우되, 모르면 합리적으로 추정):
{
  "category": "top|bottom|outer|dress|shoes|bag|accessory",
  "subcategory": "한국어 구체 종류",
  "color": "beige|navy|black|white|gray|brown|red|pink|blue|green",
  "pattern": "solid|stripe|check|graphic|floral",
  "season": "spring|summer|fall|winter|all",
  "size_standard": "S|M|L|XL|FREE 또는 숫자(28·250 등). 본문에 없으면 빈 문자열",
  "tags": ["스타일 키워드 2-3개"],
  "bbox": [ymin, xmin, ymax, xmax]
}

bbox는 위에서 분류한 의류 아이템 1개의 위치를 정수 (0~1000 정규화)로 [상, 좌, 하, 우] 순서로.
예: 모델이 입은 상의만 잡고 싶다 → 머리 끝 ~ 허리선까지의 영역.
이미지 전체를 차지하면 [0, 0, 1000, 1000]."""

CLASSIFY_PROMPT_MULTI = """이 사진에 보이는 의류·패션 아이템을 모두 각각 분석하세요.
JSON으로만 답하세요. 다른 텍스트는 금지.

카테고리:
- top: 셔츠·티셔츠·블라우스·니트·스웨터·후드·맨투맨·캐미솔·탱크탑
- bottom: 바지·청바지·슬랙스·치마·스커트·반바지·쇼츠
- outer: 자켓·코트·패딩·가디건·블레이저·점퍼
- dress: 원피스·점프수트
- shoes: 운동화·구두·로퍼·부츠·샌들·슬리퍼
- bag: 백팩·토트백·숄더백·크로스백·클러치
- accessory: 모자·벨트·시계·안경·목걸이·귀걸이·스카프

규칙:
- 사람이 입고 있어도 각 아이템을 별개로.
- 같은 카테고리 안에서도 분리되어 보이면 별개 (예: 안에 입은 티셔츠 + 겉의 자켓).
- 너무 작거나 거의 가려진 건 무시.
- 아이템 1개만 보이면 items 배열에 1개만.
- 최대 5개.

응답 형식 (모든 필드 채우되, 정보 없으면 합리적 추정):
{
  "items": [
    {
      "category": "top|bottom|outer|dress|shoes|bag|accessory",
      "subcategory": "한국어 구체 종류",
      "color": "beige|navy|black|white|gray|brown|red|pink|blue|green",
      "pattern": "solid|stripe|check|graphic|floral",
      "season": "spring|summer|fall|winter|all",
      "size_standard": "S|M|L|XL|FREE 또는 숫자(28·250 등). 본문에 없으면 빈 문자열",
      "tags": ["스타일 키워드 2-3개"],
      "bbox": [ymin, xmin, ymax, xmax]
    }
  ],
  "primary_idx": 0
}

bbox 작성 규칙 — 매우 중요:
- 0~1000 정규화 [ymin, xmin, ymax, xmax] (정수).
- **해당 아이템의 픽셀이 실제 차지하는 영역만**. 사람 전체나 주변 다른 옷·살갗·배경은 포함 X.
- 의류는 그 의류의 외곽선(실루엣)에 딱 맞춰. 예: 상의는 머리·목·팔다리·하의 영역 제외.
- 신발은 신발 외곽선만 (발목·바지단·바닥 그림자 제외).
- 가방·벨트는 그 물건의 실루엣만.
- bbox가 다른 아이템 bbox와 겹쳐도 OK (각자 자기 아이템 영역만 정확히).
- 잘못된 예: 신발 검출 시 종아리·바지 포함하는 큰 박스. 올바른 예: 발등~밑창 끝까지의 타이트한 박스.

primary_idx는 가장 크고 메인이 되는 아이템의 items 인덱스."""

def _img_to_jpeg_b64(image_path, max_side=1536):
    """이미지를 JPEG base64로 (OpenAI data URL용). 너무 크면 축소."""
    import base64, io
    from PIL import Image
    img = Image.open(image_path).convert('RGB')
    if max(img.size) > max_side:
        img.thumbnail((max_side, max_side))
    buf = io.BytesIO(); img.save(buf, format='JPEG', quality=88)
    return base64.b64encode(buf.getvalue()).decode()

def _vision_generate(prompt, image_path):
    """비전 모델로 JSON 텍스트 응답. OpenAI 우선 → Gemini 폴백 → None."""
    if OPENAI_AVAILABLE:
        try:
            b64 = _img_to_jpeg_b64(image_path)
            resp = _openai_client.chat.completions.create(
                model=OPENAI_VISION_MODEL,
                messages=[{'role': 'user', 'content': [
                    {'type': 'text', 'text': prompt},
                    {'type': 'image_url', 'image_url': {'url': f'data:image/jpeg;base64,{b64}'}},
                ]}],
                response_format={'type': 'json_object'},
                temperature=0.2,
            )
            return resp.choices[0].message.content or ''
        except Exception as e:
            print(f'[ai] OpenAI vision 실패 → Gemini 폴백: {type(e).__name__}: {str(e)[:160]}', flush=True)
    if GEMINI_AVAILABLE:
        from PIL import Image
        img = Image.open(image_path).convert('RGB')
        resp = _gemini_model.generate_content([prompt, img], generation_config={'temperature': 0.2})
        return resp.text or ''
    return None

def _text_generate_json(prompt):
    """텍스트 프롬프트 → JSON 텍스트. OpenAI 우선 → Gemini 폴백 → None."""
    if OPENAI_AVAILABLE:
        try:
            resp = _openai_client.chat.completions.create(
                model=OPENAI_VISION_MODEL,
                messages=[{'role': 'user', 'content': prompt}],
                response_format={'type': 'json_object'},
                temperature=0.5,
            )
            return resp.choices[0].message.content or ''
        except Exception as e:
            print(f'[ai] OpenAI text 실패 → Gemini 폴백: {type(e).__name__}: {str(e)[:160]}', flush=True)
    if GEMINI_AVAILABLE:
        try:
            resp = _gemini_model.generate_content(prompt, generation_config={'temperature': 0.5})
            return resp.text or ''
        except Exception as e:
            print(f'[ai] Gemini text 실패: {type(e).__name__}: {str(e)[:160]}', flush=True)
    return None

def ai_classify_multi(image_path, title='', description='', body_text=''):
    """여러 아이템을 한 번에 탐지. 1개만 있으면 items=[1개]로 반환."""
    if not (OPENAI_AVAILABLE or GEMINI_AVAILABLE):
        print('[ai] no vision backend → stub(multi)', flush=True)
        return {'items': [stub_classify(image_path, title)], 'primary_idx': 0}
    try:
        prompt = CLASSIFY_PROMPT_MULTI
        ctx_parts = []
        if title: ctx_parts.append(f"제목: {title[:120]}")
        if description: ctx_parts.append(f"설명: {description[:200]}")
        if body_text: ctx_parts.append(f"상세: {body_text[:500]}")
        if ctx_parts:
            prompt += "\n\n참고 정보 (사이트에서 추출):\n" + "\n".join(ctx_parts)
        print(f'[ai] classify(multi) 호출...', flush=True)
        text = (_vision_generate(prompt, image_path) or '').strip()
        if not text:
            return {'items': [stub_classify(image_path, title)], 'primary_idx': 0}
        print(f'[ai] multi response (first 400): {text[:400]}', flush=True)
        import re
        m = re.search(r'\{.*\}', text, re.DOTALL)
        if not m:
            print(f'[ai] no JSON in multi → stub', flush=True)
            return {'items': [stub_classify(image_path, title)], 'primary_idx': 0}
        data = json.loads(m.group())
        allowed = {'top','bottom','outer','dress','shoes','bag','accessory'}
        items = [it for it in (data.get('items') or []) if isinstance(it, dict) and it.get('category') in allowed]
        if not items:
            print(f'[ai] multi empty → stub', flush=True)
            return {'items': [stub_classify(image_path, title)], 'primary_idx': 0}
        primary = data.get('primary_idx', 0)
        if not isinstance(primary, int) or primary < 0 or primary >= len(items):
            primary = 0
        print(f'[ai] multi ok: {len(items)} items, primary={primary}, cats={[it.get("category") for it in items]}', flush=True)
        return {'items': items, 'primary_idx': primary}
    except Exception as e:
        import traceback
        print(f'[ai] multi error: {type(e).__name__}: {e}', flush=True)
        traceback.print_exc()
    return {'items': [stub_classify(image_path, title)], 'primary_idx': 0}

def ai_classify(image_path, title='', description='', body_text=''):
    if not (OPENAI_AVAILABLE or GEMINI_AVAILABLE):
        print('[ai] no vision backend → stub', flush=True)
        return stub_classify(image_path, title)
    try:
        prompt = CLASSIFY_PROMPT
        ctx_parts = []
        if title: ctx_parts.append(f"제목: {title[:120]}")
        if description: ctx_parts.append(f"설명: {description[:200]}")
        if body_text: ctx_parts.append(f"상세: {body_text[:500]}")
        if ctx_parts:
            prompt += "\n\n참고 정보 (사이트에서 추출):\n" + "\n".join(ctx_parts)
        print(f'[ai] classify 호출...', flush=True)
        text = (_vision_generate(prompt, image_path) or '').strip()
        if not text:
            return stub_classify(image_path, title)
        print(f'[ai] response (first 300): {text[:300]}', flush=True)
        import re
        m = re.search(r'\{.*\}', text, re.DOTALL)
        if not m:
            print(f'[ai] no JSON found in response', flush=True)
            return stub_classify(image_path, title)
        data = json.loads(m.group())
        allowed = {'top','bottom','outer','dress','shoes','bag','accessory'}
        if data.get('category') not in allowed:
            print(f'[ai] invalid category {data.get("category")} → stub', flush=True)
            return stub_classify(image_path, title)
        print(f'[ai] ok: cat={data.get("category")} color={data.get("color")} bbox={data.get("bbox")}', flush=True)
        return data
    except Exception as e:
        import traceback
        print(f'[ai] error: {type(e).__name__}: {e}', flush=True)
        traceback.print_exc()
    return stub_classify(image_path, title)

def _http_get(url, timeout=15, extra_headers=None):
    """Cloudflare 우회: curl_cffi 사용 가능하면 chrome impersonation, 아니면 일반 requests fallback."""
    headers = _browser_headers()
    if extra_headers: headers.update(extra_headers)
    try:
        from curl_cffi import requests as ccr
        return ccr.get(url, impersonate='chrome', timeout=timeout, allow_redirects=True, headers=headers)
    except ImportError:
        import requests as rq
        return rq.get(url, headers=headers, timeout=timeout, allow_redirects=True)

def fetch_url_meta(url):
    """이미지·제목·풍부한 컨텍스트 추출 (제품설명·사이즈옵션 등)."""
    try:
        from bs4 import BeautifulSoup
        from urllib.parse import urljoin
        r = _http_get(url)
        print(f'[fetch] {url} → status={r.status_code} bytes={len(r.text)}')
        r.raise_for_status()
        soup = BeautifulSoup(r.text, 'html.parser')

        # 1. Title — og:title → twitter:title → <title>
        title = ''
        for sel in [('meta', {'property': 'og:title'}), ('meta', {'name': 'twitter:title'}), ('meta', {'name': 'title'})]:
            tag = soup.find(*sel)
            if tag and tag.get('content'):
                title = tag['content'].strip()
                break
        if not title and soup.title:
            title = (soup.title.string or '').strip()

        # 2. Image — og:image → twitter:image → link image_src → first big <img>
        image_url = None
        for sel in [
            ('meta', {'property': 'og:image'}),
            ('meta', {'property': 'og:image:url'}),
            ('meta', {'name': 'twitter:image'}),
            ('meta', {'name': 'twitter:image:src'}),
            ('link', {'rel': 'image_src'}),
        ]:
            tag = soup.find(*sel)
            if tag:
                val = tag.get('content') or tag.get('href')
                if val:
                    image_url = val
                    break

        # 3. Fallback — JSON-LD structured data
        if not image_url:
            import re
            for script in soup.find_all('script', type='application/ld+json'):
                try:
                    txt = script.string or ''
                    m = re.search(r'"image"\s*:\s*"([^"]+)"', txt)
                    if m: image_url = m.group(1); break
                    m = re.search(r'"image"\s*:\s*\[\s*"([^"]+)"', txt)
                    if m: image_url = m.group(1); break
                except: pass

        # 4. Last resort — pick first reasonably-sized <img> in main area
        if not image_url:
            for img in soup.find_all('img'):
                src = img.get('src') or img.get('data-src') or img.get('data-original')
                if src and not any(skip in src.lower() for skip in ['logo', 'icon', 'sprite', '.svg', 'avatar']):
                    image_url = src
                    break

        # Resolve relative URLs
        if image_url and not image_url.startswith(('http://', 'https://', 'data:')):
            image_url = urljoin(url, image_url)

        # 추가 컨텍스트 — description, body text 일부
        og_desc = soup.find('meta', property='og:description')
        description = og_desc.get('content', '') if og_desc else ''
        # body text에서 옷 관련 키워드 주변 200자만 (Gemini 비용 절약)
        body_text = ''
        for tag in soup.find_all(['p', 'li', 'span', 'div'], limit=200):
            t = (tag.get_text() or '').strip()
            if any(k in t for k in ['소재', '사이즈', '컬러', '색상', '계절', 'SIZE', '치수', '봄', '여름', '가을', '겨울', '면', '폴리', '울', '코튼']):
                body_text += t[:120] + ' / '
                if len(body_text) > 800: break

        print(f'[fetch] title="{title[:60]}" image={(image_url or "")[:80]}', flush=True)
        return image_url, title, description, body_text
    except Exception as e:
        print(f'[fetch] error: {e}', flush=True)
        return None, '', '', ''

def stub_coordinate(items, base_id=None, considering_id=None):
    import random
    if not items: return []
    by_cat = {}
    for it in items:
        by_cat.setdefault(it['category'] or 'top', []).append(it)
    combos = []
    moods = ['데일리 캐주얼', '미니멀 무드', '오피스 룩', '편안한 위켄드', '베이지 톤 매치']
    for i in range(3):
        ids = []
        if considering_id: ids.append(considering_id)
        if base_id and base_id != considering_id:
            ids.append(base_id)
        # add complementary categories
        for need in ['top','bottom','shoes','outer','bag']:
            if need in by_cat and by_cat[need]:
                pick = random.choice(by_cat[need])
                if pick['id'] not in ids:
                    ids.append(pick['id'])
                if need in ('outer','bag') and random.random() > 0.5:
                    break
            if len([x for x in ids if x is not None]) >= 4:
                break
        combos.append({'item_ids': ids, 'reasoning': random.choice(moods)})
    return combos

def ai_coordinate(anchor, owned, max_combos=4):
    """기준 아이템(있으면)과 옷장 옷의 '어울리는' 조합 생성. OpenAI→Gemini. 억지 매칭 금지 — 적으면 적게, 없으면 [].
    anchor 없으면 옷장 전체로 데일리 코디 추천. 반환: [{'item_ids':[...], 'reasoning': str}] / [] / None(실패)."""
    if not (OPENAI_AVAILABLE or GEMINI_AVAILABLE):
        return None
    anchor_id = anchor.get('id') if anchor else None
    pool = [it for it in owned if it.get('id') != anchor_id]
    if not pool:
        return []
    def _desc(it):
        return f"id={it['id']} | {it.get('category')} | {it.get('color') or '-'} | {it.get('pattern') or '-'} | {it.get('subcategory') or '-'} | {it.get('season') or 'all'}"
    catalog = "\n".join(_desc(it) for it in pool)
    if anchor:
        anchor_desc = f"{anchor.get('category')} / {anchor.get('color') or '-'} / {anchor.get('pattern') or '-'} / {anchor.get('subcategory') or '-'} / {anchor.get('season') or 'all'}"
        prompt = f"""사용자가 구매를 고민 중인 "기준 아이템"과, 이미 가진 옷장 목록이다.
기준 아이템과 **실제로 잘 어울리는** 코디 조합을 최대 {max_combos}개 제안하라. JSON으로만 답하라.

기준 아이템: {anchor_desc}

옷장 (id | category | color | pattern | subcategory | season):
{catalog}

규칙:
- 각 조합은 기준 아이템과 함께 입을 옷들의 id만 옷장에서 골라 나열 (기준 아이템 id는 넣지 마라).
- 현실적인 한 벌: 기준이 상의면 하의를 반드시 포함, 그 반대도. dress면 하의 제외. 신발·아우터·가방·액세서리는 어울리면 추가.
- 같은 카테고리 중복 금지 (상의 2개 X). 단 outer+top은 허용.
- 옷장에 있는 id만 사용. **억지로 채우지 마라.** 색·톤·무드가 어울리는 조합만. 어울리는 게 적으면 적게, 거의 없으면 combos를 빈 배열로.
- reasoning은 한국어 한 줄 무드 설명 (예: "톤온톤 베이지 미니멀", "캐주얼 데일리").

형식: {{"combos": [{{"item_ids": [정수...], "reasoning": "..."}}]}}"""
    else:
        prompt = f"""사용자의 옷장 목록이다. 이 옷들만으로 **실제로 잘 어울리는** 데일리 코디 조합을 최대 {max_combos}개 제안하라. JSON으로만 답하라.

옷장 (id | category | color | pattern | subcategory | season):
{catalog}

규칙:
- 현실적인 한 벌: 상의+하의는 기본, 신발·아우터·가방·액세서리는 어울리면 추가. dress는 하의 제외.
- 같은 카테고리 중복 금지 (상의 2개 X). 단 outer+top은 허용.
- 옷장에 있는 id만 사용. **억지로 채우지 마라.** 색·톤·무드가 어울리는 조합만.
- 매 조합은 서로 다르게 구성. reasoning은 한국어 한 줄 무드 설명 (예: "톤온톤 베이지 미니멀").

형식: {{"combos": [{{"item_ids": [정수...], "reasoning": "..."}}]}}"""
    text = _text_generate_json(prompt)
    if not text:
        return None
    try:
        import re
        m = re.search(r'\{.*\}', text, re.DOTALL)
        data = json.loads(m.group()) if m else json.loads(text)
        valid_ids = {it['id'] for it in pool}
        out = []
        for combo in (data.get('combos') or [])[:max_combos]:
            ids = [i for i in (combo.get('item_ids') or []) if isinstance(i, int) and i in valid_ids]
            if not ids:
                continue
            full = ([anchor['id']] + ids) if anchor else ids
            out.append({'item_ids': full, 'reasoning': (combo.get('reasoning') or '코디 추천').strip()[:40]})
        return out
    except Exception as e:
        print(f'[coord] 파싱 실패 → stub 폴백: {type(e).__name__}: {str(e)[:120]}', flush=True)
        return None

# ── Helpers ───────────────────────────────────────────────────
def blocklist():
    with db() as c:
        rows = c.execute('SELECT ip FROM ip_blocklist').fetchall()
    return {r['ip'] for r in rows}

def client_ip():
    return request.headers.get('X-Forwarded-For', request.remote_addr or '').split(',')[0].strip()

def hash_ip(ip):
    return hashlib.sha256(ip.encode()).hexdigest()[:16]

def device(ua):
    u = (ua or '').lower()
    if any(x in u for x in ['iphone','android','mobile']): return 'mobile'
    if any(x in u for x in ['ipad','tablet']): return 'tablet'
    return 'desktop'

BOT_PATTERNS = (
    'bot','crawler','spider','curl','wget','python-requests','httpclient',
    'headlesschrome','phantomjs','puppeteer','playwright','selenium',
    'facebookexternalhit','meta-externalagent','kakaotalk-scrap','daum',
    'twitterbot','whatsapp','telegrambot','linkedinbot','slackbot',
    'discordbot','pinterestbot','redditbot','embed','preview','lighthouse',
    'gptbot','claudebot','perplexity','anthropic','openai','ccbot',
)

def is_bot(ua):
    u = (ua or '').lower()
    if not u: return True
    return any(p in u for p in BOT_PATTERNS)

def require_auth(f):
    @wraps(f)
    def wrap(*a, **kw):
        auth = request.authorization
        if not auth or auth.password != DASH_PW:
            return Response('Login required', 401, {'WWW-Authenticate': 'Basic realm="LOOKBOX"'})
        return f(*a, **kw)
    return wrap

# ── API ───────────────────────────────────────────────────────
@app.route('/api/track', methods=['POST','OPTIONS'])
def track():
    if request.method == 'OPTIONS':
        return '', 204
    ip = client_ip()
    if ip in blocklist():
        return jsonify({'ok': True})
    ua = request.headers.get('User-Agent', '')
    if is_bot(ua):
        return jsonify({'ok': True, 'filtered': 'bot'})
    try:
        data  = request.get_json(silent=True) or {}
        props = data.get('properties', {})
        with db() as c:
            c.execute('''INSERT INTO events
                (session_id,event_name,properties,page_url,referrer,user_agent,
                 ip_hash,utm_source,utm_medium,utm_campaign,device)
                VALUES (?,?,?,?,?,?,?,?,?,?,?)''', (
                data.get('session_id'), data.get('event'),
                json.dumps(props, ensure_ascii=False),
                data.get('url'), data.get('referrer'), ua, hash_ip(ip),
                props.get('utm_source'), props.get('utm_medium'), props.get('utm_campaign'),
                device(ua)
            ))
            c.commit()
    except Exception as e:
        print(f'Track error: {e}')
    resp = jsonify({'ok': True})
    resp.headers['Access-Control-Allow-Origin'] = '*'
    return resp

@app.route('/api/dashboard/data')
@require_auth
def dash_data():
    today = datetime.now().strftime('%Y-%m-%d')
    start = request.args.get('start', '')
    end   = request.args.get('end', today)

    if start:
        df = "AND date(created_at) BETWEEN ? AND ?"
        da = (start, end)
    else:
        df, da = '', ()

    with db() as c:
        def q(sql, *args): return c.execute(sql, args).fetchall()
        def scalar(sql, *args): return c.execute(sql, args).fetchone()[0]
        def pq(sql, *args): return q(sql + ' ' + df, *args, *da)
        def ps(sql, *args): return scalar(sql + ' ' + df, *args, *da)

        funnel = {ev: ps('SELECT COUNT(DISTINCT session_id) FROM events WHERE event_name=?', ev)
                  for ev in ['page_view','plan_picker_open','plan_form_valid','plan_selected','confirm_btn_click']}

        today_pv   = scalar("SELECT COUNT(DISTINCT session_id) FROM events WHERE event_name='page_view' AND date(created_at)=?", today)
        today_conv = scalar("SELECT COUNT(DISTINCT session_id) FROM events WHERE event_name='confirm_btn_click' AND date(created_at)=?", today)
        active     = scalar("SELECT COUNT(DISTINCT session_id) FROM events WHERE datetime(created_at) >= datetime('now','-5 minutes')")

        recent_sql = 'SELECT event_name,properties,device,utm_source,session_id,created_at FROM events'
        recent_sql += (' WHERE date(created_at) BETWEEN ? AND ?' if start else '') + ' ORDER BY id DESC LIMIT 50'
        recent   = q(recent_sql, *(da if start else ()))
        utms     = pq("SELECT COALESCE(utm_source,'(직접 방문)') utm_source, COUNT(DISTINCT session_id) cnt FROM events WHERE event_name='page_view' GROUP BY utm_source ORDER BY cnt DESC LIMIT 10")
        ad_break = pq("SELECT COALESCE(utm_source,'(직접)') src, COALESCE(utm_campaign,'-') camp, COALESCE(json_extract(properties,'$.utm_content'),'-') content, COUNT(DISTINCT session_id) cnt FROM events WHERE event_name='page_view' AND utm_source IS NOT NULL GROUP BY src, camp, content ORDER BY cnt DESC LIMIT 20")
        payers   = pq("SELECT properties, created_at FROM events WHERE event_name='confirm_btn_click' ORDER BY id DESC LIMIT 50")
        devices  = pq("SELECT device, COUNT(DISTINCT session_id) cnt FROM events WHERE event_name='page_view' GROUP BY device ORDER BY cnt DESC")
        hourly_d = end if start else today
        hourly   = q("SELECT strftime('%H',created_at) hr, COUNT(DISTINCT session_id) cnt FROM events WHERE event_name='page_view' AND date(created_at)=? GROUP BY hr ORDER BY hr", hourly_d)
        plans    = pq("SELECT properties, COUNT(*) cnt FROM events WHERE event_name='plan_selected' GROUP BY properties ORDER BY cnt DESC")
        scroll   = pq("SELECT json_extract(properties,'$.depth') depth, COUNT(DISTINCT session_id) cnt FROM events WHERE event_name='scroll_depth' GROUP BY depth ORDER BY CAST(depth AS INTEGER)")
        sections = pq("SELECT json_extract(properties,'$.section') sec, COUNT(DISTINCT session_id) cnt FROM events WHERE event_name='section_view' GROUP BY sec ORDER BY cnt DESC")

    plans_out = []
    for p in plans:
        try: plans_out.append({'plan': json.loads(p['properties']).get('plan','?'), 'cnt': p['cnt']})
        except: pass

    return jsonify({
        'funnel': funnel,
        'today': {'visitors': today_pv, 'conversions': today_conv},
        'active_now': active,
        'recent':   [dict(r) for r in recent],
        'utms':     [dict(r) for r in utms],
        'ad_break': [dict(r) for r in ad_break],
        'payers':   [dict(r) for r in payers],
        'devices':  [dict(r) for r in devices],
        'hourly':   [dict(r) for r in hourly],
        'plans':    plans_out,
        'scroll':   [dict(r) for r in scroll],
        'sections': [dict(r) for r in sections],
    })

@app.route('/api/reset', methods=['POST'])
@require_auth
def reset_data():
    with db() as c:
        c.execute('DELETE FROM events')
        c.commit()
    return jsonify({'ok': True})

# ── Blocklist API ─────────────────────────────────────────────
@app.route('/api/blocklist', methods=['GET'])
@require_auth
def bl_get():
    with db() as c:
        rows = c.execute('SELECT ip FROM ip_blocklist ORDER BY created_at DESC').fetchall()
    return jsonify({'ips': [r['ip'] for r in rows]})

@app.route('/api/blocklist', methods=['POST'])
@require_auth
def bl_add():
    ip = (request.get_json(silent=True) or {}).get('ip', '').strip()
    if not ip:
        return jsonify({'error': 'IP required'}), 400
    with db() as c:
        c.execute('INSERT OR IGNORE INTO ip_blocklist (ip) VALUES (?)', (ip,))
        c.commit()
    return jsonify({'ok': True})

@app.route('/api/blocklist/<path:ip>', methods=['DELETE'])
@require_auth
def bl_del(ip):
    with db() as c:
        c.execute('DELETE FROM ip_blocklist WHERE ip=?', (ip,))
        c.commit()
    return jsonify({'ok': True})

# ── Wardrobe MVP API ──────────────────────────────────────────
@app.route('/api/wardrobe', methods=['GET'])
def wardrobe_list():
    status = request.args.get('status', 'owned')
    sort   = request.args.get('sort', 'recent')
    sort_sql = {
        'recent': 'created_at DESC',
        'worn':   'wear_count DESC, COALESCE(last_worn,"") DESC',
        'rating': 'CASE WHEN rating_count=0 THEN 0 ELSE CAST(rating_sum AS REAL)/rating_count END DESC',
        'unworn': 'wear_count ASC, COALESCE(last_worn,"") ASC',
    }.get(sort, 'created_at DESC')
    with db() as c:
        rows = c.execute(f'SELECT * FROM clothes WHERE status=? ORDER BY {sort_sql}', (status,)).fetchall()
    return jsonify([dict(r) for r in rows])

CAT_KO = {'top':'상의','bottom':'하의','outer':'아우터','dress':'원피스','shoes':'신발','bag':'가방','accessory':'액세서리'}

def _build_product_shot_prompt(meta):
    cat_ko = CAT_KO.get(meta.get('category') or '', '의류')
    subcat = (meta.get('subcategory') or '').strip()
    item_desc = f'{cat_ko}({subcat})' if subcat else cat_ko
    return f"""이 사진에서 {item_desc} 하나만 추출해서 통일된 e커머스 제품 컷으로 만들어줘.
- 배경: 균일한 연한 웜그레이(#EFEDE8) 단색. 그라데이션·그림자·반사·텍스트·워터마크 금지.
- 구도: 아이템을 정중앙에, 평평하게 펼친(또는 정면) 모습으로 프레임의 약 85%를 채우게.
- 사람·다른 옷·악세서리·소품·피부·머리카락·팔다리는 전부 제거.
- {item_desc}의 색·재질·디테일·로고·패턴·실루엣은 원본 그대로 유지.
- 세로 4:5 비율."""

def ai_generate_clean_shot(input_path, output_path, meta):
    """원본 사진을 이미지 편집 모델에 보내 통일된 제품샷 생성. OpenAI 우선 → Gemini 폴백.
    bbox로 미리 자르지 않음 — 모델이 컨텍스트 보고 알아서 아이템 추출."""
    if not (OPENAI_IMAGE_AVAILABLE or IMAGE_GEN_AVAILABLE): return False
    cat = meta.get('category') or ''
    prompt = _build_product_shot_prompt(meta)
    # 1순위: OpenAI gpt-image-1 편집
    if OPENAI_IMAGE_AVAILABLE:
        try:
            import base64, io
            from PIL import Image
            img = Image.open(input_path).convert('RGB')
            if max(img.size) > 1024: img.thumbnail((1024, 1024))  # 업로드 용량↓ → 속도↑
            buf = io.BytesIO(); img.save(buf, format='PNG'); buf.seek(0); buf.name = 'src.png'
            print(f'[img-gen] OpenAI {cat} 시작 (img={img.size}, q={OPENAI_IMAGE_QUALITY})', flush=True)
            result = _openai_client.images.edit(
                model=OPENAI_IMAGE_MODEL, image=buf, prompt=prompt,
                size='1024x1536', quality=OPENAI_IMAGE_QUALITY,
            )
            with open(output_path, 'wb') as fo: fo.write(base64.b64decode(result.data[0].b64_json))
            print(f'[img-gen] OpenAI {cat} 성공 → {os.path.basename(output_path)}', flush=True)
            return True
        except Exception as e:
            print(f'[img-gen] OpenAI 실패 → Gemini/폴백: {type(e).__name__}: {str(e)[:200]}', flush=True)
    # 2순위: Gemini 이미지 생성
    if IMAGE_GEN_AVAILABLE:
        try:
            from PIL import Image
            img = Image.open(input_path).convert('RGB')
            print(f'[img-gen] Gemini {cat} 시작 (img={img.size})', flush=True)
            resp = _gemini_image_model.generate_content(
                [prompt, img],
                generation_config={'response_modalities': ['IMAGE'], 'temperature': 0.3},
            )
            for cand in (resp.candidates or []):
                for part in (cand.content.parts or []):
                    data = getattr(part, 'inline_data', None)
                    if data and getattr(data, 'data', None):
                        with open(output_path, 'wb') as fo: fo.write(data.data)
                        print(f'[img-gen] Gemini {cat} 성공 → {os.path.basename(output_path)}', flush=True)
                        return True
            print(f'[img-gen] Gemini {cat} 빈 응답 (텍스트만 옴?)', flush=True)
        except Exception as e:
            print(f'[img-gen] Gemini 에러: {type(e).__name__}: {str(e)[:200]}', flush=True)
    return False

def _process_item(src_path, src_ext, base, idx, meta):
    """원본 그대로 image-gen → 실패시 bbox 크롭 + rembg 폴백. (fname, cat) 반환."""
    import shutil
    item_base = f'{base}_{idx}'
    final_name = f'{item_base}.png'
    final_path = os.path.join(UPLOADS_DIR, final_name)
    cat = meta.get('category')
    # 1순위: 원본 통째로 image-gen
    if ai_generate_clean_shot(src_path, final_path, meta):
        return final_name, cat
    # 2순위: bbox 크롭 + rembg
    tmp_path = os.path.join(UPLOADS_DIR, f'{item_base}.{src_ext}')
    shutil.copy(src_path, tmp_path)
    if meta.get('bbox'):
        _crop_to_bbox(tmp_path, meta['bbox'])
    mode = 'cloth' if cat in ('top','bottom','outer','dress','accessory') else 'general'
    if remove_bg(tmp_path, final_path, mode=mode, category=cat):
        try: os.remove(tmp_path)
        except: pass
        return final_name, cat
    return f'{item_base}.{src_ext}', cat

def _process_and_insert(src_path, src_ext, base, items_meta, source, source_url, title):
    """아이템별 제품샷 생성을 병렬로 (이미지 생성이 직렬이면 N배 느림). DB insert는 순서 유지 위해 직렬."""
    from concurrent.futures import ThreadPoolExecutor
    def _work(args):
        i, meta = args
        fname, _ = _process_item(src_path, src_ext, base, i, meta)
        return i, fname, meta
    results = [None] * len(items_meta)
    with ThreadPoolExecutor(max_workers=min(len(items_meta), 4) or 1) as ex:
        for i, fname, meta in ex.map(_work, list(enumerate(items_meta))):
            results[i] = (fname, meta)
    return [_insert_pending(fname, source, source_url, title, meta) for fname, meta in results]

def _insert_pending(fname, source, source_url, title, meta):
    cat = meta.get('category')
    with db() as c:
        cur = c.execute('''INSERT INTO clothes
            (image_path, source, source_url, title, status, category, subcategory, color, pattern, season, tags, size_standard)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)''', (
            f'/app/uploads/{fname}', source, source_url, title, 'pending',
            cat, meta.get('subcategory'), meta.get('color'),
            meta.get('pattern'), meta.get('season'), json.dumps(meta.get('tags',[]), ensure_ascii=False),
            (meta.get('size_standard') or '').strip() or None
        ))
        c.commit()
        new_id = cur.lastrowid
        row = c.execute('SELECT * FROM clothes WHERE id=?', (new_id,)).fetchone()
    return dict(row)

@app.route('/api/wardrobe', methods=['POST'])
def wardrobe_add():
    f = request.files.get('image')
    if not f: return jsonify({'error': 'no image'}), 400
    import time, uuid
    src_ext = (f.filename or 'jpg').rsplit('.', 1)[-1].lower()
    if src_ext not in ('jpg','jpeg','png','webp','gif'): src_ext = 'jpg'
    base = f'{int(time.time())}_{uuid.uuid4().hex[:6]}'
    src_path = os.path.join(UPLOADS_DIR, f'{base}_src.{src_ext}')
    f.save(src_path)
    multi = ai_classify_multi(src_path)
    items_meta = multi['items']
    primary_idx = multi.get('primary_idx', 0)
    intended_status = request.form.get('status', 'owned')
    inserted = _process_and_insert(src_path, src_ext, base, items_meta, 'upload', None, None)
    try: os.remove(src_path)
    except: pass
    return jsonify({'items': inserted, 'primary_idx': primary_idx, 'intended_status': intended_status})

@app.route('/api/wardrobe/url', methods=['POST'])
def wardrobe_add_url():
    data = request.get_json(silent=True) or {}
    url = (data.get('url') or '').strip()
    status = data.get('status', 'considering')
    if not url: return jsonify({'error': 'no url'}), 400
    image_url, title, description, body_text = fetch_url_meta(url)
    if not image_url:
        return jsonify({'error': '이미지를 찾지 못했어요. 다른 URL이나 사진 업로드로 시도해보세요.'}), 400
    import time, uuid
    try:
        r = _http_get(image_url, extra_headers={'Referer': url})
        if hasattr(r, 'raise_for_status'): r.raise_for_status()
        elif getattr(r, 'status_code', 200) >= 400:
            raise Exception(f'HTTP {r.status_code}')
        ct = (r.headers.get('Content-Type') or '').lower()
        src_ext = 'jpg'
        if 'png' in ct: src_ext = 'png'
        elif 'webp' in ct: src_ext = 'webp'
        elif 'gif' in ct: src_ext = 'gif'
        base = f'{int(time.time())}_{uuid.uuid4().hex[:6]}'
        src_path = os.path.join(UPLOADS_DIR, f'{base}_src.{src_ext}')
        with open(src_path, 'wb') as fp: fp.write(r.content)
    except Exception as e:
        return jsonify({'error': f'image download failed: {e}'}), 400
    multi = ai_classify_multi(src_path, title, description, body_text)
    items_meta = multi['items']
    primary_idx = multi.get('primary_idx', 0)
    inserted = _process_and_insert(src_path, src_ext, base, items_meta, 'url', url, title)
    try: os.remove(src_path)
    except: pass
    return jsonify({'items': inserted, 'primary_idx': primary_idx, 'intended_status': status})

@app.route('/api/wardrobe/<int:cid>', methods=['PATCH'])
def wardrobe_update(cid):
    data = request.get_json(silent=True) or {}
    allowed = ['status','category','subcategory','color','pattern','season','tags',
               'size_standard','size_detail','note','title']
    fields, args = [], []
    for k in allowed:
        if k in data:
            v = data[k]
            if k in ('tags','size_detail') and not isinstance(v, str):
                v = json.dumps(v, ensure_ascii=False)
            fields.append(f'{k}=?')
            args.append(v)
    if not fields: return jsonify({'ok': True})
    args.append(cid)
    with db() as c:
        c.execute(f'UPDATE clothes SET {", ".join(fields)} WHERE id=?', args)
        c.commit()
    return jsonify({'ok': True})

@app.route('/api/wardrobe/<int:cid>', methods=['DELETE'])
def wardrobe_delete(cid):
    with db() as c:
        row = c.execute('SELECT image_path FROM clothes WHERE id=?', (cid,)).fetchone()
        if row:
            try:
                fname = (row['image_path'] or '').rsplit('/', 1)[-1]
                fp = os.path.join(UPLOADS_DIR, fname)
                if fname and os.path.exists(fp): os.remove(fp)
            except: pass
        c.execute('DELETE FROM clothes WHERE id=?', (cid,))
        c.commit()
    return jsonify({'ok': True})

@app.route('/api/wardrobe/<int:cid>/wear', methods=['POST'])
def wardrobe_wear(cid):
    with db() as c:
        c.execute('UPDATE clothes SET last_worn=CURRENT_TIMESTAMP, wear_count=wear_count+1 WHERE id=?', (cid,))
        c.commit()
        row = c.execute('SELECT wear_count, last_worn FROM clothes WHERE id=?', (cid,)).fetchone()
    return jsonify({'ok': True, 'wear_count': row['wear_count'], 'last_worn': row['last_worn']})

@app.route('/api/coordinate', methods=['POST'])
def coordinate():
    data = request.get_json(silent=True) or {}
    base_id = data.get('base_id')
    considering_id = data.get('considering_id')
    cooldown = int(data.get('cooldown_days', 3))
    with db() as c:
        rows = c.execute('''
            SELECT * FROM clothes
            WHERE status='owned'
              AND (last_worn IS NULL OR last_worn < datetime('now', ?))
        ''', (f'-{cooldown} days',)).fetchall()
        items = [dict(r) for r in rows]
        anchor = None
        anchor_id = considering_id or base_id
        if anchor_id:
            row = c.execute('SELECT * FROM clothes WHERE id=?', (anchor_id,)).fetchone()
            if row:
                anchor = dict(row)
                if anchor not in items: items.append(anchor)
    # AI 스타일링 우선 (앵커 있으면 기준 매칭, 없으면 옷장 전체). 실패 시 stub.
    combos = ai_coordinate(anchor, items)
    if combos is None:
        combos = stub_coordinate(items, base_id, considering_id)
    with db() as c:
        for combo in combos:
            cur = c.execute('INSERT INTO outfits (item_ids, base_id, considering_id, reasoning) VALUES (?,?,?,?)',
                (json.dumps(combo['item_ids']), base_id, considering_id, combo['reasoning']))
            combo['id'] = cur.lastrowid
        c.commit()
        item_lookup = {}
        for it_id in {iid for combo in combos for iid in combo['item_ids']}:
            row = c.execute('SELECT * FROM clothes WHERE id=?', (it_id,)).fetchone()
            if row: item_lookup[it_id] = dict(row)
    for combo in combos:
        combo['items'] = [item_lookup[iid] for iid in combo['item_ids'] if iid in item_lookup]
    return jsonify(combos)

@app.route('/api/outfits/worn', methods=['GET'])
def outfits_worn():
    """입었다고 기록된 코디 목록 (최근순)."""
    with db() as c:
        rows = c.execute('SELECT * FROM outfits WHERE worn=1 ORDER BY id DESC LIMIT 50').fetchall()
        outfits = []
        for r in rows:
            o = dict(r)
            try: iids = json.loads(o['item_ids'])
            except: iids = []
            items = []
            for iid in iids:
                ir = c.execute('SELECT id, image_path, category FROM clothes WHERE id=?', (iid,)).fetchone()
                if ir: items.append(dict(ir))
            o['items'] = items
            outfits.append(o)
    return jsonify(outfits)

@app.route('/api/outfit/<int:oid>/rate', methods=['POST'])
def outfit_rate(oid):
    data = request.get_json(silent=True) or {}
    rating = data.get('rating')
    worn = 1 if data.get('worn') else 0
    with db() as c:
        c.execute('UPDATE outfits SET rating=?, worn=? WHERE id=?', (rating, worn, oid))
        row = c.execute('SELECT item_ids FROM outfits WHERE id=?', (oid,)).fetchone()
        if row:
            try: iids = json.loads(row['item_ids'])
            except: iids = []
            if worn:
                for iid in iids:
                    c.execute('UPDATE clothes SET last_worn=CURRENT_TIMESTAMP, wear_count=wear_count+1 WHERE id=?', (iid,))
            if rating:
                for iid in iids:
                    c.execute('UPDATE clothes SET rating_sum=rating_sum+?, rating_count=rating_count+1 WHERE id=?', (rating, iid))
        c.commit()
    return jsonify({'ok': True})

# ── Prototype Live API ─────────────────────────────────────────
CATEGORY_KO = {
    'top': '상의', 'bottom': '하의', 'outer': '아우터', 'dress': '원피스',
    'shoes': '신발', 'bag': '액세서리', 'accessory': '액세서리',
}
CATEGORY_EN = {
    '상의': 'top', '하의': 'bottom', '아우터': 'outer', '원피스': 'dress',
    '신발': 'shoes', '가방': 'bag', '액세서리': 'accessory',
}

def _live_id(db_id):
    return f'db-{db_id}'

def _db_id(raw):
    if isinstance(raw, int):
        return raw
    raw = str(raw or '')
    if raw.startswith('db-'):
        raw = raw[3:]
    try:
        return int(raw)
    except ValueError:
        return None

def _live_item(row):
    r = dict(row)
    cat = CATEGORY_KO.get(r.get('category') or '', r.get('category') or '상의')
    name = r.get('title') or r.get('subcategory') or CAT_KO.get(r.get('category') or '', '옷')
    return {
        'id': _live_id(r['id']),
        'serverId': r['id'],
        'name': name,
        'category': cat,
        'color': r.get('color') or '뉴트럴',
        'img': (r.get('image_path') + '?flat=1') if r.get('image_path') else None,
        'status': r.get('status'),
        'brand': r.get('title') or '',
        'size': r.get('size_standard') or '',
        'note': r.get('note') or '',
        'conf': 0.95,
    }

def _live_outfit(combo):
    item_ids = [_live_id(i) for i in combo.get('item_ids', [])]
    mood = combo.get('reasoning') or 'AI 추천 코디'
    return {
        'id': 'outfit-' + str(combo.get('id') or abs(hash(tuple(item_ids))) % 1000000),
        'serverId': combo.get('id'),
        'label': mood[:18],
        'mood': mood,
        'itemIds': item_ids,
        'lookImg': None,
    }

def _set_item_status(ids, status):
    ids = [i for i in (_db_id(x) for x in ids) if i]
    if not ids:
        return []
    with db() as c:
        q = ','.join('?' for _ in ids)
        if status == 'delete':
            rows = c.execute(f'SELECT image_path FROM clothes WHERE id IN ({q})', ids).fetchall()
            c.execute(f'DELETE FROM clothes WHERE id IN ({q})', ids)
            c.commit()
            for row in rows:
                try:
                    fname = (row['image_path'] or '').rsplit('/', 1)[-1]
                    fp = os.path.join(UPLOADS_DIR, fname)
                    if fname and os.path.exists(fp):
                        os.remove(fp)
                except Exception:
                    pass
            return []
        c.execute(f'UPDATE clothes SET status=? WHERE id IN ({q})', [status] + ids)
        c.commit()
        rows = c.execute(f'SELECT * FROM clothes WHERE id IN ({q})', ids).fetchall()
    return [_live_item(r) for r in rows]

def _insert_live_items(src_path, src_ext, base, items_meta, source, source_url, title, status):
    inserted = _process_and_insert(src_path, src_ext, base, items_meta, source, source_url, title)
    ids = [it['id'] for it in inserted]
    return _set_item_status(ids, status)

@app.route('/api/live/status')
def live_status():
    return jsonify({
        'ok': True,
        'openai': OPENAI_AVAILABLE,
        'openai_image': OPENAI_IMAGE_AVAILABLE,
        'gemini': GEMINI_AVAILABLE,
        'image_generation': OPENAI_IMAGE_AVAILABLE or IMAGE_GEN_AVAILABLE,
        'background_removal': REMBG_AVAILABLE,
    })

@app.route('/api/live/wardrobe')
def live_wardrobe():
    status = request.args.get('status', 'owned')
    with db() as c:
        rows = c.execute('SELECT * FROM clothes WHERE status=? ORDER BY created_at DESC', (status,)).fetchall()
    return jsonify({'items': [_live_item(r) for r in rows]})

@app.route('/api/live/import/photo', methods=['POST'])
def live_import_photo():
    f = request.files.get('image')
    if not f:
        return jsonify({'error': 'no image'}), 400
    import time, uuid
    status = request.form.get('status', 'owned')
    if status not in ('owned', 'considering', 'pending'):
        status = 'owned'
    src_ext = (f.filename or 'jpg').rsplit('.', 1)[-1].lower()
    if src_ext not in ('jpg', 'jpeg', 'png', 'webp', 'gif'):
        src_ext = 'jpg'
    base = f'{int(time.time())}_{uuid.uuid4().hex[:6]}'
    src_path = os.path.join(UPLOADS_DIR, f'{base}_src.{src_ext}')
    f.save(src_path)
    try:
        multi = ai_classify_multi(src_path)
        items = _insert_live_items(src_path, src_ext, base, multi['items'], 'upload', None, None, status)
        return jsonify({'items': items, 'primary_idx': multi.get('primary_idx', 0), 'status': status})
    finally:
        try:
            os.remove(src_path)
        except Exception:
            pass

@app.route('/api/live/import/url', methods=['POST'])
def live_import_url():
    data = request.get_json(silent=True) or {}
    url = (data.get('url') or '').strip()
    status = data.get('status', 'considering')
    if status not in ('owned', 'considering', 'pending'):
        status = 'considering'
    if not url:
        return jsonify({'error': 'no url'}), 400
    image_url, title, description, body_text = fetch_url_meta(url)
    if not image_url:
        return jsonify({'error': '이미지를 찾지 못했어요. 다른 URL이나 사진 업로드로 시도해보세요.'}), 400
    import time, uuid
    try:
        r = _http_get(image_url, extra_headers={'Referer': url})
        if hasattr(r, 'raise_for_status'):
            r.raise_for_status()
        elif getattr(r, 'status_code', 200) >= 400:
            raise Exception(f'HTTP {r.status_code}')
        ct = (r.headers.get('Content-Type') or '').lower()
        src_ext = 'jpg'
        if 'png' in ct:
            src_ext = 'png'
        elif 'webp' in ct:
            src_ext = 'webp'
        elif 'gif' in ct:
            src_ext = 'gif'
        base = f'{int(time.time())}_{uuid.uuid4().hex[:6]}'
        src_path = os.path.join(UPLOADS_DIR, f'{base}_src.{src_ext}')
        with open(src_path, 'wb') as fp:
            fp.write(r.content)
    except Exception as e:
        return jsonify({'error': f'image download failed: {e}'}), 400
    try:
        multi = ai_classify_multi(src_path, title, description, body_text)
        items = _insert_live_items(src_path, src_ext, base, multi['items'], 'url', url, title, status)
        return jsonify({'items': items, 'primary_idx': multi.get('primary_idx', 0), 'status': status})
    finally:
        try:
            os.remove(src_path)
        except Exception:
            pass

@app.route('/api/live/items/status', methods=['POST'])
def live_items_status():
    data = request.get_json(silent=True) or {}
    status = data.get('status', 'owned')
    if status not in ('owned', 'considering', 'pending', 'archived', 'delete'):
        return jsonify({'error': 'invalid status'}), 400
    items = _set_item_status(data.get('ids') or [], status)
    return jsonify({'ok': True, 'items': items})

@app.route('/api/live/coordinate', methods=['POST'])
def live_coordinate():
    data = request.get_json(silent=True) or {}
    anchor_id = _db_id(data.get('anchor_id'))
    max_combos = int(data.get('max_combos') or 4)
    with db() as c:
        owned_rows = c.execute("SELECT * FROM clothes WHERE status='owned' ORDER BY created_at DESC").fetchall()
        items = [dict(r) for r in owned_rows]
        anchor = None
        if anchor_id:
            row = c.execute('SELECT * FROM clothes WHERE id=?', (anchor_id,)).fetchone()
            if row:
                anchor = dict(row)
                if all(it['id'] != anchor['id'] for it in items):
                    items.append(anchor)
    combos = ai_coordinate(anchor, items, max_combos=max_combos)
    if combos is None:
        combos = stub_coordinate(items, considering_id=anchor_id)
    with db() as c:
        for combo in combos:
            cur = c.execute(
                'INSERT INTO outfits (item_ids, base_id, considering_id, reasoning) VALUES (?,?,?,?)',
                (json.dumps(combo['item_ids']), None, anchor_id, combo.get('reasoning') or 'AI 추천 코디')
            )
            combo['id'] = cur.lastrowid
        c.commit()
        ids = sorted({iid for combo in combos for iid in combo.get('item_ids', [])})
        item_rows = []
        if ids:
            q = ','.join('?' for _ in ids)
            item_rows = c.execute(f'SELECT * FROM clothes WHERE id IN ({q})', ids).fetchall()
    return jsonify({
        'anchor': _live_item(anchor) if anchor else None,
        'items': [_live_item(r) for r in item_rows],
        'outfits': [_live_outfit(c) for c in combos],
    })

# ── Dashboard & Static ────────────────────────────────────────
def prototype_response():
    filename = 'Prototype.live.html' if os.path.exists(os.path.join(BASE_DIR, 'Prototype.live.html')) else 'Prototype.html'
    return send_from_directory(BASE_DIR, filename)

@app.route('/app')
def app_index():
    return prototype_response()

_norm_warmed = False
@app.route('/api/warm-norms', methods=['POST'])
def warm_norms():
    """소유/고민중 옷 이미지의 정규화본을 백그라운드로 미리 생성 → 조합/데모 타일 즉시 표시."""
    global _norm_warmed
    if _norm_warmed:
        return jsonify({'ok': True, 'skipped': True})
    _norm_warmed = True
    with db() as c:
        rows = c.execute("SELECT image_path FROM clothes WHERE status IN ('owned','considering')").fetchall()
    names = [(r['image_path'] or '').rsplit('/', 1)[-1] for r in rows]
    names = [n for n in names if n]
    def _warm():
        for n in names:
            try: normalized_upload(n)
            except Exception: pass
    import threading
    threading.Thread(target=_warm, daemon=True).start()
    return jsonify({'ok': True, 'count': len(names)})

@app.route('/app/uploads/<path:filename>')
def app_uploads(filename):
    if request.args.get('flat'):
        p = flatlay_upload(filename)
        if p:
            d, f = os.path.split(p)
            return send_from_directory(d, f)
    if request.args.get('norm'):
        p = normalized_upload(filename)
        if p:
            d, f = os.path.split(p)
            return send_from_directory(d, f)
    return send_from_directory(UPLOADS_DIR, filename)

@app.route('/app/<path:path>')
def app_static(path):
    return send_from_directory(os.path.join(BASE_DIR, 'app'), path)

@app.route('/dashboard')
@require_auth
def dashboard():
    return send_from_directory(os.path.join(BASE_DIR, 'admin'), 'dashboard.html')

@app.route('/')
def root():
    return prototype_response()

@app.route('/v2/<path:path>')
def static_v2(path):
    return send_from_directory(STATIC_DIR, path)

@app.route('/<path:path>')
def static_root(path):
    try: return send_from_directory(STATIC_DIR, path)
    except: abort(404)

if __name__ == '__main__':
    print(f'\n  LOOKBOX Analytics Server')
    print(f'  Landing:   http://localhost:8080')
    print(f'  Dashboard: http://localhost:8080/dashboard  (PW: {DASH_PW})')
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=False)
