/** 몰 선택 안내 — 해야 할 일만. 이름은 몰마다 다르고 문장은 같다. */
export function orderLoginGuide(name) {
  return `${name} 로그인이 필요해요. 로그인하면 주문내역이 열려요.`;
}

export const ORDER_PLATFORMS = [
  { id: 'musinsa',  name: '무신사',     host: 'musinsa.com',     ordersUrl: 'https://www.musinsa.com/mypage/orders' },
  { id: '29cm',     name: '29CM',      host: '29cm.co.kr',      ordersUrl: 'https://order.29cm.co.kr/my/orders' },
  { id: 'zigzag',   name: '지그재그',   host: 'zigzag.kr',       ordersUrl: 'https://zigzag.kr/my/orders' },
  { id: 'ably',     name: '에이블리',   host: 'a-bly.com',       ordersUrl: 'https://m.a-bly.com/mypage/order-list' },
  { id: 'coupang',  name: '쿠팡',       host: 'coupang.com',     ordersUrl: 'https://mc.coupang.com/ssr/desktop/order/list' },
  { id: 'naver',    name: '네이버페이', host: 'pay.naver.com',   ordersUrl: 'https://order.pay.naver.com/home' },
  { id: 'wconcept', name: 'W컨셉',      host: 'wconcept.co.kr',  ordersUrl: 'https://www.wconcept.co.kr/MyAccount/Order' },
  { id: 'kream',    name: 'KREAM',      host: 'kream.co.kr',     ordersUrl: 'https://kream.co.kr/my/buying' },
  { id: 'brandi',   name: '브랜디',     host: 'brandi.co.kr',    ordersUrl: 'https://www.brandi.co.kr/mypage/order' },
  { id: 'ssg',      name: 'SSG닷컴',    host: 'ssg.com',         ordersUrl: 'https://www.ssg.com/myssg/orderList.ssg' },
  { id: 'hyundai',  name: '더현대닷컴', host: 'thehyundai.com',  ordersUrl: 'https://www.thehyundai.com/Hyundai/Mypage/OrderList.do' },
  { id: 'musthave', name: '머스트잇',   host: 'mustit.co.kr',    ordersUrl: 'https://mustit.co.kr/mypage/order_list' },
];

export function orderPlatformById(id) {
  return ORDER_PLATFORMS.find((p) => p.id === id) || ORDER_PLATFORMS[0];
}
