#!/usr/bin/env bash

function build_release_notes() {
  version=""
  context=""

  while read -r line;
  do
    # we only want what's before the first of these lines -- which indicate a version
    if [[ $line =~ ^\#[[:space:]][0-9] ]]; then
      if [[ $version = "" ]]; then
        version=$line
        continue
      else
        break
      fi
    fi

    # only print these context (Added, Fixed, Changed) lines if they actually document changes
    if [[ $line =~ ^\#\#[[:space:]] ]]; then
      context="${line//:|#/\\$0}"
      continue
    fi

    # a blank line indicates the end of a context
    if [[ $line =~ ^[[:space:]]*$ ]]; then
      if [[ $context = "" ]]; then
        echo $line
      else
        context=""
      fi
      continue
    fi

    # this is a documented change, so we will print the associate context as well
    if [[ $line =~ ^\*[[:space:]] ]]; then
      if [[ ! $context = "" ]]; then
        echo $context
        context=""
      fi
      echo "${line//:|*/\\$0}"
    fi
  done < CHANGELOG.md
}


 #######################
##                     ##
##   Push to GitHub    ##
##                     ##
 #######################
echo "Get all history to merge into the github remote"
if $(git rev-parse --is-shallow-repository); then
  git fetch --unshallow origin master
else
  git fetch origin 
fi

git checkout origin/master

RELVER=$(node --eval="process.stdout.write(require('./package.json').version)")

git remote add github https://F5ESEAnalytics:${GH_TOKEN}@github.com/F5Networks/f5-appsvcs-templates
git fetch github master
git checkout github/master
git merge origin/master
git push github HEAD:master


 ############################
##                          ##
##   GitHub Release Draft   ##
##                          ##
 ############################
echo "Download rpm/hash from artifactory"
wget -qO f5-appsvcs-templates-${RELVER}-1.noarch.rpm https://artifactory.f5net.com:443/artifactory/f5-automation-toolchain-generic/f5-appsvcs-templates/${RELVER}/f5-appsvcs-templates-${RELVER}-1.noarch.rpm;
wget -qO f5-appsvcs-templates-${RELVER}-1.noarch.rpm.sha256.txt https://artifactory.f5net.com:443/artifactory/f5-automation-toolchain-generic/f5-appsvcs-templates/${RELVER}/f5-appsvcs-templates-${RELVER}-1.noarch.rpm.sha256.txt


echo "Set up gh api and create the new release"
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
  | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
      | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
        && apt update \
        && apt install gh -y

gh auth login --with-token ${GH_TOKEN}

build_release_notes | gh release create v${RELVER} --notes-start-tag v${RELVER} --target master -d -t v${RELVER} -F - f5-appsvcs-templates-${RELVER}-1.noarch.rpm f5-appsvcs-templates-${RELVER}-1.noarch.rpm.sha256.txt


 #################################
##                               ##
##   GitLab Release Candidate 0  ##
##                               ##
 #################################
echo "Set up permissions for new minor-rc.0 version on develop"
git config --global user.name $GITLAB_SERVICE_ACCOUNT_USER
git config --global user.email $GITLAB_SERVICE_ACCOUNT_EMAIL
git remote add mystique https://gitlab-ci-token:${GITLAB_SERVICE_ACCOUNT_TOKEN}@gitswarm.f5net.com/automation-toolchain/mystique.git/

git fetch mystique develop
git checkout mystique/develop

current_version=($(echo $RELVER | tr "." " "))
new_minor=$((current_version[1]+1))
new_version="${current_version[0]}.${new_minor}.0"

npm version "${new_version}-rc.0" -m 'Bump version to %s'

sed -i'.bu' "s/version: .*$/version: $new_version/" docs/openapi.yml
rm docs/openapi.yml.bu

echo -e "# ${new_version}\n## Added\n\n## Fixed\n\n## Changed\n\n$(cat CHANGELOG.md)" > CHANGELOG.md
git commit --amend --no-edit CHANGELOG.md docs/openapi.yml

echo "push v${new_version}-rc.0 to gitlab"
git push mystique HEAD:develop
