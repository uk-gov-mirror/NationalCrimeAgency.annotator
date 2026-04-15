# GitHub Actions Workflows

This directory contains automated workflows for continuous integration and release management.

> **Note:** This project uses [Conventional Commits](https://www.conventionalcommits.org/) for commit messages.
> Release notes are automatically generated from commit histories.

## Workflows

### Configuration (`config.yml`)

Defines the Elastic stack version and target architecture for all other workflows.

Called by `plugin.yml` and `release.yml` before any other jobs.
Both workflows propagate the outputs downstream to `kibana.yml` and build steps.

### Kibana Development Environment (`kibana.yml`)

Builds a Kibana development environment and yarn repository.

Bootstrapping a Kibana development environment takes considerable time,
so it is cached by architecture and version.
The Kibana source repository and yarn packages are similarly cached to speed up subsequent runs.

### Plugin (`plugin.yml`)

Builds the plugin.

**Triggers:**
- Push to `main`
- Pull requests targeting `main`
- Manual dispatch

**Jobs:**

1. **Config** — Resolves the stack version and architecture from `config.yml`
2. **Setup Kibana** — Creates or restores the cached Kibana development environment
3. **Build plugin** — Full build pipeline:
   - Restores Kibana source and yarn caches
   - Bootstraps the plugin into the Kibana tree
   - Lints with ESLint (`node ../../scripts/eslint`)
   - Builds the distributable zip
   - Runs the full test suite with coverage reporting
   - Uploads the zip as a workflow artefact

### Commit Lint (`commitlint.yml`)

Linting checks.

**Triggers:**
- Pull requests (opened, synchronised, reopened)

**Purpose:**
Validates all commit messages in a PR follow the Conventional Commits format.

**Format:**
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Allowed types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks (dependencies, config, etc.)
- `ci`: CI/CD changes
- `build`: Build system changes
- `revert`: Revert a previous commit

**Examples:**
```
feat(annotations): add single-select control type
fix(formatter): resolve badge rendering for nested fields
docs: update deployment configuration examples
chore(deps): bump dependencies to latest
```

**Breaking Changes:**
```
feat(api)!: remove deprecated annotation endpoint

BREAKING CHANGE: The /api/annotations/v1 endpoint has been removed.
Migrate to /api/annotations/v2 which supports nested field paths.
```

### Version Bump (`version-bump.yml`)

Entry point for version management and the full release chain. Triggered manually via the Actions tab.

**Triggers:**
- Manual dispatch. At least one input must be provided:
  - `version` — plugin version, without `v` prefix (e.g. `1.2.0`). Triggers a full release.
  - `stackVersion` — Kibana stack version (e.g. `8.20.0`). Updates all stack version references.
  - Both can be supplied together for a combined bump.

**Jobs:**

1. **Bump** — Updates version numbers and pushes to main:
   - If `version`: updates `package.json` and `kibana.json`
   - If `stackVersion`: updates `config.yml`, `Dockerfile`, `push-image.sh`, and `README.md`,
     replacing all occurrences of the previous stack version
   - Commits with a message reflecting what changed and pushes to `main`
   - Provides instructions for manual tagging after CI passes

**⚠️ Important Limitation:**

GitHub Actions workflows triggered by the default `GITHUB_TOKEN` **cannot trigger other workflows**
(security feature to prevent infinite loops). This means `plugin.yml` won't automatically run after
the version bump push.

**Solutions:**

1. **Option A: Manual tagging** (current default):
   - After version-bump.yml completes, manually check that CI passes
   - Then manually create and push the git tag:
     ```bash
     git fetch origin main && git checkout main && git pull
     git tag v1.2.0
     git push origin v1.2.0
     ```
   - This triggers `release.yml`

2. **Option B: Use a Personal Access Token**:
   - Create a fine-grained PAT with `Contents: Read and write` + `Workflows: Read and write`
   - Store it as repository secret `RELEASE_PAT`
   - Workflow will automatically trigger CI and create tag after CI passes
   - Best for automated releases

> **Branch protection:** If your branch rules prevent `GITHUB_TOKEN` from pushing to `main`,
> you **must** use Option B (RELEASE_PAT).

### Release (`release.yml`)

Creates a new release.

**Triggers:**
- Push of version tags matching `v*.*.*` (e.g. `v1.2.0`) — normally via `version-bump.yml`

**Jobs:**

1. **Config** — Resolves the stack version and architecture from `config.yml`
2. **Release** — Creates a GitHub release:
   - Downloads the zip built by the `plugin.yml` CI run for the tagged commit
     (fails fast if no successful CI run exists for that commit)
   - Checks out the full git history (`fetch-depth: 0`) for commit range analysis
   - Generates release notes by parsing conventional commits since the previous tag,
     grouped by type (Features, Bug Fixes, Performance, Documentation, etc.)
   - Creates a GitHub release with the zip attached
3. **Verify** — Downloads the release assets and confirms the plugin zip is present

## Bumping the Kibana Version

All stack version references are updated automatically. Run the version bump workflow
with the `stackVersion` input:

```bash
gh workflow run version-bump.yml -f stackVersion=8.20.0
```

This updates `config.yml`, `Dockerfile`, `push-image.sh`, and `README.md` in a single commit.

After the push, **invalidate the Kibana cache** (optional but recommended):
navigate to Actions → Caches in GitHub and delete the `kibana-linux-x86_64-<old-version>`
entry so `kibana.yml` clones and bootstraps the new version fresh on the next run.

## Creating a Release

Since this project uses Conventional Commits, release notes are **fully automated**.
Version bumping requires a few manual steps due to GitHub Actions security limitations.

1. **Ensure all commits on `main` follow conventional commits format.**

2. **Trigger the version bump workflow:**
   ```bash
   gh workflow run version-bump.yml -f version=1.2.0

   # Or combined with a Kibana version upgrade
   gh workflow run version-bump.yml -f version=1.2.0 -f stackVersion=8.20.0
   ```
   Or via the Actions tab: select **Version Bump** → **Run workflow** → enter the inputs.

3. **Wait for the version bump workflow to complete.**
   It will update `package.json`, `kibana.json`, and other files, then push to `main`.

4. **Verify CI passes:**
   - Check if `plugin.yml` automatically started (if you have `RELEASE_PAT` configured)
   - If not, manually trigger `plugin.yml` on the `main` branch via Actions tab
   - Wait for it to complete successfully

5. **Create and push the git tag:**
   ```bash
   git fetch origin main
   git checkout main
   git pull origin main
   git tag v1.2.0
   git push origin v1.2.0
   ```

6. **The release workflow automatically triggers** when the tag is pushed:
   - Downloads the plugin zip from the CI run
   - Generates release notes from conventional commits
   - Creates the GitHub release with the zip attached

7. **Monitor progress** in the Actions tab:
   `version-bump.yml` → (manual CI check) → (manual tag) → `release.yml`

**Release Notes Example:**

When pushing tag `v1.2.0`, the workflow analyses all conventional commits since `v1.1.0`:

```markdown
# Release 1.2.0

## ✨ Features
- **annotations**: add single-select control type
- **formatter**: support icon-only badge display mode

## 🐛 Bug Fixes
- **routes**: resolve privilege check for nested field paths

## ♻️ Refactoring
- **components**: extract shared badge logic into utility

## 🔧 Maintenance
- **deps**: bump dependencies to latest

---
**Full Changelog**: https://github.com/NationalCrimeAgency/annotator/compare/v1.1.0...v1.2.0
```

## Running Checks Locally

Before pushing, ensure checks pass locally:

```bash
# Bootstrap dependencies
yarn bootstrap

# Lint
node ../../scripts/eslint .

# Build
yarn build --kibana-version "8.19.12"

# Test with coverage
yarn test:coverage
```

## Troubleshooting

### CI Doesn't Trigger After Version Bump

**Problem:** After `version-bump.yml` pushes to `main`, `plugin.yml` doesn't automatically start.

**Cause:** GitHub Actions workflows triggered by the default `GITHUB_TOKEN` cannot trigger other workflows (security feature).

**Solutions:**

1. **Manual trigger** (simplest):
   - Go to Actions tab → Select `CI` workflow
   - Click "Run workflow" → Select `main` branch → Run
   - Wait for it to pass, then manually create the git tag

2. **Set up RELEASE_PAT** (automated):
   - Create a fine-grained Personal Access Token:
     - Permissions: `Contents: Read and write` + `Workflows: Read and write`
     - Repository access: Select your repository
   - Add as repository secret: `RELEASE_PAT`
   - Next run will automatically trigger CI and create tags

### Kibana Cache Miss

If the Kibana cache is stale or corrupted, delete it via Actions → Caches in GitHub.
The `setup_kibana` job will clone and bootstrap Kibana fresh on the next run.

### Release Tag Already Exists

To re-run a release:

```bash
# Delete locally and remotely
git tag -d v1.2.0
git push origin :refs/tags/v1.2.0

# Delete the GitHub release (via UI or CLI)
gh release delete v1.2.0

# Re-trigger by running the version bump workflow again
gh workflow run version-bump.yml -f version=1.2.0
```

### Release Fails to Find CI Artefact

The release workflow downloads the zip produced by the `plugin.yml` run for the tagged commit.
If no successful CI run exists, it will exit with:

```
No successful CI run found for commit <sha>
```

Ensure the `plugin.yml` workflow completed successfully on the commit before pushing the tag.
Note that GitHub Actions artefacts expire after 90 days — tag promptly after merging.

### Build Failures

Common causes:

1. **Bootstrap fails** — Check if the Kibana version in `config.yml` matches the checked-out source
2. **Lint failures** — Run `node ../../scripts/eslint .` locally and fix reported issues
3. **Test failures** — Run `yarn test:coverage` locally; check for environment-specific mocking issues
4. **Artefact upload missing** — Confirm the build zip path glob matches `build/*.zip`
