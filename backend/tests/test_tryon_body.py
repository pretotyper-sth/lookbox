"""바로 보기 전신은 얼굴을 고정하고, 부위별 고해상도 마스크를 함께 만든다."""

import ast
import io
import unittest
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter


MAIN_PATH = Path(__file__).parents[1].joinpath("app/main.py")
FNS = (
    "_tryon_border_background",
    "_tryon_seed_component",
    "_tryon_soft_hole",
    "_tryon_make_assets",
    "_tryon_assets_valid",
)
CONSTS = (
    "_TRYON_PLATE_RGB",
    "_TRYON_TOP_SEED",
    "_TRYON_BOTTOM_SEED",
)


def load_assets():
    tree = ast.parse(MAIN_PATH.read_text())
    body = [
        node for node in tree.body
        if (isinstance(node, ast.FunctionDef) and node.name in FNS)
        or (
            isinstance(node, (ast.Assign, ast.AnnAssign))
            and getattr(getattr(node, "target", None) or node.targets[0], "id", "") in CONSTS
        )
    ]
    ns = {
        "Image": Image,
        "ImageChops": ImageChops,
        "ImageFilter": ImageFilter,
        "io": io,
        "deque": __import__("collections").deque,
        "Any": object,
    }
    exec(compile(ast.Module(body=body, type_ignores=[]), "<tryon-assets>", "exec"), ns)
    return ns


def neutral_body() -> bytes:
    im = Image.new("RGB", (120, 180), (242, 241, 238))
    px = im.load()
    for y in range(20, 48):
        for x in range(50, 70):
            px[x, y] = (197, 145, 118)
    for y in range(54, 100):
        for x in list(range(31, 42)) + list(range(78, 89)):
            px[x, y] = (198, 146, 119)
    for y in range(50, 96):
        for x in range(42, 78):
            px[x, y] = (250, 250, 248)
    for y in range(94, 156):
        for x in range(44, 76):
            px[x, y] = (64, 104, 150)
    for y in range(156, 166):
        for x in list(range(40, 58)) + list(range(62, 80)):
            px[x, y] = (249, 249, 247)
    out = io.BytesIO()
    im.save(out, format="PNG")
    return out.getvalue()


class TryOnBodyTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.src = MAIN_PATH.read_text()

    def test_prompt_locks_face(self):
        start = self.src.index("_TRYON_BODY_PROMPT")
        prompt = self.src[start:start + 1200]
        self.assertIn("identity lock", prompt)
        self.assertIn("exact face", prompt)
        self.assertIn("#F2F1EE", prompt)
        self.assertIn("ONE continuous", prompt)
        self.assertIn("plain white short-sleeve", prompt)
        self.assertIn("mid-blue straight-leg denim", prompt)
        self.assertIn("white low-top sneakers", prompt)
        self.assertIn("8% empty", prompt)

    def test_model_quality_cache_and_timeout_are_tryon_specific(self):
        self.assertIn('OPENAI_IMAGE_MODEL_TRYON = os.environ.get("OPENAI_IMAGE_MODEL_TRYON", "gpt-image-2")', self.src)
        self.assertIn('OPENAI_IMAGE_QUALITY_TRYON = os.environ.get("OPENAI_IMAGE_QUALITY_TRYON", "high")', self.src)
        start = self.src.index("def live_tryon_body")
        chunk = self.src[start:start + 4000]
        self.assertIn("tryon4-", chunk)
        self.assertIn("OPENAI_IMAGE_MODEL_TRYON", chunk)
        self.assertIn("OPENAI_IMAGE_QUALITY_TRYON", chunk)
        self.assertIn("OPENAI_IMAGE_TIMEOUT_TRYON", chunk)
        self.assertNotIn("input_fidelity", chunk)


class TryOnAssetTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ns = load_assets()

    def test_white_top_and_denim_bottom_are_disjoint_and_keep_skin_and_shoes(self):
        assets = self.ns["_tryon_make_assets"](neutral_body())
        top = Image.open(io.BytesIO(assets["top"])).convert("RGBA")
        bottom = Image.open(io.BytesIO(assets["bottom"])).convert("RGBA")
        full = Image.open(io.BytesIO(assets["full"])).convert("RGBA")

        self.assertLess(top.getpixel((60, 70))[3], 64)
        self.assertGreater(top.getpixel((35, 70))[3], 200)
        self.assertGreater(top.getpixel((60, 120))[3], 200)
        self.assertLess(bottom.getpixel((60, 120))[3], 64)
        self.assertGreater(bottom.getpixel((50, 160))[3], 200)
        self.assertLess(full.getpixel((60, 70))[3], 64)
        self.assertLess(full.getpixel((60, 120))[3], 64)
        self.assertGreater(full.getpixel((50, 160))[3], 200)

        top_alpha = top.getchannel("A")
        bottom_alpha = bottom.getchannel("A")
        overlap = ImageChops.multiply(
            top_alpha.point(lambda a: 255 if a < 128 else 0),
            bottom_alpha.point(lambda a: 255 if a < 128 else 0),
        )
        self.assertIsNone(overlap.getbbox())
        self.assertTrue(any(0 < value < 255 for value in top_alpha.getdata()))
        self.assertTrue(self.ns["_tryon_assets_valid"](assets))

    def test_empty_plate_fails_quality_gate(self):
        out = io.BytesIO()
        Image.new("RGB", (120, 180), (242, 241, 238)).save(out, format="PNG")
        assets = self.ns["_tryon_make_assets"](out.getvalue())
        self.assertFalse(self.ns["_tryon_assets_valid"](assets))


if __name__ == "__main__":
    unittest.main()
