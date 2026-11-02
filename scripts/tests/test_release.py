import hashlib
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest


def load(name):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).parents[1] / (name + ".py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


packager = load("package_release")
deploy = load("deploy_release")


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.root = self.base / "root"
        self.root.mkdir()
        self.counter = 0

    def release(self, sha, asset=None):
        self.counter += 1
        source = self.base / f"build-{self.counter}"
        (source / "assets").mkdir(parents=True)
        (source / "index.html").write_text(
            '<div id="app"></div><script src="/mianjing/assets/app.js"></script>'
            '<link href="/mianjing/favicon.svg">'
        )
        (source / "assets/app.js").write_text(asset or 'console.log("shared")')
        (source / "favicon.svg").write_text("<svg/>")
        output = self.base / f"package-{self.counter}"
        packager.package(source, output, sha)
        return output / "site"

    def publish(self, site, sha, check=None):
        deploy.activate(self.root, site, sha, check or (lambda *_: None))

    def test_exact_manifest_and_version(self):
        site = self.release("a" * 40)
        files = deploy.validate_release(site, "a" * 40)
        self.assertEqual(len(files), 4)
        self.assertEqual(files["mianjing/favicon.svg"], hashlib.sha256(b"<svg/>").hexdigest())
        self.assertEqual(json.loads((site / "mianjing/version.json").read_text()), {"commit": "a" * 40})

    def test_corrupt_artifact_never_changes_current(self):
        self.publish(self.release("a" * 40), "a" * 40)
        previous = (self.root / "current").resolve()
        corrupt = self.release("b" * 40)
        (corrupt / "mianjing/index.html").write_text("damaged")
        with self.assertRaisesRegex(ValueError, "Checksum"):
            self.publish(corrupt, "b" * 40)
        self.assertEqual((self.root / "current").resolve(), previous)
        self.assertFalse((self.root / ("releases/" + "b" * 40)).exists())

    def test_failed_health_check_restores_previous_release(self):
        self.publish(self.release("a" * 40), "a" * 40)
        previous = (self.root / "current").resolve()

        def fail(*_):
            self.assertNotEqual((self.root / "current").resolve(), previous)
            raise RuntimeError("simulated failed online check")

        with self.assertRaisesRegex(RuntimeError, "online check"):
            self.publish(self.release("b" * 40), "b" * 40, fail)
        self.assertEqual((self.root / "current").resolve(), previous)

    def test_failed_first_publish_leaves_no_active_release(self):
        def fail(*_):
            raise RuntimeError("unavailable")

        with self.assertRaises(RuntimeError):
            self.publish(self.release("a" * 40), "a" * 40, fail)
        self.assertFalse((self.root / "current").is_symlink())

    def test_collision_does_not_replace_immutable_asset(self):
        self.publish(self.release("a" * 40), "a" * 40)
        with self.assertRaisesRegex(RuntimeError, "collision"):
            self.publish(self.release("b" * 40, "changed bytes with same name"), "b" * 40)
        self.assertEqual((self.root / "current").resolve().name, "a" * 40)
        self.assertEqual((self.root / "shared/mianjing/assets/app.js").read_text(), 'console.log("shared")')

    def test_republish_rollback_and_retention_keep_five_versions(self):
        for number in range(1, 8):
            sha = f"{number:040x}"
            self.publish(self.release(sha), sha)
            os.utime(self.root / "releases" / sha, (number, number))
        self.assertEqual(len(list((self.root / "releases").iterdir())), 5)
        previous = f"{6:040x}"
        self.publish(self.root / "releases" / previous, previous)
        self.assertEqual((self.root / "current").resolve().name, previous)
        self.publish(self.root / "releases" / previous, previous)
        self.assertTrue((self.root / "shared/mianjing/assets/app.js").is_file())

    def test_wrong_sha_and_symlinks_are_rejected(self):
        site = self.release("a" * 40)
        with self.assertRaises(ValueError):
            deploy.validate_release(site, "b" * 40)
        (site / "mianjing/extra").symlink_to(site / "mianjing/index.html")
        with self.assertRaisesRegex(ValueError, "symlink"):
            deploy.validate_release(site, "a" * 40)

    def test_rejects_build_without_production_base(self):
        source = self.base / "wrong-build"
        source.mkdir()
        (source / "index.html").write_text('<script src="/assets/app.js"></script>')
        with self.assertRaisesRegex(ValueError, "/mianjing/"):
            packager.package(source, self.base / "output", "a" * 40)


if __name__ == "__main__":
    unittest.main()
