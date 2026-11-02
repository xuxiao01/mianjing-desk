"""Package a static build with an exact manifest; no third-party dependencies."""
import hashlib
import json
from pathlib import Path
import re
import shutil
import sys


def package(dist, output, sha):
    if not re.fullmatch(r"[0-9a-f]{40}", sha):
        raise ValueError("Expected a full Git commit SHA")
    if output.exists():
        raise ValueError("Release output already exists")
    html = (dist / "index.html").read_text()
    if '/mianjing/assets/' not in html or '/mianjing/favicon.svg' not in html:
        raise ValueError("Build must target /mianjing/")
    for path in dist.rglob("*"):
        if path.is_symlink():
            raise ValueError("Symlinks are not allowed in release artifacts")
    site = output / "site"
    shutil.copytree(dist, site / "mianjing")
    (site / "mianjing/version.json").write_text(json.dumps({"commit": sha}) + "\n")
    files = {
        str(path.relative_to(site)): hashlib.sha256(path.read_bytes()).hexdigest()
        for path in sorted(site.rglob("*")) if path.is_file()
    }
    (site / "manifest.json").write_text(json.dumps({"commit": sha, "files": files}) + "\n")
    print(f"Packaged {len(files)} files for {sha}")


if __name__ == "__main__":
    package(Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3])
