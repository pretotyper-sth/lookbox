"""현재 위치 날씨 API 계약."""

import ast
import unittest
from pathlib import Path


MAIN_PATH = Path(__file__).parents[1].joinpath("app/main.py")
FRONTEND_PATH = Path(__file__).parents[2].joinpath("frontend/src/proto/09-app.jsx")


class WeatherLocationTest(unittest.TestCase):
    def setUp(self):
        self.source = MAIN_PATH.read_text()
        self.tree = ast.parse(self.source)

    def test_weather_endpoint_accepts_bounded_coordinates(self):
        fn = next(node for node in self.tree.body if isinstance(node, ast.FunctionDef) and node.name == "live_weather")
        text = ast.get_source_segment(self.source, fn) or ""
        self.assertIn("lat: float | None = Query(default=None, ge=-90, le=90)", text)
        self.assertIn("lon: float | None = Query(default=None, ge=-180, le=180)", text)
        self.assertIn("_weather_for_location(lat, lon)", text)

    def test_weather_lookup_uses_device_coordinates_without_storing_them(self):
        fn = next(node for node in self.tree.body if isinstance(node, ast.FunctionDef) and node.name == "_weather_for_location")
        text = ast.get_source_segment(self.source, fn) or ""
        self.assertIn("latitude={lat:.4f}&longitude={lon:.4f}", text)
        self.assertIn("apparent_temperature", text)
        self.assertIn('city = _weather_city_name(lat, lon) if has_device_location else "서울"', text)
        self.assertIn('"city": city', text)

    def test_weather_lookup_resolves_a_concise_city_label(self):
        fn = next(node for node in self.tree.body if isinstance(node, ast.FunctionDef) and node.name == "_weather_city_name")
        text = ast.get_source_segment(self.source, fn) or ""
        self.assertIn("nominatim.openstreetmap.org/reverse", text)
        self.assertIn("accept-language=ko", text)
        self.assertIn('address.get("state")', text)
        self.assertIn('replace("특별시", "")', text)

    def test_seoul_coordinates_have_a_local_city_fallback(self):
        const = next(node for node in self.tree.body if isinstance(node, ast.Assign) and getattr(node.targets[0], "id", "") == "_KOREAN_WEATHER_CITIES")
        fn = next(node for node in self.tree.body if isinstance(node, ast.FunctionDef) and node.name == "_weather_city_fallback")
        ns = {}
        exec(compile(ast.Module(body=[const, fn], type_ignores=[]), "<weather>", "exec"), ns)
        self.assertEqual(ns["_weather_city_fallback"](37.5665, 126.9780), "서울")

    def test_unresolved_city_is_not_reused_from_the_device_cache(self):
        text = FRONTEND_PATH.read_text()
        self.assertIn("const DEVICE_WEATHER_CACHE_BASE = 'lb_device_weather_v3'", text)
        self.assertIn("cached.weather.city !== '현재 위치'", text)


if __name__ == "__main__":
    unittest.main()
