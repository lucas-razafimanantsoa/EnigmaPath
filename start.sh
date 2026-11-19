#!/usr/bin/env bash
# Starts the EnigmaPath server (needed for the exam) and opens the browser.
cd "$(dirname "$0")" || exit 1
if command -v python3 >/dev/null 2>&1; then
  python3 server.py "$@"
elif command -v python >/dev/null 2>&1; then
  python server.py "$@"
else
  echo "Python 3 is not installed. Install it from https://www.python.org/downloads/ and try again."
  exit 1
fi
