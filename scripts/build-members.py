from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IMAGES_DIR = ROOT / "images"
OUTPUT = ROOT / "data" / "members.json"
SUPPORTED = {".png", ".jpg", ".jpeg", ".webp"}


def parse_member(path: Path) -> dict | None:
    stem = path.stem
    if "_" not in stem:
        print(f"skip: {path.name} (expected: 名前_名前英語.ext)")
        return None

    name, name_en = (part.strip() for part in stem.split("_", 1))
    if not name or not name_en:
        print(f"skip: {path.name} (name or English name is empty)")
        return None

    relative_path = path.relative_to(ROOT).as_posix()
    return {
        "id": path.name,
        "name": name,
        "nameEn": name_en,
        "photo": relative_path,
        "filename": path.name,
        "badgeText": "",
        "bandColor": "",
    }


def main() -> None:
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    members = []
    for path in sorted(IMAGES_DIR.iterdir(), key=lambda p: p.name.casefold()):
        if not path.is_file() or path.suffix.lower() not in SUPPORTED:
            continue
        member = parse_member(path)
        if member:
            members.append(member)

    payload = {
        "version": 1,
        "generatedFrom": "images/*",
        "filenameRule": "名前_名前英語.ext",
        "members": members,
    }
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"generated {OUTPUT.relative_to(ROOT)}: {len(members)} member(s)")


if __name__ == "__main__":
    main()
