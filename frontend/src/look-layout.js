const roles = { '상의': 'top', '아우터': 'outer', '하의': 'bottom', '스커트': 'bottom', '원피스': 'dress', '신발': 'shoes', '가방': 'bag', '모자': 'hat', '소품': 'accessory', '액세서리': 'accessory' };

export function editorialSlots(items) {
  const owned = (items || []).filter(Boolean);
  if (!owned.length) return null;
  const hasOuter = owned.some(item => roles[item.category] === 'outer');
  const hasTop = owned.some(item => roles[item.category] === 'top');
  const slots = {
    top: { x0: 6, y0: 7, x1: 62, y1: hasOuter ? 58 : 83, z: 2, labelX: 26, labelY: hasOuter ? 27 : 42 },
    outer: { x0: 6, y0: hasTop ? 38 : 8, x1: 64, y1: 89, z: 4, labelX: 27, labelY: hasTop ? 67 : 43 },
    bottom: { x0: 51, y0: 7, x1: 95, y1: 91, z: 1, labelX: 73, labelY: 44 },
    dress: { x0: 7, y0: 7, x1: 66, y1: 91, z: 2, labelX: 28, labelY: 43 },
    shoes: { x0: 46, y0: 76, x1: 95, y1: 97, z: 7, labelX: 72, labelY: 86 },
    bag: { x0: 7, y0: 71, x1: 38, y1: 96, z: 5, labelX: 22, labelY: 81 },
    hat: { x0: 7, y0: 3, x1: 35, y1: 22, z: 5, labelX: 22, labelY: 13 },
    accessory: { x0: 7, y0: 85, x1: 48, y1: 97, z: 6, labelX: 27, labelY: 91 },
  };
  const counts = {};
  return Object.fromEntries(owned.map(item => {
    const role = roles[item.category] || 'accessory';
    const n = counts[role] || 0; counts[role] = n + 1;
    const slot = slots[role];
    return [item.id, { ...slot, z: slot.z + n * 0.1, labelY: Math.max(8, slot.labelY - n * 12) }];
  }));
}

export function outfitPrice(value) {
  const text = String(value ?? '').trim();
  if (!text) return '가격 미등록';
  const numeric = text.replace(/[₩원,\s]/g, '');
  return /^\d+(\.\d+)?$/.test(numeric) ? `${Number(numeric).toLocaleString('ko-KR')}원` : text;
}
