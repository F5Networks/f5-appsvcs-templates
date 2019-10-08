FULL_VERSION=$(node -e "console.log(require('./package.json').version)")
VERSION=$(echo $FULL_VERSION | sed 's/-[0-9]*//')
RELEASE=$(echo $FULL_VERSION | sed 's/[0-9.]*-//')
OUTPUT_DIR=$(pwd)/dist

npm install

rpmbuild -bb \
    --define "main $(pwd)" \
    --define '_topdir %{main}/rpmbuild' \
    --define "_name mystique" \
    --define "_version ${VERSION}" \
    --define "_release ${RELEASE}" \
    build/project.spec

cd rpmbuild/RPMS/noarch
rpmFile=$(ls -t *.rpm 2>/dev/null | head -1)
mkdir -p ${OUTPUT_DIR}
cp ${rpmFile} ${OUTPUT_DIR}
sha256sum "${rpmFile}" > "${OUTPUT_DIR}/${rpmFile}.sha256"
