#!/bin/bash
set -eux

# Generate API docs
npx js-yaml ../docs/openapi.yml > presentation/openapi.json
npx redoc-cli bundle -o presentation/apidoc.html presentation/openapi.json

# Bundle Node modules
npx browserify presentation/app.js -o presentation/bundle.js
