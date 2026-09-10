export const PLATFORMS = [
  { id: 'musinsa', name: '무신사', urls: ['https://www.musinsa.com/order/order-list', 'https://my.musinsa.com/order/order_list.html'] },
  { id: '29cm', name: '29CM', urls: ['https://www.29cm.co.kr/order/my-order', 'https://www.29cm.co.kr/mypage/order'] },
  { id: 'zigzag', name: '지그재그', urls: ['https://zigzag.kr/order-list', 'https://zigzag.kr/my-page'] },
  { id: 'ably', name: '에이블리', urls: ['https://m.a-bly.com/mypage/order-list', 'https://a-bly.com/mypage'] },
  { id: 'wconcept', name: 'W컨셉', urls: ['https://www.wconcept.co.kr/MyPage/MyOrderList'] },
  { id: 'kream', name: 'KREAM', urls: ['https://kream.co.kr/my/buying', 'https://kream.co.kr/my'] },
  { id: 'naver', name: '네이버페이', urls: ['https://order.pay.naver.com/home'] },
  { id: 'brandi', name: '브랜디', urls: ['https://www.brandi.co.kr/mypage/order'] },
  { id: 'ssg', name: 'SSG닷컴', urls: ['https://pay.ssg.com/myssg/orderList.ssg'] },
  { id: 'coupang', name: '쿠팡', urls: ['https://mc.coupang.com/ssr/desktop/order/list'] },
  { id: 'hyundai', name: '더현대닷컴', urls: ['https://www.thehyundai.com/front/mpa/selectOrdDlvCrst.thd', 'https://www.thehyundai.com/Hyundai/Mypage/OrderList.do'] },
  { id: 'musthave', name: '머스트잇', urls: ['https://mustit.co.kr/m/mypage/order_list'] },
];

export const byId = (id) => PLATFORMS.find((p) => p.id === id);
