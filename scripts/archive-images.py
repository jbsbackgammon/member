"""Archive superseded images from the first-parent history of main."""
from __future__ import annotations

import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / "images" / "old"
# Start with the main branch immediately before this feature was installed.
BASELINE = "2f399446e848a82718356d41393de62a0dd32d12"
SUPPORTED = {".png", ".jpg", ".jpeg", ".webp"}
JST = timezone(timedelta(hours=9))


def git(*args: str) -> bytes:
    return subprocess.check_output(["git", *args], cwd=ROOT)


def archive_updates(baseline: str = BASELINE) -> int:
    # Full history is scanned deliberately: queued/cancelled workflow runs and
    # multiple pushes cannot skip an intermediate replacement. Names are
    # deterministic, making repeated runs safe.
    git("merge-base", "--is-ancestor", baseline, "HEAD")
    commits = git("rev-list", "--first-parent", "--reverse", f"{baseline}..HEAD").decode().splitlines()
    count = 0
    for commit in commits:
        parent = git("rev-parse", f"{commit}^1").decode().strip()
        paths = git("diff", "--no-renames", "--name-only", "--diff-filter=M", "-z",
                    parent, commit, "--", "images/")
        for raw in paths.split(b"\0"):
            if not raw:
                continue
            path = Path(raw.decode("utf-8"))
            if path.parent != Path("images") or path.suffix.lower() not in SUPPORTED:
                continue
            old_oid = git("rev-parse", f"{parent}:{path.as_posix()}").decode().strip()
            new_oid = git("rev-parse", f"{commit}:{path.as_posix()}").decode().strip()
            if old_oid == new_oid:
                continue
            timestamp = int(git("show", "-s", "--format=%ct", commit).decode())
            stamp = datetime.fromtimestamp(timestamp, JST).strftime("%Y%m%d_%H%M%S")
            # Include the replacing commit ID so same-second updates cannot collide.
            suffix = f"_{stamp}_{commit[:12]}{path.suffix}"
            stem = path.stem
            while len((stem + suffix).encode("utf-8")) > 255:
                stem = stem[:-1]
            target = ARCHIVE / (stem + suffix)
            previous = git("cat-file", "blob", old_oid)
            if target.exists():
                if target.read_bytes() != previous:
                    raise RuntimeError(f"Archive collision: {target.relative_to(ROOT)}")
                continue
            ARCHIVE.mkdir(parents=True, exist_ok=True)
            target.write_bytes(previous)
            count += 1
            print(f"archived: {path.as_posix()} -> {target.relative_to(ROOT)}")
    print(f"archived {count} superseded image(s)")
    return count


if __name__ == "__main__":
    archive_updates()
