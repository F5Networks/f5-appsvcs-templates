#!/usr/bin/env bash
set -eu
echo "Checking grammar and style"
vale --glob='*.rst' .
echo "Checking links"
make linkcheck
