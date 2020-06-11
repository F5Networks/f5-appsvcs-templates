#!/bin/bash
set -eux

# Generate API docs
npx redoc-cli bundle -o iappslx/presentation/apidoc.html docs/openapi.yml

# Bundle Node modules
npx browserify iappslx/presentation/app.js -o iappslx/presentation/bundle.js
