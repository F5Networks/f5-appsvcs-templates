#!/usr/bin/env bash

FORMAT=${1:-"html"}
FMT=$(echo "$FORMAT" | awk '{print tolower($0)}')
case $FMT in
    html)
        echo "Creating docs.html files"
        ./node_modules/.bin/jsdoc2md nodejs/fastWorker.js > nodejs/docs.html
        ./node_modules/.bin/jsdoc2md lib/*.js > lib/docs.html
        ;;
    md)
        echo "Creating README.md files"
        ./node_modules/.bin/jsdoc2md nodejs/fastWorker.js > nodejs/README.md
        ./node_modules/.bin/jsdoc2md lib/*.js > lib/README.md
        ;;
esac
