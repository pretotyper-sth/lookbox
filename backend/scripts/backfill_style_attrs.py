"""옷장에 이미 담긴 아이템의 숨은 스타일 속성을 사진 기준으로 다시 채운다.

코디 추천은 metadata.style(핏·소재·격식·톤·무드)을 보고 조합을 짠다. 새로 담는
아이템은 분류(비전) 호출에서 같이 받지만, 이전에 담아둔 것들은 이름 기반 추론뿐이라
'카고 포켓'처럼 이름에 안 적힌 성격을 놓친다. 이 스크립트는 저장된 사진을 다시 보고
정확한 값으로 덮는다 (아이템당 비전 1회, gpt-4o 기준 약 $0.005).

사용법:
    .venv/bin/python scripts/backfill_style_attrs.py <이메일> [--limit N] [--all] [--dry-run]

기본은 style이 없거나 이름 기반(style_source=name)인 아이템만. --all은 전부 다시 본다.
"""

import argparse
import os
import sys
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

from app import main as m  # noqa: E402


def find_user(email: str) -> str:
    page = 1
    while page <= 20:
        res = m.supabase_admin.auth.admin.list_users(page=page, per_page=200)
        users = res if isinstance(res, list) else getattr(res, "users", [])
        if not users:
            break
        for u in users:
            if (getattr(u, "email", "") or "").lower() == email.lower():
                return u.id
        page += 1
    raise SystemExit(f"계정을 찾지 못했어요: {email}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("email")
    ap.add_argument("--limit", type=int, default=200)
    ap.add_argument("--all", action="store_true", help="이미 사진 기준으로 채운 것도 다시 본다")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    uid = find_user(args.email)
    rows = (
        m.supabase_admin.table("wardrobe_items")
        .select("id,name,category,color,image_url,metadata,status")
        .eq("user_id", uid)
        .neq("status", "deleted")
        .order("created_at", desc=True)
        .execute()
        .data
        or []
    )
    targets = []
    for row in rows:
        meta = row.get("metadata") or {}
        style = meta.get("style") if isinstance(meta.get("style"), dict) else {}
        source = meta.get("style_source")
        if args.all or not style or source == "name":
            if row.get("image_url"):
                targets.append(row)
    targets = targets[: args.limit]
    print(f"{args.email}: 아이템 {len(rows)}개 중 {len(targets)}개 대상")
    if args.dry_run or not targets:
        for row in targets[:10]:
            print("  -", row["name"])
        return

    def work(row: dict) -> tuple[dict, dict]:
        attrs = m.style_attrs_from_image(
            row["image_url"], row.get("name") or "", row.get("category") or "", row.get("color") or "", uid
        )
        return row, attrs

    done = 0
    with ThreadPoolExecutor(max_workers=6) as pool:
        for row, attrs in pool.map(work, targets):
            if not attrs:
                print(f"  x {row['name'][:34]} — 속성을 얻지 못함")
                continue
            meta = dict(row.get("metadata") or {})
            meta["style"] = attrs
            meta["style_source"] = "image"
            (
                m.supabase_admin.table("wardrobe_items")
                .update({"metadata": meta})
                .eq("id", row["id"])
                .eq("user_id", uid)
                .execute()
            )
            done += 1
            print(
                f"  o {row['name'][:34]:36s} {attrs.get('subtype','-'):12s} "
                f"fit={attrs.get('fit','-'):9s} mat={attrs.get('material','-'):9s} "
                f"form={attrs.get('formality','-')} tone={attrs.get('tone','-')}/{attrs.get('depth','-')} "
                f"styles={','.join(attrs.get('styles', []))}"
            )
    print(f"완료: {done}/{len(targets)}")


if __name__ == "__main__":
    main()
