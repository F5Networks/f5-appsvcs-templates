#!/usr/bin/env bash
set -eux

src="$1"
target="$2"
tmpdir="_tmpnodemodules_"
skip_babel=${SKIP_BABEL:-0}

rm -rf "${tmpdir}"
mkdir "${tmpdir}"
cp "${src}"/package* "${tmpdir}"/
pushd "${tmpdir}"
mapfile -t file_modules < <(grep 'file:' package.json | sed 's/\s*".*": "file:\(.*\)",/\1/')
for file_module in "${file_modules[@]}"; do
    module_path="${src}"/"${file_module}"
    npm pack "${module_path}"
    module_pkg_name=$(node -e "console.log(require('${module_path}/package.json').name);")
    module_pkg_name=${module_pkg_name//@}
    module_pkg_name=${module_pkg_name//\//-}
    module_pkg_ver=$(node -e "console.log(require('${module_path}/package.json').version)")
    module_pkg=${module_pkg_name}-${module_pkg_ver}.tgz
    sed -i'.bu' "s%file:${file_module}%file:${module_pkg}%" package.json
done
npm install --prod --no-optional
popd

if [[ $skip_babel == 1 ]]; then
    cp -rp "${tmpdir}"/node_modules "${target}"
else
    prevpwd=$(pwd)
    pushd "${src}"
    npx babel "${prevpwd}/${tmpdir}"/node_modules -d "${target}" --copy-files --copy-ignored
    popd
fi

rm -rf "${tmpdir}"
