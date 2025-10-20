/**
 * Browser runtime shim to ensure process.versions.node exists.
 * Some bundled dependencies branch on the Node major version.
 * We inject the build-time Node version so version parsing logic works.
 */
(function ensureProcessVersionsNode() {
  const node22 = '22.12.0';
  if (typeof process === 'undefined') return; // No process object at all
  if (!process.versions) process.versions = {};
  if (!process.versions.node) {
    try {
      process.versions.node = (typeof __BUILD_NODE_VERSION__ !== 'undefined')
        ? __BUILD_NODE_VERSION__
        : node22;
    } catch (e) {
      process.versions.node = node22;
    }
  }
})();
