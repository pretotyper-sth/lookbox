// 주요 쇼핑 플랫폼의 '구매내역' 진입 주소. 사이트가 주소를 바꾸는 일이 잦아서,
// 여기 적힌 주소로 못 찾으면 사용자가 브라우저에서 직접 이동한 뒤 Enter를 누르면
// 그 페이지에서 그대로 긁는다(수집 로직은 주소에 의존하지 않는다).
export const PLATFORMS = [
  { id: 'musinsa',  name: '무신사',            urls: ['https://www.musinsa.com/order/order-list', 'https://my.musinsa.com/order/order_list.html'] },
  { id: '29cm',     name: '29CM',             urls: ['https://www.29cm.co.kr/order/my-order/list'] },
  { id: 'zigzag',   name: '지그재그',          urls: ['https://zigzag.kr/order-list', 'https://zigzag.kr/my-page'] },
  { id: 'ably',     name: '에이블리',          urls: ['https://m.a-bly.com/mypage/order-list', 'https://a-bly.com/mypage'] },
  { id: 'wconcept', name: 'W컨셉',             urls: ['https://www.wconcept.co.kr/MyPage/MyOrderList'] },
  { id: 'kream',    name: 'KREAM',            urls: ['https://kream.co.kr/my/buying?tab=finished'] },
  { id: 'naver',    name: '네이버페이 주문내역', urls: ['https://pay.naver.com/pc/history?page=1'] },
  { id: 'ssg',      name: 'SSG닷컴',           urls: ['https://pay.ssg.com/myssg/orderList.ssg'] },
  { id: 'coupang',  name: '쿠팡',              urls: ['https://mc.coupang.com/ssr/desktop/order/list'], bootstrapUrl: 'https://www.coupang.com/', desktopUa: true },
  { id: 'musthave', name: '머스트잇',          urls: ['https://mustit.co.kr/m/mypage/my_buying'] },
];

export const byId = (id) => PLATFORMS.find((p) => p.id === id);
