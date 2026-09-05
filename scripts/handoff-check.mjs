import fs from "node:fs";
import path from "node:path";
import { root } from "./checkpoint.mjs";
const order = [
  "AGENTS.md",
  "memory/PROJECT.md",
  "memory/STATUS.md",
  "memory/DECISIONS.md",
];
const texts = order.map((file) => {
  const value = fs.readFileSync(path.join(root, file), "utf8");
  if (!value.trim()) throw new Error(`交接文件为空：${file}`);
  return value;
});
if (!texts[2].includes("下一步") || !texts[2].includes("0.1.0"))
  throw new Error("STATUS 未包含当前版本与下一步");
const sessions = fs
  .readdirSync(path.join(root, "memory", "sessions"))
  .filter((f) => f.endsWith(".md"));
if (!sessions.length) throw new Error("缺少会话摘要");
const manifest = JSON.parse(
  fs.readFileSync(
    path.join(root, "dist", "extension", "manifest.json"),
    "utf8",
  ),
);
if (manifest.version !== "0.1.0") throw new Error("构建版本与交接状态不一致");
const report = {
  time: new Date().toISOString(),
  result: "pass",
  readOrder: order,
  version: manifest.version,
  next: texts[2]
    .split("\n")
    .filter((s) => s.startsWith("下一步"))
    .slice(-2),
  sessions: sessions.length,
  scope: "新Node进程读取实际文件的交接自检；不是另一个Codex会话或真实Hook触发",
};
fs.writeFileSync(
  path.join(root, "artifacts", "handoff-check.json"),
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
