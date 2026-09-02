"""AI 착장은 canonical 인물 + 옷장 실물. 배경은 레퍼런스 스튜디오를 그대로 쓴다."""

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
    '_look_row_backdrop',
    '_look_content_box',
    '_fit_look_to_card',
    '_crop_look_to_card',
    '_bottom_hem_note',
)
CONSTS = (
    '_LOOK_PLATE_RGB', 'CATEGORY_KO', 'CATEGORY_EN',
    '_LEGACY_CATEGORY_KO', '_LOOK_SLOT_LABEL', '_LOOK_SLOT_ORDER', '_LOOK_CARD_RATIO',
    '_LOOK_CROP_PAD', '_LOOK_BACKDROP_TOL',
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


def studio_look(w: int, h: int, person: tuple[int, int, int, int] | None) -> bytes:
    """레퍼런스 스튜디오처럼 위에서 아래로 어두워지는 배경 + 인물."""
    im = Image.new("RGB", (w, h))
    px = im.load()
    for y in range(h):
        base = 236 - int(34 * (y / h) ** 1.4)
        for x in range(w):
            px[x, y] = (base, base - 1, base - 5)
    if person:
        x0, y0, x1, y1 = person
        for y in range(y0, y1):
            for x in range(x0, x1):
                px[x, y] = (28, 42, 72)
    buf = io.BytesIO()
    im.save(buf, format="PNG")
    return buf.getvalue()


class ModelLookPromptTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ns = load()

    def test_prompt_is_catalog_model_not_selfie(self):
        prompt = self.ns['_model_look_prompt']("남성")
        self.assertIn("identity lock", prompt)
        # 배경은 단색 판이 아니라 레퍼런스 스튜디오. 판 색을 강요하면 그라데이션이
        # 계단처럼 뭉개진다(2026-09-02).
        self.assertNotIn("#E5E3DE", prompt)
        self.assertIn("one continuous soft gray studio backdrop", prompt)
        self.assertIn("15% of the frame empty", prompt)
        self.assertIn("Do not use the user's face", prompt)
        self.assertNotIn("순하", prompt)
        self.assertNotIn("키 크고", prompt)
        self.assertEqual(self.ns['_LOOK_PLATE_RGB'], (229, 227, 222))

    def test_look_prompt_single_image_swap(self):
        src = MAIN_PATH.read_text()
        self.assertIn("outfit replacement task", src)
        self.assertIn("Image 1 defines the character identity", src)
        self.assertIn("Do not mix these roles", src)
        self.assertIn("model-id-v11-", src)
        self.assertIn("model-id14-", src)
        self.assertIn("look-identity", src)
        self.assertIn("01-canonical.png", src)
        self.assertIn("긴 기장", src)
        self.assertIn("Do not lengthen the legs", src)
        # 레퍼런스가 실제 룩북 모델로 바뀌었다. 억지로 젊게·작게 만들던 규칙은
        # 얼굴과 비율만 흔들어서 걷어냈다(2026-09-02).
        self.assertNotIn("heads tall", src)
        self.assertNotIn("De-age", src)
        self.assertNotIn("youthful early-to-mid-20s", src)
        self.assertIn("Keep the height and proportions of Image 1", src)
        self.assertIn("15% of the frame empty", src)
        self.assertIn("middle 70%", src)
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

    def test_crop_look_keeps_person_inside_card(self):
        navy = (28, 42, 72)
        out = self.ns['_crop_look_to_card'](studio_look(40, 60, (12, 16, 28, 44)))
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
        navy = (28, 42, 72)
        out = self.ns['_crop_look_to_card'](studio_look(40, 60, (14, 1, 26, 59)))
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

    def test_crop_keeps_backdrop_gradient_smooth(self):
        """배경을 판 색으로 못박던 시절, 배경 밝기가 판 밝기를 지나는 줄에서
        얼룩진 띠가 생겼다. 신발 옆이 깨져 보이던 게 이거다(2026-09-02).
        이제 후처리는 자르기뿐이라 그라데이션이 그대로 남아야 한다.
        """
        src = studio_look(80, 120, (30, 20, 50, 100))
        out = self.ns['_crop_look_to_card'](src)
        img = Image.open(io.BytesIO(out)).convert("RGB")
        col = [img.getpixel((2, y))[0] for y in range(img.height)]
        self.assertGreater(col[0] - col[-1], 4)          # 그라데이션이 살아 있다
        self.assertLessEqual(max(abs(a - b) for a, b in zip(col, col[1:])), 2)

    def test_fit_pads_with_backdrop_not_flat_plate(self):
        """인물이 커서 넣기로 갈 때도 단색을 깔면 카드에 배경이 둘이 된다."""
        out = self.ns['_crop_look_to_card'](studio_look(40, 60, (14, 1, 26, 59)))
        img = Image.open(io.BytesIO(out)).convert("RGB")
        self.assertNotEqual(img.getpixel((1, 1)), self.ns['_LOOK_PLATE_RGB'])
        col = [img.getpixel((1, y))[0] for y in range(img.height)]
        self.assertLessEqual(max(abs(a - b) for a, b in zip(col, col[1:])), 2)

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
        self.assertIn("model-id14-", src)
        self.assertIn("OPENAI_IMAGE_MODEL_LOOK", src)
        self.assertNotIn("_flatten_look_plate", src)
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
