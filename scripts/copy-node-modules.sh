#!/usr/bin/env bash
set -eux

src="$1"
target="$2"
tmpdir="_tmpnodemodules_"

rm -rf "${tmpdir}"
mkdir "${tmpdir}"
cp "${src}"/package* "${tmpdir}"/
pushd "${tmpdir}"
mystique_path="${src}"/../core
npm pack "${mystique_path}"
mystique_pkg_name=$(node -e "console.log(require('${mystique_path}/package.json').name);")
mystique_pkg_ver=$(node -e "console.log(require('${mystique_path}/package.json').version)")
mystique_pkg=${mystique_pkg_name}-${mystique_pkg_ver}.tgz
sed -i'.bu' "s/file:\.\.\/core/file:${mystique_pkg}/" package.json
npm install --prod --no-optional
popd

prevpwd=$(pwd)
pushd "${src}"
npx babel "${prevpwd}/${tmpdir}"/node_modules -d "${target}" -D
popd

rm -rf "${tmpdir}"
