import { secureStorage } from "../core/storage";
import { safeURL } from "../core/url";
import type { Scan } from "../core/model";
const plans = new Map<number, Scan>();
let epoch = 0;
const targetByWindow = new Map<number, number>();
const secured = secureStorage();
void secured.catch(() => {});
chrome.runtime.onInstalled.addListener(() => {
  void secureStorage();
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
});
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    targetByWindow.set(tab.windowId, tab.id);
    void chrome.sidePanel.open({ tabId: tab.id });
  }
});
chrome.tabs.onActivated.addListener(async (info) => {
  const tab = await chrome.tabs.get(info.tabId).catch(() => undefined);
  if (tab?.url?.startsWith(chrome.runtime.getURL(""))) return;
  if (targetByWindow.get(info.windowId) !== info.tabId) {
    epoch++;
    plans.clear();
    targetByWindow.set(info.windowId, info.tabId);
  }
});
chrome.tabs.onUpdated.addListener((id, change) => {
  if (change.status === "loading" || change.url) {
    plans.delete(id);
    epoch++;
  }
});
chrome.tabs.onRemoved.addListener((id) => plans.delete(id));
async function active() {
  let [tab] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });
  if (tab?.url?.startsWith(chrome.runtime.getURL(""))) {
    const target = targetByWindow.get(tab.windowId);
    if (target) tab = await chrome.tabs.get(target);
  }
  if (!tab?.id || !tab.url)
    throw new Error("请切到目标网申页面，再点击工具栏中的插件图标授予本页权限");
  safeURL(tab.url);
  return tab;
}
async function send(tabId: number, message: unknown) {
  const reply = await chrome.tabs.sendMessage(tabId, message, { frameId: 0 });
  if (!reply?.ok) throw new Error(reply?.error || "网页响应无效，请重新扫描");
  return reply.data;
}
async function route(m: Record<string, unknown>) {
  await secured;
  if (m.type === "OPEN") {
    const u = safeURL(String(m.url));
    await chrome.tabs.create({ url: u.href });
    return {
      message:
        "已打开页面；登录并进入表单后，请再次点击工具栏插件图标授予本页权限",
    };
  }
  const tab = await active();
  const id = tab.id!;
  if (m.type === "SCAN") {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: id, frameIds: [0] },
        files: ["content.js"],
      });
    } catch {
      throw new Error(
        "尚无此页权限，或此页面禁止插件访问。请在目标标签页点击插件图标；跨域跳转后需再次触发。",
      );
    }
    const mark = epoch;
    const result = await send(id, { type: "SCAN" });
    if (mark !== epoch)
      throw new Error("扫描期间页面 / 标签已变化，请重新扫描");
    const scan: Scan = { ...result, tabId: id, epoch };
    plans.set(id, scan);
    return scan;
  }
  const scan = plans.get(id);
  if (
    !scan ||
    scan.token !== m.token ||
    scan.epoch !== epoch ||
    scan.url !== tab.url
  )
    throw new Error("旧计划已失效（页面切换、跳转或后台重启）；请重新扫描");
  if (m.type === "CHECK" || m.type === "UNDO")
    return send(id, { type: m.type, token: scan.token });
  if (m.type === "WRITE") {
    const field = scan.fields.find((f) => f.id === m.id);
    if (
      !field ||
      field.blocked ||
      typeof m.value !== "string" ||
      m.value.length > 12000 ||
      typeof m.expected !== "string" ||
      typeof m.overwrite !== "boolean"
    )
      throw new Error("填写请求无效");
    return send(id, {
      type: "WRITE",
      token: scan.token,
      id: field.id,
      value: m.value,
      expected: m.expected,
      overwrite: m.overwrite,
    });
  }
  throw new Error("操作不支持");
}
chrome.runtime.onMessage.addListener((m, sender, respond) => {
  const allowed = [
    chrome.runtime.getURL("panel.html"),
    chrome.runtime.getURL("options.html"),
  ];
  if (
    sender.id !== chrome.runtime.id ||
    !sender.url ||
    !allowed.some((u) => sender.url!.split(/[?#]/)[0] === u) ||
    !m ||
    typeof m !== "object"
  )
    return false;
  if (!["OPEN", "SCAN", "WRITE", "UNDO", "CHECK"].includes(m.type))
    return false;
  route(m)
    .then((data) => respond({ ok: true, data }))
    .catch((e) =>
      respond({
        ok: false,
        error: e instanceof Error ? e.message : "操作失败",
      }),
    );
  return true;
});
