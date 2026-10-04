import unittest

from PIL import Image

from backend.app import look_references as references


class StudioReferenceTest(unittest.TestCase):
    def setUp(self):
        references._DECKS.clear()

    def test_catalog_has_decodable_male_and_female_images_and_sources(self):
        catalog = references.reference_catalog()
        self.assertEqual(len(catalog), 37)
        self.assertEqual(sum(row['gender'] == 'm' for row in catalog), 16)
        self.assertEqual(sum(row['gender'] == 'f' for row in catalog), 21)
        for row in catalog:
            with self.subTest(reference=row['id']):
                with Image.open(references.REFERENCE_DIR / row['file']) as image:
                    image.verify()
                self.assertTrue(row['ai_label_verified'])
                self.assertTrue(row['source_page'].startswith('https://www.musinsa.com/snap/'))

    def test_gender_deck_exhausts_before_repeating_and_does_not_repeat_at_boundary(self):
        for gender in ('m', 'f'):
            count = sum(row['gender'] == gender for row in references.reference_catalog())
            first = [references.choose_studio_reference(gender, 'person-a') for _ in range(count)]
            second = references.choose_studio_reference(gender, 'person-a')
            self.assertEqual(len({row['id'] for row in first}), count)
            self.assertTrue(all(row['gender'] == gender for row in first))
            self.assertNotEqual(first[-1]['id'], second['id'])

    def test_unknown_gender_keeps_existing_fallback(self):
        self.assertIsNone(references.choose_studio_reference('u', 'person-a'))

    def test_accounts_have_independent_bounded_decks(self):
        first = references.choose_studio_reference('m', 'person-a')
        references.choose_studio_reference('m', 'person-b')
        self.assertEqual(len(references._DECKS[('person-a', 'm')][0]), 15)
        self.assertEqual(references._DECKS[('person-a', 'm')][1], first['id'])
        for index in range(260):
            references.choose_studio_reference('m', str(index))
        self.assertEqual(len(references._DECKS), 256)
