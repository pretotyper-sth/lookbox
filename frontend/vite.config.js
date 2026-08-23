import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// 마이페이지 맨 아래에 쓰는 배포일. 커밋 해시(6e6…)는 사용자에게 필요 없다.
const _built = new Date()
const BUILD_DATE = `${_built.getFullYear()}년 ${_built.getMonth() + 1}월 ${_built.getDate()}일`

export default defineConfig({
  define: { __BUILD_DATE__: JSON.stringify(BUILD_DATE) },
  // 프로토 모듈은 classic React(React.createElement)용으로 작성됐고 각 파일이
  // const React = window.React 를 갖는다. classic 런타임을 쓰면 automatic 런타임이
  // dev에서 방출하던 require("react/jsx-dev-runtime")가 사라져 빈 화면 버그가 해결된다.
  plugins: [react({ jsxRuntime: 'classic' })],
})
