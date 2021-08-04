# FAST Release Process

## Release Artifacts

* Each FAST release has multiple artifacts:
  * RPM
  * RPM sha256 checksum
* RPM is built on every pipeline run, and is kept for one week
* The atg-build project automatically tags and pushes the artifacts to the repo (f5-automation-toolchain-generic/f5-appsvcs-templates)
* On a release, artifacts are copied from the artifact repo to GitHub and are made available as release artifacts

## Release Notes

* Release notes are tracked during development in `CHANGELOG.md`

## Release branches

A release branch may be needed for instances like out-of-band bugfix releases.

* Create a new release branch
  * Make sure that your local git refs are up to date
  * Create the branch from the `master` branch or the appropriate tag.
  * Use the major and minor version as the name of the branch.
    Example:

    ```bash
    git fetch
    git checkout master
    git checkout -b release-1.10
    ```

In the case when we need to "stage" the release work and continue future release work in develop:

* Create new release branch from head of `develop`.
  * Use the major and minor version as the name of the branch.
    Example:

    ```bash
    git fetch
    git checkout develop
    git checkout -b release-1.10
    ```

* Bump the version in `develop` to the next minor's pre-release. For example if you just created release branch `release-1.10`, the new version should be `1.11.0-rc.0`. See section for `Updating Versions`.

## Updating Versions

* Use `npm version <newversion>` to perform version updates. Note that by default it will create a git commit and tag with the updated files.
    Example:
    ```bash
    # will create a commit message "Bump version to 1.11.0-rc.0
    npm version 1.11.0-rc.0 -m 'Bump version to %s'
    # we're not pushing the tag v1.11.0-rc.0, just the commit
    git push
    # Note that atg-build uses the following to bump subsequent versions
    # npm version prerelease --preid=rc -m 'Bump version to %s'
    ```
* Add new block to `CHANGELOG.md`

## Process for release candidates

* Manually trigger integration tests and verify that they are passing.
* Go to the FAST RC schedule of `atg-build` project.
  * This is set to weekly schedule but can be triggered on demand.
  * Once the schedule runs, it will:
    * Update and commit the RC build number (e.g. 1.10.0-rc.1) changes.
    * Create a tag with the updated version (e.g. v1.10.0-rc.1).
    * Upload the build artifacts.
    * Send a release email to the configured recipient in the schedule.
* Once the pipeline is successful, forward the release email to the distribution list.

## Process for release

* `f5-fast-core` is released in tandem with `f5-appsvcs-templates`.
    * We usually tag and publish to NPM a few days before a `f5-appsvcs-templates` release.
    * Make sure to update package dependency to the latest `f5-fast-core` version.
* Manually trigger integration tests and verify that they are passing.
* Merge latest changes from the branch with release changes into master. For example:
  ```
    git checkout master
    git merge develop
    git push
  ```
* Trigger a new FAST Release schedule from `atg-build` project. Once the schedule runs, it will:
    * Update and commit the release build number (e.g. 1.10.0).
    * Create a tag with the updated version (e.g. v1.10.0).
    * Upload the build artifacts.
    * Send a release email to the configured recipient in the schedule.

#### GitHub Publishing
* Push to GitHub master:
  * Create the GitHub remote (as needed):
    * git remote add github https://github.com/f5networks/f5-appsvcs-templates.git
  * git push github master
  * git push github tag vX.Y.Z
* Create GitHub release - [GitHub Releases](https://github.com/F5Networks/f5-appsvcs-templates/releases)
  * Navigate to the latest release, select `edit` and upload the artifacts:
    * `.rpm` file
    * `.sha256` file
  * Copy release notes from changelog into the release description

## Post-Release

* Merge `master` back into `develop` once all the release process has been completed
* Update `develop` files with the next minor's pre-release. For example, version 1.10.0 should be updated with 1.11.0-rc.0 (See `Updating Versions` section above)
