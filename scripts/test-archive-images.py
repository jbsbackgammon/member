"""Integration tests using a temporary Git repository, not live member photos."""
import importlib.util
import subprocess
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("archive_images", Path(__file__).with_name("archive-images.py"))
archive = importlib.util.module_from_spec(spec)
spec.loader.exec_module(archive)


class ArchiveTest(unittest.TestCase):
    def test_history_and_idempotency(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            archive.ROOT = root
            archive.ARCHIVE = root / "images" / "old"
            archive.STATE = root / "scripts" / "archive-state.json"

            def git(*args):
                return subprocess.check_output(["git", *args], cwd=root)

            git("init", "-q")
            git("config", "user.name", "Test")
            git("config", "user.email", "test@example.invalid")
            (root / "images").mkdir()
            photo = root / "images" / "選手 名前_Player.png"
            other = root / "images" / "new_Player.jpg"

            def commit(message):
                git("add", ".")
                git("commit", "-qm", message)

            photo.write_bytes(b"original")
            commit("baseline")
            baseline = git("rev-parse", "HEAD").decode().strip()
            photo.write_bytes(b"second")
            other.write_bytes(b"new")
            commit("first update and new addition")
            photo.write_bytes(b"third")
            commit("second update")
            git("commit", "--allow-empty", "-qm", "no image change")
            self.assertEqual(archive.archive_updates(baseline), 2)
            files = list(archive.ARCHIVE.iterdir())
            self.assertEqual({p.read_bytes() for p in files}, {b"original", b"second"})
            self.assertTrue(all(p.name.startswith("選手 名前_Player_") for p in files))
            self.assertEqual(photo.read_bytes(), b"third")
            self.assertEqual(other.read_bytes(), b"new")
            commit("archive")
            self.assertEqual(archive.archive_updates(baseline), 0)
            # Manual deletion is permanent, even when subsequent updates occur.
            removed = next(p for p in files if p.read_bytes() == b"original")
            removed.unlink()
            commit("manual archive deletion")
            self.assertEqual(archive.archive_updates(baseline), 0)
            self.assertFalse(removed.exists())
            photo.write_bytes(b"fourth")
            commit("third update")
            self.assertEqual(archive.archive_updates(baseline), 1)
            self.assertFalse(removed.exists())
            self.assertEqual({p.read_bytes() for p in archive.ARCHIVE.iterdir()}, {b"second", b"third"})
            commit("archive third update")
            # Simulate migration from the former implementation, which has no
            # checkpoint but has archive additions/deletions in Git history.
            archive.STATE.unlink()
            commit("simulate legacy archive state")
            self.assertEqual(archive.archive_updates(baseline), 0)
            self.assertFalse(removed.exists())
            self.assertTrue(archive.STATE.exists())
            commit("migration checkpoint")
            photo.unlink()
            commit("delete current image")
            self.assertEqual(archive.archive_updates(baseline), 0)


if __name__ == "__main__":
    unittest.main()
