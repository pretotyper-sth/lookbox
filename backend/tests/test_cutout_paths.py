"""상품컷은 AI를 거치지 않고 배경만 지워야 한다 — 그 판정에 쓰이는 전처리 테스트.

쇼핑몰 상품컷을 저장하면 위아래에 검은 띠가 붙어 오는 경우가 많다. 그 띠 때문에
'테두리가 균일한 판인가' 판정이 실패해서, 배경만 지우면 되는 사진이 AI 재생성으로
넘어갔다(로고·글자가 있으면 글자가 바뀔 수 있어 손해가 크다). 띠는 걷어내되, 단색 판
위에 옷이 놓인 평범한 상품컷의 여백은 절대 건드리면 안 된다 — 그러면 테두리 판정이
옷에 걸려 오히려 스튜디오 경로를 잃는다.
"""

import ast
import unittest
from pathlib import Path

from PIL import Image, ImageDraw


MAIN_PATH = Path(__file__).parents[1].joinpath("app/main.py")
FNS = ("_line_stats", "_trim_letterbox", "_border_bg_stats")


def load():
    tree = ast.parse(MAIN_PATH.read_text())
    body = [n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in FNS]
    ns = {"Image": Image, "Any": object}
    exec(compile(ast.Module(body=body, type_ignores=[]), "<cutout>", "exec"), ns)
    return ns


def product_shot(letterbox=0, plate=(243, 243, 243), bar=(0, 0, 0)):
    """단색 판 위에 어두운 옷이 놓인 상품컷. letterbox>0이면 위아래에 띠를 붙인다."""
    im = Image.new("RGB", (600, 600), plate)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([150, 130, 450, 470], 30, fill=(30, 36, 70))
    if letterbox:
        out = Image.new("RGB", (600, 600 + letterbox * 2), bar)
        out.paste(im, (0, letterbox))
        im = out
    return im.convert("RGBA")


class TrimLetterboxTest(unittest.TestCase):
    def setUp(self):
        self.ns = load()

    def test_plain_product_shot_is_left_alone(self):
        img = product_shot()
        self.assertEqual(self.ns["_trim_letterbox"](img).size, img.size)
        self.assertTrue(self.ns["_border_bg_stats"](img)[0])

    def test_black_bars_break_the_plate_check_and_get_trimmed(self):
        img = product_shot(letterbox=80)
        self.assertFalse(self.ns["_border_bg_stats"](img)[0])   # 띠가 있으면 판이 아니라고 본다
        trimmed = self.ns["_trim_letterbox"](img)
        self.assertEqual(trimmed.size, (600, 600))              # 띠만 정확히 잘린다
        self.assertTrue(self.ns["_border_bg_stats"](trimmed)[0])  # 이제 스튜디오 컷 대상

    def test_white_bars_on_grey_plate_are_trimmed_too(self):
        img = product_shot(letterbox=60, plate=(226, 226, 228), bar=(255, 255, 255))
        self.assertEqual(self.ns["_trim_letterbox"](img).size, (600, 600))

    def test_busy_photo_is_not_trimmed(self):
        img = Image.new("RGB", (400, 400))
        d = ImageDraw.Draw(img)
        for y in range(0, 400, 4):
            d.rectangle([0, y, 400, y + 4], fill=(120 + y // 4, 90, 60))
        img = img.convert("RGBA")
        self.assertEqual(self.ns["_trim_letterbox"](img).size, img.size)
        self.assertFalse(self.ns["_border_bg_stats"](img)[0])
