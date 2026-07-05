"""Post-extraction UI tweaks for the ported prototype.

Pipeline: run this to (1) regenerate the proto sources via extract_prototype.py
and (2) apply UI/text adjustments that sit on top of the extracted code.

Kept separate from extract_prototype.py so the tweaks are easy to review.
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PROTO = ROOT / "frontend" / "src" / "proto"
EXTRACT = Path(__file__).resolve().parent / "extract_prototype.py"

# file -> list of (old, new) exact replacements applied once each.
TWEAKS = {
    "09-app.jsx": [
        # combo-gate prompt: friendly explanation first, add button below
        (
            "        <div style={{ padding: '24px 24px 28px', textAlign: 'center' }}>\n"
            "          <Btn full size=\"lg\" icon=\"plus\" onClick={() => { setComboPrompt(false); go('wardrobe'); openAdd('wardrobe'); }}>옷 추가</Btn>\n"
            "          <p style={{ margin: '14px 0 0', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>옷을 3벌 이상 담으면 조합을 추천받을 수 있어요</p>\n"
            "        </div>\n",
            "        <div style={{ padding: '28px 24px 26px', textAlign: 'center' }}>\n"
            "          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>조합 추천을 받으려면 옷이 필요해요</h3>\n"
            "          <p style={{ margin: '8px 0 0', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55 }}>상의·하의·신발 등 옷을 3벌만 모으면<br />어울리는 조합을 추천해드려요.</p>\n"
            "          <div style={{ marginTop: 20 }}>\n"
            "            <Btn full size=\"lg\" icon=\"plus\" onClick={() => { setComboPrompt(false); go('wardrobe'); openAdd('wardrobe'); }}>옷 추가</Btn>\n"
            "          </div>\n"
            "        </div>\n",
        ),
        # sidebar order: 옷장 > 룩북 > 오늘의 추천 코디
        (
            "            <button className={'lb-navitem' + (tab === 'today' && !focused ? ' on' : '')} onClick={() => go('today')}>\n"
            "              <Icon name=\"sparkle\" size={20} fill={tab === 'today' && !focused ? 'currentColor' : 'none'} stroke={tab === 'today' && !focused ? 0 : 1.7} /> 오늘의 추천 코디\n"
            "            </button>\n"
            "            <button className={'lb-navitem' + (tab === 'lookbook' && !focused ? ' on' : '')} onClick={() => go('lookbook')}>\n"
            "              <Icon name=\"bookmark\" size={20} fill={tab === 'lookbook' && !focused ? 'currentColor' : 'none'} stroke={tab === 'lookbook' && !focused ? 0 : 1.7} /> 룩북\n"
            "            </button>\n",
            "            <button className={'lb-navitem' + (tab === 'lookbook' && !focused ? ' on' : '')} onClick={() => go('lookbook')}>\n"
            "              <Icon name=\"bookmark\" size={20} fill={tab === 'lookbook' && !focused ? 'currentColor' : 'none'} stroke={tab === 'lookbook' && !focused ? 0 : 1.7} /> 룩북\n"
            "            </button>\n"
            "            <button className={'lb-navitem' + (tab === 'today' && !focused ? ' on' : '')} onClick={() => go('today')}>\n"
            "              <Icon name=\"sparkle\" size={20} fill={tab === 'today' && !focused ? 'currentColor' : 'none'} stroke={tab === 'today' && !focused ? 0 : 1.7} /> 오늘의 추천 코디\n"
            "            </button>\n",
        ),
    ],
    "04-screens-ab.jsx": [
        # wardrobe empty copy: two lines, "구매 전"
        (
            "            가진 옷을 모아두면, 사기 전에 어울리는 조합을 미리 확인할 수 있어요.",
            "            가진 옷을 모아두면, 구매 전<br />어울리는 조합을 미리 확인할 수 있어요.",
        ),
        # register step: keep the extracted image fixed (category chip only
        # changes the tag), instead of falling back to a category silhouette
        (
            "<Thumb item={{ category: cur.cat, name: cur.name }} />",
            "<Thumb item={{ ...cur, category: cur.cat }} />",
        ),
        # prefill brand/store from URL imports (photo path unaffected)
        (
            "list.map((d) => ({ ...d, cat: d.category, draft: { brand: '', size: '', store: '', note: '' }, showDetails: !!autoAddDetails }))",
            "list.map((d) => ({ ...d, cat: d.category, draft: { brand: d.brand || '', size: '', store: d.store || '', note: '' }, showDetails: !!autoAddDetails || !!d.brand }))",
        ),
        (
            "q.map((d) => ({ ...d, cat: d.category, draft: { brand: '', size: '', store: '', note: '' }, showDetails: !!autoAddDetails }))",
            "q.map((d) => ({ ...d, cat: d.category, draft: { brand: d.brand || '', size: '', store: d.store || '', note: '' }, showDetails: !!autoAddDetails || !!d.brand }))",
        ),
    ],
    "05-screens-cde.jsx": [
        # lookbook: no desktop title (sidebar already shows it); mobile title
        # nudged slightly lower.
        (
            "        <TopBar left={<div style={{ fontWeight: 800, fontSize: 19 }}>룩북</div>} />",
            "        {!wide && <TopBar left={<div style={{ fontWeight: 800, fontSize: 19, marginTop: 4 }}>룩북</div>} />}",
        ),
        (
            "      {!wide && <TopBar left={<div style={{ fontWeight: 800, fontSize: 19 }}>룩북</div>} right={<span style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 600 }}>{saved.length}개</span>} />}",
            "      {!wide && <TopBar left={<div style={{ fontWeight: 800, fontSize: 19, marginTop: 4 }}>룩북</div>} right={<span style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 600 }}>{saved.length}개</span>} />}",
        ),
        (
            "        {wide && (\n"
            "          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>\n"
            "            <h1 style={{ margin: 0, fontSize: 25, fontWeight: 800 }}>룩북</h1>\n"
            "            <span style={{ fontSize: 13.5, color: 'var(--ink-3)', fontWeight: 600 }}>{saved.length}개</span>\n"
            "          </div>\n"
            "        )}\n",
            "",
        ),
        # empty lookbook: add an invisible spacer matching the other empty
        # screens' lock hint line so the icon/heading/button align vertically.
        (
            "          <div style={{ marginTop: 'var(--s7)', width: '100%', maxWidth: 280 }}>\n"
            "            <Btn full size=\"lg\" icon=\"sparkle\" onClick={startComboOrWardrobe}>{hasWardrobe ? '조합 추천받기' : '옷장 채우러 가기'}</Btn>\n"
            "          </div>\n",
            "          <div style={{ marginTop: 'var(--s7)', width: '100%', maxWidth: 280 }}>\n"
            "            <Btn full size=\"lg\" icon=\"sparkle\" onClick={startComboOrWardrobe}>{hasWardrobe ? '조합 추천받기' : '옷장 채우러 가기'}</Btn>\n"
            "          </div>\n"
            "          <div aria-hidden=\"true\" style={{ marginTop: 'var(--s4)', display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--ink-3)', fontSize: 12.5, visibility: 'hidden' }}>\n"
            "            <Icon name=\"lock\" size={14} /> 3벌부터 데일리 추천이 열려요\n"
            "          </div>\n",
        ),
    ],
    "06-today.jsx": [
        # locked-state copy: abbreviated, clean two lines on PC and mobile
        (
            "            옷장에 옷이 모이면, 매일 아침 가진 옷만으로 만든 코디를 추천해드려요.",
            "            옷장에 옷이 모이면,<br />가진 옷으로 매일 코디를 추천해요.",
        ),
    ],
}


def main() -> None:
    subprocess.run([sys.executable, str(EXTRACT)], check=True)
    for name, tweaks in TWEAKS.items():
        path = PROTO / name
        body = path.read_text()
        for old, new in tweaks:
            if old not in body:
                raise SystemExit(f"tweak anchor not found in {name}: {old[:60]!r}")
            body = body.replace(old, new, 1)
        path.write_text(body)
        print("patched", name)


if __name__ == "__main__":
    main()
