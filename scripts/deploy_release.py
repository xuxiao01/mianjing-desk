"""Activate validated releases as an unprivileged account; also supports rollback."""
import fcntl
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import signal
import sys
import tempfile
import urllib.request

ROOT = Path("/www/wwwroot/mianjing-desk")
URL = "https://xuxiaoapi.online"


def validate_release(site, sha):
    if not re.fullmatch(r"[0-9a-f]{40}", sha):
        raise ValueError("Expected a full commit SHA")
    if site.is_symlink() or not site.is_dir():
        raise ValueError("Release must be a real directory")
    for path in site.rglob("*"):
        if path.is_symlink():
            raise ValueError("Release contains a symlink")
    manifest = json.loads((site / "manifest.json").read_text())
    if manifest.get("commit") != sha or not isinstance(manifest.get("files"), dict):
        raise ValueError("Invalid manifest")
    files = manifest["files"]
    if not {"mianjing/index.html", "mianjing/favicon.svg", "mianjing/version.json"} <= files.keys():
        raise ValueError("Missing entry files")
    actual = {str(p.relative_to(site)) for p in site.rglob("*") if p.is_file()}
    if actual != set(files) | {"manifest.json"}:
        raise ValueError("Artifact files differ from manifest")
    for name, expected in files.items():
        path = PurePosixPath(name)
        if path.is_absolute() or ".." in path.parts or not name.startswith("mianjing/"):
            raise ValueError("Invalid artifact path")
        if hashlib.sha256((site / name).read_bytes()).hexdigest() != expected:
            raise ValueError(f"Checksum mismatch: {name}")
    if json.loads((site / "mianjing/version.json").read_text()) != {"commit": sha}:
        raise ValueError("Version does not match manifest")
    return files


def check_site(sha, files):
    def get(path):
        request = urllib.request.Request(URL + path, headers={"Cache-Control": "no-cache"})
        with urllib.request.urlopen(request, timeout=15) as response:
            return response.read(), response.headers.get_content_type()

    version, _ = get("/mianjing/version.json")
    if json.loads(version).get("commit") != sha:
        raise RuntimeError("Online commit does not match release")
    for path in ("/mianjing/", "/mianjing/questions", "/mianjing/reading",
                 "/mianjing/settings", "/mianjing/questions/q-4", "/mianjing/reading/q-4"):
        body, content_type = get(path)
        if content_type != "text/html" or b'<div id="app">' not in body:
            raise RuntimeError(f"SPA entry failed: {path}")
    for name, digest in files.items():
        if "/assets/" not in name and not name.endswith("favicon.svg"):
            continue
        body, content_type = get("/" + name)
        if hashlib.sha256(body).hexdigest() != digest:
            raise RuntimeError(f"Online asset mismatch: {name}")
        if name.endswith(".js") and content_type not in ("application/javascript", "text/javascript"):
            raise RuntimeError(f"Invalid JavaScript MIME: {name}")
        if name.endswith(".css") and content_type != "text/css":
            raise RuntimeError(f"Invalid CSS MIME: {name}")


def switch_current(root, target):
    temporary = root / ".current-next"
    temporary.unlink(missing_ok=True)
    temporary.symlink_to(target)
    os.replace(temporary, root / "current")


def activate(root, site, sha, health_check=check_site):
    root = root.resolve()
    files = validate_release(site, sha)
    releases = root / "releases"
    releases.mkdir(exist_ok=True)
    target = releases / sha
    if target.exists():
        if validate_release(target, sha) != files:
            raise RuntimeError("Existing release differs from upload")
    else:
        staging = Path(tempfile.mkdtemp(prefix=".release-", dir=root))
        try:
            shutil.copytree(site, staging / "site")
            os.replace(staging / "site", target)
        finally:
            shutil.rmtree(staging)
    shared = root / "shared/mianjing/assets"
    shared.mkdir(parents=True, exist_ok=True)
    for source in (target / "mianjing/assets").rglob("*"):
        if not source.is_file():
            continue
        destination = shared / source.relative_to(target / "mianjing/assets")
        destination.parent.mkdir(parents=True, exist_ok=True)
        if destination.exists():
            if destination.read_bytes() != source.read_bytes():
                raise RuntimeError("Immutable asset collision")
        else:
            temporary = destination.with_name(destination.name + ".upload")
            shutil.copyfile(source, temporary)
            temporary.chmod(0o644)
            os.replace(temporary, destination)
    for path in [target, *target.rglob("*")]:
        path.chmod(0o755 if path.is_dir() else 0o644)
    current = root / "current"
    if current.exists() and not current.is_symlink():
        raise RuntimeError("Current is not a symlink")
    previous = current.resolve() if current.is_symlink() else None
    if previous and (previous.parent != releases or not previous.is_dir()):
        raise RuntimeError("Current points outside releases")
    switch_current(root, target)
    try:
        health_check(sha, files)
    except BaseException:
        if previous:
            switch_current(root, previous)
        else:
            current.unlink()
        print("Health check failed; previous release restored", flush=True)
        raise
    # Never remove the active or immediately previous release. Shared hashed assets remain.
    keep = {target, previous}
    candidates = sorted((p for p in releases.iterdir() if p.is_dir() and not p.is_symlink()
                         and re.fullmatch(r"[0-9a-f]{40}", p.name)),
                        key=lambda p: p.stat().st_mtime, reverse=True)
    for path in candidates:
        if len(keep - {None}) >= 5:
            break
        keep.add(path)
    for path in candidates:
        if path not in keep:
            shutil.rmtree(path)
    print(f"Published {sha}", flush=True)


def main():
    def interrupted(signum, frame):
        raise RuntimeError(f"Deployment interrupted by signal {signum}")

    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGHUP, interrupted)
    mode, sha = sys.argv[1:3]
    if mode not in {"deploy", "rollback"} or not re.fullmatch(r"[0-9a-f]{40}", sha):
        raise ValueError("Usage: deploy_release.py deploy|rollback COMMIT [UPLOAD]")
    with (ROOT / ".deploy.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if mode == "rollback":
            site = ROOT / "releases" / sha
        else:
            upload = sys.argv[3]
            if not re.fullmatch(r"[0-9a-f]{40}-[0-9]+-[0-9]+", upload) or not upload.startswith(sha + "-"):
                raise ValueError("Invalid upload identifier")
            site = ROOT / "incoming" / upload / "site"
        activate(ROOT, site, sha)
        if mode == "deploy":
            shutil.rmtree(site.parent)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Deployment failed: {error}", file=sys.stderr)
        sys.exit(1)
