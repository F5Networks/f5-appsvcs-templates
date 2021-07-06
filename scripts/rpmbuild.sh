#!/bin/bash
set -eu

MAINDIR=$(pwd)

VERSION=$(./scripts/getversion.sh)
RELEASE=1
PKG_NAME=$(node -e "console.log(require('./package.json').name);")
OUTPUT_DIR=${MAINDIR}/dist

rm -rf "$MAINDIR/rpmbuild"

npx webpack -c "${MAINDIR}/workerWebpack.config.js"
echo '/* jshint ignore: start */' | cat - "${MAINDIR}/nodejs/bundle.js" > temp && mv temp "${MAINDIR}/nodejs/bundle.js"

rpmbuild -bb \
    --define "main ${MAINDIR}" \
    --define '_topdir %{main}/rpmbuild' \
    --define "_name ${PKG_NAME}" \
    --define "_version ${VERSION}" \
    --define "_release ${RELEASE}" \
    project.spec

cd "$MAINDIR/rpmbuild/RPMS/noarch"
rpmFile=$(ls -t *.rpm 2>/dev/null | head -1)
mkdir -p ${OUTPUT_DIR}
cp ${rpmFile} ${OUTPUT_DIR}
