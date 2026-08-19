"""중복 감지 — 구매내역을 일괄로 담을 때 이미 있는 옷을 또 담지 않게 하는 판정.

주소만 비교하면 같은 상품을 다른 경로(모바일 도메인·다른 몰)로 담은 경우를 놓치고,
사진만 비교하면 '흰 배경 + 어두운 옷'끼리 겹친다. 그래서 주소·상품코드·이름·사진 지문을
함께 본다. 이 파일은 그 판정의 경계를 고정한다. AI는 쓰지 않는다.
"""

import ast
import html as html_lib
import io
import re
import unittest
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw


MAIN_PATH = Path(__file__).parents[1].joinpath("app/main.py")
FNS = (
    "_norm_color_token", "_is_color_tail", "_split_color_from_title",
    "_product_code", "_url_key", "_name_tokens", "_name_similarity",
    "_content_crop", "_image_fingerprint", "_hamming", "_color_distance",
    "_fp_usable", "_fp_match", "_match_duplicate",
)
CONSTS = (
    "COLOR_WORDS", "NON_COLOR_TAILS", "_COLOR_CANONICAL_RAW", "_COLOR_CANONICAL", "_COLOR_NORM", "_DUP_STOPWORDS",
    "_SIZE_TOKEN", "_FP_VERSION", "_FP_GRID", "_FP_COLOR", "_DUP_REASON_KO",
)


def load():
    tree = ast.parse(MAIN_PATH.read_text())
    body = [
        n for n in tree.body
        if (isinstance(n, ast.FunctionDef) and n.name in FNS)
        or (isinstance(n, ast.Assign) and getattr(n.targets[0], "id", "") in CONSTS)
        or (isinstance(n, ast.AnnAssign) and getattr(n.target, "id", "") in CONSTS)
    ]
    ns = {
        "Any": object, "Image": Image, "ImageChops": ImageChops, "io": io, "re": re,
        "html_lib": html_lib,
        "urlparse": __import__("urllib.parse", fromlist=["urlparse"]).urlparse,
        "parse_qs": __import__("urllib.parse", fromlist=["parse_qs"]).parse_qs,
    }
    exec(compile(ast.Module(body=body, type_ignores=[]), "<dupe>", "exec"), ns)
    return ns


def garment_shot(color=(40, 44, 78), kind="top", size=1000, bg=(243, 243, 243)):
    """흰 배경 상품컷 흉내. 실제 사진처럼 배경이 대부분이라 지문이 겹치기 쉬운 조건."""
    im = Image.new("RGB", (size, size), bg)
    d = ImageDraw.Draw(im)
    if kind == "top":
        d.polygon([(300, 250), (430, 210), (570, 210), (700, 250), (670, 380), (620, 350),
                   (620, 780), (380, 780), (380, 350), (330, 380)], fill=color)
    else:
        d.polygon([(360, 230), (640, 230), (660, 800), (540, 800), (500, 520), (460, 800), (340, 800)], fill=color)
    return im


def as_bytes(im, fmt="PNG", **kw):
    buf = io.BytesIO()
    im.save(buf, format=fmt, **kw)
    return buf.getvalue()


class KeysTest(unittest.TestCase):
    def setUp(self):
        self.ns = load()

    def test_same_product_different_paths_share_a_key(self):
        key = self.ns["_url_key"]
        a = key("https://m.musinsa.com/app/goods/3312991?utm_source=ad")
        b = key("https://www.musinsa.com/app/goods/3312991/")
        self.assertEqual(a, b)
        self.assertNotEqual(a, key("https://www.musinsa.com/app/goods/9999999"))

    def test_product_code_survives_a_different_host(self):
        code = self.ns["_product_code"]
        self.assertEqual(code("https://x.co/p?goodsNo=3312991"), "goodsno:3312991")
        self.assertEqual(code("https://y.co/goods/3312991"), "path:3312991")
        self.assertEqual(code("https://y.co/goods/shirt-blue"), "")

    def test_name_tokens_ignore_noise(self):
        tokens = self.ns["_name_tokens"]
        self.assertEqual(
            tokens("[유니섹스] 수피마 코튼 컴포트 셔츠_삭스"),
            tokens("수피마 코튼 컴포트 셔츠 (SAX)"),
        )
        sim = self.ns["_name_similarity"]
        self.assertEqual(sim(tokens("원워시드 와이드 데님"), tokens("원워시드 와이드 데님_블루")), 1.0)
        self.assertLess(sim(tokens("나이키 에어포스 1 로우"), tokens("아디다스 삼바 OG")), 0.2)


class FingerprintTest(unittest.TestCase):
    def setUp(self):
        self.ns = load()
        self.fp = self.ns["_image_fingerprint"]

    def test_resized_and_recompressed_photo_still_matches(self):
        original = garment_shot()
        small = original.resize((640, 640), Image.LANCZOS)
        a = self.fp(as_bytes(original))
        b = self.fp(as_bytes(small, "JPEG", quality=70))
        self.assertEqual(self.ns["_fp_match"](a, b), "same")

    def test_same_shape_other_colour_is_not_the_same_photo(self):
        navy = self.fp(as_bytes(garment_shot((36, 44, 78))))
        white = self.fp(as_bytes(garment_shot((238, 238, 236))))
        self.assertNotEqual(self.ns["_fp_match"](navy, white), "same")

    def test_dark_top_and_dark_bottom_are_not_confused(self):
        top = self.fp(as_bytes(garment_shot((40, 40, 44), "top")))
        bottom = self.fp(as_bytes(garment_shot((38, 44, 74), "bottom")))
        self.assertNotEqual(self.ns["_fp_match"](top, bottom), "same")

    def test_old_fingerprints_are_ignored(self):
        self.assertFalse(self.ns["_fp_usable"]({"d": 1, "c": [0, 0, 0]}))   # 버전 없음
        self.assertFalse(self.ns["_fp_usable"](None))


class MatchTest(unittest.TestCase):
    def setUp(self):
        self.ns = load()
        self.fp = self.ns["_image_fingerprint"]

    def index(self, **over):
        row = {
            "id": "item-1", "name": "원워시드 와이드 데님_인디고",
            "tokens": self.ns["_name_tokens"]("원워시드 와이드 데님_인디고"),
            "color": self.ns["_norm_color_token"]("인디고"),
            "brand": "테스트브랜드", "store": "무신사",
            "url_key": self.ns["_url_key"]("https://www.musinsa.com/app/goods/111222"),
            "code": self.ns["_product_code"]("https://www.musinsa.com/app/goods/111222"),
            "fp": self.fp(as_bytes(garment_shot((38, 44, 74), "bottom"))),
        }
        row.update(over)
        return [row]

    def match(self, index, **kw):
        return self.ns["_match_duplicate"](index, **kw)

    def test_same_url_is_a_duplicate(self):
        hit = self.match(self.index(), url="https://m.musinsa.com/app/goods/111222?ref=x", name="와이드 데님")
        self.assertEqual(hit[1], "same_url")

    def test_same_code_on_another_host_is_a_duplicate(self):
        hit = self.match(self.index(), url="https://other.shop/goods/111222", name="와이드 데님 팬츠")
        self.assertEqual(hit[1], "same_code")

    def test_same_photo_from_another_mall_is_a_duplicate(self):
        hit = self.match(
            self.index(),
            url="https://another.shop/p/xyz",
            name="원워시드 와이드 데님 (인디고)",
            fp=self.fp(as_bytes(garment_shot((38, 44, 74), "bottom").resize((700, 700)), "JPEG", quality=75)),
        )
        self.assertEqual(hit[1], "same_photo")

    def test_same_name_other_colour_is_not_a_duplicate(self):
        # 같은 옷의 다른 색을 일부러 둘 다 담아 둔 사람이 있다. 이름만 같은 건 중복이 아니다.
        hit = self.match(self.index(), url="https://another.shop/p/zzz", name="원워시드 와이드 데님_블랙")
        self.assertIsNone(hit)

    def test_same_name_same_colour_is_a_duplicate(self):
        hit = self.match(self.index(), url="https://another.shop/p/zzz", name="원워시드 와이드 데님_인디고")
        self.assertEqual(hit[1], "same_name")

    def test_unrelated_item_is_clean(self):
        hit = self.match(self.index(), url="https://another.shop/p/aaa", name="아미스 레드 캡")
        self.assertIsNone(hit)

    def test_every_reason_has_korean_copy(self):
        for code in ("same_url", "same_code", "same_photo", "same_photo_name", "same_name", "same_name_brand"):
            self.assertIn(code, self.ns["_DUP_REASON_KO"])
