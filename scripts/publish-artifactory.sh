#!/usr/bin/env bash
set -eux

upload_file () {
    echo uploading "$1"
    # upload file
    curl $curl_flags -T "dist/$1" "$repo_url/$1"
    # artifactory calculates and compares the checksums but strips the filename
    curl $curl_flags -T "dist/$1.sha256" "$repo_url/$1.sha256"
    # sha file with hash and file name preserved
    curl $curl_flags -T "dist/$1.sha256" "$repo_url/$1.sha256.txt"
}

package_file="${1:-package.json}"
product_name=$(jq -r .name "$package_file")
product_version=$(jq -r .version "$package_file")

repo_url="https://$ARTIFACTORY_URL/artifactory/f5-automation-toolchain-generic/$product_name/$product_version"
curl_flags="--insecure --fail -H X-JFrog-Art-Api:$ARTIFACTORY_API_KEY"

# find files
pushd dist
files=$(ls --hide=*.sha256)
popd

# upload each file
for f in $files
do
    upload_file $f
done
