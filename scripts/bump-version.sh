#!/usr/bin/env bash
# Usage: ./scripts/bump-version.sh <version>
# Example: ./scripts/bump-version.sh 1.2.0
set -euo pipefail

# ── arg / semver validation ───────────────────────────────────────────────
if [ $# -ne 1 ]; then
  echo "Usage: $0 <version>  (e.g. 1.2.0 or v1.2.0)" >&2
  exit 1
fi

VERSION="${1#v}"  # strip leading 'v' if present

if ! printf '%s' "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "Error: '$VERSION' is not a valid semver (expected X.Y.Z)" >&2
  exit 1
fi

TAG="v${VERSION}"

# ── guard: must be run from repo root ────────────────────────────────────
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

# ── guard: no uncommitted changes ────────────────────────────────────────
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Error: working tree has uncommitted changes. Commit or stash them first." >&2
  exit 1
fi

# ── guard: tag must not already exist ────────────────────────────────────
if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Error: tag '$TAG' already exists." >&2
  exit 1
fi

echo "Bumping to $TAG..."

# ── capture old version before bump ──────────────────────────────────────
OLD_VERSION="$(node -p "require('./package.json').version")"

# ── update package.json files ────────────────────────────────────────────
npm version "$VERSION" --no-git-tag-version --workspaces --include-workspace-root

# ── update tauri.conf.json ────────────────────────────────────────────────
TAURI_CONF="packages/desktop/src-tauri/tauri.conf.json"
jq --arg v "$VERSION" '.version = $v' "$TAURI_CONF" > /tmp/_tauri.conf.json
mv /tmp/_tauri.conf.json "$TAURI_CONF"

# ── update Cargo.toml (only the [package] version, not deps) ─────────────
sed -i "0,/^version = /s/^version = \"[^\"]*\"/version = \"$VERSION\"/" \
  packages/desktop/src-tauri/Cargo.toml

# ── update README.md version references (unstaged) ───────────────────────
OLD_VERSION_ESC="${OLD_VERSION//./\\.}"
sed -i "s/${OLD_VERSION_ESC}/${VERSION}/g" README.md
echo "Updated README.md: $OLD_VERSION → $VERSION (unstaged)"

echo ""
echo "Done. Review changes, then:"
echo "  git add -p && git commit -m \"chore: release $TAG\" && git tag $TAG"
echo "  git push && git push origin $TAG"
