/** 몰 선택 안내 — 해야 할 일만. 이름은 몰마다 다르고 문장은 같다. */
export function orderLoginGuide(name) {
  return `${name} 로그인이 필요해요. 로그인하면 주문내역이 열려요.`;
}

export const ORDER_PLATFORMS = [
  { id: 'musinsa', name: '무신사' },
  { id: '29cm', name: '29CM' },
  { id: 'zigzag', name: '지그재그' },
  { id: 'ably', name: '에이블리' },
  { id: 'coupang', name: '쿠팡' },
  { id: 'naver', name: '네이버페이' },
  { id: 'wconcept', name: 'W컨셉' },
  { id: 'kream', name: 'KREAM' },
  { id: 'brandi', name: '브랜디' },
  { id: 'ssg', name: 'SSG닷컴' },
  { id: 'hyundai', name: '더현대닷컴' },
  { id: 'musthave', name: '머스트잇' },
];
