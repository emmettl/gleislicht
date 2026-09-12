"""Publish an already-successful Gleislicht Pages artifact to Cloudflare.

Requires Python 3, gh, Node/npm and a local Wrangler login (or an API token).
Defaults to a dry run. Source files and the GitHub Pages release are untouched.
"""

import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import tarfile
import tempfile
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
REPO = "emmettl/gleislicht"
PREFIX = "gleislicht"
URL = "https://motionstudies.app/" + PREFIX + "/"
MAX_FILE_BYTES = 25 * 1024 * 1024
MAX_FILES = 20_000


def validate_data_pointer(pointer):
    identity = pointer.get("id", "")
    expected = "https://data.motionstudies.app/gleislicht/releases/" + identity + "/"
    if pointer.get("schemaVersion") != 1 or not re.fullmatch(r"[a-f0-9]{64}", identity) or pointer.get("baseUrl") != expected:
        raise ValueError("Invalid immutable timetable release")


def verify_data_pointer(pointer):
    validate_data_pointer(pointer)
    request = urllib.request.Request(pointer["baseUrl"] + "_release.json", headers={"Origin": "https://motionstudies.app"})
    with urllib.request.urlopen(request, timeout=30) as response:
        manifest = json.load(response)
        if manifest.get("id") != pointer["id"] or manifest.get("baseUrl") != pointer["baseUrl"] or response.headers.get("Access-Control-Allow-Origin") != "*":
            raise ValueError("Timetable release is incomplete or inaccessible")


def github_json(endpoint):
    return json.loads(subprocess.check_output(["gh", "api", endpoint], text=True))


def latest_successful_run():
    result = github_json(f"repos/{REPO}/actions/workflows/pages.yml/runs?branch=main&status=success&per_page=1")
    if not result["workflow_runs"]:
        raise ValueError("No successful main-branch Pages release is available")
    run = result["workflow_runs"][0]
    validate_run(run)
    return run


def is_superseded(run, latest):
    validate_run(run)
    validate_run(latest)
    return run["run_number"] < latest["run_number"]


def verify_deployment(release, edition):
    """Allow edge propagation, then check release identity and browser cache policy."""
    hashed_asset = next(path for path in sorted((edition / "assets").iterdir()) if path.is_file())
    policies = {
        "": "public, max-age=0, must-revalidate",
        "assets/" + hashed_asset.name: "public, max-age=31536000, immutable",
        ("_data-release.json" if (edition / "_data-release.json").exists() else "data/swiss-rail-day-manifest.json"): "public, max-age=0, must-revalidate",
        "_release.json": "no-cache",
    }
    for attempt in range(6):
        try:
            request = urllib.request.Request(URL + "_release.json", headers={"User-Agent": "Gleislicht-Hosting-CI/1.0", "Cache-Control": "no-cache"})
            with urllib.request.urlopen(request, timeout=30) as response:
                if json.load(response) != release:
                    raise ValueError("Published release metadata does not match this artifact")
            for path, expected in policies.items():
                request = urllib.request.Request(URL + path, method="HEAD", headers={"User-Agent": "Gleislicht-Hosting-CI/1.0"})
                with urllib.request.urlopen(request, timeout=30) as response:
                    if response.headers.get("Cache-Control") != expected:
                        raise ValueError("Unexpected cache policy: " + path)
                    if "noindex" in response.headers.get("X-Robots-Tag", "").lower():
                        raise ValueError("Production hosting must be indexable: " + path)
                    if response.headers.get("X-Motion-Studies-Hosting") != "cloudflare-static":
                        raise ValueError("Response did not come from Cloudflare hosting: " + path)
            print("Verified live release identity and cache policies", flush=True)
            return
        except (OSError, ValueError):
            if attempt == 5:
                raise
            time.sleep(10)


def validate_run(run):
    if (run.get("status") != "completed" or run.get("conclusion") != "success"
            or run.get("head_branch") != "main"
            or run.get("path") != ".github/workflows/pages.yml"
            or run.get("repository", {}).get("full_name") != REPO
            or run.get("event") not in {"push", "schedule", "workflow_dispatch"}):
        raise ValueError("Publishing requires a successful main-branch Gleislicht Pages run")


def stage_artifact(archive, destination, run):
    """Validate the full archive before copying regular files into a fresh directory."""
    validate_run(run)
    if destination.exists():
        raise ValueError("Staging destination must not exist")
    with tarfile.open(archive) as tar:
        files = {}
        for member in tar.getmembers():
            path = PurePosixPath(member.name)
            if path.is_absolute() or ".." in path.parts or "\\" in member.name:
                raise ValueError("Unsafe artifact path: " + member.name)
            if not (member.isdir() or member.isfile()):
                raise ValueError("Links and special files are not permitted: " + member.name)
            if member.isdir():
                continue
            name = str(path)
            if name in files or name in {"_headers", "_redirects", "_worker.js", "_release.json"}:
                raise ValueError("Duplicate or reserved artifact path: " + name)
            if member.size > MAX_FILE_BYTES:
                raise ValueError("Asset exceeds Cloudflare's 25 MiB limit: " + name)
            if re.search(r"(^|/)(all-change|correspondances|local-express|new-york)", name):
                raise ValueError("Foreign edition in Swiss artifact: " + name)
            # Everything under /assets/ receives an immutable browser cache policy.
            # Keep stable filenames out of that namespace as builds evolve.
            if name.startswith("assets/") and not re.fullmatch(r"assets/[^/]+-[A-Za-z0-9_-]{8}\.[A-Za-z0-9.]+", name):
                raise ValueError("Immutable asset must have a Vite content hash: " + name)
            files[name] = member
        if len(files) + 1 > MAX_FILES:
            raise ValueError("Artifact exceeds Cloudflare's free asset count limit")
        external = "_data-release.json" in files
        required_files = ["index.html", "_data-release.json"] if external else ["index.html", "data/swiss-rail-morning.json", "data/swiss-rail-day-manifest.json"]
        if external:
            if any(name.startswith("data/") for name in files):
                raise ValueError("External data artifact includes a second dataset")
            validate_data_pointer(json.load(tar.extractfile(files["_data-release.json"])))
        for required in required_files:
            if required not in files:
                raise ValueError("Missing required Swiss artifact: " + required)
        for name, target in [("london.html", "allchange"), ("paris.html", "correspondances")]:
            if name not in files or ("https://emmettl.github.io/" + target + "/").encode() not in tar.extractfile(files[name]).read():
                raise ValueError("Missing compatibility redirect: " + name)

        edition = destination / PREFIX
        edition.mkdir(parents=True)
        digest = hashlib.sha256()
        for name, member in sorted(files.items()):
            target = edition / name
            target.parent.mkdir(parents=True, exist_ok=True)
            file_digest = hashlib.sha256()
            with tar.extractfile(member) as source, target.open("xb") as output:
                while chunk := source.read(1024 * 1024):
                    output.write(chunk)
                    file_digest.update(chunk)
            digest.update(name.encode() + b"\0" + file_digest.digest())
        release = {
            "repository": REPO,
            "run_id": run["id"],
            "commit": run["head_sha"],
            "workflow_url": run["html_url"],
            "source_files": len(files),
            "source_bytes": sum(member.size for member in files.values()),
            "content_sha256": digest.hexdigest(),
        }
        (edition / "_release.json").write_text(json.dumps(release, indent=2) + "\n")
        (destination / "_headers").write_text(
            "/gleislicht/*\n"
            "  X-Motion-Studies-Hosting: cloudflare-static\n"
            "\n/gleislicht/assets/*\n"
            "  Cache-Control: public, max-age=31536000, immutable\n"
            "\n/gleislicht/_release.json\n"
            "  Cache-Control: no-cache\n"
        )
        (destination / "_redirects").write_text(
            "/gleislicht-pilot /gleislicht/ 301\n"
            "/gleislicht-pilot/* /gleislicht/:splat 301\n"
        )
        return release


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run", required=True, type=int, help="Successful GitHub Pages workflow run ID")
    parser.add_argument("--deploy", action="store_true", help="Publish after staging and Wrangler dry-run validation")
    parser.add_argument("--require-latest", action="store_true", help="Skip superseded releases (used by CI)")
    args = parser.parse_args()
    run = github_json(f"repos/{REPO}/actions/runs/{args.run}")
    validate_run(run)
    if args.require_latest and is_superseded(run, latest_successful_run()):
        print("Skipping superseded Pages release:", args.run)
        return
    # Keep temporary payloads available if upload fails; print the directory for recovery.
    stage = Path(tempfile.mkdtemp(prefix="gleislicht-"))
    print("Staging:", stage, flush=True)
    subprocess.run([
        "gh", "run", "download", str(args.run), "--repo", REPO,
        "--name", "github-pages", "--dir", str(stage / "download"),
    ], check=True)
    release = stage_artifact(stage / "download/artifact.tar", stage / "assets", run)
    print(json.dumps(release, indent=2), flush=True)
    pointer_file = stage / "assets" / PREFIX / "_data-release.json"
    if pointer_file.exists():
        verify_data_pointer(json.loads(pointer_file.read_text()))
    command = [
        "npx", "--yes", "wrangler@4.131.1", "deploy",
        "--config", str(ROOT / "wrangler.gleislicht.jsonc"),
        "--assets", str(stage / "assets"),
    ]
    subprocess.run(command + ["--dry-run", "--outdir", str(stage / "dry-run")], cwd=ROOT, check=True)
    if args.deploy:
        # Recheck after download and staging, immediately before changing the publisher.
        if args.require_latest and is_superseded(run, latest_successful_run()):
            print("Skipping Pages release superseded while staging:", args.run)
            shutil.rmtree(stage)
            return
        subprocess.run(command, cwd=ROOT, check=True)
        verify_deployment(release, stage / "assets" / PREFIX)
        print("Published:", URL)
        shutil.rmtree(stage)
    else:
        print("Dry run passed. To publish, rerun with --deploy. Staged files retained:", stage)


if __name__ == "__main__":
    main()
