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
        observation = next(node for node in self.tree.body if isinstance(node, ast.FunctionDef) and node.name == "_weather_observation")
        observation_text = ast.get_source_segment(self.source, observation) or ""
        self.assertIn("latitude={latitude:.4f}&longitude={longitude:.4f}", observation_text)
        self.assertIn("apparent_temperature", observation_text)
        self.assertIn("executor.submit(_weather_city_name, lat, lon)", text)
        self.assertIn('"city": city', text)

    def test_weather_lookup_uses_reverse_geocoding_without_city_ranges(self):
        fn = next(node for node in self.tree.body if isinstance(node, ast.FunctionDef) and node.name == "_weather_city_name")
        text = ast.get_source_segment(self.source, fn) or ""
        self.assertIn("nominatim.openstreetmap.org/reverse", text)
        self.assertIn("accept-language=ko", text)
        self.assertIn('address.get("city")', text)
        self.assertNotIn("_KOREAN_WEATHER_CITIES", self.source)

    def test_weather_and_city_queries_run_in_parallel(self):
        fn = next(node for node in self.tree.body if isinstance(node, ast.FunctionDef) and node.name == "_weather_for_location")
        text = ast.get_source_segment(self.source, fn) or ""
        self.assertIn("ThreadPoolExecutor(max_workers=2)", text)
        self.assertIn("executor.submit(_weather_city_name", text)
        self.assertIn("executor.submit(_weather_observation", text)

    def test_clear_weather_code_is_not_treated_as_missing(self):
        fn = next(node for node in self.tree.body if isinstance(node, ast.FunctionDef) and node.name == "_weather_condition")
        ns = {"Any": object}
        exec(compile(ast.Module(body=[fn], type_ignores=[]), "<weather>", "exec"), ns)
        self.assertEqual(ns["_weather_condition"](0), "맑음")

    def test_unresolved_city_is_not_reused_from_the_device_cache(self):
        text = FRONTEND_PATH.read_text()
        self.assertIn("const DEVICE_WEATHER_CACHE_BASE = 'lb_device_weather_v5'", text)
        self.assertIn("cached.weather.cityResolved !== false", text)


if __name__ == "__main__":
    unittest.main()
