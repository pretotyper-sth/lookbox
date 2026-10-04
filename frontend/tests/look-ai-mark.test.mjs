import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (name) => readFileSync(new URL(`../src/proto/${name}`, import.meta.url), 'utf8');
const css = read('proto.css');
const composite = read('05-screens-cde.jsx');
const shared = read('02-shared.jsx');

test('AI label stays at the bottom left and mobile hides only the wording', () => {
  assert.match(css, /\.lb-look-ai-mark\s*\{[^}]*left:\s*var\(--s3\);[^}]*bottom:\s*var\(--s3\);/s);
  assert.match(css, /@media\s*\(max-width:\s*759px\)\s*\{[\s\S]*?\.lb-look-ai-mark-label\s*\{\s*display:\s*none;/);
});

test('small outfit cards use the icon mode and large images retain the label', () => {
  assert.match(composite, /aiMark = 'full'/);
  assert.match(composite, /aiMark === 'icon' \? null : <span className="lb-look-ai-mark-label"> AI로 생성<\/span>/);
  assert.ok((composite.match(/aiMark="icon"/g) || []).length >= 2);
});

test('enlarged AI image uses the same accessible and responsive marking', () => {
  assert.match(shared, /<span className="lb-look-ai-mark" aria-label="AI 생성 이미지">\s*<span>✦<\/span><span className="lb-look-ai-mark-label"> AI로 생성<\/span>\s*<\/span>/);
});
