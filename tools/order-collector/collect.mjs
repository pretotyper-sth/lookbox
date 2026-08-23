#!/usr/bin/env node
/**
 * LOOKBOX 구매내역 수집기 — 내 PC의 크롬을 그대로 띄워, 내가 로그인한 쇼핑몰의
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
 * 결과: orders.json + 클립보드용 한 줄 JSON. LOOKBOX '아이템 추가 → URL' 칸에 붙여넣으면
 * 후보 목록이 뜨고, 고른 것만 자동으로 이미지 추출·등록된다.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { PLATFORMS, byId } from './platforms.mjs';
import { PAGE_EXTRACTOR, PAGE_EXPAND } from './extract.mjs';

const PROFILE_DIR = path.join(os.homedir(), '.lookbox-collector', 'chrome');
const OUT = process.env.LOOKBOX_OUT || path.join(process.cwd(), 'orders.json');

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.split('=').slice(1).join('=');
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : '';
};
const AUTO = flag('stdout') || flag('json');
const LOGIN_WAIT_MS = Math.max(15_000, parseInt(opt('login-wait') || '180000', 10) || 180_000);

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

async function collectFrom(page, platform) {
  const found = [];
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

async function collectFromAuto(page, platform) {
  const found = [];
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
    }
    step('collect');
    await page.evaluate(PAGE_EXPAND).catch(() => {});
    const items = await page.evaluate(PAGE_EXTRACTOR).catch(() => []);
    if (items.length) {
      found.push(...items);
      break;
    }
  }
  return found.map((it) => ({ ...it, platform: platform.name }));
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
    headless: false,
    viewport: null,
    args: ['--start-maximized'],
  });
  const page = ctx.pages()[0] || (await ctx.newPage());

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
    console.log('LOOKBOX에서 [아이템 추가 → URL] 칸에 붙여넣으면 고를 수 있어요.\n');
  }

  if (!flag('keep-open')) await ctx.close();
})().catch((e) => {
  if (e && (e.code === 'NEED_LOGIN' || e.message === 'NEED_LOGIN')) {
    process.stderr.write('STEP need_login\n');
    process.exit(2);
  }
  if (AUTO) process.stderr.write(`FAIL ${e.message}\n`);
  else console.error('\n실패:', e.message);
  process.exit(1);
});
