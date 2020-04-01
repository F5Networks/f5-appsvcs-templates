#!/usr/bin/env bash
set -eux
projects=("$@")
if [ -z "${projects[*]}" ]; then
    projects=(
        core
        iappslx
        templates
    )
fi

for project in "${projects[@]}"; do
    pushd "${project}"
    npm ci
    npm audit
    popd
done
