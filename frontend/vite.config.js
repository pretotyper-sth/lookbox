import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// 배포된 빌드를 기기에서 눈으로 확인할 수 있게 커밋·시각을 심는다. '업데이트가 안 보인다'가
// 캐시 문제인지 배포 문제인지, 마이페이지 맨 아래 한 줄만 보면 갈린다.
const BUILD_ID = [
  (process.env.VERCEL_GIT_COMMIT_SHA || 'local').slice(0, 7),
  new Date().toISOString().slice(0, 16).replace('T', ' '),
].join(' · ')

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  // 프로토 모듈은 classic React(React.createElement)용으로 작성됐고 각 파일이
  // const React = window.React 를 갖는다. classic 런타임을 쓰면 automatic 런타임이
  // dev에서 방출하던 require("react/jsx-dev-runtime")가 사라져 빈 화면 버그가 해결된다.
  plugins: [react({ jsxRuntime: 'classic' })],
})
