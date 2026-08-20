"""사용자에게 보이는 문구 — 개발자 말투나 코드가 새어 나가지 않게 고정한다.

화면에 'item_not_found'나 '추출 실패' 같은 게 뜨면, 사용자는 뭘 해야 할지 알 수 없다.
모든 실패 문구는 (1) 한국어로 (2) 무슨 일이 있었는지 (3) 지금 뭘 하면 되는지를 담는다.
"""

import ast
import re
import unittest
from pathlib import Path


MAIN_PATH = Path(__file__).parents[1].joinpath("app/main.py")
SOURCE = MAIN_PATH.read_text()

# 관리자·개발 전용 엔드포인트는 사람이 읽을 일이 없다(존재를 숨기는 404 등).
INTERNAL_OK = {"not_found", "dev_seed_disabled", "source_account_protected"}


class DetailStringTest(unittest.TestCase):
    def test_no_machine_codes_reach_the_user(self):
        codes = [m for m in re.findall(r'detail="([a-z0-9_]+)"', SOURCE) if m not in INTERNAL_OK]
        self.assertEqual(codes, [], f"사람이 읽을 수 없는 detail: {codes}")

    def test_failure_messages_say_what_to_do_next(self):
        tree = ast.parse(SOURCE)
        msgs = {}
        for node in tree.body:
            if isinstance(node, ast.Assign) and getattr(node.targets[0], "id", "") in (
                "_EXTRACT_FAIL_MSG", "_FASHION_REJECT_MSG"
            ):
                msgs[node.targets[0].id] = ast.literal_eval(node.value)
        self.assertEqual(set(msgs), {"_EXTRACT_FAIL_MSG", "_FASHION_REJECT_MSG"})
        for name, table in msgs.items():
            for key, text in table.items():
                with self.subTest(msg=f"{name}.{key}"):
                    self.assertRegex(text, r"[가-힣]", "한국어여야 한다")
                    self.assertTrue(text.endswith("."), f"문장으로 끝나야 한다: {text}")
                    # 다음 행동이 있어야 한다: 다시 시도 / 다른 사진 / 올려 주세요 …
                    self.assertRegex(
                        text, r"(주세요|시도해|시도하|바꾸면|알려)", f"할 일이 없다: {text}"
                    )
                    self.assertLessEqual(len(text), 70, f"너무 길다: {text}")

    def test_our_fault_messages_do_not_blame_the_photo(self):
        table = next(
            ast.literal_eval(n.value) for n in ast.parse(SOURCE).body
            if isinstance(n, ast.Assign) and getattr(n.targets[0], "id", "") == "_EXTRACT_FAIL_MSG"
        )
        for key in ("auth", "quota", "bad_setup", "no_openai", "upstream", "rate_limit", "timeout"):
            self.assertNotIn("사진", table[key], f"{key}: 우리 문제인데 사진 탓을 한다")

    def test_credit_and_limit_messages_tell_when_it_comes_back(self):
        # 언제 다시 쓸 수 있는지가 없으면 사용자는 기다릴지 결제할지 정할 수 없다.
        credit = re.search(r'detail=f"이번 달 크레딧을 다 썼어요\.[^"]*"', SOURCE)
        self.assertIsNotNone(credit)
        self.assertIn("다시 채워져요", credit.group(0))
        # 무료 사용자에게는 지금 이어서 쓸 방법도 알려준다
        self.assertIn("프로로 바꾸면", SOURCE)
        limit = re.search(r'f"전신 이미지는 한 달에[^"]*"', SOURCE)
        self.assertIsNotNone(limit)
