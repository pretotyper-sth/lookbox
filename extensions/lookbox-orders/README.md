# RealCloset 구매내역 확장

쇼핑몰 로그인을 작은 Chrome 팝업으로 열고, 로그인되면 주문내역으로 자동 이동한다.
찾은 상품은 RealCloset의 구매내역 모달에 한 개씩 전달하며 수집이 끝나면 팝업을 닫는다.
아이디·비밀번호는 읽거나 저장하지 않는다.

## 한 번만 연결

1. 크롬 주소창에 `chrome://extensions` 를 연다.
2. 오른쪽 위 **개발자 모드**를 켠다.
3. **압축해제된 확장 프로그램 로드** → 이 폴더(`extensions/lookbox-orders`)를 고른다.

RealCloset을 새로고침한 뒤 아이템 추가 → 구매내역 → 쇼핑몰 선택 → **주문 내역 가져오기**.

배포판은 이 폴더를 Manifest V3 확장으로 Chrome Web Store에 등록한다. 웹은 확장 설치 여부를
자동 확인하며, 설치되지 않았으면 설치 후 새로고침하라는 안내를 표시한다.

개인정보 처리방침: `https://realcloset.vercel.app/extension-privacy.html`
