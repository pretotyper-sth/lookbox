export const PLATFORMS = [
  { id: 'musinsa', name: '무신사', urls: ['https://my.musinsa.com/order/order_list.html', 'https://www.musinsa.com/mypage/orders'] },
  { id: '29cm', name: '29CM', urls: ['https://order.29cm.co.kr/my/orders', 'https://www.29cm.co.kr/mypage/order'] },
  { id: 'zigzag', name: '지그재그', urls: ['https://zigzag.kr/my/orders', 'https://s.zigzag.kr/my/orders'] },
  { id: 'ably', name: '에이블리', urls: ['https://m.a-bly.com/mypage/order-list', 'https://a-bly.com/mypage'] },
  { id: 'wconcept', name: 'W컨셉', urls: ['https://www.wconcept.co.kr/MyAccount/Order'] },
  { id: 'kream', name: 'KREAM', urls: ['https://kream.co.kr/my/buying'] },
  { id: 'naver', name: '네이버페이', urls: ['https://order.pay.naver.com/home'] },
  { id: 'brandi', name: '브랜디', urls: ['https://www.brandi.co.kr/mypage/order'] },
  { id: 'ssg', name: 'SSG닷컴', urls: ['https://www.ssg.com/myssg/orderList.ssg'] },
  { id: 'coupang', name: '쿠팡', urls: ['https://mc.coupang.com/ssr/desktop/order/list'] },
  { id: 'hyundai', name: '더현대닷컴', urls: ['https://www.thehyundai.com/Hyundai/Mypage/OrderList.do'] },
  { id: 'musthave', name: '머스트잇', urls: ['https://mustit.co.kr/mypage/order_list'] },
];

export const byId = (id) => PLATFORMS.find((p) => p.id === id);
