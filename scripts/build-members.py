from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IMAGES_DIR = ROOT / "images"
OUTPUT = ROOT / "data" / "members.json"
SUPPORTED = {".png", ".jpg", ".jpeg", ".webp"}

FOUNDER_VIP_NAMES = {
    "安藤 弘達",
    "日野 雄之",
    "平林 直",
    "犬塚 岳史",
    "神谷 正俊",
    "川合 仁",
    "川口 博文",
    "木原 直哉",
    "来住野 香子",
    "桑門 昌太郎",
    "松浦 崚",
    "三島 泰夫",
    "水谷 晋",
    "望月 正行",
    "二宮 幸浩",
    "西山 博",
    "小倉 裕二",
    "乙部 朱美",
    "斎藤 和弘",
    "武田 英希",
    "田中 浩",
    "山本 雅人",
    "柳 暢祐",
    "Benjamin Friesen",
}

STAFF_NAMES = {
    "柳 暢祐",
    "北野 雄大",
    "内藤 哲",
    "中村 泉美",
    "小台 百華",
    "田中 瑞樹",
    "渡辺 未来",
    "川口 博文",
    "グズマン 愛南",
    "吉田 宗弘",
}


def parse_member(path: Path) -> dict | None:
    stem = path.stem
    if "_" not in stem:
        print(f"skip: {path.name} (expected: 名前_名前英語.ext)")
        return None

    name, name_en = (part.strip() for part in stem.split("_", 1))
    if not name or not name_en:
        print(f"skip: {path.name} (name or English name is empty)")
        return None

    if name in STAFF_NAMES and name in FOUNDER_VIP_NAMES:
        badge_text = "創設VIP・STAFF"
        band_color = "#ef6c00"
    elif name in STAFF_NAMES:
        badge_text = "STAFF"
        band_color = "#ef6c00"
    elif name in FOUNDER_VIP_NAMES:
        badge_text = "創設VIP"
        band_color = "#d32f2f"
    else:
        badge_text = ""
        band_color = ""

    relative_path = path.relative_to(ROOT).as_posix()
    return {
        "id": path.name,
        "name": name,
        "nameEn": name_en,
        "photo": relative_path,
        "filename": path.name,
        "badgeText": badge_text,
        "bandColor": band_color,
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
