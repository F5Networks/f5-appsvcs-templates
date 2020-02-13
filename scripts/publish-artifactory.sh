#!/usr/bin/env bash
set -eux

package_file="${1:-package.json}"
product_name=$(jq -r .name "$package_file")
product_version=$(jq -r .version "$package_file")

repo_url="https://$ARTIFACTORY_URL/artifactory/f5-automation-toolchain-generic/$product_name/$product_version"
curl_flags="--insecure --fail -H X-JFrog-Art-Api:$ARTIFACTORY_API_KEY"

# upload RPM
cd $(dirname $package_file)
pushd dist
rpm_name=$(ls -t $product_name-${product_version}*.rpm 2>/dev/null | head -1)
popd
curl $curl_flags -T "dist/$rpm_name" "$repo_url/$rpm_name"
# artifactory calculates and compares the checksums but strips the filename
curl $curl_flags -T "dist/$rpm_name.sha256" "$repo_url/$rpm_name.sha256"
# sha file with hash and file name preserved
curl $curl_flags -T "dist/$rpm_name.sha256" "$repo_url/$rpm_name.sha256.txt"

