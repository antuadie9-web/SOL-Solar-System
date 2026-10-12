#!/usr/bin/env bash
# Provision the headless software-WebGPU QA browser on Debian/Ubuntu (CI or sandbox). Not needed on a desktop with Chrome.
set -e
sudo apt-get update && sudo apt-get install -y chromium libvulkan1 mesa-vulkan-drivers
python3 -m pip install --quiet pillow
echo "Use: CHROME=/usr/lib/chromium/chromium node tools/qa/smoke.mjs --software ..."
