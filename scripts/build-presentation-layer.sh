#!/bin/bash
set -eux

# Generate API docs
cp docs/openapi.yml openapi-tmp.yml
sed -i'.bu' "s%http://localhost:8100/mgmt/shared/fast%/mgmt/shared/fast%" openapi-tmp.yml
npx redoc-cli build -o presentation/apidoc.html openapi-tmp.yml
rm openapi-tmp.*

# Bundle Node modules
if [ -z "${NODE_ENV:+x}" ]; then
    export NODE_ENV=production
fi
npx webpack
