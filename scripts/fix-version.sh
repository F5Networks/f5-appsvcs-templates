#!/usr/bin/env bash
set -eu

version=$(node -e "console.log(require('./package.json').version)")
sed -i'.bu' "s/version: .*$/version: $version/" docs/openapi.yml
rm docs/openapi.yml.bu
git add docs/openapi.yml
