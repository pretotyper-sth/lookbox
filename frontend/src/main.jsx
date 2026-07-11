import React from 'react'
import * as ReactDOM from 'react-dom/client'
import './proto/proto.css'
import protoManifest from './proto/manifest.json'
import { initLiveBridge } from './live-bridge.js'

// The prototype modules were written for an in-browser Babel runtime that shared
// one global scope. We expose React/ReactDOM/resources on window, then import the
// modules in their original order so each one can register itself on window and
// the final app-shell module can mount <App/>.
window.React = React
window.ReactDOM = ReactDOM
// Exact resource id -> image path map, extracted from the given prototype HTML.
window.__resources = protoManifest.resources

// Route the prototype's /api/live/* calls to the backend with an anon session.
// Non-blocking: installs the fetch bridge synchronously and warms the session in
// the background so we don't delay first paint on a network round trip.
initLiveBridge()

await import('./proto/01-tweaks.jsx')
await import('./proto/02-shared.jsx')
await import('./proto/03-data.jsx')
await import('./proto/04-screens-ab.jsx')
await import('./proto/05-screens-cde.jsx')
await import('./proto/06-today.jsx')
await import('./proto/07-onboarding.jsx')
await import('./proto/08-mypage.jsx')
await import('./proto/09-app.jsx')
