"""프로필 사진은 스토리지 URL로 계정에 붙인다. data URL은 metadata에 넣지 않는다."""

import ast
import base64
import io
import unittest
from pathlib import Path

from PIL import Image


MAIN_PATH = Path(__file__).parents[1].joinpath("app/main.py")
FNS = ("_decode_data_url", "_face_image_bytes")


def load():
    tree = ast.parse(MAIN_PATH.read_text())
    body = [
        n for n in tree.body
        if isinstance(n, ast.FunctionDef) and n.name in FNS
    ]
    ns = {
        "base64": base64,
        "_fetch_bytes": lambda src, limit=3_000_000: b"from-url" if src.startswith("http") else None,
    }
    exec(compile(ast.Module(body=body, type_ignores=[]), "<profile-avatar>", "exec"), ns)
    return ns


def tiny_jpeg_data_url() -> str:
    im = Image.new("RGB", (4, 4), (200, 180, 160))
    buf = io.BytesIO()
    im.save(buf, format="JPEG", quality=80)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


class ProfileAvatarTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ns = load()
        cls.src = MAIN_PATH.read_text()

    def test_data_url_still_decodes(self):
        url = tiny_jpeg_data_url()
        raw = self.ns["_face_image_bytes"](url)
        self.assertTrue(raw)
        self.assertGreater(len(raw), 20)

    def test_http_url_uses_fetch(self):
        self.assertEqual(self.ns["_face_image_bytes"]("https://example.com/a.webp"), b"from-url")

    def test_empty_is_none(self):
        self.assertIsNone(self.ns["_face_image_bytes"](""))
        self.assertIsNone(self.ns["_face_image_bytes"](None))

    def test_endpoint_stores_url_on_account(self):
        self.assertIn("@app.post(\"/api/live/profile/avatar\")", self.src)
        self.assertIn("_patch_user_prefs", self.src)
        self.assertIn("{user.id}/profile/avatar-", self.src)
        self.assertIn("live_tryon_body", self.src)
        start = self.src.index("def live_tryon_body")
        chunk = self.src[start:start + 400]
        self.assertIn("_face_image_bytes", chunk)
        self.assertNotIn("_decode_data_url(body.face_data_url)", chunk)


if __name__ == "__main__":
    unittest.main()
