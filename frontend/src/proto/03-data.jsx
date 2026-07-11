/* @prototype-ported */

/* LOOKBOX — sample data. Exported to window. */

// 번들(standalone) 시 window.__resources 의 blob URL을 우선 사용, 아니면 원본 경로.
const R = (id, path) => (window.__resources && window.__resources[id]) || path;

const IMG = {
  topNavy: R('topNavy', 'app/img/top-navy-cut.png'),
  skirtWhite: R('skirtWhite', 'app/img/skirt-white-cut.png'),
  sandalBlack: R('sandalBlack', 'app/img/sandal-black-cut.png'),
};

const CATEGORIES = ['전체', '상의', '하의', '아우터', '신발', '액세서리'];

// Wardrobe items the user already owns. inWardrobe: true.
const WARDROBE = [
  { id: 'w1', name: '네이비 헨리넥 티', category: '상의',   color: '네이비',     img: IMG.topNavy },
  { id: 'w2', name: '화이트 데님 스커트', category: '하의', color: '화이트',     img: IMG.skirtWhite },
  { id: 'w3', name: '블랙 토 샌들',       category: '신발',   color: '블랙',       img: IMG.sandalBlack },
  { id: 'w4', name: '가디건',     category: '아우터', color: '베이지',     img: null },
  { id: 'w5', name: '슬랙스',          category: '하의',   color: '라이트그레이', img: null },
  { id: 'w6', name: '셔츠',       category: '상의',   color: '화이트',     img: null },
  { id: 'w7', name: '가방',          category: '액세서리', color: '블랙',     img: null },
  { id: 'w8', name: '로퍼',            category: '신발',   color: '브라운',     img: null },
];

// The "고민 중인 옷" anchor — not yet in wardrobe.
const ANCHOR = {
  id: 'anchor', name: '트렌치 코트', category: '아우터', color: '카멜',
  img: null, inWardrobe: false, isAnchor: true,
};

// Helper to look up an item by id from wardrobe (+ anchor).
const ALL = {};
[...WARDROBE, ANCHOR].forEach((it) => { ALL[it.id] = it; });

// AI outfit recommendations (anchor + wardrobe items). Each = one coordi card.
// lookImg: 조합 전체가 담긴 '한 장의 룩 이미지'. 경로를 넣으면 합성 플랫레이 대신 그 사진을 씁니다.
const OUTFITS = [
  { id: 'o1', label: '데일리 캐주얼', mood: '편안하지만 단정하게',
    itemIds: ['anchor', 'w6', 'w5', 'w8'], lookImg: null },
  { id: 'o2', label: '미니멀 시티',   mood: '톤온톤 차분한 무드',
    itemIds: ['anchor', 'w1', 'w2', 'w3'], lookImg: null },
  { id: 'o3', label: '레이어드 무드', mood: '가볍게 겹쳐 입는 날',
    itemIds: ['anchor', 'w6', 'w2', 'w7'], lookImg: null },
];

// ── 오늘의 코디 (데일리 추천) ──────────────────────────────────────
// '구매 전 조합'과 달리 앵커(고민 중인 옷) 없이 옷장에 이미 있는 옷만으로 구성.
// 매일 옷장에서 N벌을 골라 추천하는 데일리 큐레이션 풀. reshuffle 시 순환.
// occasion: 상황 태그 · note: 날씨/무드 한 줄 이유.
const DAILY = [
  { id: 'd1', label: '오피스 데일리', occasion: '출근',       mood: '단정한 미니멀',
    note: '낮 기온에 딱 맞는 가벼운 정장 무드', itemIds: ['w6', 'w5', 'w8', 'w7'] },
  { id: 'd2', label: '주말 캐주얼',   occasion: '주말 나들이', mood: '편안한 데일리',
    note: '따뜻한 오후, 가볍게 입기 좋아요',     itemIds: ['w1', 'w2', 'w3'] },
  { id: 'd3', label: '레이어드 데이', occasion: '쌀쌀한 아침', mood: '가볍게 겹쳐 입는',
    note: '일교차 큰 날, 가디건으로 온도 조절',   itemIds: ['w6', 'w4', 'w5', 'w8'] },
  { id: 'd4', label: '미니멀 시티',   occasion: '약속·외출',   mood: '톤온톤 차분하게',
    note: '어디든 무난한 도심형 코디',           itemIds: ['w1', 'w5', 'w8', 'w7'] },
  { id: 'd5', label: '소프트 캐주얼', occasion: '카페 데이',   mood: '부드러운 무드',
    note: '맑은 날씨에 산뜻하게',               itemIds: ['w6', 'w2', 'w3', 'w7'] },
];

// 오늘의 날씨 컨텍스트 (추천 이유에 사용 · 데모용 고정값)
const WEATHER = { city: '서울', temp: 24, cond: '맑음', hi: 27, lo: 18 };

// 조합 id → outfit 통합 룩업 (구매 전 조합 + 데일리 모두 포함)
const OUTFIT_BY_ID = {};
[...OUTFITS, ...DAILY].forEach((o) => { OUTFIT_BY_ID[o.id] = o; });

// Pre-saved looks for the Lookbook filled state.
const SAVED = [
  { id: 's1', outfitId: 'o2', label: '미니멀 시티', savedAt: '3일 전' },
  { id: 's2', outfitId: 'o1', label: '데일리 캐주얼', savedAt: '1주 전' },
];

// Garments the AI "separates" out of one uploaded photo / product page.
// A person is usually wearing several pieces at once — the model detects each.
// Sliced by the detect-count tweak (1 → top only · 3 → top/bottom/belt · 4 → +shoes).
const DETECT = [
  { category: '상의',     name: '네이비 니트 베스트', color: '네이비',   conf: 0.97 },
  { category: '하의',     name: '와이드 데님 팬츠',   color: '인디고',   conf: 0.95 },
  { category: '액세서리', name: '브라운 레더 벨트',   color: '브라운',   conf: 0.89 },
  { category: '신발',     name: '스웨이드 더비 슈즈', color: '탠',       conf: 0.86 },
];

// 회원가입 — 선호 스타일. 대표 이미지는 빈칸(img:null)으로 두고 추후 교체.
// img 에 경로를 넣으면 자동으로 placeholder 대신 사진이 표시됩니다.
// 무드(선호 스타일) — 사람들이 많이 찾는 순으로 위에서부터 나열.
const STYLES = [
  { id: 'casual',  name: '캐주얼',   en: 'CASUAL',    desc: '편안한 데일리 무드',       img: R('styleCasual', 'app/img/style-casual.png') },
  { id: 'minimal', name: '미니멀',   en: 'MINIMAL',   desc: '군더더기 없는 기본기',     img: R('styleMinimal', 'app/img/style-minimal.png') },
  { id: 'street',  name: '스트릿',   en: 'STREET',    desc: '자유로운 시티 무드',       img: R('styleStreet', 'app/img/style-street.png') },
  { id: 'chic',    name: '시크',     en: 'CHIC',      desc: '모던하고 절제된',           img: R('styleChic', 'app/img/style-chic.png') },
  { id: 'dandy',   name: '댄디',     en: 'DANDY',     desc: '단정한 클래식 신사',       img: R('styleDandy', 'app/img/style-dandy.png') },
  { id: 'sporty',  name: '스포티',   en: 'SPORTY',    desc: '활동적이고 가벼운',         img: R('styleSporty', 'app/img/style-sporty.png') },
  { id: 'classic', name: '클래식',   en: 'CLASSIC',   desc: '격식 있는 정통',             img: R('styleClassic', 'app/img/style-classic.png') },
  { id: 'amekaji', name: '아메카지', en: 'AMEKAJI',   desc: '빈티지 워크웨어',           img: R('styleAmekaji', 'app/img/style-amekaji.png') },
  { id: 'gorpcore', name: '고프코어', en: 'GORPCORE', desc: '기능적인 아웃도어 무드',   img: R('styleGorpcore', 'app/img/style-gorpcore.png') },
  { id: 'hiphop',  name: '힙합',     en: 'HIPHOP',    desc: '자유분방한 힙합 무드',     img: R('styleHiphop', 'app/img/style-hiphop.png') },
  { id: 'y2k',     name: 'Y2K',      en: 'Y2K',       desc: '과감한 2000년대 무드',     img: R('styleY2k', 'app/img/style-y2k.png') },
  { id: 'preppy',  name: '프레피',   en: 'PREPPY',    desc: '단정한 캠퍼스 무드',       img: R('stylePreppy', 'app/img/style-preppy.png') },
];

// 선호 핏 · 선호 컬러 (옷 추천에 사용)
const FITS = ['슬림', '레귤러', '오버핏', '상관없음'];
const PALETTE = [
  { id: 'mono',    name: '모노톤',     swatch: ['#1A1A1A', '#8A857C', '#FFFFFF'] },
  { id: 'earth',   name: '어스톤',     swatch: ['#7C6748', '#A98C5A', '#D8C7A6'] },
  { id: 'navy',    name: '네이비·블루', swatch: ['#1F2A44', '#3E5A86', '#9FB4D4'] },
  { id: 'warm',    name: '웜 뉴트럴',   swatch: ['#B0573C', '#D49A6A', '#EAD9C4'] },
  { id: 'fresh',   name: '프레시',     swatch: ['#1F6B4F', '#5FA17C', '#CFE3D3'] },
  { id: 'vivid',   name: '비비드',     swatch: ['#B0573C', '#2C5FA8', '#C9A227'] },
];

// 퍼스널 컴러 (4계절) — 쟘 모르면 진단 팝업으로 안내
const PERSONAL_COLORS = [
  { id: 'spring', name: '봄 웜',   sub: 'Spring Warm', swatch: ['#FF8C69', '#FFD25A', '#9DCB6A'] },
  { id: 'summer', name: '여름 쿨', sub: 'Summer Cool', swatch: ['#C9A2C8', '#E8A0B0', '#A8C4DE'] },
  { id: 'autumn', name: '가을 웜', sub: 'Autumn Warm', swatch: ['#C18A3D', '#A8503A', '#7B7A3A'] },
  { id: 'winter', name: '겨울 쿨', sub: 'Winter Cool', swatch: ['#C0246B', '#1F2A57', '#3FA7C9'] },
];

const DEFAULT_PREFS = {
  email: '', gender: '', age: '', styles: [], fit: '', palettes: [], personalColor: '', pcDiagnosed: false,
  dailyEnabled: false, // 오늘의 추천 코디 — 비용 때문에 기본 off, 마이페이지에서 허용
};

Object.assign(window, { LB_DATA: { CATEGORIES, WARDROBE, ANCHOR, ALL, OUTFITS, DAILY, WEATHER, OUTFIT_BY_ID, SAVED, IMG, DETECT, STYLES, FITS, PALETTE, PERSONAL_COLORS, DEFAULT_PREFS } });


/* @prototype-ported: real-service start = empty user content */
Object.assign(window.LB_DATA, {
  WARDROBE: [], OUTFITS: [], DAILY: [], SAVED: [], DETECT: [],
  ALL: {}, OUTFIT_BY_ID: {},
});
Object.assign(window.LB_DATA.ANCHOR, { name: '', category: '', color: '', img: null });
