"""세로로 이어 붙인 상품 상세컷에서 정면 전신 한 장만 고른다."""

import ast
import unittest
from pathlib import Path

from PIL import Image, ImageDraw


MAIN_PATH = Path(__file__).parents[1].joinpath("app/main.py")


def load():
    tree = ast.parse(MAIN_PATH.read_text())
    body = [n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "_pick_hero_panel"]
    ns = {"Image": Image}
    exec(compile(ast.Module(body=body, type_ignores=[]), "<hero>", "exec"), ns)
    return ns["_pick_hero_panel"]


def tee_panel(graphic: bool, closeup: bool = False, size: int = 200) -> Image.Image:
    im = Image.new("RGB", (size, size), (248, 248, 247))
    d = ImageDraw.Draw(im)
    if closeup:
        d.rectangle([0, 0, size - 1, size - 1], fill=(176, 176, 180))
        d.ellipse([size // 5, size // 4, size - size // 5, size - size // 6], fill=(22, 32, 78))
        return im
    d.polygon(
        [
            (size * 0.28, size * 0.18),
            (size * 0.72, size * 0.18),
            (size * 0.82, size * 0.32),
            (size * 0.74, size * 0.86),
            (size * 0.26, size * 0.86),
            (size * 0.18, size * 0.32),
        ],
        fill=(168, 170, 174),
    )
    if graphic:
        d.ellipse([size * 0.38, size * 0.36, size * 0.62, size * 0.58], fill=(24, 36, 90))
        d.rectangle([size * 0.34, size * 0.48, size * 0.66, size * 0.54], fill=(24, 36, 90))
    return im


def stack(*panels: Image.Image, gap: int = 12) -> Image.Image:
    w = panels[0].width
    h = sum(p.height for p in panels) + gap * (len(panels) + 1)
    canvas = Image.new("RGB", (w, h), (255, 255, 255))
    y = gap
    for p in panels:
        canvas.paste(p, (0, y))
        y += p.height + gap
    return canvas


class HeroPanelTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fn = staticmethod(load())

    def test_single_product_shot_is_left_alone(self):
        im = tee_panel(graphic=True)
        out = self.fn(im)
        self.assertEqual(out.size, im.size)

    def test_picks_front_full_tee_from_stack(self):
        front = tee_panel(graphic=True)
        back = tee_panel(graphic=False)
        detail = tee_panel(graphic=True, closeup=True)
        im = stack(front, back, detail)
        out = self.fn(im)
        self.assertLess(out.height, im.height * 0.45)
        self.assertGreater(out.height, 160)
        # 정면 가슴 그래픽이 살아 있어야 한다 (네이비 원).
        px = out.load()
        navy = 0
        for y in range(out.height):
            for x in range(out.width):
                r, g, b = px[x, y]
                if b > 70 and b > r + 30 and b > g + 20:
                    navy += 1
        self.assertGreater(navy, 80)

    def test_tall_photo_without_gutters_is_left_alone(self):
        im = Image.new("RGB", (120, 400), (40, 50, 60))
        d = ImageDraw.Draw(im)
        for y in range(0, 400, 8):
            d.rectangle([10, y, 110, y + 6], fill=(40 + y // 8, 80, 90))
        out = self.fn(im)
        self.assertEqual(out.size, im.size)

if __name__ == "__main__":
    unittest.main()
