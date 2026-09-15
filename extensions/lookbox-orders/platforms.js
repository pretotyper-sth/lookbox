export const PLATFORMS = [
  { id: 'musinsa', name: '무신사', urls: ['https://www.musinsa.com/order/order-list', 'https://my.musinsa.com/order/order_list.html'] },
  { id: '29cm', name: '29CM', urls: ['https://www.29cm.co.kr/order/my-order/list'] },
  { id: 'zigzag', name: '지그재그', urls: ['https://zigzag.kr/my-page'] },
  { id: 'ably', name: '에이블리', urls: ['https://mobile.a-bly.com/orders'] },
  { id: 'wconcept', name: 'W컨셉', urls: ['https://www.wconcept.co.kr/MyPage/MyOrderList'] },
  { id: 'kream', name: 'KREAM', urls: ['https://kream.co.kr/my/buying?tab=finished'] },
  { id: 'naver', name: '네이버페이', urls: ['https://pay.naver.com/pc/history?page=1'] },
  { id: 'ssg', name: 'SSG닷컴', urls: ['https://pay.ssg.com/myssg/orderList.ssg'] },
  {
    id: 'coupang',
    name: '쿠팡',
    urls: ['https://mc.coupang.com/ssr/desktop/order/list'],
    loginUrl: 'https://login.coupang.com/login/login.pang?rtnUrl=https%3A%2F%2Fwww.coupang.com%2Fnp%2Fpost%2Flogin%3Fr%3Dhttp%253A%252F%252Fwww.coupang.com%252F',
  },
  { id: 'musthave', name: '머스트잇', urls: ['https://mustit.co.kr/m/mypage/my_buying'] },
];

export const byId = (id) => PLATFORMS.find((p) => p.id === id);
