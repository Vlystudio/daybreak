"""Build and capture the real iOS shell with a synthetic, unprivileged account."""
import glob
import hashlib
import json
import os
import pathlib
import plistlib
import subprocess

def run(*args, capture=False):
    return subprocess.run(args, check=True, text=True, stdout=subprocess.PIPE if capture else None).stdout

device_name = os.environ["DAYBREAK_SCREENSHOT_DEVICE"]
for key in ("DAYBREAK_REVIEW_EMAIL", "DAYBREAK_REVIEW_PASSWORD"):
    if not os.environ.get(key):
        raise RuntimeError("Missing synthetic review credentials")
devices = json.loads(run("xcrun", "simctl", "list", "devices", "available", "--json", capture=True))["devices"]
matches = [(runtime, d) for runtime, entries in devices.items() if runtime.endswith("iOS-26-0") for d in entries if d["name"] == device_name]
if len(matches) != 1:
    raise RuntimeError("Expected one matching iOS 26.0 simulator")
runtime, device = matches[0]
udid = device["udid"]
if device["state"] != "Booted":
    run("xcrun", "simctl", "boot", udid)
run("xcrun", "simctl", "bootstatus", udid, "-b")
run("xcrun", "simctl", "ui", udid, "appearance", "light")
run("xcrun", "simctl", "status_bar", udid, "override", "--time", "9:41", "--batteryState", "charged", "--batteryLevel", "100")
destination = "platform=iOS Simulator,id=" + udid
run("xcodebuild", "build-for-testing", "-workspace", "ios/App/App.xcworkspace", "-scheme", "StoreScreenshots", "-configuration", "Debug", "-destination", destination, "-derivedDataPath", "build/store-derived", "CODE_SIGNING_ALLOWED=NO", "-quiet")
test_file = glob.glob("build/store-derived/Build/Products/*.xctestrun")
if len(test_file) != 1:
    raise RuntimeError("Expected one generated xctestrun")
with open(test_file[0], "rb") as handle:
    plan = plistlib.load(handle)
if "TestConfigurations" in plan:
    targets = [target for config in plan["TestConfigurations"] for target in config["TestTargets"]]
else:
    # Schemes without an .xctestplan can still emit the original dictionary
    # format on Xcode 26. Only inject into actual test-bundle entries.
    targets = [target for target in plan.values() if isinstance(target, dict) and target.get("TestBundlePath")]
if len(targets) != 1 or "StoreScreenshots" not in targets[0]["TestBundlePath"]:
    raise RuntimeError("Expected exactly the StoreScreenshots test bundle")
for target in targets:
    target.setdefault("EnvironmentVariables", {}).update({key: os.environ[key] for key in ("DAYBREAK_REVIEW_EMAIL", "DAYBREAK_REVIEW_PASSWORD")})
with open(test_file[0], "wb") as handle:
    plistlib.dump(plan, handle)
try:
    run("xcodebuild", "test-without-building", "-xctestrun", test_file[0], "-destination", destination, "-resultBundlePath", "build/store-result.xcresult", "-parallel-testing-enabled", "NO", "-quiet")
finally:
    # Never publish the xctestrun or result bundle: either may retain credentials.
    for target in targets:
        for key in ("DAYBREAK_REVIEW_EMAIL", "DAYBREAK_REVIEW_PASSWORD"):
            target.get("EnvironmentVariables", {}).pop(key, None)
    with open(test_file[0], "wb") as handle:
        plistlib.dump(plan, handle)
output = pathlib.Path("build/store-screenshots")
output.mkdir(parents=True, exist_ok=True)
run("xcrun", "xcresulttool", "export", "attachments", "--path", "build/store-result.xcresult", "--output-path", str(output))
images = sorted(output.glob("*.png"))
if len(images) < 6:
    raise RuntimeError("The complete screenshot set was not exported")
evidence = {"commit": os.environ.get("GITHUB_SHA"), "workflowRun": os.environ.get("GITHUB_RUN_ID"), "device": device_name, "runtime": runtime, "origin": "https://daybreak-one.vercel.app", "data": "Synthetic App Review account only", "capture": "Actual iOS Simulator app screens, not composited mockups", "images": [{"file": item.name, "sha256": hashlib.sha256(item.read_bytes()).hexdigest()} for item in images]}
(output / "capture-evidence.json").write_text(json.dumps(evidence, indent=2) + "\n")
