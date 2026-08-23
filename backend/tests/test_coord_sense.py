"""코디 감각 로직 — 숨은 스타일 속성 정규화와 규칙 기반 페어링 점수.

추천이 '되긴 하는데 아쉬운' 이유가 카테고리·색·이름만 보고 짰기 때문이라, 핏·격식·
톤·패턴을 속성으로 남기고 그 값으로 조합을 고른다. 그 계약을 여기서 고정한다.
"""

import ast
import unittest
from pathlib import Path


MAIN_PATH = Path(__file__).parents[1].joinpath("app/main.py")
FNS = ("_pick", "_clean_style_attrs", "_row_style", "_pair_score", "_catalog_line", "_profile_block")
CONSTS = (
    "_STYLE_IDS", "_FITS", "_PATTERNS", "_MATERIALS", "_PC_GUIDE",
    "_FIT_KO", "_SEASON_KO", "_NEUTRAL_COLORS",
)


def load():
    tree = ast.parse(MAIN_PATH.read_text())
    body = [
        n for n in tree.body
        if (isinstance(n, ast.FunctionDef) and n.name in FNS)
        or (isinstance(n, ast.Assign) and getattr(n.targets[0], "id", "") in CONSTS)
    ]
    ns = {"Any": object, "_category_display": lambda c: {"top": "상의", "bottom": "하의"}.get(c, c or "")}
    exec(compile(ast.Module(body=body, type_ignores=[]), "<coord>", "exec"), ns)
    return ns


def item(cat="top", color="블랙", name="옷", **style):
    return {"id": "i-" + cat + color, "category": cat, "color": color, "name": name,
            "metadata": {"style": style, "seasons": style.pop("_seasons", [])}}


class StyleAttrTest(unittest.TestCase):
    def setUp(self):
        self.ns = load()

    def test_only_known_values_survive(self):
        clean = self.ns["_clean_style_attrs"]({
            "subtype": "카고 팬츠", "fit": "WIDE", "pattern": "zebra", "material": "denim",
            "tone": "warm", "depth": "deep", "chroma": "muted", "formality": "3",
            "styles": ["street", "nonsense", "casual", "minimal", "chic"],
            "details": ["카고 포켓", " "],
        })
        self.assertEqual(clean["fit"], "wide")           # 대소문자 무시
        self.assertNotIn("pattern", clean)               # 목록 밖 값은 버린다
        self.assertEqual(clean["formality"], 3)          # 문자열 숫자도 받는다
        self.assertEqual(clean["styles"], ["street", "casual", "minimal"])  # 3개까지
        self.assertEqual(clean["details"], ["카고 포켓"])

    def test_out_of_range_formality_and_garbage_are_dropped(self):
        self.assertEqual(self.ns["_clean_style_attrs"]({"formality": 9}), {})
        self.assertEqual(self.ns["_clean_style_attrs"]("nope"), {})

    def test_new_mood_ids_are_known(self):
        ids = self.ns["_STYLE_IDS"]
        for s in ("blockcore", "bodyfit", "bizcasual", "girlish", "glam", "feminine"):
            self.assertIn(s, ids)

    def test_catalog_line_carries_hidden_attributes(self):
        line = self.ns["_catalog_line"](item(
            cat="bottom", color="블랙", name="와이드 팬츠",
            subtype="카고 팬츠", fit="wide", material="cotton", formality=2, styles=["street"],
        ))
        self.assertIn("카고 팬츠", line)
        self.assertIn("핏=와이드", line)
        self.assertIn("격식=2", line)
        self.assertIn("무드=street", line)

    def test_profile_block_explains_personal_color(self):
        block = self.ns["_profile_block"]({"personal_color": "autumn", "fit": "오버사이즈"})
        self.assertIn("가을 웜", block)
        self.assertIn("warm", block)
        self.assertIn("오버사이즈", block)
        self.assertEqual(self.ns["_profile_block"](None), "")

    def test_profile_block_skips_height_weight(self):
        block = self.ns["_profile_block"]({"height": "170", "weight": "60", "fit": "슬림"})
        self.assertNotIn("체형", block)
        self.assertNotIn("170", block)
        self.assertNotIn("60", block)
        self.assertIn("슬림", block)


class PairScoreTest(unittest.TestCase):
    def setUp(self):
        self.ns = load()
        self.score = self.ns["_pair_score"]

    def test_formality_gap_is_penalised(self):
        suit = item(cat="top", color="네이비", formality=5, tone="cool")
        slacks = item(cat="bottom", color="차콜", formality=4, tone="cool")
        trainers = item(cat="bottom", color="그레이", formality=1, tone="neutral")
        self.assertGreater(self.score(suit, slacks, None), self.score(suit, trainers, None))

    def test_two_patterns_lose_to_one(self):
        striped = item(cat="top", color="화이트", pattern="stripe", formality=3)
        checked = item(cat="bottom", color="베이지", pattern="check", formality=3)
        plain = item(cat="bottom", color="베이지", pattern="solid", formality=3)
        self.assertGreater(self.score(striped, plain, None), self.score(striped, checked, None))

    def test_both_oversized_loses_to_balanced(self):
        big_top = item(cat="top", color="블랙", fit="oversized", formality=2)
        wide = item(cat="bottom", color="블랙", fit="wide", formality=2)
        slim = item(cat="bottom", color="블랙", fit="slim", formality=2)
        self.assertGreater(self.score(big_top, slim, None), self.score(big_top, wide, None))

    def test_personal_colour_lifts_matching_top(self):
        warm_top = item(cat="top", color="카멜", tone="warm", depth="deep", chroma="muted", formality=3)
        cool_top = item(cat="top", color="애쉬블루", tone="cool", depth="light", chroma="vivid", formality=3)
        bottom = item(cat="bottom", color="블랙", tone="neutral", formality=3)
        autumn = {"personal_color": "autumn"}
        self.assertGreater(self.score(warm_top, bottom, autumn), self.score(cool_top, bottom, autumn))


class IncludeAndWishTest(unittest.TestCase):
    """옷장에서 고른 아이템은 빠지면 안 되고, 제안 아이템도 한 자리로 센다."""

    def setUp(self):
        tree = ast.parse(MAIN_PATH.read_text())
        names = ("_item_bucket", "_combo_has_top_and_bottom", "_clean_wish", "_include_note", "_wish_note")
        body = [n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in names]
        consts = [
            n for n in tree.body
            if isinstance(n, ast.Assign) and getattr(n.targets[0], "id", "") == "_WISH_CATEGORIES"
        ]
        ns = {"Any": object, "_canonicalize_color": lambda c: {"black": "블랙"}.get(c.lower(), c)}
        exec(compile(ast.Module(body=[*body, *consts], type_ignores=[]), "<wish>", "exec"), ns)
        self.ns = ns

    def test_wish_fills_the_missing_half_of_an_outfit(self):
        by_id = {"a": {"category": "top"}}
        has = self.ns["_combo_has_top_and_bottom"]
        self.assertFalse(has(["a"], by_id))                                   # 상의만 → 코디 아님
        self.assertTrue(has(["a"], by_id, {"category": "bottom"}))            # 제안 하의가 채운다
        self.assertFalse(has(["a"], by_id, {"category": "bag"}))              # 가방으론 안 된다

    def test_wish_needs_a_real_category_and_name(self):
        clean = self.ns["_clean_wish"]
        self.assertIsNone(clean({"name": "가방", "category": "핸드백"}))       # 목록 밖 카테고리
        self.assertIsNone(clean({"name": "", "category": "bag"}))              # 이름 없음
        got = clean({"name": "레더 크로스백", "category": "bag", "color": "black", "reason": "포인트"})
        self.assertEqual(got["category"], "bag")
        self.assertEqual(got["color"], "블랙")                                 # 옷장 표기로 통일

    def test_prompt_notes_switch_on_the_inputs(self):
        items = [{"id": "x1", "name": "와이드 데님"}]
        note = self.ns["_include_note"](["x1"], items)
        self.assertIn("모든 코디에 빠짐없이", note)
        self.assertIn("와이드 데님", note)
        self.assertEqual(self.ns["_include_note"]([], items), "")
        self.assertIn("옷장에 있는 아이템만", self.ns["_wish_note"](0, 4))
        self.assertIn("4개 중 2개", self.ns["_wish_note"](2, 4))
