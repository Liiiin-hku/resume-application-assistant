import {
  test,
  expect,
  chromium,
  type BrowserContext,
  type Page,
  type Worker,
} from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
const root = process.cwd(),
  base = "http://127.0.0.1:4173";
let context: BrowserContext,
  ui: Page,
  target: Page,
  worker: Worker,
  id: string,
  profileDir: string;
test.beforeEach(async () => {
  profileDir = path.join(
    root,
    "artifacts",
    "test-profiles",
    crypto.randomUUID(),
  );
  context = await chromium.launchPersistentContext(profileDir, {
    channel: "chromium",
    headless: true,
    args: [
      "--enable-unsafe-extension-debugging",
      `--disable-extensions-except=${path.join(root, "dist", "extension")}`,
      `--load-extension=${path.join(root, "dist", "extension")}`,
    ],
  });
  worker =
    context.serviceWorkers()[0] ||
    (await context.waitForEvent("serviceworker"));
  id = worker.url().split("/")[2];
  ui = await context.newPage();
  await ui.goto(`chrome-extension://${id}/panel.html`);
  await expect(ui.locator("#scan-page")).toBeVisible();
  target = await context.newPage();
  await target.goto(`${base}/native.html`);
});
test.afterEach(async () => {
  await context?.close();
  if (
    profileDir.startsWith(
      path.join(root, "artifacts", "test-profiles") + path.sep,
    )
  )
    fs.rmSync(profileDir, { recursive: true, force: true });
});
async function grant() {
  await target.bringToFront();
  const cdp = await context.newCDPSession(target);
  const info = await cdp.send("Target.getTargetInfo");
  const browserCDP = await context.browser()!.newBrowserCDPSession();
  const targets = await browserCDP.send("Target.getTargets", {
    filter: [{ type: "tab", exclude: false }],
  });
  const tab = targets.targetInfos.find((t) => t.url === target.url());
  if (!tab)
    throw new Error("未找到测试网页tab target: " + JSON.stringify(targets));
  await browserCDP.send("Extensions.triggerAction" as any, {
    id,
    targetId: tab.targetId,
  });

  await browserCDP.detach();
  await cdp.detach();
}
async function importProfile() {
  await ui.getByRole("button", { name: "① 资料库", exact: true }).click();
  await ui.getByText("导入资料 JSON 备份", { exact: true }).click();
  await ui
    .locator("#json-file")
    .setInputFiles(path.join(root, "tests", "fixtures", "虚构示例资料.json"));
  await expect(ui.locator("#accept-import")).toBeVisible();
  for (const check of await ui.locator(".incoming input[type=checkbox]").all())
    await check.check();
  await ui.locator("#accept-import").click();
  await expect(ui.locator("[role=status]")).toContainText("资料已保存");
  await ui.getByRole("button", { name: "② 当前页填写", exact: true }).click();
}
async function scan() {
  await target.bringToFront();
  await ui.locator("#scan-page").click();
  await expect(ui.locator("[role=status]")).toContainText("扫描完成");
}
async function fill() {
  ui.once("dialog", (d) => d.accept());
  await ui.locator("#scan-only").uncheck();
  await ui.locator("#fill-selected").click();
  await expect(ui.locator("[role=status]")).toContainText("本次结果", {
    timeout: 25000,
  });
}
test("真实扩展：导入资料→授权→只扫描预览→填写→无覆盖无声明无提交→撤销保护", async () => {
  await importProfile();
  await grant();
  await scan();
  await expect(target.locator("[name=name]")).toHaveValue("");
  await expect(ui.locator("#fill-selected")).toBeDisabled();
  await ui.setViewportSize({ width: 450, height: 900 });
  await ui.screenshot({ path: "artifacts/填写预览.png" });
  await fill();
  await expect(target.locator("[name=name]")).toHaveValue("虚构测试员甲");
  await expect(target.locator("[name=email]")).toHaveValue(
    "fictional@example.invalid",
  );
  await expect(target.locator("[name=currentCity]")).toHaveValue(
    "网页已有城市",
  );
  await expect(target.locator("[name=school]")).toHaveValue("虚构大学甲");
  await expect(target.locator("[name=educationEndDate]")).toHaveValue(
    "2024-06-30",
  );
  await expect(target.locator("[name=qualification]")).toHaveValue("undergrad");
  await expect(target.locator("[name=gender][value=female]")).toBeChecked();
  await expect(target.locator("[name=cities][value=a]")).toBeChecked();
  await expect(target.locator("[name=cities][value=b]")).toBeChecked();
  for (const name of [
    "emergencyName",
    "emergencyPhone",
    "nationalId",
    "captcha",
    "expectedSalary",
    "gpa",
  ])
    await expect(target.locator(`[name=${name}]`)).toHaveValue("");
  await expect(target.locator("[name=privacy]")).not.toBeChecked();
  expect(await target.evaluate(() => (window as any).submitCount)).toBe(0);
  await target.locator("[name=name]").fill("用户随后修改");
  ui.once("dialog", (d) => d.accept());
  await ui.locator("#undo-fill").click();
  await expect(ui.locator("[role=status]")).toContainText("撤销核验成功", {
    timeout: 25000,
  });
  await expect(target.locator("[name=name]")).toHaveValue("用户随后修改");
  await expect(target.locator("[name=email]")).toHaveValue("");
  await ui.screenshot({ path: "artifacts/侧栏.png", fullPage: true });
});

test("暂停停止后续写入、取消可恢复重扫、无重复追加", async () => {
  await importProfile();
  await grant();
  await scan();
  await ui.locator("#scan-only").uncheck();
  ui.once("dialog", (d) => d.accept());
  await ui.locator("#fill-selected").click();
  await ui.locator("#pause-fill").click();
  await expect(ui.locator("#pause-fill")).toHaveText("继续");
  await ui.locator("#cancel-fill").click();
  await expect(ui.locator("[role=status]")).toContainText("已停止后续填写", {
    timeout: 10000,
  });
  await expect(target.locator("[name=school]")).toHaveValue("");
  expect(await target.evaluate(() => (window as any).submitCount)).toBe(0);
  await scan();
  await fill();
  await expect(target.locator("[name=school]")).toHaveValue("虚构大学甲");
});

test("动态受控表单：异步加载、原生setter进入模型、回退检测和只重试失败项", async () => {
  await importProfile();
  await target.goto(`${base}/dynamic.html`);
  await grant();
  await scan();
  await fill();
  expect(await target.evaluate(() => (window as any).model.name)).toBe(
    "虚构测试员甲",
  );
  expect(await target.evaluate(() => (window as any).model.email)).toBe(
    "fictional@example.invalid",
  );
  await expect(target.locator("[name=phone]")).toHaveValue("");
  await expect(ui.locator("[role=status]")).toContainText("失败 1");
  await target.locator("#mode").click();
  ui.once("dialog", (d) => d.accept());
  await ui.locator("#retry-failed").click();
  await expect(ui.locator("[role=status]")).toContainText("失败 0", {
    timeout: 10000,
  });
  expect(await target.evaluate(() => (window as any).model.phone)).toBe(
    "13800000000",
  );
  expect(await target.evaluate(() => (window as any).submitCount)).toBe(0);
});

test("真实React受控文本、单选、多选进入组件state且重渲染后保留", async () => {
  await importProfile();
  await target.goto(`${base}/react.html`);
  await expect(target.locator("[name=name]")).toBeVisible();
  await grant();
  await scan();
  await fill();
  const model = await target.evaluate(() => (window as any).reactModel);
  expect(model.name).toBe("虚构测试员甲");
  expect(model.email).toBe("fictional@example.invalid");
  expect(model.gender).toBe("女");
  expect(new Set(model.cities)).toEqual(new Set(["示例市甲", "示例市乙"]));
  expect(model.privacy).toBe(false);
  await target.locator("#rerender").click();
  await expect(target.locator("[name=gender][value=女]")).toBeChecked();
  await expect(target.locator("[name=cities][value=示例市甲]")).toBeChecked();
  expect(await target.evaluate(() => (window as any).submitCount || 0)).toBe(0);
});

test("多经历：显式关联本科硕士、项目、复杂控件交人工、重复扫描不新增", async () => {
  await importProfile();
  await target.goto(`${base}/repeated.html`);
  await grant();
  await scan();
  await expect(target.locator("[name=school1]")).toHaveValue("");
  await ui
    .getByText("确认经历顺序 / 分组关联（多条记录请检查）", { exact: true })
    .click();
  await ui
    .getByLabel("教育经历 1 对应经历", { exact: true })
    .selectOption("edu-undergrad");
  await ui
    .getByText("确认经历顺序 / 分组关联（多条记录请检查）", { exact: true })
    .click();
  await ui
    .getByLabel("教育经历 2 对应经历", { exact: true })
    .selectOption("edu-master");
  await fill();
  await expect(target.locator("[name=school1]")).toHaveValue("虚构大学甲");
  await expect(target.locator("[name=school2]")).toHaveValue("虚构大学乙");
  await expect(target.locator("[name=projectName]")).toHaveValue(
    "虚构装配测试项目",
  );
  await expect(target.locator("[name=searchSchool]")).toHaveValue("");
  await expect(target.locator("[name=conflict]")).toHaveValue("");
  await expect(target.locator("#terms")).not.toBeChecked();
  await scan();
  expect(await target.evaluate(() => (window as any).addCount)).toBe(0);
  expect(await target.evaluate(() => (window as any).submitCount)).toBe(0);
  await expect(target.locator("fieldset")).toHaveCount(4);
  await ui.screenshot({ path: "artifacts/多经历预览.png", fullPage: true });
});

test("手动字段关联、站点规则持久化及已有值覆盖须确认", async () => {
  await importProfile();
  await grant();
  await scan();
  const city = ui
    .locator(".plan-row")
    .filter({ has: ui.getByRole("strong" as any) });
  const row = ui
    .locator(".plan-row")
    .filter({ has: ui.getByText("现居地", { exact: true }) });
  ui.once("dialog", (d) => d.accept());
  await row.getByLabel("允许覆盖 现居地", { exact: true }).check();
  await row.getByLabel("填写 现居地", { exact: true }).check();
  await fill();
  await expect(target.locator("[name=currentCity]")).toHaveValue("示例市甲");
  await target.goto(`${base}/repeated.html`);
  await grant();
  await scan();
  const custom = ui
    .locator(".plan-row")
    .filter({ has: ui.getByText("内部备注", { exact: true }) });
  await custom.getByText("手动字段关联与复制", { exact: true }).click();
  await custom
    .getByLabel("手动关联 内部备注", { exact: true })
    .selectOption(JSON.stringify({ recordId: "basic-demo", key: "name" }));
  await custom.getByText("手动字段关联与复制", { exact: true }).click();
  await custom
    .getByRole("button", { name: "保存为本站规则", exact: true })
    .click();
  const stored = await ui.evaluate(async () =>
    chrome.storage.local.get("rules"),
  );
  expect(JSON.stringify(stored)).not.toContain("虚构测试员甲");
  await scan();
  await expect(
    custom.getByLabel("填写 内部备注", { exact: true }),
  ).toBeChecked();
});

test("权限不足、跨来源跳转、标签切换和结构变化使旧计划失效", async () => {
  await ui.locator("#scan-page").click();
  await expect(ui.locator("[role=status]")).toContainText("权限");
  await importProfile();
  await target.goto(`${base}/dynamic.html`);
  await grant();
  await scan();
  await target.locator("#mutate").click();
  ui.once("dialog", (d) => d.accept());
  await ui.locator("#scan-only").uncheck();
  await ui.locator("#fill-selected").click();
  await expect(ui.locator("[role=status]")).toContainText("结构已变化");
  await expect(target.locator("[name=name]")).toHaveValue("");
  await target.goto("http://localhost:4173/native.html");
  await expect(ui.locator(".plan-row")).toHaveCount(0);
  await ui.locator("#scan-page").click();
  await expect(ui.locator("[role=status]")).toContainText("权限");
  await grant();
  await scan();
  const another = await context.newPage();
  await another.goto(`${base}/native.html`);
  await another.bringToFront();
  await expect(ui.locator(".plan-row")).toHaveCount(0);
  await another.close();
});

test("后台实际停止后旧计划拒绝，重新扫描后恢复；资料不丢失", async () => {
  await importProfile();
  await grant();
  await scan();
  const cdp = await context.newCDPSession(target);
  await cdp.send("ServiceWorker.enable");
  await cdp.send("ServiceWorker.stopAllWorkers");
  await cdp.detach();
  ui.once("dialog", (d) => d.accept());
  await ui.locator("#scan-only").uncheck();
  await ui.locator("#fill-selected").click();
  await expect(ui.locator("[role=status]")).toContainText("旧计划已失效");
  await scan();
  await fill();
  await expect(target.locator("[name=name]")).toHaveValue("虚构测试员甲");
});

test("真正本地解析 PDF/DOCX，扫描件/损坏文件明确报错，无外网请求", async () => {
  const outside: string[] = [];
  context.on("request", (req) => {
    if (
      /^https?:/.test(req.url()) &&
      !req.url().startsWith(base) &&
      !req.url().startsWith("http://localhost:4173")
    )
      outside.push(req.url());
  });
  await ui.getByRole("button", { name: "① 资料库", exact: true }).click();
  await ui
    .locator("#resume-file")
    .setInputFiles(path.join(root, "tests", "fixtures", "fictional-text.pdf"));
  await expect(ui.locator("#accept-import")).toBeVisible({ timeout: 15000 });
  await expect(ui.getByLabel("待确认 姓名", { exact: true })).toHaveValue(
    "Fictional Applicant",
  );
  await ui.getByRole("button", { name: "取消本次导入", exact: true }).click();
  await ui
    .locator("#resume-file")
    .setInputFiles(path.join(root, "tests", "fixtures", "虚构简历.docx"));
  await expect(ui.locator("#accept-import")).toBeVisible();
  await expect(ui.getByLabel("待确认 学校名称", { exact: true })).toHaveCount(
    2,
  );
  await ui.getByRole("button", { name: "取消本次导入", exact: true }).click();
  for (const [file, text] of [
    ["no-text.pdf", "没有提取到可用文本"],
    ["corrupted.pdf", "PDF 解析失败"],
    ["corrupted.docx", "DOCX 解析失败"],
  ]) {
    await ui
      .locator("#resume-file")
      .setInputFiles(path.join(root, "tests", "fixtures", file));
    await expect(ui.locator("[role=status]")).toContainText(text);
  }
  expect(outside).toEqual([]);
  await ui.screenshot({ path: "artifacts/资料库.png", fullPage: true });
});

test("备份导出、重导入差异不覆盖、编辑取消确认、拒绝混入示例、清空需确认", async () => {
  await importProfile();
  await ui.getByRole("button", { name: "① 资料库", exact: true }).click();
  const downloadPromise = ui.waitForEvent("download");
  await ui.locator("#export-profile").click();
  const download = await downloadPromise;
  const exported = path.join(root, "artifacts", "fictional-export.json");
  await download.saveAs(exported);
  const p = JSON.parse(fs.readFileSync(exported, "utf8"));
  expect(p.demo).toBe(true);
  expect(p.records[0].facts.name.value).toBe("虚构测试员甲");
  p.records[0].facts.name.value = "新虚构名字";
  await ui.getByText("导入资料 JSON 备份", { exact: true }).click();
  await ui.locator("#json-file").setInputFiles({
    name: "fictional-mixing-rejection.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ ...p, demo: false })),
  });
  await expect(ui.locator("[role=status]")).toContainText(
    "虚构示例不能与正式资料混合",
  );
  await expect(ui.locator("#accept-import")).toHaveCount(0);
  expect(
    await ui.evaluate(
      async () =>
        ((await chrome.storage.local.get("profile")).profile as any).demo,
    ),
  ).toBe(true);
  await ui.locator("#json-file").setInputFiles({
    name: "changed.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(p)),
  });
  await expect(ui.getByLabel("待确认 姓名", { exact: true })).toHaveValue(
    "新虚构名字",
  );
  expect(
    await ui.evaluate(
      async () =>
        ((await chrome.storage.local.get("profile")).profile as any).records[0]
          .facts.name.value,
    ),
  ).toBe("虚构测试员甲");
  await ui.getByRole("button", { name: "取消本次导入", exact: true }).click();
  await ui.locator(".record").first().locator("summary").click();
  await ui.getByLabel("虚构测试员甲 姓名", { exact: true }).fill("虚构编辑");
  await expect(
    ui.getByLabel("虚构测试员甲 姓名事实已确认", { exact: true }),
  ).not.toBeChecked();
  await ui.locator("#save-profile").click();
  ui.once("dialog", (d) => d.dismiss());
  await ui.locator("#clear-profile").click();
  expect(
    await ui.evaluate(
      async () => !!(await chrome.storage.local.get("profile")).profile,
    ),
  ).toBe(true);
  ui.once("dialog", (d) => d.accept());
  await ui.locator("#clear-profile").click();
  await expect(ui.locator("[role=status]")).toContainText("已清空");
  expect(
    await ui.evaluate(
      async () => !!(await chrome.storage.local.get("profile")).profile,
    ),
  ).toBe(false);
});

test("资料库对content script不可读；网页伪造消息不能调用后台资料或填写", async () => {
  await importProfile();
  await grant();
  await scan();
  const result = await worker.evaluate(async () => {
    const [t] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    return chrome.scripting.executeScript({
      target: { tabId: t.id! },
      func: async () => {
        let storage = "";
        try {
          await chrome.storage.local.get("profile");
          storage = "readable";
        } catch {
          storage = "blocked";
        }
        let message = "";
        try {
          const response = await chrome.runtime.sendMessage({ type: "SCAN" });
          message = response === undefined ? "blocked" : "answered";
        } catch {
          message = "blocked";
        }
        return { storage, message };
      },
    });
  });
  expect(result[0].result).toEqual({ storage: "blocked", message: "blocked" });
  await target.evaluate(() =>
    window.postMessage({ type: "WRITE", id: "field-0", value: "伪造值" }, "*"),
  );
  await expect(target.locator("[name=name]")).toHaveValue("");
});
