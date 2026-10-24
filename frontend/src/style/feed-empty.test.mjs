import test from 'node:test';
import assert from 'node:assert/strict';
import { followingEmptyCopy } from './feed-empty.js';

test('following feed explains that nobody has been followed', () => {
  assert.deepEqual(followingEmptyCopy([]), {
    title: '아직 팔로잉한 사람이 없어요',
    description: '전체 피드에서 취향이 맞는 사람을 팔로우해 보세요.',
  });
});
test('following feed distinguishes followed accounts without public posts', () => {
  assert.deepEqual(followingEmptyCopy(['profile-1']), {
    title: '팔로잉한 사람의 공개 피드가 없어요',
    description: '새로운 피드가 올라오면 여기에 보여드려요.',
  });
});
