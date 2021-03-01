#!/bin/bash
set -eux

# Generate API docs
cp docs/openapi.yml openapi-tmp.yml
sed -i'.bu' "s%http://localhost:8100/mgmt/shared/fast%/mgmt/shared/fast%" openapi-tmp.yml
npx redoc-cli bundle -o iappslx/presentation/apidoc.html openapi-tmp.yml
rm openapi-tmp.*

# Bundle Node modules
npx browserify iappslx/presentation/app.js -o iappslx/presentation/bundle.js --exclude original-fs
