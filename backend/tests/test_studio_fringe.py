"""어두운 상품컷 누끼가 판색 JPEG 링잉을 흰 테두리로 남기지 않아야 한다."""

import ast
import io
import unittest
from collections import deque
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter


MAIN_PATH = Path(__file__).parents[1].joinpath("app/main.py")
FIXTURE = Path(__file__).parent.joinpath("fixtures/studio-dark-polo.png")
FNS = (
    "_border_bg_stats",
    "_estimate_plate",
    "_is_plate_fringe",
    "_fill_enclosed_bg",
    "_absorb_plate_fringe",
    "_repair_rim_colors",
    "_studio_cutout_from_image",
)
CONSTS = ("_RIM_DEPTH", "_FRINGE_MAX_STEPS")


def load():
    tree = ast.parse(MAIN_PATH.read_text())
    body = []
    for n in tree.body:
        if isinstance(n, ast.FunctionDef) and n.name in FNS:
            body.append(n)
        elif isinstance(n, ast.Assign) and getattr(n.targets[0], "id", "") in CONSTS:
            body.append(n)
        elif isinstance(n, ast.AnnAssign) and getattr(n.target, "id", "") in CONSTS:
            body.append(n)
    ns = {
        "Image": Image,
        "ImageChops": ImageChops,
        "ImageFilter": ImageFilter,
        "deque": deque,
        "io": io,
        "Any": object,
    }
    exec(compile(ast.Module(body=body, type_ignores=[]), "<studio>", "exec"), ns)
    return ns


def light_near_transparent(im: Image.Image, luma_cut: float = 140, reach: int = 4) -> int:
    """실루엣 근처(투명 픽셀 reach px 안)에 남은 밝은 불투명 픽셀 수."""
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    n = 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 128 or (r + g + b) / 3 <= luma_cut:
                continue
            hit = False
            for dy in range(-reach, reach + 1):
                for dx in range(-reach, reach + 1):
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < w and 0 <= yy < h and px[xx, yy][3] < 40:
                        hit = True
                        break
                if hit:
                    break
            if hit:
                n += 1
    return n


def dark_on_plate_with_ringing() -> Image.Image:
    """어두운 옷 + 밝은 판 + 블러 혼합대 + 소매 틈 + 흰 라벨."""
    plate = (229, 230, 225)
    fabric = (37, 38, 43)
    im = Image.new("RGB", (360, 440), plate)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([50, 36, 310, 404], 18, fill=fabric)
    d.ellipse([248, 130, 308, 210], fill=plate)  # 소매-몸판 사이 판
    mixed = Image.blend(im, im.filter(ImageFilter.GaussianBlur(1.8)), 0.9)
    d2 = ImageDraw.Draw(mixed)
    d2.rectangle([150, 52, 210, 76], fill=(252, 252, 250))
    return mixed.convert("RGBA")


class StudioFringeTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ns = load()

    def cut(self, img: Image.Image) -> Image.Image:
        raw = self.ns["_studio_cutout_from_image"](img)
        self.assertIsNotNone(raw)
        return Image.open(io.BytesIO(raw)).convert("RGBA")

    def test_synthetic_dark_garment_has_no_plate_halo(self):
        out = self.cut(dark_on_plate_with_ringing())
        self.assertEqual(light_near_transparent(out), 0)
        # 라벨은 남아야 한다
        w, h = out.size
        px = out.load()
        label = sum(
            1
            for y in range(h // 5)
            for x in range(w)
            if px[x, y][3] >= 200 and min(px[x, y][:3]) >= 230
        )
        self.assertGreater(label, 20)

    def test_light_garment_is_not_eaten(self):
        im = Image.new("RGB", (360, 440), (243, 243, 241))
        d = ImageDraw.Draw(im)
        d.rounded_rectangle([60, 40, 300, 400], 20, fill=(236, 235, 232))
        out = self.cut(im.convert("RGBA"))
        opaque = sum(1 for v in out.getchannel("A").tobytes() if v >= 128)
        self.assertGreater(opaque / (out.size[0] * out.size[1]), 0.45)

    def test_real_dark_polo_fixture_has_clean_silhouette(self):
        self.assertTrue(FIXTURE.exists(), "studio-dark-polo.png fixture missing")
        out = self.cut(Image.open(FIXTURE).convert("RGBA"))
        self.assertEqual(light_near_transparent(out), 0)
        # COS / SLIM 라벨
        px = out.load()
        w, h = out.size
        label = sum(
            1
            for y in range(h)
            for x in range(w)
            if px[x, y][3] >= 128 and (px[x, y][0] + px[x, y][1] + px[x, y][2]) / 3 > 200
        )
        self.assertGreater(label, 200)


if __name__ == "__main__":
    unittest.main()
