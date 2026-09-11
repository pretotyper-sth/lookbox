#!/usr/bin/env node
/**
 * RealCloset 구매내역 수집기 — 내 PC의 크롬을 그대로 띄워, 내가 로그인한 쇼핑몰의
 * 구매내역에서 '상품 목록'만 긁어 온다.
 *
 *   로그인은 사람이 직접 한다. 이 스크립트는 아이디·비밀번호를 묻지도, 저장하지도 않는다.
 *   로그인 상태는 전용 크롬 프로필(~/.lookbox-collector)에 남아 다음 실행 때 재사용된다.
 *
 * 쓰는 법:
 *   npm i                      # 처음 한 번
 *   npm run collect            # 플랫폼 골라서 수집
 *   npm run collect -- --all   # 등록된 플랫폼 전부
 *   npm run collect -- --platform musinsa,29cm
 *
 * 결과: orders.json + 클립보드용 한 줄 JSON. RealCloset '아이템 추가 → URL' 칸에 붙여넣으면
 * 후보 목록이 뜨고, 고른 것만 자동으로 이미지 추출·등록된다.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { PLATFORMS, byId } from './platforms.mjs';
import { PAGE_EXTRACTOR, PAGE_EXPAND } from './extract.mjs';

const PROFILE_DIR = path.join(os.homedir(), '.lookbox-collector', 'chrome');
const OUT = process.env.REALCLOSET_OUT || process.env.LOOKBOX_OUT || path.join(process.cwd(), 'orders.json');

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.split('=').slice(1).join('=');
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : '';
};
const AUTO = flag('stdout') || flag('json');
const EMBED = flag('embed');
const VIEW_W = Math.max(280, parseInt(opt('width') || '384', 10) || 384);
const VIEW_H = Math.max(320, parseInt(opt('height') || '520', 10) || 520);
const LOGIN_WAIT_MS = Math.max(15_000, parseInt(opt('login-wait') || '180000', 10) || 180_000);
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36';

const step = (key) => {
  if (AUTO) process.stderr.write(`STEP ${key}\n`);
};

const rl = () => readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => { const r = rl(); r.question(q, (a) => { r.close(); res(a.trim()); }); });

async function pickPlatforms() {
  if (flag('all')) return PLATFORMS;
  const named = (opt('platform') || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (named.length) {
    const picked = named.map(byId).filter(Boolean);
    if (!picked.length) throw new Error(`모르는 플랫폼: ${named.join(', ')}`);
    return picked;
  }
  console.log('\n어느 쇼핑몰의 구매내역을 가져올까요? (번호를 쉼표로, 엔터만 누르면 전부)\n');
  PLATFORMS.forEach((p, i) => console.log(`  ${String(i + 1).padStart(2)}. ${p.name}`));
  const answer = await ask('\n번호: ');
  if (!answer) return PLATFORMS;
  const idx = answer.split(',').map((s) => parseInt(s.trim(), 10) - 1).filter((n) => n >= 0 && n < PLATFORMS.length);
  return idx.length ? idx.map((i) => PLATFORMS[i]) : PLATFORMS;
}

const looksLoggedOut = async (page) => {
  const url = page.url().toLowerCase();
  if (/login|signin|auth|member\/login/.test(url)) return true;
  const body = ((await page.locator('body').innerText().catch(() => '')) || '').slice(0, 400);
  return /로그인이 필요|로그인 해주세요|로그인하세요|로그인 후 이용/.test(body);
};

const startLoginBootstrap = async (page, platform) => {
  if (!platform.bootstrapUrl) return false;
  try {
    await page.goto(platform.bootstrapUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    const login = page.locator('a[href*="login.coupang.com/login/login.pang"]').first();
    if (!(await login.count())) return false;
    await login.click();
    await page.waitForTimeout(800);
    return true;
  } catch {
    return false;
  }
};

async function collectFrom(page, platform) {
  const found = [];
  if (await startLoginBootstrap(page, platform)) {
    console.log(`\n  → ${platform.name}: 로그인이 필요해요. 열려 있는 창에서 직접 로그인해 주세요.`);
    await ask('     로그인하고 구매내역이 보이면 Enter: ');
  }
  for (const url of platform.urls) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    } catch { continue; }
    await page.waitForTimeout(1500);
    if (await looksLoggedOut(page)) {
      console.log(`\n  → ${platform.name}: 로그인이 필요해요. 열려 있는 창에서 직접 로그인해 주세요.`);
      await ask('     로그인하고 구매내역이 보이면 Enter: ');
    }
    await page.evaluate(PAGE_EXPAND).catch(() => {});
    const items = await page.evaluate(PAGE_EXTRACTOR).catch(() => []);
    if (items.length) { found.push(...items); break; }
  }
  if (!found.length) {
    console.log(`\n  → ${platform.name}: 이 주소에서 주문 목록을 못 찾았어요.`);
    console.log('     열려 있는 창에서 직접 구매내역 페이지로 이동한 뒤 Enter를 누르면 그 화면에서 가져옵니다.');
    const skip = await ask('     Enter(가져오기) / s(건너뛰기): ');
    if (skip.toLowerCase() === 's') return [];
    await page.evaluate(PAGE_EXPAND).catch(() => {});
    found.push(...(await page.evaluate(PAGE_EXTRACTOR).catch(() => [])));
  }
  return found.map((it) => ({ ...it, platform: platform.name }));
}

const waitUntilLoggedIn = async (page, ms) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (!(await looksLoggedOut(page))) return true;
    await page.waitForTimeout(1200);
  }
  return false;
};

const emitItem = (it) => {
  if (AUTO) process.stderr.write(`ITEM ${JSON.stringify(it)}\n`);
};

async function collectFromAuto(page, platform) {
  const found = [];
  if (await startLoginBootstrap(page, platform)) {
    step('need_login');
    const ok = await waitUntilLoggedIn(page, LOGIN_WAIT_MS);
    if (!ok) {
      const err = new Error('NEED_LOGIN');
      err.code = 'NEED_LOGIN';
      throw err;
    }
  }
  for (const url of platform.urls) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    } catch {
      continue;
    }
    await page.waitForTimeout(1200);
    if (await looksLoggedOut(page)) {
      step('need_login');
      const ok = await waitUntilLoggedIn(page, LOGIN_WAIT_MS);
      if (!ok) {
        const err = new Error('NEED_LOGIN');
        err.code = 'NEED_LOGIN';
        throw err;
      }
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      } catch { /* 지금 페이지가 주문내역이면 그대로 둔다 */ }
      await page.waitForTimeout(800);
    }
    step('orders_ready');
    step('collect');
    await page.evaluate(PAGE_EXPAND).catch(() => {});
    const items = await page.evaluate(PAGE_EXTRACTOR).catch(() => []);
    if (items.length) {
      for (const it of items) {
        const row = { ...it, platform: platform.name };
        found.push(row);
        emitItem(row);
        await page.waitForTimeout(90);
      }
      break;
    }
  }
  return found;
}

async function applyEmbedCmd(getPage, cmd, cdp) {
  const page = getPage();
  if (!page || !cmd || !cmd.t) return;
  if (cmd.t === 'close') {
    await page.context().close().catch(() => {});
    process.exit(0);
  }
  if (cmd.t === 'click') await page.mouse.click(Number(cmd.x) || 0, Number(cmd.y) || 0);
  if (cmd.t === 'type' && cmd.text) await page.keyboard.insertText(String(cmd.text));
  if (cmd.t === 'key' && cmd.key) await page.keyboard.press(String(cmd.key));
  if (cmd.t === 'scroll') {
    const x = Number.isFinite(Number(cmd.x)) ? Number(cmd.x) : VIEW_W / 2;
    const y = Number.isFinite(Number(cmd.y)) ? Number(cmd.y) : VIEW_H / 2;
    const dx = Number(cmd.dx) || 0;
    const dy = Number(cmd.dy) || 0;
    if (cdp) {
      await cdp.send('Input.dispatchMouseEvent', {
        type: 'mouseWheel',
        x,
        y,
        deltaX: dx,
        deltaY: dy,
      });
    } else {
      await page.mouse.move(x, y).catch(() => {});
      await page.mouse.wheel(dx, dy);
    }
  }
  if (cmd.t === 'zoom') {
    const cur = await page.evaluate(() => {
      const z = document.documentElement.style.zoom;
      return z ? parseFloat(z) : 1;
    }).catch(() => 1);
    const next = Math.min(2.4, Math.max(1, (cur || 1) * (Number(cmd.scale) || 1)));
    await page.evaluate((z) => {
      document.documentElement.style.zoom = String(z);
    }, next).catch(() => {});
  }
}

function startEmbedServer(getPage, getCdp) {
  let lastJpeg = Buffer.alloc(0);
  const clients = new Set();
  const pushFrame = (b64) => {
    let buf;
    try { buf = Buffer.from(b64, 'base64'); } catch { return; }
    if (!buf.length) return;
    lastJpeg = buf;
    for (const res of clients) {
      try {
        res.write(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${buf.length}\r\n\r\n`);
        res.write(buf);
        res.write('\r\n');
      } catch {
        clients.delete(res);
      }
    }
  };
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'content-type');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    const pathName = String(req.url || '').split('?')[0];
    if (pathName === '/stream') {
      res.writeHead(200, {
        'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Connection: 'keep-alive',
      });
      if (lastJpeg.length) {
        res.write(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${lastJpeg.length}\r\n\r\n`);
        res.write(lastJpeg);
        res.write('\r\n');
      }
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    if (pathName === '/frame.jpg') {
      res.writeHead(200, {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'no-store',
      });
      res.end(lastJpeg);
      return;
    }
    if (pathName === '/meta') {
      const page = getPage();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ url: page ? page.url() : '', w: VIEW_W, h: VIEW_H }));
      return;
    }
    if (pathName === '/input' && req.method === 'POST') {
      let raw = '';
      req.on('data', (c) => { raw += c; });
      req.on('end', async () => {
        try { await applyEmbedCmd(getPage, JSON.parse(raw || '{}'), getCdp()); } catch { /* 한 입력 실패는 무시 */ }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });
      return;
    }
    res.writeHead(404);
    res.end();
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      process.stderr.write(`EMBED http://127.0.0.1:${port}\n`);
      resolve({
        pushFrame,
        close: () => {
          for (const res of clients) {
            try { res.end(); } catch { /* already closed */ }
          }
          clients.clear();
          server.close();
        },
      });
    });
  });
}

async function attachScreencast(page, pushFrame) {
  const client = await page.context().newCDPSession(page);
  await client.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 58,
    maxWidth: VIEW_W,
    maxHeight: VIEW_H,
    everyNthFrame: 2,
  });
  client.on('Page.screencastFrame', async (frame) => {
    if (pushFrame) pushFrame(frame.data);
    await client.send('Page.screencastFrameAck', { sessionId: frame.sessionId }).catch(() => {});
  });
  await page.evaluate(() => {
    if (!document.documentElement.style.zoom) document.documentElement.style.zoom = '1.2';
  }).catch(() => {});
  return client;
}

function listenEmbedInput(getPage, getCdp) {
  const rlIn = readline.createInterface({ input: process.stdin });
  rlIn.on('line', async (line) => {
    try { await applyEmbedCmd(getPage, JSON.parse(line), getCdp()); } catch { /* 한 입력 실패는 무시 */ }
  });
}

(async () => {
  const platforms = AUTO ? await (async () => {
    const named = (opt('platform') || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!named.length) throw new Error('AUTO 모드는 --platform=musinsa 처럼 쇼핑몰을 지정해야 해요');
    const picked = named.map(byId).filter(Boolean);
    if (!picked.length) throw new Error(`모르는 플랫폼: ${named.join(', ')}`);
    return picked;
  })() : await pickPlatforms();
  fs.mkdirSync(PROFILE_DIR, { recursive: true });
  if (!AUTO) {
    console.log('\n크롬을 띄웁니다. 로그인은 직접 해주세요 — 아이디·비밀번호는 저장하지 않습니다.');
    console.log(`(로그인 상태만 ${PROFILE_DIR} 에 남아 다음 실행에 재사용됩니다)\n`);
  }
  step('open');

  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    channel: 'chrome',
    headless: EMBED,
    viewport: EMBED ? { width: VIEW_W, height: VIEW_H } : null,
    userAgent: EMBED ? (platforms.length === 1 && platforms[0].desktopUa ? DESKTOP_UA : IPHONE_UA) : undefined,
    isMobile: EMBED && !(platforms.length === 1 && platforms[0].desktopUa),
    hasTouch: EMBED && !(platforms.length === 1 && platforms[0].desktopUa),
    args: EMBED ? ['--headless=new'] : ['--start-maximized'],
  });
  let page = ctx.pages()[0] || (await ctx.newPage());
  let embedCdp = null;
  let embedHub = null;
  if (EMBED) {
    await ctx.addInitScript(() => {
      const apply = () => {
        if (!document.documentElement.style.zoom) document.documentElement.style.zoom = '1.2';
      };
      apply();
      document.addEventListener('DOMContentLoaded', apply);
    });
    embedHub = await startEmbedServer(() => page, () => embedCdp);
    embedCdp = await attachScreencast(page, embedHub.pushFrame);
    page.on('load', () => {
      page.evaluate(() => {
        if (!document.documentElement.style.zoom) document.documentElement.style.zoom = '1.2';
      }).catch(() => {});
    });
    ctx.on('page', async (p) => {
      page = p;
      embedCdp = await attachScreencast(p, embedHub.pushFrame).catch(() => embedCdp);
      p.on('close', () => {
        const left = ctx.pages()[0];
        if (left) page = left;
      });
    });
    listenEmbedInput(() => page, () => embedCdp);
  }

  const all = [];
  for (const p of platforms) {
    if (!AUTO) console.log(`\n■ ${p.name}`);
    const items = AUTO ? await collectFromAuto(page, p) : await collectFrom(page, p);
    if (!AUTO) console.log(`  ${items.length}개 수집`);
    all.push(...items);
  }

  // 같은 상품 URL은 한 번만
  const seen = new Set();
  const items = all.filter((it) => {
    const key = it.url.split('#')[0];
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const payload = { lookbox: 'orders', version: 1, collectedAt: new Date().toISOString(), items };
  if (AUTO) {
    process.stdout.write(JSON.stringify(payload));
  } else {
    fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));
    console.log(`\n총 ${items.length}개를 모았어요 → ${OUT}`);
    items.slice(0, 40).forEach((it) => {
      console.log(`  · [${it.platform}] ${it.name.slice(0, 46)}${it.price ? ` (${it.price})` : ''}`);
    });
    if (items.length > 40) console.log(`  … 외 ${items.length - 40}개`);
    const oneLine = JSON.stringify(payload);
    try {
      const { execSync } = await import('node:child_process');
      if (process.platform === 'darwin') { execSync('pbcopy', { input: oneLine }); console.log('\n클립보드에 복사했어요.'); }
    } catch { /* 클립보드 실패는 무시 — 파일이 있다 */ }
    console.log('RealCloset에서 [아이템 추가 → URL] 칸에 붙여넣으면 고를 수 있어요.\n');
  }

  if (!flag('keep-open')) {
    if (embedHub) embedHub.close();
    await ctx.close();
  }
})().catch((e) => {
  if (e && (e.code === 'NEED_LOGIN' || e.message === 'NEED_LOGIN')) {
    process.stderr.write('STEP need_login\n');
    process.exit(2);
  }
  if (AUTO) process.stderr.write(`FAIL ${e.message}\n`);
  else console.error('\n실패:', e.message);
  process.exit(1);
});
