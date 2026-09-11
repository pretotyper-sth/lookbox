/** 몰 선택 안내 — 해야 할 일만. 이름은 몰마다 다르고 문장은 같다. */
export function orderLoginGuide(name) {
  return `${name} 로그인이 필요해요. 로그인하면 주문내역이 열려요.`;
}

export const ORDER_PLATFORMS = [
  { id: 'musinsa',  name: '무신사',     host: 'musinsa.com',     loginUrl: 'https://www.musinsa.com/auth/login',           ordersUrl: 'https://www.musinsa.com/order/order-list' },
  { id: '29cm',     name: '29CM',      host: '29cm.co.kr',      loginUrl: 'https://auth.29cm.co.kr/login',                ordersUrl: 'https://www.29cm.co.kr/order/my-order' },
  { id: 'zigzag',   name: '지그재그',   host: 'zigzag.kr',       loginUrl: 'https://zigzag.kr/login',                      ordersUrl: 'https://zigzag.kr/order-list' },
  { id: 'ably',     name: '에이블리',   host: 'a-bly.com',       loginUrl: 'https://m.a-bly.com/login',                    ordersUrl: 'https://m.a-bly.com/mypage/order-list' },
  { id: 'coupang',  name: '쿠팡',       host: 'coupang.com',     loginUrl: 'https://www.coupang.com/',                     ordersUrl: 'https://mc.coupang.com/ssr/desktop/order/list', desktopUa: true },
  { id: 'naver',    name: '네이버페이', host: 'pay.naver.com',   loginUrl: 'https://nid.naver.com/nidlogin.login',         ordersUrl: 'https://order.pay.naver.com/home' },
  { id: 'wconcept', name: 'W컨셉',      host: 'wconcept.co.kr',  loginUrl: 'https://www.wconcept.co.kr/Member/Login',     ordersUrl: 'https://www.wconcept.co.kr/MyPage/MyOrderList' },
  { id: 'kream',    name: 'KREAM',      host: 'kream.co.kr',     loginUrl: 'https://kream.co.kr/login',                    ordersUrl: 'https://kream.co.kr/my/buying' },
  { id: 'ssg',      name: 'SSG닷컴',    host: 'ssg.com',         loginUrl: 'https://member.ssg.com/member/login.ssg',      ordersUrl: 'https://pay.ssg.com/myssg/orderList.ssg' },
  { id: 'hyundai',  name: '더현대닷컴', host: 'thehyundai.com',  loginUrl: 'https://www.thehyundai.com/login',             ordersUrl: 'https://www.thehyundai.com/front/mpa/selectOrdDlvCrst.thd' },
  { id: 'musthave', name: '머스트잇',   host: 'mustit.co.kr',    loginUrl: 'https://mustit.co.kr/member/login',            ordersUrl: 'https://mustit.co.kr/m/mypage/order_list' },
];

export function orderPlatformById(id) {
  return ORDER_PLATFORMS.find((p) => p.id === id) || ORDER_PLATFORMS[0];
}
