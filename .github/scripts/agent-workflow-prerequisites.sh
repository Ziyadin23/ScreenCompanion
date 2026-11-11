#!/usr/bin/env bash
set -euo pipefail

# The sandbox mounts /usr read-only; setup-node's /opt toolcache is unavailable inside it.
node_source=$(readlink -f "$(command -v node)")
npm_source=$(readlink -f "$(command -v npm)")
node_prefix=$(dirname "$(dirname "$node_source")")
test "$npm_source" = "$node_prefix/lib/node_modules/npm/bin/npm-cli.js"
sudo install -d /usr/local/lib/sc-ci-node
sudo cp -a "$node_prefix/." /usr/local/lib/sc-ci-node/
sudo ln -sfn /usr/local/lib/sc-ci-node/bin/node /usr/bin/node
sudo ln -sfn /usr/local/lib/sc-ci-node/bin/npm /usr/bin/npm
cmp "$node_source" /usr/bin/node
cmp "$npm_source" "$(readlink -f /usr/bin/npm)"
diff -qr "$node_prefix/lib/node_modules/npm" /usr/local/lib/sc-ci-node/lib/node_modules/npm
test "$(node --version)" = "$(/usr/bin/node --version)"
test "$(npm --version)" = "$(/usr/bin/npm --version)"

if test "${SC_CI47_DIAGNOSTICS:-}" = 1; then
  node "$(dirname "$0")/ci-network-diagnostics.mjs"
  exit 1
fi
node "$(dirname "$0")/install-bubblewrap.mjs"
# Ubuntu 24.04 AppArmor otherwise strips capabilities needed for bwrap's namespace setup.
# This setting lives only for this fresh GitHub-hosted runner job.
sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0
test "$(sysctl -n kernel.apparmor_restrict_unprivileged_userns)" = 0
test "$(sysctl -n kernel.unprivileged_userns_clone)" = 1
test "$(sysctl -n user.max_user_namespaces)" -gt 0
/usr/bin/bwrap --unshare-user --unshare-pid --unshare-net --ro-bind / / --proc /proc -- \
  /usr/bin/bwrap --unshare-user --unshare-pid --unshare-net --ro-bind / / --proc /proc -- /usr/bin/true

npm install --global --no-audit --no-fund @fission-ai/openspec@1.16.0
test "$(openspec --version)" = 1.16.0
