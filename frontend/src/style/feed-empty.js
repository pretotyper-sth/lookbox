export function followingEmptyCopy(follows = []) {
  return follows.length ? {
    title: '팔로잉한 사람의 공개 피드가 없어요',
    description: '새로운 피드가 올라오면 여기에 보여드려요.',
  } : {
    title: '아직 팔로잉한 사람이 없어요',
    description: '전체 피드에서 취향이 맞는 사람을 팔로우해 보세요.',
  };
}
