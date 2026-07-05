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
        # combo-gate prompt copy: concrete + single line on mobile
        (
            "          <p style={{ margin: '14px 0 0', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>옷을 3벌 이상 담으면 조합을 추천받을 수 있어요</p>\n",
            "          <p style={{ margin: '14px 0 0', fontSize: 13, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>상의·하의·신발 등 3벌만 모으면 돼요</p>\n",
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
