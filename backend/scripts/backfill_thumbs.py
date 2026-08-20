"""기존 아이템에 목록용 썸네일(360px WebP)을 만들어 붙인다.

옷장 그리드는 한 칸이 140~200px인데 지금까지 1024px 원본을 그대로 내려받았다.
아이템이 늘수록 첫 화면이 느려지는 가장 큰 원인이라, 이미 담긴 옷에도 썸네일을 만들어 둔다.
AI를 쓰지 않으므로 비용은 없고, 스토리지만 아이템당 5~10KB 늘어난다.

    .venv/bin/python scripts/backfill_thumbs.py <이메일> [--limit N] [--dry-run]
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
    ap.add_argument("--limit", type=int, default=500)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    uid = find_user(args.email)
    rows = (
        m.supabase_admin.table("wardrobe_items")
        .select("id,name,storage_path,image_url,metadata,status")
        .eq("user_id", uid)
        .neq("status", "deleted")
        .execute()
        .data
        or []
    )
    targets = [r for r in rows if r.get("storage_path") and not (r.get("metadata") or {}).get("thumb_url")]
    targets = targets[: args.limit]
    print(f"{args.email}: 아이템 {len(rows)}개 중 썸네일 없는 것 {len(targets)}개")
    if args.dry_run or not targets:
        return

    total_before = 0
    total_after = 0

    def work(row: dict) -> tuple[dict, str, int, int]:
        try:
            raw = m.supabase_admin.storage.from_(m.SUPABASE_BUCKET).download(row["storage_path"])
        except Exception as exc:  # noqa: BLE001
            print(f"  x {row['name'][:28]} — 원본을 못 읽음 ({exc})")
            return row, "", 0, 0
        thumb = m.make_thumb(raw)
        if not thumb:
            return row, "", len(raw), 0
        path = row["storage_path"].rsplit(".", 1)[0] + "_t.webp"
        try:
            url = m.upload_bytes(path, thumb, "image/webp")
        except Exception as exc:  # noqa: BLE001
            print(f"  x {row['name'][:28]} — 업로드 실패 ({exc})")
            return row, "", len(raw), 0
        return row, url, len(raw), len(thumb)

    done = 0
    with ThreadPoolExecutor(max_workers=6) as pool:
        for row, url, before, after in pool.map(work, targets):
            total_before += before
            total_after += after
            if not url:
                continue
            meta = dict(row.get("metadata") or {})
            meta["thumb_url"] = url
            m.supabase_admin.table("wardrobe_items").update({"metadata": meta}).eq("id", row["id"]).eq("user_id", uid).execute()
            done += 1
            print(f"  o {row['name'][:34]:36s} {before / 1024:6.0f}KB → {after / 1024:5.0f}KB")
    if total_before:
        print(f"완료: {done}/{len(targets)} · 목록 전송량 {total_before / 1024 / 1024:.1f}MB → {total_after / 1024 / 1024:.1f}MB")


if __name__ == "__main__":
    main()
