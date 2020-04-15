#!/bin/bash
set -eu

# Generate packet with npm pack
packfile=$(npm pack)
outdir=../dist
mv "$packfile" "$outdir"

# Generate sha256 hashes
sha256sum "$outdir/$packfile" > "$outdir/$packfile.sha256"
