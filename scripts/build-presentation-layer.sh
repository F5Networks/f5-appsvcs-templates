#!/bin/bash
set -eux

# Generate API docs
npx redoc-cli bundle -o presentation/apidoc.html ../docs/openapi.yml

# Bundle Node modules
npx browserify presentation/app.js -o presentation/bundle.js
