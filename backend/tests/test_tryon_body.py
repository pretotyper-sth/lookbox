"""바로 보기 전신은 얼굴을 고정하고, 캐시 키를 바꿔 예전 실패작을 다시 쓰지 않는다."""

import unittest
from pathlib import Path


MAIN_PATH = Path(__file__).parents[1].joinpath("app/main.py")


class TryOnBodyTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.src = MAIN_PATH.read_text()

    def test_prompt_locks_face(self):
        start = self.src.index("_TRYON_BODY_PROMPT")
        prompt = self.src[start:start + 500]
        self.assertIn("동일한 얼굴", prompt)
        self.assertIn("미화하지 마세요", prompt)
        self.assertIn("#F2F1EE", prompt)

    def test_cache_and_timeout_are_tryon_specific(self):
        start = self.src.index("def live_tryon_body")
        chunk = self.src[start:start + 1600]
        self.assertIn("tryon2-", chunk)
        self.assertNotIn('key = f"tryon-{sig}"', chunk)
        self.assertIn("OPENAI_IMAGE_TIMEOUT_TRYON", chunk)
        self.assertIn('input_fidelity="high"', chunk)


if __name__ == "__main__":
    unittest.main()
