"""Generate LOOKBOX onboarding mood images.

Creates one reference lookbook shot (one man + one woman) and then edits it into
eight mood variants, keeping models, background, lighting and framing consistent.

Run from repo root:
  uv run --with openai --with pillow python backend/scripts/gen_mood_images.py
"""
import base64
import io
import os
import sys
from pathlib import Path

from openai import OpenAI

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "public" / "prototype-assets"
ENV = ROOT / ".env"


def load_env() -> None:
    if not ENV.exists():
        return
    for line in ENV.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


SIZE = "1024x1536"

REFERENCE_PROMPT = (
    "Full-body fashion lookbook photo. One Korean man on the left and one Korean "
    "woman on the right, standing side by side, facing the camera. Uniform warm "
    "greige background (#EFEDE8), soft even studio lighting, subtle floor shadow. "
    "Neutral minimal everyday outfits. Natural relaxed pose, full body visible from "
    "head to shoes. Editorial catalog style, no text, no logo, no props. Vertical "
    "4:5 framing."
)

MOODS = [
    ("minimal", "미니멀: 무채색 위주의 군더더기 없는 기본 착장, 깔끔한 실루엣"),
    ("casual", "캐주얼: 편안한 데일리 무드, 티셔츠와 데님 등 자연스러운 조합"),
    ("sporty", "스포티: 활동적이고 가벼운 애슬레저 착장, 운동화"),
    ("amekaji", "아메카지: 빈티지 워크웨어 무드, 데님과 워크재킷, 부츠"),
    ("dandy", "댄디: 단정한 클래식 신사 착장, 재킷과 슬랙스"),
    ("street", "스트릿: 자유로운 시티 무드, 오버사이즈와 캡"),
    ("chic", "시크: 모던하고 절제된 톤온톤 착장"),
    ("classic", "클래식: 격식 있는 정통 착장, 코트와 셔츠"),
]


def main() -> int:
    load_env()
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("OPENAI_API_KEY missing")
        return 1
    model = os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-1")
    quality = os.environ.get("OPENAI_IMAGE_QUALITY", "medium")
    client = OpenAI(api_key=api_key)
    OUT.mkdir(parents=True, exist_ok=True)

    print(f"[mood] reference shot via {model} ({SIZE}, {quality})", flush=True)
    ref = client.images.generate(model=model, prompt=REFERENCE_PROMPT, size=SIZE, quality=quality)
    ref_bytes = base64.b64decode(ref.data[0].b64_json)
    (OUT / "mood-reference.png").write_bytes(ref_bytes)

    for mood_id, desc in MOODS:
        buf = io.BytesIO(ref_bytes)
        buf.name = "reference.png"
        prompt = (
            "Keep the same two models (one man, one woman), same faces, same pose, "
            "same background, same lighting and same full-body framing as the source "
            f"image. Only change their outfits to this Korean fashion mood — {desc}. "
            "Editorial catalog style, uniform warm greige background (#EFEDE8), no text, "
            "no logo, no props. Vertical 4:5 framing."
        )
        print(f"[mood] {mood_id}", flush=True)
        res = client.images.edit(model=model, image=buf, prompt=prompt, size=SIZE, quality=quality)
        data = base64.b64decode(res.data[0].b64_json)
        (OUT / f"mood-{mood_id}.png").write_bytes(data)

    print("[mood] done", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
