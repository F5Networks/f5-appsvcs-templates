FULL_VERSION=$(node -e "console.log(require('./package.json').version)")
RELEASE=$(echo $FULL_VERSION | sed 's/[0-9.]*-//')
VERSION=$(echo $FULL_VERSION | sed 's/-[0-9]*//')

npm install

rpmbuild -bb \
    --define "main $(pwd)" \
    --define '_topdir %{main}/rpmbuild' \
    --define "_name mystique" \
    --define "_version ${VERSION}" \
    --define "_release ${RELEASE}" \
    build/project.spec
