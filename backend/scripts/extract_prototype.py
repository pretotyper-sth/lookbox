"""Extract the LOOKBOX prototype bundle into Vite-friendly source.

Reads Prototype.live.html (original UI + our text/flow changes) and writes:
- frontend/src/proto/*.jsx   (each JS/JSX module, with a prelude that pulls the
  globals it declares in its `/* global ... */` banner from window)
- frontend/src/proto/proto.css (design tokens + layout css from the template)
- frontend/public/fonts/*     (Pretendard woff/woff2) + @font-face rewrite
- frontend/public/prototype-assets/* (garment/style pngs)
- frontend/src/proto/manifest.json (ordered module list + resource id map)
"""
import base64
import json
import gzip
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "Prototype.live.html"
PROTO = ROOT / "frontend" / "src" / "proto"
FONTS = ROOT / "frontend" / "public" / "fonts"
ASSETS = ROOT / "frontend" / "public" / "prototype-assets"

EXT_MAP = {"font/woff2": "woff2", "font/woff": "woff", "image/png": "png"}

# module uuid -> output filename (order matters, matches template script order)
ORDER = [
    ("01e2078d-1ed4-440a-9101-64a2d354c325", "01-tweaks.jsx"),
    ("e991c2f6-ec07-4a41-b09f-3edc8b6575cd", "02-shared.jsx"),
    ("2b5472e4-8500-4ae6-81b0-523ec77d2eb0", "03-data.jsx"),
    ("a62ca800-82c5-4860-8466-f27f4640fac3", "04-screens-ab.jsx"),
    ("a2f891ff-a248-421a-93e7-51c1191e4210", "05-screens-cde.jsx"),
    ("e7edcd11-0fc5-457c-8a12-76649a180287", "06-today.jsx"),
    ("221f2a8c-ea0f-4e3f-96c4-9fcb1c3d20ab", "07-onboarding.jsx"),
    ("c2d1a5bc-4942-4206-8de2-2dddb5a37e51", "08-mypage.jsx"),
    ("f61e4738-16df-466d-8f38-c961f49e4700", "09-app.jsx"),
]



def block(name, html):
    return re.search(r'<script type="__bundler/' + re.escape(name) + r'">\s*(.*?)\s*</script>', html, re.S)


def decode(entry):
    data = base64.b64decode(entry["data"])
    if entry.get("compressed"):
        data = gzip.decompress(data)
    return data


def module_text(entry):
    return decode(entry).decode("utf-8")


def registered_names(text):
    """Names each module publishes to window (Object.assign / window.X =)."""
    names = set()
    for body in re.findall(r"Object\.assign\(window,\s*\{(.*?)\}\)", text, re.S):
        for token in re.findall(r"([A-Za-z_$][\w$]*)\s*[:,}]", body + "}"):
            names.add(token)
    for token in re.findall(r"window\.([A-Za-z_$][\w$]*)\s*=", text):
        names.add(token)
    return names


def local_defs(text):
    defs = set(re.findall(r"function\s+([A-Za-z_$][\w$]*)", text))
    defs |= set(re.findall(r"const\s+([A-Za-z_$][\w$]*)\s*=", text))
    return defs


def build_prelude(text, registry):
    """Bind, from window, the globals a module needs.

    Combines the `/* global ... */` banner with any registered component/helper
    the module actually references, minus what it defines locally.
    """
    banner = set()
    m = re.search(r"/\*\s*global\s+([^*]+)\*/", text)
    if m:
        for raw in m.group(1).replace("\n", " ").split(","):
            token = raw.strip()
            if re.fullmatch(r"[A-Za-z_$][\w$]*", token or ""):
                banner.add(token)

    used = set(re.findall(r"<([A-Z][\w]*)", text))
    used |= set(re.findall(r"\b([A-Za-z_$][\w$]*)\s*\(", text))
    used |= set(re.findall(r"\b([A-Z][\w]*)\.", text))

    defined = local_defs(text)
    wanted = (banner | (used & registry)) - defined - {"React", "ReactDOM"}

    lines = ["/* @prototype-ported */"]
    if "React" in banner or re.search(r"\bReact\b", text):
        lines.append("const React = window.React;")
    if "ReactDOM" in banner or re.search(r"\bReactDOM\b", text):
        lines.append("const ReactDOM = window.ReactDOM;")
    if wanted:
        lines.append("const { " + ", ".join(sorted(wanted)) + " } = window;")
    return "\n".join(lines) + "\n\n"


def main():
    html = SRC.read_text()
    manifest = json.loads(block("manifest", html).group(1))
    PROTO.mkdir(parents=True, exist_ok=True)
    FONTS.mkdir(parents=True, exist_ok=True)
    ASSETS.mkdir(parents=True, exist_ok=True)

    # fonts: keep only woff2 to stay light
    for uuid, entry in manifest.items():
        if entry.get("mime") == "font/woff2":
            (FONTS / f"{uuid}.woff2").write_bytes(decode(entry))

    # images: use the exact bytes the given HTML mapped to each resource id
    ext = json.loads(block("ext_resources", html).group(1))
    resource_paths = {}
    for item in ext:
        rid, uuid = item["id"], item["uuid"]
        entry = manifest.get(uuid)
        if not entry:
            print("MISSING image", rid, uuid)
            continue
        (ASSETS / f"{rid}.png").write_bytes(decode(entry))
        resource_paths[rid] = f"/prototype-assets/{rid}.png"

    # css from template <style> blocks (skip the fixed #root overflow one at the end)
    template = json.loads(block("template", html).group(1))
    styles = re.findall(r"<style>(.*?)</style>", template, re.S)
    css_parts = []
    for style in styles:
        css = style
        # rewrite woff2 url("uuid") -> url(/fonts/uuid.woff2)
        for uuid, entry in manifest.items():
            if entry.get("mime") == "font/woff2":
                css = css.replace(f'url("{uuid}")', f"url(/fonts/{uuid}.woff2)")
        # drop the now-missing woff fallbacks: , url("uuid") format('woff')
        css = re.sub(r",\s*url\(\"[0-9a-f-]+\"\)\s*format\('woff'\)", "", css)
        css_parts.append(css.strip())
    (PROTO / "proto.css").write_text("\n\n".join(css_parts) + "\n")

    # first pass: collect every name published to window across modules
    registry = set()
    texts = {}
    for uuid, out_name in ORDER:
        entry = manifest.get(uuid)
        if not entry:
            print("MISSING", uuid)
            continue
        texts[out_name] = module_text(entry)
        registry |= registered_names(texts[out_name])

    # This is a real service, not a demo: strip the prototype's sample user
    # content (wardrobe/outfits/saved/detect) so a fresh account starts empty.
    # Config-style data (categories, onboarding options, weather) is kept.
    data_reset = (
        "\n\n/* @prototype-ported: real-service start = empty user content */\n"
        "Object.assign(window.LB_DATA, {\n"
        "  WARDROBE: [], OUTFITS: [], DAILY: [], SAVED: [], DETECT: [],\n"
        "  ALL: {}, OUTFIT_BY_ID: {},\n"
        "});\n"
        "Object.assign(window.LB_DATA.ANCHOR, { name: '', category: '', color: '', img: null });\n"
    )

    # Post-extraction UX/text patches on top of the untouched prototype code.
    patches = {
        "09-app.jsx": [
            # combo gate: reachable even with an empty wardrobe (shows a prompt)
            (
                "  const startCombo = () => openAdd('anchor');\n",
                "  const startCombo = () => openAdd('anchor');\n"
                "  const comboReady = items.length >= 3;\n"
                "  const comboGate = () => {\n"
                "    if (comboReady) return startCombo();\n"
                "    showToast('옷을 3벌 이상 담으면 조합을 추천받을 수 있어요');\n"
                "    openAdd('wardrobe');\n"
                "  };\n",
            ),
            ("/> 오늘 코디", "/> 오늘의 추천 코디"),
            (
                "{items.length >= 3 && <Btn full icon=\"sparkle\" onClick={startCombo}>조합 추천받기</Btn>}",
                "<Btn full icon=\"sparkle\" variant={comboReady ? 'primary' : 'soft'} style={comboReady ? undefined : { opacity: 0.55 }} onClick={comboGate}>조합 추천받기</Btn>",
            ),
            (
                "    hasWardrobe: items.length >= 3,\n",
                "    hasWardrobe: items.length >= 3,\n    comboReady, comboGate,\n",
            ),
        ],
        "04-screens-ab.jsx": [
            (
                "  const { items, openAdd, startCombo, wide, openItem } = ctx;",
                "  const { items, openAdd, wide, openItem, comboReady, comboGate } = ctx;",
            ),
            (
                "paddingBottom: (ready && !wide) ? 110 : undefined",
                "paddingBottom: !wide ? 110 : undefined",
            ),
            (
                "      {ready && !wide && (\n"
                "        <div className=\"lb-cta-dock\">\n"
                "          <Btn full size=\"lg\" icon=\"sparkle\" onClick={startCombo}>구매 전 조합 추천받기</Btn>\n"
                "        </div>\n"
                "      )}",
                "      {!wide && (\n"
                "        <div className=\"lb-cta-dock\">\n"
                "          <Btn full size=\"lg\" icon=\"sparkle\" variant={comboReady ? 'primary' : 'soft'} style={comboReady ? undefined : { opacity: 0.6 }} onClick={comboGate}>구매 전 조합 추천받기</Btn>\n"
                "        </div>\n"
                "      )}",
            ),
        ],
    }

    # modules
    ported = []
    for _uuid, out_name in ORDER:
        text = texts.get(out_name)
        if text is None:
            continue
        prelude = build_prelude(text, registry)
        body = prelude + text
        if out_name == "03-data.jsx":
            body += data_reset
        for old, new in patches.get(out_name, []):
            if old not in body:
                raise SystemExit(f"patch anchor not found in {out_name}: {old[:60]!r}")
            body = body.replace(old, new, 1)
        (PROTO / out_name).write_text(body)
        ported.append(out_name)

    (PROTO / "manifest.json").write_text(
        json.dumps({"order": ported, "resources": resource_paths}, ensure_ascii=False, indent=2)
    )
    print("ported", ported)
    print("fonts", len(list(FONTS.glob("*"))))


if __name__ == "__main__":
    main()
