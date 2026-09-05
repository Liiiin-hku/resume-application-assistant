import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { root, checkpoint } from "./checkpoint.mjs";
const dir = path.join(root, "artifacts", "edge-smoke-profile");
const report = {
  time: new Date().toISOString(),
  environment: "本机 Microsoft Edge，headless，隔离测试资料目录",
  result: "pending",
  checks: [],
};
let context;
try {
  context = await chromium.launchPersistentContext(dir, {
    channel: "msedge",
    headless: true,
    args: ["--enable-unsafe-extension-debugging"],
    ignoreDefaultArgs: ["--disable-extensions"],
  });
  report.version = context.browser().version();
  const cdp = await context.browser().newBrowserCDPSession();
  const { id } = await cdp.send("Extensions.loadUnpacked", {
    path: path.join(root, "dist", "extension"),
  });
  const page = await context.newPage();
  await page.goto(`chrome-extension://${id}/options.html`);
  await page.locator("#resume-file").waitFor();
  await page
    .locator("#resume-file")
    .setInputFiles(path.join(root, "tests", "fixtures", "虚构简历.docx"));
  await page.locator("#accept-import").waitFor();
  if ((await page.getByLabel("待确认 学校名称", { exact: true }).count()) !== 2)
    throw new Error("DOCX 教育字段数量错误");
  report.checks = [
    "本机Edge通过CDP加载交付目录",
    "真实MV3选项页启动",
    "本地DOCX解析并展示两条待确认教育记录",
  ];
  report.result = "pass";
  await page.setViewportSize({ width: 1050, height: 850 });
  await page.screenshot({
    path: path.join(root, "artifacts", "Edge资料导入.png"),
  });
} catch (e) {
  report.result = "failure";
  report.error = e.message;
  process.exitCode = 1;
} finally {
  if (context) await context.close();
  if (
    path.resolve(dir) === path.join(root, "artifacts", "edge-smoke-profile") &&
    fs.existsSync(dir)
  )
    fs.rmSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(root, "artifacts", "edge-smoke.json"),
    JSON.stringify(report, null, 2),
  );
  await checkpoint({
    step: "本机Edge隔离冒烟测试",
    result: report.result === "pass" ? "success" : "failure",
    summary:
      report.result === "pass"
        ? `Edge ${report.version} 实际加载扩展和DOCX解析通过；未做人工工具栏安装或完整表单回归`
        : `自动化未通过：${report.error}`,
    next: "在报告中区分Edge冒烟、Chromium完整回归和人工待验收",
  });
  console.log(JSON.stringify(report, null, 2));
}
