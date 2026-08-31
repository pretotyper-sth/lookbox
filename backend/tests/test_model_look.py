"""AI 착장은 canonical 인물 + 옷장 실물. 배경은 옷장·코디와 같은 #E5E3DE 판."""

import ast
import io
import unittest
from collections import deque
from pathlib import Path

from PIL import Image


MAIN_PATH = Path(__file__).parents[1].joinpath("app/main.py")
FNS = (
    '_look_gender_key',
    '_category_display',
    '_category_key',
    '_model_look_subject',
    '_model_identity_prompt',
    '_model_look_prompt',
    '_garment_desc',
    '_model_look_garment_lines',
    '_model_look_outfit_block',
    '_flatten_look_plate',
    '_look_is_plate_pixel',
    '_look_content_box',
    '_fit_look_to_card',
    '_crop_look_to_card',
    '_bottom_hem_note',
)
CONSTS = (
    '_LOOK_PLATE_HEX', '_LOOK_PLATE_RGB', 'CATEGORY_KO', 'CATEGORY_EN',
    '_LEGACY_CATEGORY_KO', '_LOOK_SLOT_LABEL', '_LOOK_SLOT_ORDER', '_LOOK_CARD_RATIO',
    '_LOOK_CROP_PAD',
)


def load():
    tree = ast.parse(MAIN_PATH.read_text())
    body = [
        n for n in tree.body
        if (isinstance(n, ast.FunctionDef) and n.name in FNS)
        or (isinstance(n, ast.Assign) and getattr(n.targets[0], "id", "") in CONSTS)
        or (isinstance(n, ast.AnnAssign) and getattr(n.target, "id", "") in CONSTS)
    ]
    ns = {"Image": Image, "io": io, "deque": deque, "Any": object}
    exec(compile(ast.Module(body=body, type_ignores=[]), "<model-look>", "exec"), ns)
    return ns


def _wrong_plate() -> tuple[int, int, int]:
    return (210, 207, 202)


def two_tone_look() -> bytes:
    """인물 주변만 다른 톤, 양옆은 AI가 깔아 둔 잘못된 판색."""
    wrong = _wrong_plate()
    plate = (229, 227, 222)
    navy = (28, 42, 72)
    im = Image.new("RGB", (80, 120), wrong)
    px = im.load()
    for y in range(120):
        for x in range(22, 58):
            px[x, y] = plate
    for y in range(28, 100):
        for x in range(30, 50):
            px[x, y] = navy
    buf = io.BytesIO()
    im.save(buf, format="PNG")
    return buf.getvalue()


def interior_plate_patch() -> bytes:
    """테두리와 끊긴 밝은 판 조각 — 인물 옆 왼쪽 아래 아티팩트."""
    wrong = _wrong_plate()
    plate = (229, 227, 222)
    navy = (28, 42, 72)
    im = Image.new("RGB", (80, 120), wrong)
    px = im.load()
    for y in range(120):
        for x in range(22, 58):
            px[x, y] = plate
    for y in range(28, 100):
        for x in range(30, 50):
            px[x, y] = navy
    for y in range(72, 96):
        for x in range(8, 20):
            px[x, y] = plate
    buf = io.BytesIO()
    im.save(buf, format="PNG")
    return buf.getvalue()


def island_behind_ring() -> bytes:
    """어두운 링으로 테두리와 끊긴 판 섬 — 격자 잔상."""
    wrong = _wrong_plate()
    plate = (229, 227, 222)
    navy = (28, 42, 72)
    dark = (40, 40, 38)
    im = Image.new("RGB", (80, 120), wrong)
    px = im.load()
    for y in range(120):
        for x in range(22, 58):
            px[x, y] = plate
    for y in range(28, 100):
        for x in range(30, 50):
            px[x, y] = navy
    for y in range(70, 98):
        for x in range(6, 22):
            px[x, y] = dark
    for y in range(74, 94):
        for x in range(10, 18):
            px[x, y] = plate
    buf = io.BytesIO()
    im.save(buf, format="PNG")
    return buf.getvalue()


class ModelLookPromptTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ns = load()

    def test_prompt_is_catalog_model_not_selfie(self):
        prompt = self.ns['_model_look_prompt']("남성")
        self.assertIn(self.ns['_LOOK_PLATE_HEX'], prompt)
        self.assertIn("identity lock", prompt)
        self.assertIn("15% of the frame empty", prompt)
        self.assertIn("Do not use the user's face", prompt)
        self.assertNotIn("순하", prompt)
        self.assertNotIn("키 크고", prompt)
        self.assertEqual(self.ns['_LOOK_PLATE_HEX'], "#E5E3DE")
        self.assertEqual(self.ns['_LOOK_PLATE_RGB'], (229, 227, 222))

    def test_look_prompt_single_image_swap(self):
        src = MAIN_PATH.read_text()
        self.assertIn("outfit replacement task", src)
        self.assertIn("Image 1 defines the character identity", src)
        self.assertIn("Do not mix these roles", src)
        self.assertIn("model-id-v9-", src)
        self.assertIn("model-id12-", src)
        self.assertIn("look-identity", src)
        self.assertIn("01-canonical.png", src)
        self.assertIn("긴 기장", src)
        self.assertIn("Do not lengthen the legs", src)
        self.assertIn("7.5 heads", src)
        self.assertIn("15% of the frame empty", src)
        self.assertIn("middle 70%", src)
        self.assertIn("youthful early-to-mid-20s", src)
        self.assertIn("MUST wear this suggested item", src)
        self.assertNotIn("다리가 길어 보이게", src)
        self.assertIn("OPENAI_IMAGE_MODEL_LOOK", src)
        self.assertIn('_png_named(identity, "01-canonical.png")', src)
        self.assertNotIn("인상은 순하고 부드럽게", src)
        self.assertNotIn("키 크고 비율 좋은 카탈로그", src)

    def test_bottom_hem_prefers_long_inseam(self):
        note = self.ns['_bottom_hem_note']([
            {"category": "bottom", "name": "슬랙스"},
            {"category": "shoes", "name": "로퍼"},
        ], "abc")
        self.assertIn("긴 기장", note)
        self.assertNotIn("다리가 길어", note)
        short = self.ns['_bottom_hem_note']([{"category": "bottom", "name": "데님 반바지"}], "x")
        self.assertIn("반바지", short)

    def test_garment_lines_from_items(self):
        lines = self.ns['_model_look_garment_lines']([
            {"category": "top", "name": "그레이 티", "color": "그레이"},
            {"category": "bottom", "name": "데님", "color": "블루"},
        ])
        self.assertIn("그레이", lines)
        self.assertIn("데님", lines)

    def test_garment_lines_include_style(self):
        lines = self.ns['_model_look_garment_lines']([
            {
                "category": "top", "name": "옥스퍼드", "color": "화이트",
                "metadata": {"style": {"subtype": "셔츠", "material": "cotton", "fit": "regular"}},
            },
        ])
        self.assertIn("셔츠", lines)
        self.assertIn("cotton", lines)

    def test_outfit_block_groups_slots(self):
        block = self.ns['_model_look_outfit_block']([
            {"category": "top", "name": "그레이 티", "color": "그레이"},
            {"category": "bottom", "name": "데님", "color": "블루"},
            {"category": "shoes", "name": "로퍼", "color": "블랙"},
        ])
        self.assertIn("TOP:", block)
        self.assertIn("BOTTOM:", block)
        self.assertIn("SHOES:", block)
        self.assertIn("그레이 티", block)
        self.assertIn("로퍼", block)

    def test_mood_identity_files_exist(self):
        root = Path(__file__).parents[1] / "assets" / "look-identity"
        self.assertTrue((root / "m.jpg").is_file(), "male mood identity")
        self.assertTrue((root / "f.jpg").is_file(), "female mood identity")

    def test_gender_only_changes_the_model(self):
        man = self.ns['_model_look_subject']("남성")
        woman = self.ns['_model_look_subject']("여성")
        self.assertIn("남성", man)
        self.assertIn("여성", woman)
        self.assertNotEqual(man, woman)
        self.assertEqual(self.ns['_look_gender_key']("남성"), "m")
        self.assertEqual(self.ns['_look_gender_key']("여성"), "f")

    def test_flatten_unifies_two_plate_tones(self):
        out = self.ns['_flatten_look_plate'](two_tone_look())
        img = Image.open(io.BytesIO(out)).convert("RGB")
        plate = self.ns['_LOOK_PLATE_RGB']
        self.assertEqual(img.getpixel((2, 2)), plate)
        self.assertEqual(img.getpixel((40, 8)), plate)
        self.assertEqual(img.getpixel((24, 60)), plate)
        r, g, b = img.getpixel((40, 60))
        self.assertLess(r + g + b, 180)

    def test_flatten_fills_interior_plate_patch(self):
        out = self.ns['_flatten_look_plate'](interior_plate_patch())
        img = Image.open(io.BytesIO(out)).convert("RGB")
        plate = self.ns['_LOOK_PLATE_RGB']
        self.assertEqual(img.getpixel((12, 84)), plate)

    def test_crop_look_keeps_person_inside_card(self):
        plate = self.ns['_LOOK_PLATE_RGB']
        navy = (28, 42, 72)
        im = Image.new("RGB", (40, 60), plate)
        px = im.load()
        for y in range(16, 44):
            for x in range(12, 28):
                px[x, y] = navy
        buf = io.BytesIO()
        im.save(buf, format="PNG")
        out = self.ns['_crop_look_to_card'](buf.getvalue())
        cropped = Image.open(io.BytesIO(out)).convert("RGB")
        w, h = cropped.size
        self.assertEqual(w, 40)
        self.assertLess(h, 60)
        self.assertAlmostEqual(w / h, self.ns['_LOOK_CARD_RATIO'], places=2)
        navy_rows = [
            y for y in range(h)
            if any(cropped.getpixel((x, y))[:3] == navy for x in range(w))
        ]
        self.assertTrue(navy_rows)
        self.assertGreater(navy_rows[0], 2)
        self.assertLess(navy_rows[-1], h - 3)

    def test_crop_look_fits_instead_of_cutting_tall_person(self):
        plate = self.ns['_LOOK_PLATE_RGB']
        navy = (28, 42, 72)
        im = Image.new("RGB", (40, 60), plate)
        px = im.load()
        for y in range(1, 59):
            for x in range(14, 26):
                px[x, y] = navy
        buf = io.BytesIO()
        im.save(buf, format="PNG")
        out = self.ns['_crop_look_to_card'](buf.getvalue())
        fitted = Image.open(io.BytesIO(out)).convert("RGB")
        w, h = fitted.size
        self.assertAlmostEqual(w / h, self.ns['_LOOK_CARD_RATIO'], places=2)
        navy_rows = [
            y for y in range(h)
            if any(fitted.getpixel((x, y))[:3] == navy for x in range(w))
        ]
        self.assertTrue(navy_rows)
        self.assertGreaterEqual(navy_rows[0], 0)
        self.assertLessEqual(navy_rows[-1], h - 1)

    def test_flatten_fills_island_behind_dark_ring(self):
        out = self.ns['_flatten_look_plate'](island_behind_ring())
        img = Image.open(io.BytesIO(out)).convert("RGB")
        plate = self.ns['_LOOK_PLATE_RGB']
        self.assertEqual(img.getpixel((14, 88)), plate)
        r, g, b = img.getpixel((40, 60))
        self.assertLess(r + g + b, 180)

    def test_generate_signature_has_gender_not_face(self):
        tree = ast.parse(MAIN_PATH.read_text())
        fn = next(
            n for n in tree.body
            if isinstance(n, ast.FunctionDef) and n.name == "generate_model_look_image"
        )
        args = [a.arg for a in fn.args.args]
        self.assertIn("gender", args)
        self.assertNotIn("face_bytes", args)
        apply = next(
            n for n in tree.body
            if isinstance(n, ast.FunctionDef) and n.name == "_apply_model_looks"
        )
        self.assertNotIn("face_bytes", [a.arg for a in apply.args.args])
        self.assertIn("report", [a.arg for a in apply.args.args])
        src = ast.get_source_segment(MAIN_PATH.read_text(), fn) or ""
        self.assertNotIn("face_bytes", src)
        self.assertIn('_look_gender_key', src)
        self.assertIn("OPENAI_IMAGE_QUALITY_LOOK", src)
        self.assertIn("model-id12-", src)
        self.assertIn("OPENAI_IMAGE_MODEL_LOOK", src)
        self.assertIn("_flatten_look_plate(out)", src)
        self.assertIn("_crop_look_to_card(out)", src)
        looks_src = MAIN_PATH.read_text()
        start = looks_src.index("def live_coordinate_looks")
        end = looks_src.index("\ndef ", start + 1)
        self.assertIn("stream_with_keepalive", looks_src[start:end])
        self.assertIn("live_reset_daily", looks_src)
        self.assertIn("/api/live/outfits/daily/reset", looks_src)
        self.assertIn("body.ids", looks_src)
        apply_src = looks_src[looks_src.index("def _apply_model_looks"):start]
        self.assertIn('"_look"', apply_src)
        self.assertIn("LOOK_TEST_LIMIT", apply_src)
        self.assertIn("sequential skip", apply_src)
        self.assertNotIn("ThreadPoolExecutor", apply_src)


if __name__ == "__main__":
    unittest.main()
