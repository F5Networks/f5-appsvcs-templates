#!/bin/bash
set -eu

MAINDIR=$(pwd)

FULL_VERSION=$(node -e "console.log(require('./package.json').version)")
VERSION="$(echo $FULL_VERSION | cut -d - -f 1)"
LAST_TAG="$(git describe --tags --always --abbrev=0)"
NUM_COMMITS_FROM_TAG=$(git rev-list $LAST_TAG.. --count)
if [ "$LAST_TAG" = "v${VERSION}*" ]; then
    VERSION="$(echo $LAST_TAG | tail -c +2)"
fi
if [ "$NUM_COMMITS_FROM_TAG" -ne 0 ]; then
    VERSION="$VERSION.dev$NUM_COMMITS_FROM_TAG"
fi
RELEASE=1
PKG_NAME=$(node -e "console.log(require('./package.json').name);")
OUTPUT_DIR=${MAINDIR}/dist

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
