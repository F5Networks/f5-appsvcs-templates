#!/bin/bash
set -eu

full_version=$(node -e "console.log(require('./package.json').version)")
version="$(echo $full_version | cut -d - -f 1)"
last_tag="$(git describe --tags --always --abbrev=0)"
num_commits_from_tag=$(git rev-list $last_tag.. --count)
if [[ "$last_tag" == "v${version}"* ]]; then
    version="$(echo $last_tag | tail -c +2)"
fi
if [ "$num_commits_from_tag" -ne 0 ]; then
    version="$version.dev$num_commits_from_tag"
fi

version=$(echo "$version" | sed 's/-rc./rc/')
echo ${version}
