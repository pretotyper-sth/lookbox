"""바로 보기 전신은 얼굴을 고정하고, 부위별 고해상도 마스크를 함께 만든다."""

import ast
import io
import unittest
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter


MAIN_PATH = Path(__file__).parents[1].joinpath("app/main.py")
FNS = ("_tryon_garment_mask", "_tryon_soft_hole", "_tryon_make_assets", "_tryon_assets_valid")
CONSTS = ("_TRYON_PLATE_RGB",)


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
        "ImageDraw": ImageDraw,
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
            px[x, y] = (52, 52, 55)
    for y in range(94, 156):
        for x in range(44, 76):
            px[x, y] = (64, 104, 150)
    for y in range(156, 166):
        for x in list(range(40, 58)) + list(range(62, 80)):
            px[x, y] = (249, 249, 247)
    out = io.BytesIO()
    im.save(out, format="PNG")
    return out.getvalue()


def body_with_nearby_dark_prop() -> bytes:
    im = Image.open(io.BytesIO(neutral_body())).convert("RGB")
    px = im.load()
    # 상의와 떨어졌지만 옛 포즈 다각형 안에 있는 어두운 소품.
    for y in range(58, 88):
        for x in range(8, 22):
            px[x, y] = (40, 40, 44)
    # 상의 한가운데의 작은 질감 구멍. 옷 전체는 뚫리되 바깥은 남긴다.
    for y in range(70, 72):
        for x in range(60, 62):
            px[x, y] = (242, 241, 238)
    out = io.BytesIO()
    im.save(out, format="PNG")
    return out.getvalue()


def body_with_light_collar_and_hem() -> bytes:
    im = Image.open(io.BytesIO(neutral_body())).convert("RGB")
    px = im.load()
    # 생성본이 흰 티·연청이 되어도 목라인·발목까지 뚫려야 한다.
    for y in range(50, 64):
        for x in range(42, 78):
            px[x, y] = (220, 220, 218)
    for y in range(130, 156):
        for x in range(44, 76):
            px[x, y] = (190, 196, 200)
    out = io.BytesIO()
    im.save(out, format="PNG")
    return out.getvalue()


def body_with_plate_like_white_clothes() -> bytes:
    im = Image.open(io.BytesIO(neutral_body())).convert("RGB")
    px = im.load()
    # 실제 생성본처럼 목·종아리가 판색에 붙어 가장자리 flood에 먹힌다.
    for y in range(50, 64):
        for x in range(42, 78):
            px[x, y] = (240, 239, 236)
    for y in range(130, 156):
        for x in range(44, 76):
            px[x, y] = (241, 240, 237)
    out = io.BytesIO()
    im.save(out, format="PNG")
    return out.getvalue()


class TryOnBodyTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.src = MAIN_PATH.read_text()

    def test_prompt_locks_face(self):
        start = self.src.index("_TRYON_BODY_PROMPT")
        prompt = self.src[start:start + 4800]
        self.assertIn("identity lock", prompt)
        self.assertIn("exact face", prompt)
        self.assertIn("#F2F1EE", prompt)
        self.assertIn("ONE continuous", prompt)
        self.assertIn("matte black short-sleeve", prompt)
        self.assertIn("mid-blue straight-leg denim", prompt)
        self.assertIn("white low-top sneakers", prompt)
        self.assertIn("6% empty", prompt)
        self.assertIn("SAME person", prompt)
        self.assertIn("8 head-heights", prompt)
        self.assertIn("passport-like", prompt)
        self.assertIn("Forbidden shirt colors", prompt)
        self.assertIn("three-quarter", prompt)

    def test_model_quality_cache_and_timeout_are_tryon_specific(self):
        self.assertIn('OPENAI_IMAGE_MODEL_TRYON = os.environ.get("OPENAI_IMAGE_MODEL_TRYON", "gpt-image-2")', self.src)
        self.assertIn('OPENAI_IMAGE_QUALITY_TRYON = os.environ.get("OPENAI_IMAGE_QUALITY_TRYON", "high")', self.src)
        start = self.src.index("def live_tryon_body")
        chunk = self.src[start:start + 4000]
        self.assertIn("tryon21-", chunk)
        self.assertIn("OPENAI_IMAGE_MODEL_TRYON", chunk)
        self.assertIn("OPENAI_IMAGE_QUALITY_TRYON", chunk)
        self.assertIn("OPENAI_IMAGE_TIMEOUT_TRYON", chunk)
        self.assertNotIn("_tryon_request_garment_masks", chunk)
        self.assertNotIn("input_fidelity", chunk)

    def test_mask_fail_retries_then_notes_daily_fail_not_monthly(self):
        start = self.src.index("def live_tryon_body")
        chunk = self.src[start:start + 7000]
        self.assertIn("mask quality weak — retry gen", chunk)
        self.assertIn('_TRYON_FAIL_MSG["mask"]', chunk)
        self.assertIn("note_fail", chunk)
        self.assertIn("ensure_within_daily_fail", chunk)
        self.assertNotIn("save body anyway", chunk)
        self.assertGreater(chunk.index("note_usage"), chunk.index("generated_images"))
        self.assertGreater(chunk.index("note_usage"), chunk.index("images.edit"))
        self.assertIn("_TRYON_BUSY", chunk)
        self.assertIn('"mask": "옷 경계를 정리하지 못했어요', self.src)


class TryOnAssetTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ns = load_assets()

    def test_charcoal_top_and_denim_bottom_are_disjoint_and_keep_skin_and_shoes(self):
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
        self.assertLess(overlap.histogram()[255], top.width * top.height * 0.01)
        self.assertTrue(any(0 < value < 255 for value in top_alpha.getdata()))
        self.assertTrue(self.ns["_tryon_assets_valid"](assets))

    def test_seed_grows_to_full_shirt_and_skips_prop(self):
        assets = self.ns["_tryon_make_assets"](body_with_nearby_dark_prop())
        top = Image.open(io.BytesIO(assets["top"])).convert("RGBA")
        self.assertLess(top.getpixel((60, 55))[3], 64)
        self.assertLess(top.getpixel((60, 70))[3], 64)
        self.assertLess(top.getpixel((70, 90))[3], 64)
        self.assertGreater(top.getpixel((15, 70))[3], 200)
        self.assertGreater(top.getpixel((35, 70))[3], 200)
        self.assertGreater(top.getpixel((50, 160))[3], 200)
        self.assertTrue(self.ns["_tryon_assets_valid"](assets))

    def test_top_hole_matches_shirt_not_nearby_dark_area(self):
        assets = self.ns["_tryon_make_assets"](body_with_nearby_dark_prop())
        top = Image.open(io.BytesIO(assets["top"])).convert("RGBA")
        self.assertLess(top.getpixel((60, 70))[3], 64)
        self.assertLess(top.getpixel((61, 71))[3], 64)
        self.assertGreater(top.getpixel((15, 70))[3], 200)
        self.assertGreater(top.getpixel((35, 70))[3], 200)
        self.assertGreater(top.getpixel((41, 70))[3], 160)
        self.assertTrue(self.ns["_tryon_assets_valid"](assets))

    def test_unsegmentable_light_clothes_fail_instead_of_inventing_holes(self):
        for fixture in (body_with_light_collar_and_hem, body_with_plate_like_white_clothes):
            with self.subTest(fixture=fixture.__name__):
                assets = self.ns["_tryon_make_assets"](fixture())
                self.assertFalse(self.ns["_tryon_assets_valid"](assets))
                top = Image.open(io.BytesIO(assets["top"]))
                self.assertEqual(top.getpixel((25, 65))[3], 255)
                self.assertEqual(top.getpixel((60, 40))[3], 255)

    def test_gradient_background_and_highlighted_skin_stay_completely_opaque(self):
        im = Image.open(io.BytesIO(neutral_body())).convert("RGB")
        expected = im.copy()
        px = im.load()
        for y in range(im.height):
            for x in range(im.width):
                if px[x, y] == (242, 241, 238):
                    px[x, y] = (230 + x % 20, 226 + x % 20, 220 + x % 20)
                elif px[x, y] == (198, 146, 119):
                    px[x, y] = ((246, 221, 205) if y % 3 else (82, 57, 43))
        out = io.BytesIO(); im.save(out, format="PNG")
        assets = self.ns["_tryon_make_assets"](out.getvalue())
        self.assertTrue(self.ns["_tryon_assets_valid"](assets))
        full = Image.open(io.BytesIO(assets["full"]))
        for y in range(im.height):
            for x in range(im.width):
                if expected.getpixel((x, y)) not in ((52, 52, 55), (64, 104, 150)):
                    self.assertEqual(full.getpixel((x, y))[3], 255, (x, y))

    def test_separate_trouser_legs_keep_the_gap(self):
        im = Image.open(io.BytesIO(neutral_body())).convert("RGB")
        ImageDraw.Draw(im).rectangle((58, 94, 61, 155), fill=(242, 241, 238))
        out = io.BytesIO(); im.save(out, format="PNG")
        assets = self.ns["_tryon_make_assets"](out.getvalue())
        bottom = Image.open(io.BytesIO(assets["bottom"]))
        for y in (110, 130, 150):
            self.assertLess(bottom.getpixel((50, y))[3], 64)
            self.assertLess(bottom.getpixel((70, y))[3], 64)
            self.assertEqual(bottom.getpixel((60, y))[3], 255)
        self.assertTrue(self.ns["_tryon_assets_valid"](assets))

    def test_full_resolution_curved_edges_match_independent_garment_shapes(self):
        w, h = 1024, 1536
        im = Image.new("RGB", (w, h), (237, 231, 223))
        top_truth = Image.new("L", (w, h))
        bottom_truth = Image.new("L", (w, h))
        top_draw = ImageDraw.Draw(top_truth)
        top_draw.polygon([(425, 330), (599, 330), (685, 380), (730, 560),
                          (655, 590), (635, 510), (645, 775), (379, 775),
                          (389, 510), (369, 590), (294, 560), (339, 380)], fill=255)
        top_draw.ellipse((453, 302, 571, 386), fill=0)
        pants_draw = ImageDraw.Draw(bottom_truth)
        pants_draw.polygon([(379, 776), (645, 776), (638, 1340), (534, 1340),
                            (515, 915), (509, 915), (490, 1340), (386, 1340)], fill=255)
        im.paste((35, 36, 40), mask=top_truth)
        im.paste((64, 104, 150), mask=bottom_truth)
        # A hand crossing the shirt is foreground skin, including bright highlights.
        hand = (405, 595, 439, 690)
        ImageDraw.Draw(im).ellipse(hand, fill=(246, 221, 205))
        top_draw.ellipse(hand, fill=0)
        out = io.BytesIO(); im.save(out, format="PNG")
        assets = self.ns["_tryon_make_assets"](out.getvalue())
        self.assertTrue(self.ns["_tryon_assets_valid"](assets))
        for kind, truth in (("top", top_truth), ("bottom", bottom_truth)):
            alpha = Image.open(io.BytesIO(assets[kind])).getchannel("A")
            predicted = alpha.point(lambda a: 255 if a < 128 else 0)
            intersection = ImageChops.multiply(predicted, truth).histogram()[255]
            union = ImageChops.lighter(predicted, truth).histogram()[255]
            self.assertGreater(intersection / union, 0.995)
            self.assertIsNone(ImageChops.subtract(ImageChops.invert(alpha), truth).getbbox())

    def test_quality_gate_rejects_polygon_spill(self):
        assets = self.ns["_tryon_make_assets"](neutral_body())
        im = Image.open(io.BytesIO(assets["top"]))
        im.putpixel((25, 65), (242, 241, 238, 0))
        out = io.BytesIO(); im.save(out, format="PNG"); assets["top"] = out.getvalue()
        self.assertFalse(self.ns["_tryon_assets_valid"](assets))

    def test_empty_plate_fails_quality_gate(self):
        out = io.BytesIO()
        Image.new("RGB", (120, 180), (242, 241, 238)).save(out, format="PNG")
        assets = self.ns["_tryon_make_assets"](out.getvalue())
        self.assertFalse(self.ns["_tryon_assets_valid"](assets))


if __name__ == "__main__":
    unittest.main()
