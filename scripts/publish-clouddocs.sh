#!/usr/bin/env bash
set -eux

package_file="${1:-package.json}"
product_name=$(jq -r .name "$package_file")
product_version=$(jq -r .version "$package_file")

branch=${CI_COMMIT_BRANCH:-}

cd_domain=clouddocs.f5networks.net
if [ "$branch" = "docs-latest" ]; then
    cd_domain=clouddocs.f5.com
fi

cd_path="/products/extensions/$product_name"
cd_url="$cd_domain$cd_path"

# Upload docs
aws s3 sync docs/_build/html "s3://$cd_url/latest"
aws s3 sync docs/_build/html "s3://$cd_url/$product_version"

# Update versions
cat > new_versions.json << EOM
{
    "latestVersion": {
        "name": "$product_version",
        "url": "$cd_path/latest/"
    },
    "otherVersions": [
        { "name": "$product_version", "url": "$cd_path/$product_version" }
    ]
}
EOM
curl -sfo prev_versions.json "https://$cd_url/versions.json" || echo '' > prev_versions.json
if [ "$(cat prev_versions.json)" ]; then
    jq -s '.[0].otherVersions=([.[].otherVersions]|flatten)|.[0]' new_versions.json prev_versions.json > versions.json
else
    jq . new_versions.json > versions.json
fi
aws s3 cp versions.json "s3://$cd_url/versions.json"

# create invalidation to clear cloudfront cache
aws cloudfront create-invalidation --distribution-id "$AWS_DIST" --paths "$cd_path/latest"
