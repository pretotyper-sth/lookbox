// The editor and exported image share one stack for clothes and decorations.
export function canvasElements(look) {
  return [
    ...(look.items || []).map((value, index) => ({ key: value.id, collection: 'items', index, value, z: value.z ?? 0 })),
    ...(look.decorations || []).map((value, index) => ({ key: `layer:${value.id}`, collection: 'decorations', index, value, z: value.z ?? 40 + index })),
  ].sort((a, b) => a.z - b.z);
}

export function moveCanvasElement(look, key, direction) {
  const stack = canvasElements(look);
  const from = stack.findIndex(entry => entry.key === key);
  if (from < 0) return look;
  const to = direction === 'front' ? stack.length - 1 : direction === 'forward' ? Math.min(stack.length - 1, from + 1) : Math.max(0, from - 1);
  if (from === to && direction !== 'front') return look;
  const [entry] = stack.splice(from, 1);
  stack.splice(to, 0, entry);
  // Compact ranks also avoid the saved decoration z limit after repeated moves.
  const ranks = new Map(stack.map((element, index) => [element.key, index + 1]));
  return {
    ...look,
    items: (look.items || []).map(value => ({ ...value, z: ranks.get(value.id) })),
    decorations: (look.decorations || []).map(value => ({ ...value, z: ranks.get(`layer:${value.id}`) })),
  };
}
