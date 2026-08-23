"""URL 상품 페이지에서 상품컷을 고르는 판정.

차단 힌트의 'robot'이 robots 메타에 걸려 브랜드몰을 막았고,
og:image가 없으면 케어가이드 JPG를 집어 옷을 못 찾는 것처럼 보였다.
이 파일은 그 두 경계를 고정한다. 네트워크는 쓰지 않는다.
"""

import ast
import html as html_lib
import re
import unittest
from pathlib import Path
from urllib.parse import urljoin, urlparse


MAIN_PATH = Path(__file__).parents[1].joinpath("app/main.py")
FNS = (
    "_page_looks_blocked",
    "_abs_page_url",
    "_product_image_score",
    "_product_image_candidates",
    "_looks_like_image",
    "_meta_content",
)
CONSTS = (
    "_BLOCKED_PAGE_HINTS",
    "_PRODUCT_IMG_SKIP",
    "_URL_BLOCKED_MSG",
    "_URL_NO_IMAGE_MSG",
    "_URL_IMAGE_FAIL_MSG",
)


def load():
    tree = ast.parse(MAIN_PATH.read_text())
    body = [
        n for n in tree.body
        if (isinstance(n, ast.FunctionDef) and n.name in FNS)
        or (isinstance(n, ast.Assign) and getattr(n.targets[0], "id", "") in CONSTS)
        or (isinstance(n, ast.AnnAssign) and getattr(n.target, "id", "") in CONSTS)
    ]
    ns = {"re": re, "html_lib": html_lib, "urljoin": urljoin, "urlparse": urlparse}
    exec(compile(ast.Module(body=body, type_ignores=[]), "<url_import>", "exec"), ns)
    return ns


class UrlImportPickTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ns = load()

    def test_robots_meta_is_not_a_block(self):
        html = '<head><meta name="robots" content="index,follow"></head><body>상품</body>'
        self.assertFalse(self.ns["_page_looks_blocked"](200, html))

    def test_real_bot_wall_is_a_block(self):
        html = "<html><body>Are you a robot? Complete recaptcha.</body></html>"
        self.assertTrue(self.ns["_page_looks_blocked"](200, html))

    def test_skips_careguide_and_prefers_cafe24_big(self):
        html = """
        <meta property="og:image" content="https://www.ptry.co.kr/web/product/big/202608/a.jpg" />
        <img src="https://ptry.co.kr/online/careguide/drycle.jpg" />
        <img src="/web/product/tiny/202608/b.jpg" />
        """
        urls = self.ns["_product_image_candidates"](html, "https://www.ptry.co.kr/product/detail.html")
        self.assertTrue(urls)
        self.assertIn("/web/product/big/", urls[0])
        self.assertFalse(any("careguide" in u for u in urls))

    def test_reverse_og_image_attribute_order(self):
        html = '<meta content="https://shop.test/a.jpg" property="og:image">'
        urls = self.ns["_product_image_candidates"](html, "https://shop.test/item")
        self.assertEqual(urls[0], "https://shop.test/a.jpg")

    def test_jpeg_magic_is_an_image(self):
        raw = b"\xff\xd8\xff" + b"\x00" * 2000
        self.assertTrue(self.ns["_looks_like_image"](raw, "image/jpeg"))
        self.assertFalse(self.ns["_looks_like_image"](b"<html>nope</html>", "text/html"))
