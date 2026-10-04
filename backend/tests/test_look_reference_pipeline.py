import ast
import base64
import contextlib
import hashlib
import io
import time
import unittest
from typing import Any, Callable
from unittest.mock import MagicMock

from backend.tests.test_model_look import MAIN_PATH, load, studio_look


def pipeline_namespace(cached=None):
    ns = load()
    source = MAIN_PATH.read_text()
    tree = ast.parse(source)
    node = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'generate_model_look_image')
    png = studio_look(160, 200, (48, 12, 112, 192))
    database = MagicMock()
    database.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value.data = cached or []
    provider = MagicMock()
    provider.with_options.return_value.images.edit.return_value.data = [type('Output', (), {'b64_json': base64.b64encode(png).decode()})()]
    reference_path = MagicMock()
    reference_path.read_bytes.return_value = png
    ns.update({
        'base64': base64, 'hashlib': hashlib, 'time': time, 'Any': Any, 'Callable': Callable,
        'OPENAI_IMAGE_MODEL_LOOK': 'gpt-image-2.5-flare', 'OPENAI_IMAGE_QUALITY_LOOK': 'high',
        'OPENAI_IMAGE_TIMEOUT': 240, 'REFERENCE_REV': 'studio-snap-v1', 'AI_TEST_MODE': False,
        'supabase_admin': database, 'openai_client': provider,
        'look_cache_key': lambda ids: '-'.join(ids),
        'charge_credit': MagicMock(return_value=True),
        'choose_studio_reference': MagicMock(return_value={'id': 'pose-a', 'path': reference_path}),
        '_image_bytes_to_png': lambda raw: raw,
        '_ensure_model_identity_png': MagicMock(side_effect=AssertionError('canonical fallback was used')),
        '_png_named': lambda raw, name: (name, raw),
        '_garment_edit_images': MagicMock(return_value=[('garment.png', png)]),
        'upload_bytes': MagicMock(return_value='https://example.test/look.png'),
        'log_ai_usage': MagicMock(),
    })
    exec(compile(ast.Module(body=[node], type_ignores=[]), '<model-look-pipeline>', 'exec'), ns)
    return ns


class StudioLookPipelineTest(unittest.TestCase):
    def generate(self, ns, **kwargs):
        with contextlib.redirect_stdout(io.StringIO()):
            return ns['generate_model_look_image']('account-a', ['shirt-a'], [{'id': 'shirt-a', 'category': 'top', 'name': 'shirt'}], '남성', **kwargs)

    def test_studio_reference_and_garment_are_sent_to_flare_high(self):
        ns = pipeline_namespace()
        self.assertEqual(self.generate(ns), 'https://example.test/look.png')
        ns['choose_studio_reference'].assert_called_once_with('m', 'account-a')
        request = ns['openai_client'].with_options.return_value.images.edit.call_args.kwargs
        self.assertEqual(request['model'], 'gpt-image-2.5-flare')
        self.assertEqual(request['quality'], 'high')
        self.assertEqual(request['size'], '1024x1536')
        self.assertEqual(len(request['image']), 2)
        self.assertEqual(request['image'][0][0], '01-default-reference.png')
        self.assertIn('78 to 80%', request['prompt'])
        self.assertIn('Preserve logos and lettering', request['prompt'])
        ns['_garment_edit_images'].assert_called_once_with([{'id': 'shirt-a', 'category': 'top', 'name': 'shirt'}], start_at=2)
        self.assertEqual(ns['log_ai_usage'].call_args.args[3]['reference_id'], 'pose-a')

    def test_personal_face_precedes_pose_and_garments(self):
        ns = pipeline_namespace()
        self.generate(ns, personal=True, reference_png=b'profile-photo', height='175', weight='70')
        request = ns['openai_client'].with_options.return_value.images.edit.call_args.kwargs
        self.assertEqual(request['image'][0], ('01-profile.png', b'profile-photo'))
        self.assertEqual(request['image'][1][0], '02-default-look-reference.png')
        self.assertEqual(len(request['image']), 3)
        self.assertIn('Image 1 is the person. Image 2 is the look framing.', request['prompt'])
        self.assertIn('175 cm', request['prompt'])
        self.assertIn('70 kg', request['prompt'])
        self.assertIn('average build', request['prompt'])
        self.assertIn('not body shape', request['prompt'])
        self.assertEqual(ns['_garment_edit_images'].call_args.kwargs['start_at'], 3)
        cache_key = ns['supabase_admin'].table.return_value.select.return_value.eq.return_value.eq.call_args.args[1]
        self.assertIn('-personal-body1-', cache_key)

    def test_cache_hit_does_not_rotate_reference_charge_or_generate(self):
        ns = pipeline_namespace([{'image_url': 'https://example.test/cached.png'}])
        self.assertEqual(self.generate(ns), 'https://example.test/cached.png')
        for key in ['choose_studio_reference', 'charge_credit', 'upload_bytes']:
            ns[key].assert_not_called()
        ns['openai_client'].with_options.assert_not_called()

    def test_explicit_reference_remains_the_input(self):
        ns = pipeline_namespace()
        self.generate(ns, reference_png=b'explicit-reference')
        ns['choose_studio_reference'].assert_not_called()
        request = ns['openai_client'].with_options.return_value.images.edit.call_args.kwargs
        self.assertEqual(request['image'][0][1], b'explicit-reference')


if __name__ == '__main__':
    unittest.main()
