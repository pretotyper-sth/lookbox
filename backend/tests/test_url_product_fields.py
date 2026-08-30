"""URL 상품 페이지에서 가격·재질을 브랜드처럼 읽어 오는지.

네트워크 없이 HTML 픽스처만 본다. JSON-LD, 메타, 카페24 표가 경계다.
"""

import ast
import html as html_lib
import json
import re
import unittest
from pathlib import Path


MAIN_PATH = Path(__file__).parents[1].joinpath("app/main.py")
FNS = (
    "_meta_content",
    "_jsonld_nodes",
    "_plain_html",
    "_format_krw",
    "_price_from_offers",
    "_spec_cell",
    "_extract_price",
    "_clean_material",
    "_as_prop_list",
    "_html_as_search_text",
    "_material_from_body",
    "_extract_material",
)


def load():
    tree = ast.parse(MAIN_PATH.read_text())
    body = [
        n for n in tree.body
        if isinstance(n, ast.FunctionDef) and n.name in FNS
    ]
    ns = {"re": re, "html_lib": html_lib, "json": json}
    exec(compile(ast.Module(body=body, type_ignores=[]), "<url_fields>", "exec"), ns)
    return ns


JSONLD = """
<script type="application/ld+json">
{
  "@type": "Product",
  "brand": {"name": "코스"},
  "offers": {"@type": "Offer", "price": "89000", "priceCurrency": "KRW"},
  "material": "코튼 100%",
  "additionalProperty": [
    {"@type": "PropertyValue", "name": "소재", "value": "겉감 코튼 100%"}
  ]
}
</script>
"""

CAFE24 = """
<meta property="product:price:amount" content="59000" />
<strong id="span_product_price_text">59,000원</strong>
<table>
  <tr><th scope="row">판매가</th><td><strike>89,000원</strike> <strong>59,000원</strong></td></tr>
  <tr><th scope="row">소재</th><td>면 60% / 린넨 40%</td></tr>
</table>
"""


class UrlProductFieldsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ns = load()

    def test_jsonld_price_and_material(self):
        self.assertEqual(self.ns["_extract_price"](JSONLD), "89,000")
        self.assertEqual(self.ns["_extract_material"](JSONLD), "코튼 100%")

    def test_cafe24_sale_price_and_fabric_row(self):
        self.assertEqual(self.ns["_extract_price"](CAFE24), "59,000")
        self.assertEqual(self.ns["_extract_material"](CAFE24), "면 60% / 린넨 40%")

    def test_sale_cell_uses_last_amount(self):
        html = "<table><tr><th>판매가</th><td><strike>89,000원</strike> 59,000원</td></tr></table>"
        self.assertEqual(self.ns["_extract_price"](html), "59,000")

    def test_additional_property_when_material_missing(self):
        html = """
        <script type="application/ld+json">
        {"@type":"Product","additionalProperty":{"name":"재질","value":"울 80% 나일론 20%"}}
        </script>
        """
        self.assertEqual(self.ns["_extract_material"](html), "울 80% 나일론 20%")

    def test_skips_zero_and_shipping_like_amounts(self):
        html = '<meta property="product:price:amount" content="0">'
        self.assertEqual(self.ns["_extract_price"](html), "")
        self.assertEqual(self.ns["_format_krw"]("50"), "")
        self.assertEqual(self.ns["_format_krw"](89000), "89,000")

    def test_hidden_detail_popup_outshell(self):
        # '+ 상품 상세 정보 보기' 팝업이 display:none으로 HTML에 이미 있을 때
        html = """
        <h1>원워시드 스트레이트 데님</h1>
        <p>Cotton High Density Denim Cloth Washer Finish</p>
        <div class="modal" style="display:none">
          <h2>상품 상세 정보 보기</h2>
          <p>Outshell: Cotton 100%</p>
        </div>
        """
        self.assertEqual(self.ns["_extract_material"](html), "Cotton 100%")

    def test_inline_composition_list(self):
        html = "<ul><li>소재 : 면 60% / 린넨 40%</li><li>색상 : 인디고</li></ul>"
        self.assertEqual(self.ns["_extract_material"](html), "면 60% / 린넨 40%")

    def test_spa_script_payload_has_composition(self):
        html = r"""
        <script>
        window.__DETAIL__ = {"tabs":[{"title":"상세 정보","body":"Outshell: Cotton 100%\n정밀한 직조"}]};
        </script>
        """
        self.assertEqual(self.ns["_extract_material"](html), "Cotton 100%")

    def test_marketing_cotton_line_without_percent_is_ignored(self):
        html = "<p>Cotton High Density Denim Cloth Washer Finish</p>"
        self.assertEqual(self.ns["_extract_material"](html), "")
