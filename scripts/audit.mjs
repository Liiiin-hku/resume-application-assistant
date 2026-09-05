import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { root } from "./checkpoint.mjs";
const out = path.join(root, "dist", "extension");
const m = JSON.parse(fs.readFileSync(path.join(out, "manifest.json"), "utf8"));
assert.equal(m.manifest_version, 3);
assert.deepEqual(
  [...m.permissions].sort(),
  ["activeTab", "scripting", "storage", "sidePanel"].sort(),
);
assert(!m.host_permissions);
assert(!m.externally_connectable);
assert(!m.content_scripts);
assert(!m.update_url);
assert(
  !fs
    .readFileSync(path.join(out, "content.js"), "utf8")
    .includes("chrome.storage"),
);
assert(
  m.content_security_policy.extension_pages.includes("connect-src 'self'"),
);
const files = fs
  .readdirSync(out, { recursive: true })
  .filter((f) => fs.statSync(path.join(out, f)).isFile());
for (const file of files) {
  assert(
    !/(^|[\\/])(memory|data|tests|artifacts|node_modules|\.git)([\\/]|$)/.test(
      file,
    ),
  );
  assert(!/\.(pdf|docx|zip|log|map)$/i.test(file));
  if (/\.(html|js|mjs|json|css)$/.test(file)) {
    const text = fs.readFileSync(path.join(out, file), "utf8");
    assert(!text.includes("FICTIONAL_PRIVATE_CANARY_2026"));
    assert(!text.includes("虚构测试员甲"));
    assert(!text.includes("sk-TEST_SECRET_CANARY"));
    assert(!/<script[^>]+src=["']https?:/i.test(text));
  }
}
const report = {
  time: new Date().toISOString(),
  result: "pass",
  files: files.length,
  bytes: files.reduce((n, f) => n + fs.statSync(path.join(out, f)).size, 0),
  permissions: m.permissions,
  defaultHostPermissions: [],
  bundleHash: crypto
    .createHash("sha256")
    .update(
      files
        .sort()
        .map(
          (f) =>
            f +
            crypto
              .createHash("sha256")
              .update(fs.readFileSync(path.join(out, f)))
              .digest("hex"),
        )
        .join("\n"),
    )
    .digest("hex"),
};
fs.writeFileSync(
  path.join(root, "artifacts", "bundle-audit.json"),
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
