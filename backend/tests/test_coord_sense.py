"""코디 감각 로직 — 숨은 스타일 속성 정규화와 규칙 기반 페어링 점수.

추천이 '되긴 하는데 아쉬운' 이유가 카테고리·색·이름만 보고 짰기 때문이라, 핏·격식·
톤·패턴을 속성으로 남기고 그 값으로 조합을 고른다. 그 계약을 여기서 고정한다.
"""

import ast
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path


MAIN_PATH = Path(__file__).parents[1].joinpath("app/main.py")
FNS = (
    "_pick", "_clean_style_attrs", "_row_style", "_item_bucket", "_pair_score", "_pair_style_preference", "_catalog_line",
    "_profile_block", "_item_clue", "_clue_has", "_pair_is_forbidden", "_pair_clash",
    "_shoe_pair_score", "_pick_rotating_shoe", "_combo_top_bottom", "_rebalance_combo_shoes", "_accent_fit_score", "_combo_has_top_and_bottom", "_garment_slot", "_combo_has_unique_garment_slots", "_dedupe_combo_garment_slots", "_combo_core_key", "_combo_shoe_id", "_visual_garment_family", "_combo_top_variant_key", "_diversify_combo_bases", "fallback_combos",
    "_calendar_seasons", "_coord_season_note", "_coord_weather_note", "_weather_item_penalty", "_is_summer_shoe", "_offseason_shoe",
)
CONSTS = (
    "_STYLE_IDS", "_FITS", "_PATTERNS", "_MATERIALS", "_PC_GUIDE",
    "_FIT_KO", "_SEASON_KO", "_NEUTRAL_COLORS", "_PALETTE_COLOR_HINTS",
    "_CLASH_DRESS_SHOE", "_CLASH_SPORT_SHOE", "_CLASH_ATH_BOTTOM",
    "_CLASH_TAILOR_BOTTOM", "_CLASH_DRESS_TOP", "_CLASH_DRESS_OUTER", "_CLASH_ATH_TOP",
    "_SHOE_ROTATE_SLACK", "_SHOE_ROTATE_PENALTY", "_SHOE_UNIQUE_SLACK",
    "_SUMMER_SHOE",
)


def load():
    tree = ast.parse(MAIN_PATH.read_text())
    body = [
        n for n in tree.body
        if (isinstance(n, ast.FunctionDef) and n.name in FNS)
        or (isinstance(n, ast.Assign) and getattr(n.targets[0], "id", "") in CONSTS)
    ]
    ns = {
        "Any": object,
        "_category_display": lambda c: {"top": "상의", "bottom": "하의"}.get(c, c or ""),
        "datetime": datetime,
        "timezone": timezone,
        "timedelta": timedelta,
    }
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

    def test_hot_weather_penalises_heavy_outerwear(self):
        heavy = item(cat="outer", color="블랙", name="기모 롱코트")
        tee = item(cat="top", color="화이트", name="반팔 티셔츠")
        weather = {"temp": 27, "hi": 29, "lo": 20, "cond": "맑음"}
        self.assertLess(self.ns["_weather_item_penalty"](heavy, weather), 0)
        self.assertEqual(self.ns["_weather_item_penalty"](tee, weather), 0)
        self.assertIn("최고 29°C", self.ns["_coord_weather_note"](weather))

    def test_rain_penalises_weather_sensitive_shoes(self):
        suede = item(cat="shoes", color="브라운", name="스웨이드 로퍼")
        weather = {"temp": 18, "feels": 17, "hi": 20, "lo": 14, "cond": "비"}
        self.assertLess(self.ns["_weather_item_penalty"](suede, weather), 0)

    def test_cold_weather_penalises_summer_only_garment(self):
        summer_tee = item(cat="top", color="화이트", name="린넨 반팔", _seasons=["summer"])
        weather = {"temp": 7, "feels": 5, "hi": 10, "lo": 3, "cond": "맑음"}
        self.assertLess(self.ns["_weather_item_penalty"](summer_tee, weather), 0)

    def test_coord_rules_forbid_cargo_chelsea(self):
        rules = MAIN_PATH.read_text()
        self.assertIn("첼시 부츠", rules)
        self.assertIn("패션 테러리스트", rules)
        self.assertIn("같은 신발을 반복하지 말고", rules)
        self.assertIn("first_ms=", rules)


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

    def test_preferred_palette_and_fit_lift_matching_top(self):
        navy_regular = item(cat="top", color="네이비", name="레귤러 니트", fit="regular")
        black_slim = item(cat="top", color="블랙", name="슬림 티셔츠", fit="slim")
        bottom = item(cat="bottom", color="그레이", name="슬랙스", formality=3)
        profile = {"palettes": ["navy"], "fit": "레귤러"}
        self.assertGreater(self.score(navy_regular, bottom, profile), self.score(black_slim, bottom, profile))

    def test_preferred_mood_changes_pair_ranking(self):
        office = item(cat="top", color="네이비", name="블레이저", styles=["office"])
        street = item(cat="bottom", color="블랙", name="카고", styles=["street"])
        self.assertGreater(self.ns["_pair_style_preference"](office, street, ["office"]), 0)
        self.assertLess(self.ns["_pair_style_preference"](office, street, ["minimal"]), 0)

    def test_chelsea_loses_to_sneaker_on_cargo(self):
        cargo = item(cat="bottom", color="블랙", name="와이드 카고 팬츠", subtype="카고 팬츠")
        chelsea = item(cat="shoes", color="블랙", name="미니멀 첼시 부츠", subtype="첼시 부츠")
        sneaker = item(cat="shoes", color="블랙", name="아디다스 삼바")
        self.assertGreater(self.score(cargo, sneaker, None), self.score(cargo, chelsea, None))

    def test_shirt_prefers_slacks_over_cargo(self):
        shirt = item(cat="top", color="블루", name="수피마 코튼 셔츠", subtype="셔츠")
        cargo = item(cat="bottom", color="블랙", name="카고 팬츠", subtype="카고 팬츠")
        slacks = item(cat="bottom", color="블랙", name="슬랙스", subtype="슬랙스")
        self.assertGreater(self.score(shirt, slacks, None), self.score(shirt, cargo, None))

    def test_coat_and_cargo_are_forbidden(self):
        coat = item(cat="outer", color="브라운", name="울 코트", subtype="코트", formality=4)
        cargo = item(cat="bottom", color="블랙", name="조거 카고 팬츠", subtype="카고 팬츠", formality=1)
        self.assertTrue(self.ns["_pair_is_forbidden"](coat, cargo))


class ComboSlotTest(unittest.TestCase):
    def setUp(self):
        self.ns = load()

    def test_dedupe_keeps_one_item_per_slot(self):
        by_id = {
            "top-1": {"id": "top-1", "category": "top"},
            "top-2": {"id": "top-2", "category": "top"},
            "bottom": {"id": "bottom", "category": "bottom"},
            "shoes": {"id": "shoes", "category": "shoes"},
        }
        combo = {"item_ids": ["top-1", "top-2", "bottom", "shoes"]}
        self.ns["_dedupe_combo_garment_slots"](combo, by_id)
        self.assertEqual(combo["item_ids"], ["top-1", "bottom", "shoes"])

    def test_diversify_prefers_different_top_variants(self):
        items = [
            item(cat="top", color="블랙", name="블랙 카라티", subtype="카라티"),
            item(cat="top", color="화이트", name="화이트 카라티", subtype="카라티"),
            item(cat="top", color="네이비", name="네이비 니트", subtype="니트"),
        ]
        for idx, it in enumerate(items):
            it["id"] = f"top-{idx}"
        by_id = {it["id"]: it for it in items}
        combos = [
            {"item_ids": ["top-0", "bottom-0", "shoes"]},
            {"item_ids": ["top-1", "bottom-1", "shoes"]},
            {"item_ids": ["top-2", "bottom-2", "shoes"]},
        ]
        got = self.ns["_diversify_combo_bases"](combos, by_id, 3)
        self.assertEqual(got[0]["item_ids"][0], "top-0")
        self.assertEqual(got[1]["item_ids"][0], "top-2")

    def test_diversify_uses_name_family_when_style_metadata_is_missing(self):
        items = [
            item(cat="top", color="차콜", name="차콜 셔츠"),
            item(cat="top", color="차콜", name="차콜 오버핏 셔츠"),
            item(cat="top", color="네이비", name="네이비 니트"),
        ]
        for idx, it in enumerate(items):
            it["id"] = f"top-{idx}"
        by_id = {it["id"]: it for it in items}
        combos = [
            {"item_ids": ["top-0", "bottom-0", "shoes"]},
            {"item_ids": ["top-1", "bottom-1", "shoes"]},
            {"item_ids": ["top-2", "bottom-2", "shoes"]},
        ]
        got = self.ns["_diversify_combo_bases"](combos, by_id, 3)
        self.assertEqual(got[0]["item_ids"][0], "top-0")
        self.assertEqual(got[1]["item_ids"][0], "top-2")

    def test_fallback_cards_use_another_top_family_before_repeating_shirt(self):
        closet = [
            {**item(cat="top", color="차콜", name="차콜 셔츠"), "id": "shirt-1"},
            {**item(cat="top", color="차콜", name="차콜 오버핏 셔츠"), "id": "shirt-2"},
            {**item(cat="top", color="네이비", name="네이비 니트"), "id": "knit"},
            {**item(cat="bottom", color="베이지", name="치노 팬츠"), "id": "pants"},
            {**item(cat="shoes", color="화이트", name="화이트 스니커즈"), "id": "shoes"},
        ]
        combos = self.ns["fallback_combos"](closet, None, 3, profile={"weather": {"temp": 18, "feels": 17, "hi": 20, "lo": 14}})
        self.assertEqual([combo["item_ids"][0] for combo in combos[:2]], ["shirt-1", "knit"])

    def test_fallback_caps_a_repeated_bottom_at_two_cards(self):
        closet = [
            {**item(cat="top", color="화이트", name="셔츠", subtype="셔츠"), "id": "shirt"},
            {**item(cat="top", color="그레이", name="니트", subtype="니트"), "id": "knit"},
            {**item(cat="top", color="네이비", name="티셔츠", subtype="티셔츠"), "id": "tee"},
            {**item(cat="bottom", color="네이비", name="데님", subtype="데님"), "id": "jeans"},
            {**item(cat="bottom", color="베이지", name="치노", subtype="치노"), "id": "chino"},
            {**item(cat="shoes", color="화이트", name="스니커즈"), "id": "shoes"},
        ]
        combos = self.ns["fallback_combos"](closet, None, 3, profile={})
        bottoms = [next(item_id for item_id in combo["item_ids"] if item_id in {"jeans", "chino"}) for combo in combos]
        self.assertLessEqual(max(bottoms.count(item_id) for item_id in set(bottoms)), 2)
        self.assertEqual(set(bottoms), {"jeans", "chino"})


class ShoeRotateTest(unittest.TestCase):
    def setUp(self):
        self.ns = load()
        self.pick = self.ns["_pick_rotating_shoe"]

    def test_second_look_uses_the_other_shoe(self):
        shirt = item(cat="top", color="화이트", name="옥스퍼드 셔츠", subtype="셔츠")
        slacks = item(cat="bottom", color="네이비", name="슬랙스", subtype="슬랙스")
        chelsea = {
            **item(cat="shoes", color="블랙", name="미니멀 스퀘어토 집업 첼시 부츠", subtype="첼시 부츠"),
            "id": "sh-chelsea",
        }
        sneaker = {
            **item(cat="shoes", color="블랙", name="아디다스 삼바"),
            "id": "sh-samba",
        }
        first = self.pick([chelsea, sneaker], shirt, slacks, None, {})
        second = self.pick([chelsea, sneaker], shirt, slacks, None, {first["id"]: 1})
        self.assertNotEqual(second["id"], first["id"])

    def test_fallback_uses_every_safe_shoe_before_repeating(self):
        closet = [
            {**item(cat="top", color="화이트", name="옥스퍼드 셔츠"), "id": "shirt"},
            {**item(cat="top", color="네이비", name="니트"), "id": "knit"},
            {**item(cat="top", color="그레이", name="티셔츠"), "id": "tee"},
            {**item(cat="top", color="블랙", name="후디"), "id": "hoodie"},
            {**item(cat="bottom", color="네이비", name="데님"), "id": "jeans"},
            {**item(cat="bottom", color="베이지", name="치노"), "id": "chino"},
            {**item(cat="shoes", color="화이트", name="화이트 스니커즈"), "id": "shoe-1"},
            {**item(cat="shoes", color="블랙", name="블랙 스니커즈"), "id": "shoe-2"},
            {**item(cat="shoes", color="브라운", name="브라운 로퍼"), "id": "shoe-3"},
            {**item(cat="shoes", color="네이비", name="네이비 캔버스화"), "id": "shoe-4"},
        ]
        combos = self.ns["fallback_combos"](closet, None, 4, profile={})
        used = [self.ns["_combo_shoe_id"](combo["item_ids"], {x["id"]: x for x in closet}) for combo in combos]
        self.assertEqual(len(used), 4)
        self.assertEqual(len(set(used)), 4)

    def test_rebalance_replaces_repeated_safe_shoes(self):
        top = {**item(cat="top", color="화이트", name="셔츠"), "id": "top"}
        bottom = {**item(cat="bottom", color="네이비", name="데님"), "id": "bottom"}
        shoes = [
            {**item(cat="shoes", color=color, name=f"{color} 스니커즈"), "id": f"shoe-{idx}"}
            for idx, color in enumerate(("화이트", "블랙", "브라운", "네이비"))
        ]
        by_id = {x["id"]: x for x in [top, bottom, *shoes]}
        combos = [{"item_ids": ["top", "bottom", "shoe-0"]} for _ in range(4)]
        self.ns["_rebalance_combo_shoes"](combos, by_id, {})
        used = [self.ns["_combo_shoe_id"](combo["item_ids"], by_id) for combo in combos]
        self.assertEqual(len(set(used)), 4)

    def test_rotate_does_not_force_chelsea_on_cargo(self):
        hoodie = item(cat="top", color="블랙", name="후디", subtype="후디")
        cargo = item(cat="bottom", color="블랙", name="와이드 카고 팬츠", subtype="카고 팬츠")
        chelsea = {
            **item(cat="shoes", color="블랙", name="미니멀 첼시 부츠", subtype="첼시 부츠"),
            "id": "sh-chelsea",
        }
        sneaker = {
            **item(cat="shoes", color="블랙", name="아디다스 삼바"),
            "id": "sh-samba",
        }
        picked = self.pick([chelsea, sneaker], hoodie, cargo, None, {sneaker["id"]: 2})
        self.assertEqual(picked["id"], sneaker["id"])

    def test_flipflop_loses_to_loafer_in_september(self):
        sept = datetime(2026, 9, 10, tzinfo=timezone(timedelta(hours=9)))
        shirt = item(cat="top", color="블루", name="스트라이프 셔츠", subtype="셔츠")
        jeans = item(cat="bottom", color="네이비", name="와이드 데님", subtype="데님")
        flop = {
            **item(cat="shoes", color="블랙", name="블랙 쪼리", subtype="쪼리", _seasons=["summer"]),
            "id": "sh-flop",
        }
        loafer = {
            **item(cat="shoes", color="블랙", name="블랙 로퍼", subtype="로퍼"),
            "id": "sh-loafer",
        }
        self.assertGreater(
            self.ns["_shoe_pair_score"](loafer, shirt, jeans, None, sept),
            self.ns["_shoe_pair_score"](flop, shirt, jeans, None, sept),
        )
        picked = self.pick([flop, loafer], shirt, jeans, None, {})
        self.assertEqual(picked["id"], loafer["id"])


class AccentFitTest(unittest.TestCase):
    def setUp(self):
        self.ns = load()

    def test_cap_needs_explicit_street_or_sport_basis(self):
        cap = item(cat="hat", color="블랙", name="볼캡")
        polo = item(cat="top", color="네이비", name="니트 폴로")
        jeans = item(cat="bottom", color="블루", name="스트레이트 데님")
        hoodie = item(cat="top", color="블랙", name="스트리트 후디")
        cargo = item(cat="bottom", color="카키", name="와이드 카고")
        score = self.ns["_accent_fit_score"]
        self.assertLess(score(cap, polo, jeans), 0)
        self.assertGreaterEqual(score(cap, hoodie, cargo), 2)


class IncludeAndWishTest(unittest.TestCase):
    """옷장에서 고른 아이템은 빠지면 안 되고, 제안 아이템도 한 자리로 센다."""

    def setUp(self):
        tree = ast.parse(MAIN_PATH.read_text())
        names = (
            "_item_bucket", "_garment_slot", "_combo_has_unique_garment_slots",
            "_combo_has_top_and_bottom", "_combo_has_shoes",
            "_combo_is_wearable", "_clean_wish", "_include_note",
            "_wish_note", "_combo_has_category", "_gap_wish", "_fill_wish_quota",
            "_wish_slot_key", "_wish_key", "_apply_wish_slot", "_pin_wishes_to_tail", "_is_accent",
        )
        body = [n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in names]
        consts = [
            n for n in tree.body
            if isinstance(n, ast.Assign) and getattr(n.targets[0], "id", "") in (
                "_WISH_CATEGORIES", "_WISH_GAP_ITEMS",
            )
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

    def test_same_category_can_only_appear_once(self):
        by_id = {
            "polo": {"category": "top"},
            "knit": {"category": "상의"},
            "pants": {"category": "bottom"},
            "shoes": {"category": "shoes"},
        }
        unique = self.ns["_combo_has_unique_garment_slots"]
        self.assertFalse(unique(["polo", "knit", "pants", "shoes"], by_id))
        self.assertTrue(unique(["polo", "pants", "shoes"], by_id))

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
        self.assertIn("4개 중 마지막 2개", self.ns["_wish_note"](2, 4))
        self.assertIn("반드시 2개", self.ns["_wish_note"](2, 4))

    def test_fill_wish_quota_when_model_omits(self):
        by_id = {
            "t": {"id": "t", "category": "top"},
            "b": {"id": "b", "category": "bottom"},
        }
        combos = [{"label": "A", "item_ids": ["t", "b"]}, {"label": "B", "item_ids": ["t", "b"]}]
        self.ns["_fill_wish_quota"](combos, 1, by_id)
        wished = [c for c in combos if c.get("wish")]
        self.assertEqual(len(wished), 1)
        self.assertEqual(combos[-1]["wish"]["category"], "shoes")
        self.assertIsNone(combos[0].get("wish"))
        self.ns["_fill_wish_quota"](combos, 1, by_id)
        self.assertEqual(sum(1 for c in combos if c.get("wish")), 1)

    def test_gap_wish_rotates_away_from_recent_item(self):
        by_id = {
            "t": {"id": "t", "category": "top"},
            "b": {"id": "b", "category": "bottom"},
        }
        recent = {self.ns["_wish_key"]({"category": "shoes", "name": "화이트 스니커즈", "color": "화이트"})}
        wish = self.ns["_gap_wish"](["t", "b"], by_id, avoid_wishes=recent)
        self.assertEqual(wish["category"], "shoes")
        self.assertNotIn(self.ns["_wish_key"](wish), recent)

    def test_outer_bottom_shoes_get_an_inner_top_before_an_accessory(self):
        by_id = {
            "o": {"id": "o", "category": "outer", "name": "울 코트"},
            "b": {"id": "b", "category": "bottom", "name": "카키 카고 팬츠"},
            "s": {"id": "s", "category": "shoes", "name": "화이트 스니커즈"},
        }
        wish = self.ns["_gap_wish"](["o", "b", "s"], by_id)
        self.assertEqual(wish["category"], "top")

    def test_overlapping_core_wish_keeps_wardrobe_shoes(self):
        by_id = {
            "t": {"id": "t", "category": "top"},
            "b": {"id": "b", "category": "bottom"},
            "s": {"id": "s", "category": "shoes"},
        }
        combos = [{
            "label": "A",
            "item_ids": ["t", "b", "s"],
            "wish": {"name": "화이트 캔버스 스니커즈", "category": "shoes", "color": "화이트"},
        }]
        self.ns["_fill_wish_quota"](combos, 1, by_id)
        self.assertEqual(combos[0]["item_ids"], ["t", "b", "s"])
        self.assertNotEqual(combos[0]["wish"]["category"], "shoes")

    def test_misplaced_wish_moves_to_last_card(self):
        by_id = {
            "t": {"id": "t", "category": "top"},
            "b": {"id": "b", "category": "bottom"},
            "s": {"id": "s", "category": "shoes"},
        }
        combos = [
            {"label": "A", "item_ids": ["t", "b", "s"], "wish": {"name": "미니 백", "category": "bag", "color": "블랙"}},
            {"label": "B", "item_ids": ["t", "b", "s"]},
        ]
        self.ns["_fill_wish_quota"](combos, 1, by_id)
        self.assertIsNone(combos[0].get("wish"))
        self.assertEqual(combos[1]["wish"]["category"], "bag")

    def test_shoes_are_required_for_a_wearable_combo(self):
        by_id = {
            "t": {"id": "t", "category": "top"},
            "b": {"id": "b", "category": "bottom"},
            "s": {"id": "s", "category": "shoes"},
        }
        wearable = self.ns["_combo_is_wearable"]
        self.assertFalse(wearable(["t", "b"], by_id))
        self.assertTrue(wearable(["t", "b", "s"], by_id))
        self.assertTrue(wearable(["t", "b"], by_id, {"category": "shoes"}))
