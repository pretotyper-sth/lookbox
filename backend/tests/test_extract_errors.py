"""OpenAI 이미지 편집 실패를 어떤 문구·코드로 옮기는지 고정한다.

라이브에서 'AI 이미지 생성 중 오류가 났어요'만 보이고 원인을 알 수 없었던 게
이 테스트를 만든 이유다. 상태코드·에러코드가 각각 다른 문구로 갈라져야 한다.
"""

import ast
import unittest
from pathlib import Path


MAIN_PATH = Path(__file__).parents[1].joinpath("app/main.py")
WANTED = ("_openai_error_info", "_openai_fail_key", "_fail_code", "_fail_log")


def load_helpers():
    tree = ast.parse(MAIN_PATH.read_text())
    fns = [n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in WANTED]
    msgs = next(
        n for n in tree.body
        if isinstance(n, ast.Assign) and getattr(n.targets[0], "id", "") == "_EXTRACT_FAIL_MSG"
    )
    module = ast.Module(body=[*fns, msgs], type_ignores=[])
    ns = {"Any": object}
    exec(compile(module, "<extract_errors>", "exec"), ns)
    return ns


class FakeAPIError(Exception):
    def __init__(self, status, code=None, message="boom", request_id=None):
        super().__init__(message)
        self.status_code = status
        self.body = {"error": {"code": code}} if code else None
        self.message = message
        self.request_id = request_id


class ExtractErrorTest(unittest.TestCase):
    def setUp(self):
        self.ns = load_helpers()

    def key_for(self, exc):
        info = self.ns["_openai_error_info"](exc)
        return self.ns["_openai_fail_key"](info)

    def test_status_codes_map_to_distinct_messages(self):
        cases = {
            FakeAPIError(429, "rate_limit_exceeded"): "rate_limit",
            FakeAPIError(500, "server_error"): "upstream",
            FakeAPIError(503): "upstream",
            FakeAPIError(400, "moderation_blocked"): "moderation",
            FakeAPIError(400, "invalid_value"): "bad_request",
            FakeAPIError(401): "auth",
            FakeAPIError(429, "insufficient_quota"): "quota",
            FakeAPIError(413): "too_large",
            Exception("nothing useful"): "api_error",
        }
        msgs = self.ns["_EXTRACT_FAIL_MSG"]
        for exc, key in cases.items():
            self.assertEqual(self.key_for(exc), key, exc)
            self.assertIn(key, msgs)
        # 같은 문구로 뭉개지면 사용자가 원인을 구분할 수 없다
        shown = [msgs[k] for k in set(cases.values())]
        self.assertEqual(len(shown), len(set(shown)))

    def test_code_carries_status_error_code_and_request_tail(self):
        info = self.ns["_openai_error_info"](
            FakeAPIError(429, "rate_limit_exceeded", request_id="req_0123456789abcdef")
        )
        self.assertEqual(info["status"], 429)
        self.assertEqual(info["code"], "rate_limit_exceeded")
        self.assertEqual(self.ns["_fail_code"](info), "429·rate_limit_exceeded·89abcdef")

    def test_unknown_error_still_produces_a_code(self):
        info = self.ns["_openai_error_info"](RuntimeError("weird"))
        self.assertEqual(self.ns["_fail_code"](info), "RuntimeError")
        self.assertIn("weird", self.ns["_fail_log"](info))
