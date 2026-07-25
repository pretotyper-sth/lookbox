import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // 프로토 모듈은 classic React(React.createElement)용으로 작성됐고 각 파일이
  // const React = window.React 를 갖는다. classic 런타임을 쓰면 automatic 런타임이
  // dev에서 방출하던 require("react/jsx-dev-runtime")가 사라져 빈 화면 버그가 해결된다.
  plugins: [react({ jsxRuntime: 'classic' })],
})
