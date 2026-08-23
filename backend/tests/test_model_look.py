"""AI 착장은 프로필 얼굴이 아니라 성별만 맞춘 룩북 모델 + 상품 카드와 같은 회색 판."""

import ast
import io
import unittest
from collections import deque
from pathlib import Path

from PIL import Image


MAIN_PATH = Path(__file__).parents[1].joinpath("app/main.py")
FNS = (
    '_look_gender_key',
    '_model_look_subject',
    '_model_look_prompt',
    '_flatten_look_plate',
)
CONSTS = ('_LOOK_PLATE_HEX', '_LOOK_PLATE_RGB')


def load():
    tree = ast.parse(MAIN_PATH.read_text())
    body = [
        n for n in tree.body
        if (isinstance(n, ast.FunctionDef) and n.name in FNS)
        or (isinstance(n, ast.Assign) and getattr(n.targets[0], "id", "") in CONSTS)
        or (isinstance(n, ast.AnnAssign) and getattr(n.target, "id", "") in CONSTS)
    ]
    ns = {"Image": Image, "io": io, "deque": deque}
    exec(compile(ast.Module(body=body, type_ignores=[]), "<model-look>", "exec"), ns)
    return ns


def two_tone_look() -> bytes:
    """인물 주변만 베이지, 양옆은 차가운 회색 — 첨부처럼 판이 두 장 겹친 상태."""
    cool = (214, 216, 218)
    beige = (236, 230, 218)
    navy = (28, 42, 72)
    im = Image.new("RGB", (80, 120), cool)
    px = im.load()
    for y in range(120):
        for x in range(22, 58):
            px[x, y] = beige
    for y in range(28, 100):
        for x in range(30, 50):
            px[x, y] = navy
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
        self.assertIn("12%", prompt)
        self.assertIn("무신사", prompt)
        self.assertIn("쓰지 마세요", prompt)
        self.assertNotIn("왼쪽 위", prompt)
        self.assertNotIn("얼굴을 그대로", prompt)

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
        src = ast.get_source_segment(MAIN_PATH.read_text(), fn) or ""
        self.assertNotIn("face_bytes", src)
        self.assertIn('_look_gender_key', src)


if __name__ == "__main__":
    unittest.main()
