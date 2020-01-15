#!/usr/bin/env bash
set -eux
projects=("$@")
if [ -z "${projects[*]}" ]; then
    projects=(
        core
        iapplx
    )
fi

rm -rf .nyc_output
mkdir .nyc_output
for project in "${projects[@]}"; do
    pushd "${project}"
    npm ci
    npm run lint
    npm run coverage
    popd
    cp -r "${project}"/.nyc_output/* .nyc_output
done

npx nyc report -r html -r text
