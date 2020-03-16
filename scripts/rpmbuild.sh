#!/bin/bash
set -eu

MAINDIR=$(pwd)

VERSION=$(../scripts/getversion.sh)
RELEASE=1
PKG_NAME=$(node -e "console.log(require('./package.json').name);")
OUTPUT_DIR=${MAINDIR}/../dist

rm -rf rpmbuild

rpmbuild -bb \
    --define "main ${MAINDIR}" \
    --define '_topdir %{main}/rpmbuild' \
    --define "_name ${PKG_NAME}" \
    --define "_version ${VERSION}" \
    --define "_release ${RELEASE}" \
    project.spec

cd rpmbuild/RPMS/noarch
rpmFile=$(ls -t *.rpm 2>/dev/null | head -1)
mkdir -p ${OUTPUT_DIR}
cp ${rpmFile} ${OUTPUT_DIR}
sha256sum "${rpmFile}" > "${OUTPUT_DIR}/${rpmFile}.sha256"
