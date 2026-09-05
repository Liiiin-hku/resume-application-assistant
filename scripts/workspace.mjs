import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { root, checkpoint } from "./checkpoint.mjs";
process.chdir(root);
function run(script, args = []) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      PLAYWRIGHT_BROWSERS_PATH: path.join(
        root,
        "artifacts",
        "playwright-browsers",
      ),
    },
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(
      `${path.basename(script)} 执行失败（退出码 ${result.status}）`,
    );
}
function install() {
  const paths = [
    ...process.env.PATH.split(path.delimiter),
    path.join(
      os.homedir(),
      ".cache",
      "codex-runtimes",
      "codex-primary-runtime",
      "dependencies",
      "bin",
      "fallback",
    ),
  ];
  const pm = paths
    .map((p) =>
      path.join(p, process.platform === "win32" ? "pnpm.cmd" : "pnpm"),
    )
    .find((p) => fs.existsSync(p));
  if (!pm)
    throw new Error(
      "未找到 pnpm。请安装 Node.js 22+ 与 pnpm，再运行本入口；已有 dist/extension 可直接安装，无需构建。",
    );
  // Static install verb; no user-controlled command text or mutation outside workspace.
  const result =
    process.platform === "win32"
      ? spawnSync(
          "cmd.exe",
          ["/d", "/s", "/c", `""${pm}" install --frozen-lockfile"`],
          { cwd: root, stdio: "inherit", windowsVerbatimArguments: true },
        )
      : spawnSync(pm, ["install", "--frozen-lockfile"], {
          cwd: root,
          stdio: "inherit",
        });
  if (result.status !== 0)
    throw new Error("依赖安装失败，请检查网络和上方报错");
}
const command = process.argv[2] || "build";
try {
  if (command === "install") {
    install();
  } else if (command === "build") {
    if (!fs.existsSync("node_modules/esbuild")) install();
    run("scripts/build.mjs");
    run("scripts/audit.mjs");
  } else if (command === "check") {
    run("node_modules/typescript/bin/tsc", ["--noEmit"]);
    run("node_modules/vitest/vitest.mjs", ["run"]);
    run("scripts/build.mjs");
    run("scripts/audit.mjs");
  } else if (command === "e2e") {
    run("node_modules/@playwright/test/cli.js", ["install", "chromium"]);
    run("scripts/fixtures.mjs");
    run("node_modules/@playwright/test/cli.js", ["test"]);
  } else throw new Error("支持 install / build / check / e2e");
  await checkpoint({
    step: `维护入口 ${command}`,
    result: "success",
    summary: `命令 ${command} 正常结束；具体测试范围见产物报告`,
    next: "核对测试范围并更新交接状态",
  });
} catch (e) {
  console.error(`\n执行失败：${e.message}`);
  await checkpoint({
    step: `维护入口 ${command}`,
    result: "failure",
    summary: e.message,
    next: "修复报错后重新执行同一命令",
  });
  process.exitCode = 1;
}
