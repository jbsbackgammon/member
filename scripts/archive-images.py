"""Archive superseded images from the first-parent history of main."""
from __future__ import annotations

import json
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / "images" / "old"
STATE = ROOT / "scripts" / "archive-state.json"
# Start with the main branch immediately before this feature was installed.
BASELINE = "2f399446e848a82718356d41393de62a0dd32d12"
SUPPORTED = {".png", ".jpg", ".jpeg", ".webp"}
JST = timezone(timedelta(hours=9))


def git(*args: str) -> bytes:
    return subprocess.check_output(["git", *args], cwd=ROOT)


def changed_paths(parent: str, commit: str, status: str, folder: str) -> list[Path]:
    raw = git("diff", "--no-renames", "--name-only", f"--diff-filter={status}",
              "-z", parent, commit, "--", folder)
    return [Path(item.decode("utf-8")) for item in raw.split(b"\0") if item]


def archive_name(path: Path, suffix: str) -> str:
    stem = path.stem
    while len((stem + suffix).encode("utf-8")) > 255:
        stem = stem[:-1]
    return stem + suffix


def read_checkpoint() -> tuple[dict | None, bool]:
    if STATE.exists():
        return json.loads(STATE.read_text(encoding="utf-8")), False
    # If the state file was accidentally deleted, recover its last committed
    # value rather than reprocessing deliberately deleted archives.
    previous = git("log", "--first-parent", "--diff-filter=AM", "-1",
                   "--format=%H", "--", STATE.relative_to(ROOT).as_posix()).decode().strip()
    if previous:
        return json.loads(git("show", f"{previous}:{STATE.relative_to(ROOT).as_posix()}")), True
    return None, True


def archive_updates(baseline: str = BASELINE) -> int:
    # Keep a durable first-parent checkpoint, committed together with the
    # archived photos. A deleted archive is not a pending replacement.
    state, restore_state = read_checkpoint()
    migrating = state is None
    checkpoint = baseline
    if not migrating:
        if state.get("version") != 1 or not isinstance(state.get("last_processed_commit"), str):
            raise RuntimeError("Invalid archive checkpoint")
        checkpoint = state["last_processed_commit"]

    git("merge-base", "--is-ancestor", baseline, checkpoint)
    git("merge-base", "--is-ancestor", checkpoint, "HEAD")
    head = git("rev-parse", "HEAD").decode().strip()
    commits = git("rev-list", "--first-parent", "--reverse", f"{checkpoint}..{head}").decode().splitlines()
    pairs = [(commit, git("rev-parse", f"{commit}^1").decode().strip()) for commit in commits]
    if pairs and pairs[0][1] != checkpoint:
        raise RuntimeError("Archive checkpoint is not on the first-parent chain")

    # Migration from the old existence-based archive scheme: remember all
    # archive names ever committed, including ones subsequently deleted.
    # Only missing, never-archived replacements are recovered.
    historical_archives = set()
    if migrating:
        for commit, parent in pairs:
            historical_archives.update(
                path.name for path in changed_paths(parent, commit, "A", "images/old/")
                if path.parent == Path("images/old")
            )

    count = 0
    processed = 0
    for commit, parent in pairs:
        for path in changed_paths(parent, commit, "M", "images/"):
            if path.parent != Path("images") or path.suffix.lower() not in SUPPORTED:
                continue
            old_oid = git("rev-parse", f"{parent}:{path.as_posix()}").decode().strip()
            new_oid = git("rev-parse", f"{commit}:{path.as_posix()}").decode().strip()
            if old_oid == new_oid:
                continue
            timestamp = int(git("show", "-s", "--format=%ct", commit).decode())
            date = datetime.fromtimestamp(timestamp, JST)
            legacy_stamp = date.strftime("%Y%m%d_%H%M%S")
            legacy_name = archive_name(path, f"_{legacy_stamp}_{commit[:12]}{path.suffix}")
            processed += 1
            if legacy_name in historical_archives:
                continue
            # Keep the suffix exactly 14 digits. If the same name and second
            # collide, use the next unused second, never overwrite an archive.
            while True:
                stamp = date.strftime("%Y%m%d%H%M%S")
                target = ARCHIVE / archive_name(path, f"_{stamp}{path.suffix}")
                if not target.exists():
                    break
                date += timedelta(seconds=1)
            previous = git("cat-file", "blob", old_oid)
            ARCHIVE.mkdir(parents=True, exist_ok=True)
            target.write_bytes(previous)
            count += 1
            print(f"archived: {path.as_posix()} -> {target.relative_to(ROOT)}")

    # Do not write checkpoints for archive-only commits or unrelated changes.
    # This prevents an endless chain of bookkeeping commits.
    if restore_state or processed:
        STATE.parent.mkdir(parents=True, exist_ok=True)
        STATE.write_text(json.dumps({
            "version": 1,
            "last_processed_commit": head,
        }, indent=2) + "\n", encoding="utf-8")
    print(f"archived {count} superseded image(s); processed {processed} replacement(s)")
    return count


if __name__ == "__main__":
    archive_updates()
