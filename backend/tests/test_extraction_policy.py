import ast
import unittest
from pathlib import Path


MAIN_PATH = Path(__file__).parents[1].joinpath("app/main.py")


def load_policy():
    source = MAIN_PATH.read_text()
    tree = ast.parse(source)
    policy = next(
        node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == "_resolve_extract_policy"
    )
    module = ast.Module(body=[policy], type_ignores=[])
    namespace = {
        "Any": object,
        "OPENAI_IMAGE_TIMEOUT": 120,
        "OPENAI_IMAGE_TIMEOUT_FAST": 60,
        "OPENAI_IMAGE_QUALITY": "medium",
        "OPENAI_IMAGE_QUALITY_TEXT": "high",
        "OPENAI_IMAGE_QUALITY_HARD": "high",
        "OPENAI_IMAGE_MODEL": "gpt-image-1",
        "OPENAI_IMAGE_MODEL_TEXT": "gpt-image-2",
    }
    exec(compile(module, "<extraction_policy>", "exec"), namespace)
    return namespace["_resolve_extract_policy"]


class ExtractionPolicyTest(unittest.TestCase):
    def setUp(self):
        self.resolve = load_policy()

    def test_standard_and_light_garments_use_medium(self):
        policy = self.resolve(
            {"has_text_logo": False},
            {"messy_background": False, "whiteish": True},
            "",
        )
        self.assertEqual(policy["tier"], "standard")
        self.assertEqual(policy["model"], "gpt-image-1")
        self.assertEqual(policy["quality"], "medium")
        self.assertEqual(policy["timeout_s"], 60)

    def test_logo_and_complex_background_use_high(self):
        logo = self.resolve({"has_text_logo": True}, {"messy_background": False}, "")
        background = self.resolve({"has_text_logo": False}, {"messy_background": True}, "")
        self.assertEqual((logo["model"], logo["quality"]), ("gpt-image-2", "high"))
        self.assertEqual((background["model"], background["quality"]), ("gpt-image-1", "high"))
        self.assertEqual(background["timeout_s"], 120)

    def test_studio_cutout_does_not_blur_light_garment_alpha(self):
        source = MAIN_PATH.read_text()
        studio = source[source.index("def studio_product_cutout"):source.index("def _source_is_whiteish")]
        self.assertNotIn("alpha.filter(ImageFilter.GaussianBlur(1))", studio)


if __name__ == "__main__":
    unittest.main()
