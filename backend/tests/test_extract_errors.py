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
    """OpenAI SDK는 error 객체를 감싼 형태와 그대로 준 형태가 둘 다 나온다."""

    def __init__(self, status, code=None, message="boom", request_id=None, param=None, flat=False):
        super().__init__(message)
        self.status_code = status
        err = {k: v for k, v in (("code", code), ("param", param), ("message", message)) if v}
        self.body = (err if flat else {"error": err}) if err else None
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
            # param이 있으면 사진이 아니라 우리 요청이 틀린 것 (gpt-image-2 + 투명 배경)
            FakeAPIError(400, "invalid_value", param="background", flat=True): "bad_setup",
            FakeAPIError(401): "auth",
            FakeAPIError(429, "insufficient_quota"): "quota",
            FakeAPIError(413): "too_large",
            Exception("nothing useful"): "api_error",
        }
        msgs = self.ns["_EXTRACT_FAIL_MSG"]
        for exc, key in cases.items():
            self.assertEqual(self.key_for(exc), key, exc)
            self.assertIn(key, msgs)
        # 사용자가 할 일이 다른 경우는 문구도 달라야 한다(기다리기 vs 사진 바꾸기 vs 용량 줄이기).
        # 반대로 '우리 쪽 문제'끼리는 같은 문구여도 된다 — 사용자가 할 일이 같으니까.
        actionable = ["moderation", "bad_request", "rate_limit", "too_large", "upstream", "api_error"]
        shown = [msgs[k] for k in actionable]
        self.assertEqual(len(shown), len(set(shown)))

    def test_code_carries_status_error_code_and_request_tail(self):
        info = self.ns["_openai_error_info"](
            FakeAPIError(429, "rate_limit_exceeded", request_id="req_0123456789abcdef")
        )
        self.assertEqual(info["status"], 429)
        self.assertEqual(info["code"], "rate_limit_exceeded")
        self.assertEqual(self.ns["_fail_code"](info), "429·rate_limit_exceeded·89abcdef")

    def test_flat_error_body_is_parsed(self):
        info = self.ns["_openai_error_info"](FakeAPIError(
            400, "invalid_value", message="Transparent background is not supported for this model.",
            param="background", flat=True,
        ))
        self.assertEqual(info["code"], "invalid_value")
        self.assertEqual(info["param"], "background")
        self.assertIn("Transparent background", info["message"])

    def test_request_problems_do_not_blame_the_photo(self):
        msgs = self.ns["_EXTRACT_FAIL_MSG"]
        self.assertNotIn("사진", msgs["bad_setup"])   # 사진을 바꿔도 해결되지 않는다
        self.assertIn("사진", msgs["bad_request"])    # 이건 실제로 사진 문제

    def test_unknown_error_still_produces_a_code(self):
        info = self.ns["_openai_error_info"](RuntimeError("weird"))
        self.assertEqual(self.ns["_fail_code"](info), "RuntimeError")
        self.assertIn("weird", self.ns["_fail_log"](info))
