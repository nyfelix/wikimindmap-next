#!/usr/bin/env bash
# Runs once after the dev container is created (see architecture.md §14).
set -euo pipefail

# Named volumes are created root-owned; hand them to the container user.
sudo chown node:node node_modules /home/node/.claude

# package.json appears in TS-02. Until then there is nothing to install.
if [ -f package.json ]; then
  npm ci
  # Uses the project's pinned Playwright, so browser and test runner versions match.
  npx playwright install --with-deps chromium
else
  echo "post-create: no package.json yet, skipping npm ci and Playwright install."
fi
