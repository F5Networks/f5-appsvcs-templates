#!/bin/bash
set -eu

version=$(../scripts/getversion.sh)
outdir=../dist
targets=node12-win,node12-macos,node12-linux,node12-alpine

# Generate binaries
pkg . -t ${targets} -o "${outdir}/fast-${version}"

# Generate sha256 hashes
cd "${outdir}"
for bin in $(ls "fast-${version}-"*)
do
    sha256sum "${bin}" > "${bin}.sha256"
done
