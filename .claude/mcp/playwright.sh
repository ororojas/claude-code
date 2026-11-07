#!/usr/bin/env bash
# Starts the Playwright MCP server (github.com/microsoft/playwright-mcp) for Claude Code.
#
# Claude Code cloud containers ship a Chromium build at /opt/pw-browsers/chromium and
# run as root, so there the server uses that browser, headless, without Chromium's
# sandbox, and with an in-memory profile. Everywhere else it starts with upstream's
# defaults (Chrome, headed, persistent profile).
#
# Pinned version: bump it here when you want a newer server.
set -eo pipefail

VERSION="0.0.84"

if [ -x /opt/pw-browsers/chromium ]; then
  exec npx -y "@playwright/mcp@${VERSION}" \
    --browser chromium \
    --executable-path /opt/pw-browsers/chromium \
    --headless --no-sandbox --isolated "$@"
fi

exec npx -y "@playwright/mcp@${VERSION}" "$@"
