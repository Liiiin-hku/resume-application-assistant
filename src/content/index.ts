import { adapterFor } from "../adapters";
import { blockedLabel, normalize } from "../core/matching";
import type { Control, Scan } from "../core/model";

type ElementControl =
  HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLElement;
type Entry = { descriptor: Control; elements: ElementControl[] };
type LocalScan = Omit<Scan, "tabId" | "epoch">;
const scope = globalThis as typeof globalThis & {
  __resumeAssistantV1?: boolean;
};
if (!scope.__resumeAssistantV1) {
  scope.__resumeAssistantV1 = true;
  start();
}
function start() {
  let token = "";
  let snapshot: LocalScan | undefined;
  let entries = new Map<string, Entry>();
  const undo = new Map<
    string,
    { elements: ElementControl[]; before: string; after: string; kind: string }
  >();
  let applying = false;
  const controlsSelector =
    'input, textarea, select, [role="combobox"], [contenteditable="true"]';
  const groupIds = new WeakMap<Element, string>();
  let counter = 0;
  const gid = (el: Element) => {
    let id = groupIds.get(el);
    if (!id) {
      id = `group-${++counter}`;
      groupIds.set(el, id);
    }
    return id;
  };
  function visible(el: Element) {
    return (
      el.getClientRects().length > 0 &&
      getComputedStyle(el).visibility !== "hidden" &&
      getComputedStyle(el).display !== "none"
    );
  }
  function labelFor(el: ElementControl) {
    const labelText = (label: Element) => {
      const clone = label.cloneNode(true) as Element;
      clone
        .querySelectorAll("input,select,textarea,button")
        .forEach((e) => e.remove());
      return clone.textContent?.trim() || "";
    };
    const refs = (el.getAttribute("aria-labelledby") || "")
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim() || "")
      .filter(Boolean);
    const labels =
      "labels" in el && el.labels ? Array.from(el.labels).map(labelText) : [];
    const near =
      el
        .closest(".form-item,.field,.form-field,.input-group")
        ?.querySelector(adapterFor(new URL(location.href)).labelSelector)
        ?.textContent?.trim() || "";
    const hints = [
      ...labels,
      ...refs,
      el.getAttribute("aria-label") || "",
      el.getAttribute("placeholder") || "",
      near,
      el.getAttribute("name") || "",
      el.id,
    ]
      .map((v) => v.slice(0, 180))
      .filter(Boolean);
    return { label: hints[0] || "无标签字段", hints };
  }
  function read(elements: ElementControl[], kind: string): string {
    if (kind === "radio" || kind === "checkbox")
      return JSON.stringify(
        elements
          .filter((e) => (e as HTMLInputElement).checked)
          .map((e) => (e as HTMLInputElement).value),
      );
    if (kind === "select") {
      const el = elements[0] as HTMLSelectElement;
      return JSON.stringify(
        Array.from(el.selectedOptions)
          .map((o) => o.value)
          .filter(Boolean),
      );
    }
    const el = elements[0];
    return "value" in el ? String(el.value) : el.textContent || "";
  }
  function collect(): Entry[] {
    const all = Array.from(
      document.querySelectorAll<ElementControl>(controlsSelector),
    ).filter((el) => visible(el) && !el.closest("[inert]"));
    const seen = new Set<Element>();
    const result: Entry[] = [];
    for (const el of all) {
      if (seen.has(el)) continue;
      const input = el as HTMLInputElement;
      const type = input.type || "";
      if (
        ["hidden", "submit", "button", "reset", "image", "password"].includes(
          type,
        ) ||
        input.disabled ||
        input.readOnly
      )
        continue;
      const root = el.closest(adapterFor(new URL(location.href)).groupSelector);
      const section = el.closest("section,article,form");
      const context = [
        root?.querySelector("legend,h2,h3,h4,[data-group-title]")
          ?.textContent || "",
        root?.getAttribute("aria-label") || "",
        section?.querySelector("h1,h2,h3")?.textContent || "",
      ]
        .join(" ")
        .trim()
        .slice(0, 240);
      const groupId = root ? gid(root) : section ? gid(section) : "page";
      let kind =
        el instanceof HTMLSelectElement
          ? "select"
          : el instanceof HTMLTextAreaElement
            ? "textarea"
            : type || "custom";
      if (
        el.getAttribute("role") === "combobox" ||
        el.hasAttribute("contenteditable")
      )
        kind = "custom";
      let { label, hints } = labelFor(el);
      let elements = [el];
      if (["radio", "checkbox"].includes(kind)) {
        const name = input.name;
        elements = name
          ? all.filter(
              (other) =>
                other instanceof HTMLInputElement &&
                other.type === kind &&
                other.name === name &&
                other.form === input.form &&
                other.closest(
                  adapterFor(new URL(location.href)).groupSelector,
                ) === root,
            )
          : [el];
        if (root) {
          const groupLabel =
            root.querySelector("legend")?.textContent?.trim() ||
            root.getAttribute("aria-label");
          if (groupLabel) {
            label = groupLabel;
            hints = [groupLabel, name];
          }
        }
      }
      elements.forEach((e) => seen.add(e));
      let options: Control["options"] = [];
      if (kind === "select")
        options = Array.from((el as HTMLSelectElement).options).map((o) => ({
          value: o.value,
          label: o.textContent?.trim() || "",
          disabled:
            o.disabled ||
            (o.parentElement instanceof HTMLOptGroupElement &&
              o.parentElement.disabled),
        }));
      if (["radio", "checkbox"].includes(kind))
        options = elements.map((e) => ({
          value: (e as HTMLInputElement).value,
          label: labelFor(e).label,
          disabled: (e as HTMLInputElement).disabled,
        }));
      const blocked =
        type === "file"
          ? "附件需在网站原生文件选择器主动上传"
          : blockedLabel(hints.join(" ") + " " + context)
            ? "密码 / 验证码 / 证件 / 声明等字段由你在网页人工处理"
            : "";
      const raw = read(elements, kind);
      const value = raw === "[]" ? "" : raw;
      const signature = JSON.stringify([
        label,
        hints,
        context,
        kind,
        options.map((o) => [o.label, o.value]),
        el.getAttribute("name") || "",
        el.id,
      ]);
      result.push({
        elements,
        descriptor: {
          id: `field-${result.length}`,
          signature,
          label,
          hints,
          context,
          groupId,
          kind,
          value,
          options,
          required:
            input.required || el.getAttribute("aria-required") === "true",
          blocked,
          autocomplete: input.autocomplete || "",
          maxLength: input.maxLength || 0,
          pattern: input.pattern || "",
          min: input.min || "",
          max: input.max || "",
        },
      });
    }
    return result;
  }
  const fingerprint = (list: Entry[]) =>
    JSON.stringify(
      list.map((e) => [e.descriptor.signature, e.descriptor.groupId]),
    );
  function fresh() {
    if (!snapshot || snapshot.url !== location.href)
      throw new Error("页面已跳转，请重新扫描");
    const current = collect();
    if (
      fingerprint(current) !== snapshot.fingerprint ||
      current.some((e, i) =>
        e.elements.some(
          (el, j) => el !== [...entries.values()][i]?.elements[j],
        ),
      )
    )
      throw new Error("表单结构已变化，请重新扫描");
  }
  function setNative(el: ElementControl, value: string, kind: string) {
    if (kind === "radio" || kind === "checkbox") {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "checked",
      )!.set!.call(el, value === "true");
    } else {
      const proto =
        el instanceof HTMLSelectElement
          ? HTMLSelectElement.prototype
          : el instanceof HTMLTextAreaElement
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
    }
    el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
  }
  function write(entry: Entry, value: string) {
    const { elements, descriptor: f } = entry;
    if (f.kind === "custom" || f.blocked) throw new Error("控件必须人工填写");
    if (["radio", "checkbox", "select"].includes(f.kind)) {
      const values: unknown = JSON.parse(value);
      if (!Array.isArray(values) || !values.every((v) => typeof v === "string"))
        throw new Error("选项值格式错误");
      if (
        values.some((v) => !f.options.some((o) => o.value === v && !o.disabled))
      )
        throw new Error("选项已失效");
      if (f.kind !== "checkbox" && values.length !== 1)
        throw new Error("单选字段需要一个选项");
      if (f.kind === "select") setNative(elements[0], values[0], "select");
      else setChoices(elements, values as string[], f.kind);
    } else setNative(elements[0], value, f.kind);
  }
  function setChoices(
    elements: ElementControl[],
    values: string[],
    kind: string,
  ) {
    if (kind === "radio") {
      // A radio group cannot be cleared through normal user interaction. Do not
      // pretend a DOM-only uncheck also resets controlled framework state.
      if (values.length !== 1)
        throw new Error(
          "原先未选任何单选项，无法可靠撤销到未选择状态；请人工处理",
        );
      const target = elements.find(
        (e) => (e as HTMLInputElement).value === values[0],
      ) as HTMLInputElement | undefined;
      if (!target || target.disabled) throw new Error("单选选项已不可用");
      if (!target.checked) target.click();
    } else {
      for (const element of elements) {
        const input = element as HTMLInputElement;
        const checked = values.includes(input.value);
        if (input.disabled && input.checked !== checked)
          throw new Error("复选选项已禁用");
        if (input.checked !== checked) input.click();
      }
    }
  }
  async function accepted(entry: Entry, expected: string) {
    // Condition polling with a bounded stability window catches controlled state rollback.
    const start = performance.now();
    let stableAt: number | undefined;
    while (performance.now() - start < 1800) {
      fresh();
      const actual = read(entry.elements, entry.descriptor.kind);
      const invalid = entry.elements.some(
        (e) =>
          e.getAttribute("aria-invalid") === "true" ||
          ("validity" in e && !(e as HTMLInputElement).validity.valid),
      );
      if (actual === expected && !invalid) {
        stableAt ??= performance.now();
        if (performance.now() - stableAt >= 450) return;
      } else {
        stableAt = undefined;
        if (performance.now() - start > 650)
          throw new Error(
            invalid ? "网站校验未通过" : "网站拒绝了值或把值回退",
          );
      }
      await new Promise((r) => setTimeout(r, 60));
    }
    throw new Error("等待网站接受输入超时");
  }
  async function route(m: Record<string, unknown>) {
    if (m.type === "SCAN") {
      if (applying) throw new Error("正在填写，请先暂停 / 取消");
      const start = performance.now();
      let list = collect();
      while (!list.length && performance.now() - start < 1600) {
        await new Promise((r) => setTimeout(r, 100));
        list = collect();
      }
      token = crypto.randomUUID();
      entries = new Map(list.map((e) => [e.descriptor.id, e]));
      undo.clear();
      const warnings = [
        "仅扫描顶层页面；跨域 iframe、Shadow DOM（尤其封闭根）和复杂控件需手动处理。",
      ];
      if (document.querySelector("iframe"))
        warnings.push("页面含 iframe，本次未读取其内部字段。");
      if (!list.length)
        warnings.push(
          "未找到可编辑字段：可能仍在加载、尚未登录或使用不支持的控件。",
        );
      snapshot = {
        token,
        url: location.href,
        title: document.title.slice(0, 120),
        fingerprint: fingerprint(list),
        fields: list.map((e) => e.descriptor),
        warnings,
      };
      return snapshot;
    }
    if (m.token !== token) throw new Error("扫描计划已失效，请重新扫描");
    fresh();
    if (m.type === "CHECK") return { valid: true };
    if (m.type === "WRITE") {
      if (applying) throw new Error("已有写入正在执行");
      const entry = entries.get(String(m.id));
      if (!entry) throw new Error("字段不存在");
      if (entry.descriptor.blocked) throw new Error("禁止操作此字段");
      if (typeof m.value !== "string" || m.value.length > 12000)
        throw new Error("填写内容无效");
      const before = read(entry.elements, entry.descriptor.kind);
      const nonempty = before && before !== "[]";
      if (before !== m.expected)
        throw new Error("网页内容自预览后已变化，请重新扫描");
      if (nonempty && !m.overwrite)
        return { status: "已跳过", reason: "保留网页已有内容" };
      applying = true;
      try {
        write(entry, m.value);
        undo.set(String(m.id), {
          elements: entry.elements,
          before,
          after: m.value,
          kind: entry.descriptor.kind,
        });
        await accepted(entry, m.value);
        return {
          status: "已写入并验证",
          reason: "控件值和浏览器校验在观察窗口内保持一致；仍请最终核对",
        };
      } catch (e) {
        return {
          status: "填写失败",
          reason: e instanceof Error ? e.message : "网站未接受",
        };
      } finally {
        applying = false;
      }
    }
    if (m.type === "UNDO") {
      let restored = 0,
        skipped = 0;
      for (const [id, u] of undo) {
        if (read(u.elements, u.kind) !== u.after) {
          skipped++;
          continue;
        }
        const entry = entries.get(id)!;
        try {
          if (["radio", "checkbox"].includes(u.kind)) {
            const vals = JSON.parse(u.before);
            setChoices(u.elements, vals, u.kind);
          } else if (u.kind === "select") {
            const vals = JSON.parse(u.before);
            setNative(u.elements[0], vals[0] || "", u.kind);
          } else setNative(u.elements[0], u.before, u.kind);
          await accepted(entry, u.before);
          restored++;
        } catch {
          skipped++;
        }
      }
      undo.clear();
      return { restored, skipped };
    }
    throw new Error("操作不支持");
  }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (
      sender.id !== chrome.runtime.id ||
      !sender.url?.startsWith(chrome.runtime.getURL("")) ||
      !message ||
      typeof message !== "object"
    )
      return false;
    if (!["SCAN", "CHECK", "WRITE", "UNDO"].includes(message.type))
      return false;
    route(message)
      .then((data) => respond({ ok: true, data }))
      .catch((e) => respond({ ok: false, error: e.message }));
    return true;
  });
}
