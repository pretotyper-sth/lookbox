"""토스트 문구 길이 — 모바일에서 한 줄을 넘기면 읽기도 전에 사라지고 화면만 가린다.

토스트는 1.9초 스쳐 가는 알림이다. '무엇이 일어났는지'만 담고, '무엇을 하면 되는지'는
자세히 볼 수 있는 자리(추가 시트, 일괄 등록 목록, 요금제 화면)에 둔다.
"""

import re
import unittest
from pathlib import Path


PROTO = Path(__file__).parents[2].joinpath("frontend/src/proto")
MAX_CHARS = 20   # 390px 폭 · 13.5px 볼드 기준 한 줄

TOAST_CALL = re.compile(r"showToast\(\s*(?:[A-Za-z_.$]+(?:\.[A-Za-z_$]+)*\s*\|\|\s*)?'([^']+)'")


def toasts():
    out = []
    for path in sorted(PROTO.glob("*.jsx")):
        for m in TOAST_CALL.finditer(path.read_text()):
            out.append((path.name, m.group(1)))
    return out


class ToastLengthTest(unittest.TestCase):
    def test_every_toast_fits_one_line(self):
        found = toasts()
        self.assertTrue(found, "토스트를 하나도 못 찾았다 — 정규식이 깨졌는지 확인")
        long = [(f, t, len(t)) for f, t, in ((f, t) for f, t in found) if len(t) > MAX_CHARS]
        self.assertEqual(long, [], f"{MAX_CHARS}자를 넘는 토스트: {long}")

    def test_toasts_do_not_carry_instructions(self):
        # '잠시 후 다시 시도해 주세요' 같은 안내는 토스트에 넣지 않는다(사라지는 알림이라 소용없다).
        bad = [(f, t) for f, t in toasts() if "잠시 후" in t or "다시 시도해" in t]
        self.assertEqual(bad, [], f"토스트에 안내 문장이 들어 있다: {bad}")


class ShortenerTest(unittest.TestCase):
    """긴 서버 문구가 토스트로 갈 때 첫 문장만 남기는 로직이 살아 있는지."""

    def test_app_shortens_long_messages(self):
        src = PROTO.joinpath("09-app.jsx").read_text()
        self.assertIn("const shortToast", src)
        self.assertIn("setToast({ msg: shortToast(msg)", src)
        self.assertIn("코드:", src)   # 개발용 코드는 토스트에서 떼어낸다
