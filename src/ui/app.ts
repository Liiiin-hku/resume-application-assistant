import { el, button, note, option } from "./dom";
import {
  emptyProfile,
  fields,
  groups,
  groupLabels,
  record,
  fact,
  validateProfile,
  factAt,
  type Group,
  type Profile,
  type Scan,
  type PlanRow,
  type FieldRef,
} from "../core/model";
import {
  loadProfile,
  saveProfile,
  loadRules,
  saveRule,
  secureStorage,
} from "../core/storage";
import { buildPlan, planForRef, refLabel, formatValue } from "../core/matching";
import { safeURL } from "../core/url";
import { parseText } from "../parsers/text";

let profile: Profile = emptyProfile(),
  draft: Profile = emptyProfile(),
  incoming: Profile | undefined;
let scan: Scan | undefined,
  rows: PlanRow[] = [],
  associations: Record<string, string> = {};
let running = false,
  paused = false,
  cancelled = false,
  dirty = false;
let scanOnly = true;
let resumeText = "";
const header = el(
  "header",
  { class: "topbar" },
  el(
    "div",
    {},
    el("p", { class: "eyebrow" }, "LOCAL · 简历网申投递助手"),
    el("h1", {}, "把重复填写，交给助手"),
  ),
  el("span", { class: "pill" }, "0.1.0 · 本机处理"),
);
const status = el(
  "div",
  { class: "status", role: "status", "aria-live": "polite" },
  "正在读取本地资料…",
);
const tabs = el("nav", { "aria-label": "功能区" });
const main = el("main");
document.body.append(
  header,
  tabs,
  status,
  main,
  el("footer", {}, "本地规则填写 · AI 未实现 / 无远程上传 · 最终提交由你完成"),
);
function message(text: string, error = false) {
  status.textContent = text;
  status.className = error ? "status error" : "status";
}
const report = (fn: () => Promise<unknown>) => async () => {
  try {
    await fn();
  } catch (e) {
    message(e instanceof Error ? e.message : "操作失败", true);
  }
};
function invalidate() {
  scan = undefined;
  rows = [];
  associations = {};
}
let view = "fill";
function switchView(next: string) {
  if (running) {
    message("请先暂停并取消当前批次再切换");
    return;
  }
  view = next;
  render();
}
tabs.append(
  button("① 资料库", () => switchView("profile"), { "data-tab": "profile" }),
  button("② 当前页填写", () => switchView("fill"), { "data-tab": "fill" }),
  button("使用与隐私", () => switchView("help"), { "data-tab": "help" }),
);
function render() {
  tabs
    .querySelectorAll("button")
    .forEach((b) =>
      b.setAttribute("aria-current", String(b.dataset.tab === view)),
    );
  main.replaceChildren();
  if (view === "profile") renderProfile();
  else if (view === "help") renderHelp();
  else renderFill();
}
async function rpc(type: string, args: Record<string, unknown> = {}) {
  const response = await chrome.runtime.sendMessage({ type, ...args });
  if (!response?.ok)
    throw new Error(response?.error || "后台未响应。请重新加载插件后重试");
  return response.data;
}
async function persist() {
  draft = await saveProfile(draft, profile.revision);
  profile = structuredClone(draft);
  dirty = false;
  invalidate();
  message("资料已保存在此浏览器。只有已确认字段可用于默认填写。");
}
async function receive(p: Profile) {
  if (dirty) throw new Error("请先保存或放弃当前编辑，再导入新资料");
  if (profile.records.length && profile.demo !== p.demo)
    throw new Error(
      "虚构示例不能与正式资料混合。请先导出备份并清空资料，再导入另一类资料。",
    );
  incoming = validateProfile(p);
  renderProfile();
}
function renderProfile() {
  main.replaceChildren();
  const file = el("input", {
    type: "file",
    accept: ".pdf,.docx",
    id: "resume-file",
    "aria-label": "导入 PDF 或 DOCX 简历",
  });
  const raw = el("textarea", {
    id: "resume-text",
    rows: 6,
    value: resumeText,
    oninput: (e: Event) => {
      resumeText = (e.target as HTMLTextAreaElement).value;
    },
    placeholder:
      "粘贴简历文本。优先识别“姓名：…”“学校：…”等明确标签；未识别部分可手动补充。",
  });
  const importJSON = el("input", {
    type: "file",
    accept: ".json",
    id: "json-file",
    "aria-label": "导入资料 JSON",
  });
  file.addEventListener(
    "change",
    report(async () => {
      if (!file.files?.[0]) return;
      file.disabled = true;
      message("正在本机提取文本…");
      try {
        const { extractFile } = await import("../parsers/files");
        const result = await extractFile(file.files[0]);
        resumeText = result.text;
        raw.value = result.text;
        const parsed = parseText(result.text, result.sourceId);
        parsed.profile.demo = profile.demo;
        await receive(parsed.profile);
        message(parsed.warnings.join(" "));
      } finally {
        file.disabled = false;
      }
    }),
  );
  importJSON.addEventListener(
    "change",
    report(async () => {
      const f = importJSON.files?.[0];
      if (!f) return;
      if (f.size > 5 * 1024 * 1024) throw new Error("JSON 备份超过 5 MB");
      await receive(validateProfile(JSON.parse(await f.text())));
      message("备份已读入待确认区；勾选前不会覆盖原资料。");
    }),
  );
  const intro = el(
    "section",
    { class: "card" },
    el("h2", {}, "导入与核对"),
    note(
      "导入仅用于解析资料，不会向招聘网站上传附件。PDF / DOCX 在本机提取；扫描件可改为粘贴文本。",
    ),
    el("label", {}, "从简历文件提取", file),
    el(
      "details",
      {},
      el("summary", {}, "粘贴简历文本"),
      raw,
      button(
        "提取为待确认资料",
        report(async () => {
          const parsed = parseText(raw.value);
          parsed.profile.demo = profile.demo;
          await receive(parsed.profile);
          message(parsed.warnings.join(" "));
        }),
      ),
    ),
    el("details", {}, el("summary", {}, "导入资料 JSON 备份"), importJSON),
  );
  main.append(intro);
  if (incoming) renderIncoming(incoming);
  const addGroup = el(
    "select",
    { "aria-label": "新增资料类别" },
    ...groups.map((g) => option(g, groupLabels[g])),
  );
  main.append(
    el(
      "section",
      { class: "card" },
      el("h2", {}, profile.demo ? "虚构示例资料库" : "我的资料库"),
      note(
        "修改值后会取消该字段的确认。请逐项核对，再勾选“事实已确认”并保存。日期可保留年 / 年月 / 至今 / 预计等原文。",
      ),
      el(
        "div",
        { class: "toolbar" },
        addGroup,
        button("新增一条记录", () => {
          const r = record(addGroup.value as Group);
          draft.records.push(r);
          dirty = true;
          renderProfile();
        }),
        button(
          "保存资料",
          report(async () => {
            await persist();
            renderProfile();
          }),
          { class: "primary", id: "save-profile" },
        ),
      ),
    ),
  );
  if (!draft.records.length)
    main.append(
      note("资料库为空。先导入简历，或新增一条基本信息记录。", "empty"),
    );
  for (const r of draft.records) {
    const title = el("input", {
      value: r.title,
      "aria-label": "记录标题",
      oninput: (e: Event) => {
        r.title = (e.target as HTMLInputElement).value;
        dirty = true;
      },
    });
    const body = el(
      "div",
      { class: "record-body" },
      el("label", {}, "记录标题（用于区分多条经历）", title),
    );
    for (const [key, label] of Object.entries(fields[r.group])) {
      r.facts[key] ??= fact();
      const f = r.facts[key];
      const check = el("input", {
        type: "checkbox",
        checked: f.confirmed,
        "aria-label": `${r.title} ${label}事实已确认`,
        onchange: (e: Event) => {
          f.confirmed = (e.target as HTMLInputElement).checked;
          dirty = true;
        },
      });
      const input = el("textarea", {
        rows: ["description", "answer"].includes(key) ? 3 : 1,
        value: f.value,
        "aria-label": `${r.title} ${label}`,
        oninput: (e: Event) => {
          f.value = (e.target as HTMLTextAreaElement).value;
          f.confirmed = false;
          f.source = "manual";
          f.sourceId = "手动补充";
          f.excerpt = "";
          check.checked = false;
          dirty = true;
        },
      });
      body.append(
        el(
          "div",
          { class: "fact-editor" },
          el("label", {}, label, input),
          el(
            "div",
            { class: "inline" },
            el("label", {}, check, "事实已确认"),
            button(
              "复制",
              report(async () => {
                await navigator.clipboard.writeText(input.value);
                message("已复制此字段");
              }),
            ),
          ),
          f.sourceId
            ? el(
                "small",
                {},
                `来源：${f.source === "resume" ? "简历原文" : f.source === "manual" ? "手动事实" : "规则建议"} · ${f.sourceId}${f.excerpt ? " · " + f.excerpt : ""}`,
              )
            : undefined,
        ),
      );
    }
    body.append(
      button(
        "删除这条记录",
        () => {
          if (confirm(`删除“${r.title}”？保存后生效。`)) {
            draft.records = draft.records.filter((x) => x.id !== r.id);
            dirty = true;
            renderProfile();
          }
        },
        { class: "danger" },
      ),
    );
    main.append(
      el(
        "details",
        { class: "card record", open: draft.records.length <= 2 },
        el("summary", {}, `${groupLabels[r.group]} · ${r.title}`),
        body,
      ),
    );
  }
  main.append(
    el(
      "section",
      { class: "card" },
      el("h2", {}, "备份与本地管理"),
      note(
        "浏览器资料与 data/private 文件夹彼此独立，不会自动同步。普通本地存储并非加密保险箱，请勿在自由文本中保存证件或密钥。",
      ),
      el(
        "div",
        { class: "toolbar" },
        button(
          "导出资料备份",
          report(async () => {
            if (dirty) throw new Error("请先保存资料后再导出");
            const blob = new Blob(
              [JSON.stringify(validateProfile(profile), null, 2)],
              { type: "application/json" },
            );
            const url = URL.createObjectURL(blob);
            const a = el("a", {
              href: url,
              download: `网申资料备份-${new Date().toISOString().slice(0, 10)}.json`,
            });
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            message("已导出当前已保存资料；请妥善保管备份文件。");
          }),
          { id: "export-profile" },
        ),
        button("放弃未保存编辑", () => {
          if (confirm("放弃当前未保存编辑？")) {
            draft = structuredClone(profile);
            dirty = false;
            incoming = undefined;
            renderProfile();
          }
        }),
        button(
          "清空本地资料",
          report(async () => {
            if (
              !confirm(
                "确认清空此插件的所有资料与站点规则？建议先导出备份。此操作不可撤销。",
              )
            )
              return;
            await chrome.storage.local.clear();
            await chrome.storage.session.clear();
            profile = emptyProfile();
            draft = structuredClone(profile);
            incoming = undefined;
            dirty = false;
            invalidate();
            renderProfile();
            message("已清空浏览器扩展资料；磁盘上的原件和备份不受此操作影响。");
          }),
          { class: "danger", id: "clear-profile" },
        ),
      ),
    ),
  );
}
function renderIncoming(p: Profile) {
  const card = el(
    "section",
    { class: "card incoming" },
    el("h2", {}, "待确认资料与差异"),
    note(
      p.demo
        ? "这是明确标记的虚构示例，仅用于测试。"
        : "逐项核对原文、修改值，勾选你确认真实的字段。未勾选内容不会写入资料库。",
    ),
  );
  const changes: {
    from: string;
    to: HTMLSelectElement;
    key: string;
    input: HTMLTextAreaElement;
    check: HTMLInputElement;
  }[] = [];
  for (const r of p.records) {
    const target = el(
      "select",
      { "aria-label": `${r.title} 合并到哪条记录` },
      option("new", "新增记录（保持原记录）"),
      ...profile.records
        .filter((x) => x.group === r.group)
        .map((x) => option(x.id, `更新：${x.title}`)),
    );
    const same =
      profile.records.find((x) => x.id === r.id) ||
      (["basics", "job"].includes(r.group)
        ? profile.records.find((x) => x.group === r.group)
        : undefined);
    if (same) target.value = same.id;
    const recordCard = el(
      "div",
      { class: "incoming-record" },
      el("h3", {}, `${groupLabels[r.group]} · ${r.title}`),
      el("label", {}, "合并目标", target),
    );
    for (const [key, f] of Object.entries(r.facts).filter(([, f]) => f.value)) {
      const input = el("textarea", {
        rows: 1,
        value: f.value,
        "aria-label": `待确认 ${fields[r.group][key]}`,
      });
      const check = el("input", {
        type: "checkbox",
        "aria-label": `接受 ${r.title} ${fields[r.group][key]}`,
      });
      const old = el("p", { class: "difference" });
      const updateOld = () => {
        const previous = profile.records.find((x) => x.id === target.value)
          ?.facts[key];
        old.textContent = `原值：${previous?.value || "（无）"} → 新值：见下方${previous?.confirmed ? " · 原值已确认" : ""}`;
      };
      updateOld();
      target.addEventListener("change", updateOld);
      recordCard.append(
        el(
          "div",
          { class: "fact-editor" },
          el("label", {}, check, fields[r.group][key]),
          old,
          input,
          el(
            "small",
            {},
            `来源：${f.source === "resume" ? "简历原文" : f.source === "manual" ? "手动事实" : "建议"} · ${f.sourceId || "JSON 备份"} · ${f.excerpt}`,
          ),
        ),
      );
      changes.push({ from: r.id, to: target, key, input, check });
    }
    card.append(recordCard);
  }
  if (!changes.length)
    card.append(
      note("未提取到明确字段，请展开粘贴区查看文本，或新增记录手动填写。"),
    );
  card.append(
    button(
      "接受勾选字段并确认真实",
      report(async () => {
        const selected = changes.filter((c) => c.check.checked);
        if (!selected.length) throw new Error("请先逐项勾选已核对的字段");
        const next = structuredClone(profile);
        const created = new Map<string, string>();
        for (const c of selected) {
          const from = p.records.find((r) => r.id === c.from)!;
          let target = next.records.find((r) => r.id === c.to.value);
          if (!target) {
            let id = created.get(from.id);
            target = next.records.find((r) => r.id === id);
            if (!target) {
              target = record(from.group, from.title);
              if (!next.records.some((r) => r.id === from.id))
                target.id = from.id;
              next.records.push(target);
              created.set(from.id, target.id);
            }
          }
          const f = structuredClone(from.facts[c.key]);
          if (f.value !== c.input.value) {
            f.source = "manual";
            f.sourceId = "导入核对时修订";
            f.excerpt = "";
          }
          f.value = c.input.value;
          f.confirmed = true;
          target.facts[c.key] = f;
        }
        next.demo = p.demo;
        draft = next;
        await persist();
        incoming = undefined;
        renderProfile();
      }),
      { class: "primary", id: "accept-import" },
    ),
    button("取消本次导入", () => {
      incoming = undefined;
      renderProfile();
    }),
  );
  main.append(card);
}
function renderFill() {
  main.replaceChildren();
  const jobURL = el("input", {
    type: "url",
    id: "job-url",
    placeholder: "https://… 公司岗位投递链接",
    "aria-label": "岗位链接",
  });
  main.append(
    el(
      "section",
      { class: "card" },
      el("h2", {}, "从当前网申页面开始"),
      note(
        "在目标页面完成登录，点击浏览器工具栏的插件图标授予当前页权限。打开链接或跨域跳转后需要再次点击。",
      ),
      el(
        "div",
        { class: "url-row" },
        jobURL,
        button(
          "打开岗位链接",
          report(async () => {
            const result = await rpc("OPEN", { url: jobURL.value });
            invalidate();
            message(result.message);
          }),
        ),
      ),
      el(
        "details",
        {},
        el("summary", {}, "按需保存本站访问授权"),
        note(
          "优先使用工具栏图标临时授权。若需持久访问此站点，输入完整 URL 并主动授权；只申请这个来源。",
        ),
        button(
          "授权输入链接所在站点",
          report(async () => {
            const u = safeURL(jobURL.value);
            message("请在浏览器的站点授权提示中确认；未授权前不会扫描。");
            const allowed = await chrome.permissions.request({
              origins: [`${u.origin}/*`],
            });
            message(
              allowed
                ? "已授权这个站点；切到目标页面后扫描。"
                : "未授予权限；可改用目标页面的插件图标。",
            );
          }),
        ),
        button(
          "移除额外站点授权",
          report(async () => {
            const all = await chrome.permissions.getAll();
            if (all.origins?.length)
              await chrome.permissions.remove({ origins: all.origins });
            invalidate();
            message("已移除额外站点授权");
          }),
        ),
      ),
    ),
  );
  const only = el("input", {
    type: "checkbox",
    checked: scanOnly,
    id: "scan-only",
    onchange: (e: Event) => {
      scanOnly = (e.target as HTMLInputElement).checked;
      renderFill();
    },
  });
  main.append(
    el(
      "section",
      { class: "card" },
      el(
        "div",
        { class: "toolbar" },
        button(
          "扫描当前页面",
          report(async () => {
            if (running) throw new Error("请先取消本批填写");
            if (dirty) throw new Error("请先保存资料");
            message("正在扫描当前页面，不写入资料…");
            invalidate();
            scan = await rpc("SCAN");
            rows = buildPlan(
              profile,
              scan!.fields,
              scan!.url,
              await loadRules(),
              associations,
            );
            renderFill();
            message(`扫描完成，共 ${rows.length} 个字段。请核对预览。`);
          }),
          { class: "primary", id: "scan-page", disabled: running },
        ),
        el("label", {}, only, "只扫描，不写入"),
      ),
      note(
        `当前资料：${profile.demo ? "虚构示例 · " : ""}${profile.records.length} 条记录；规则确定性是判断依据，不是统计正确率。`,
      ),
    ),
  );
  if (!scan) {
    main.append(
      note("先在“资料库”确认真实字段，再扫描页面查看填写预览。", "empty"),
    );
    return;
  }
  main.append(
    el(
      "section",
      { class: "card" },
      el("h2", {}, "预览与关联"),
      note(`${scan.title} · ${new URL(scan.url).origin}`),
      ...scan.warnings.map((w) => note(w)),
    ),
  );
  const uniqueGroups = [
    ...new Map(
      scan.fields.filter((f) => f.context).map((f) => [f.groupId, f.context]),
    ).entries(),
  ];
  if (uniqueGroups.length) {
    const box = el(
      "details",
      { class: "card" },
      el("summary", {}, "确认经历顺序 / 分组关联（多条记录请检查）"),
    );
    for (const [id, context] of uniqueGroups) {
      const sel = el(
        "select",
        { "aria-label": `${context} 对应经历` },
        option("", "使用唯一明确的分组匹配"),
        ...profile.records
          .filter((r) => ["education", "work", "projects"].includes(r.group))
          .map((r) => option(r.id, `${groupLabels[r.group]} · ${r.title}`)),
      );
      sel.value = associations[id] || "";
      sel.addEventListener(
        "change",
        report(async () => {
          associations[id] = sel.value;
          rows = buildPlan(
            profile,
            scan!.fields,
            scan!.url,
            await loadRules(),
            associations,
          );
          renderFill();
        }),
      );
      box.append(el("label", {}, context, sel));
    }
    box.append(
      note(
        "插件不会自动点击“新增经历”。请先在网页增加空白记录，再重新扫描和关联。",
      ),
    );
    main.append(box);
  }
  for (let i = 0; i < rows.length; i++) renderRow(rows[i], i);
  main.append(
    el(
      "section",
      { class: "card sticky-actions" },
      note(
        "网站可能在输入时自动保存。点击确认填写后，内容就可能被网站接收；不点最终提交也不代表网站未收到。",
        "warning",
      ),
      el(
        "div",
        { class: "toolbar" },
        button(
          running ? (paused ? "已暂停" : "填写中…") : "确认填写勾选项",
          report(async () => run(false)),
          {
            class: "primary",
            id: "fill-selected",
            disabled: scanOnly || running,
          },
        ),
        button(
          paused ? "继续" : "暂停",
          () => {
            paused = !paused;
            renderFill();
          },
          { disabled: !running, id: "pause-fill" },
        ),
        button(
          "取消",
          () => {
            cancelled = true;
            paused = false;
            message("将停止发送后续字段；当前已发送字段仍会完成核验。");
          },
          { disabled: !running, id: "cancel-fill" },
        ),
        button(
          "只重试失败项",
          report(async () => run(true)),
          {
            disabled:
              scanOnly || running || !rows.some((r) => r.status === "填写失败"),
            id: "retry-failed",
          },
        ),
        button(
          "撤销本次本地修改",
          report(async () => {
            if (!scan) throw new Error("请重新扫描");
            if (
              !confirm(
                "仅尝试撤销本插件写入且之后未被修改的值。这不能撤回网站已经收到或自动保存的数据。继续？",
              )
            )
              return;
            const result = await rpc("UNDO", { token: scan.token });
            message(
              `撤销核验成功 ${result.restored} 项；跳过 / 未通过 ${result.skipped} 项。请重新扫描。`,
            );
            invalidate();
            renderFill();
          }),
          { disabled: running, id: "undo-fill" },
        ),
      ),
    ),
  );
}
function renderRow(row: PlanRow, index: number) {
  const { field } = row;
  const f = factAt(profile, row.ref);
  const conversion = f ? formatValue(f.value, field) : undefined;
  const selectable =
    !field.blocked && !!f?.confirmed && !!f.value && !conversion?.error;
  const select = el("input", {
    type: "checkbox",
    checked: row.selected,
    disabled: !selectable || running,
    "aria-label": `填写 ${field.label}`,
    onchange: (e: Event) => {
      const box = e.target as HTMLInputElement;
      if (
        box.checked &&
        row.sensitive &&
        !confirm(`单独确认本次填写“${field.label}”：${f?.value}？`)
      ) {
        box.checked = false;
        return;
      }
      row.selected = box.checked;
    },
  });
  const card = el(
    "article",
    { class: "plan-row", "data-field": field.id },
    el(
      "div",
      { class: "row-heading" },
      el("label", {}, select, el("strong", {}, field.label)),
      el(
        "span",
        { class: `badge ${row.status === "已写入并验证" ? "good" : ""}` },
        row.status,
      ),
    ),
    el("p", { class: "muted" }, field.context || "当前表单"),
    el("p", { class: "preview-value" }, f?.value || "（无可用资料）"),
    note(row.reason),
    row.ref ? note(`资料：${refLabel(profile, row.ref)}`) : undefined,
    row.source ? el("small", {}, `来源：${row.source}`) : undefined,
  );
  if (field.value) {
    const overwrite = el("input", {
      type: "checkbox",
      checked: row.overwrite,
      disabled: !selectable || running,
      "aria-label": `允许覆盖 ${field.label}`,
      onchange: (e: Event) => {
        const checked = (e.target as HTMLInputElement).checked;
        if (
          checked &&
          !confirm(
            `覆盖“${field.label}”？\n原值：${field.value}\n新值：${f?.value}`,
          )
        ) {
          (e.target as HTMLInputElement).checked = false;
          return;
        }
        row.overwrite = checked;
        if (!checked) {
          row.selected = false;
          renderFill();
        }
      },
    });
    card.append(
      note(`网页原值：${field.value}`),
      el("label", {}, overwrite, "已核对差异，允许覆盖此字段"),
    );
  }
  if (!field.blocked) {
    const map = el(
      "select",
      { "aria-label": `手动关联 ${field.label}` },
      option("", "选择资料字段…"),
      ...profile.records.flatMap((r) =>
        Object.entries(r.facts)
          .filter(([, f]) => f.value)
          .map(([key]) =>
            option(
              JSON.stringify({ recordId: r.id, key }),
              `${r.title} / ${fields[r.group][key]}`,
            ),
          ),
      ),
    );
    if (row.ref) map.value = JSON.stringify(row.ref);
    map.addEventListener("change", () => {
      if (map.value) {
        rows[index] = planForRef(profile, field, JSON.parse(map.value));
        rows[index].selected = false;
        renderFill();
      }
    });
    card.append(
      el(
        "details",
        {},
        el("summary", {}, "手动字段关联与复制"),
        map,
        button(
          "保存为本站规则",
          report(async () => {
            if (!rows[index].ref || !scan) throw new Error("请先选择资料字段");
            if (
              scan.fields.filter((f) => f.signature === field.signature)
                .length !== 1
            )
              throw new Error(
                "本页存在同结构重复字段，无法可靠保存长期规则。请本次手动关联经历。",
              );
            const u = new URL(scan.url);
            await saveRule({
              origin: u.origin,
              path: u.pathname,
              signature: field.signature,
              ref: rows[index].ref!,
            });
            message(
              "字段关系已保存，仅用于相同来源、路径和字段结构；未保存真实值。",
            );
          }),
        ),
        button(
          "复制资料值",
          report(async () => {
            const value = factAt(profile, rows[index].ref)?.value;
            if (!value) throw new Error("没有可复制的资料");
            await navigator.clipboard.writeText(value);
            message("已复制；请在网页人工粘贴或选择。");
          }),
        ),
      ),
    );
  }
  main.append(card);
}
async function run(retry: boolean) {
  if (!scan || scanOnly || running)
    throw new Error("请先扫描并关闭“只扫描，不写入”");
  const selected = rows.filter((r) =>
    retry ? r.status === "填写失败" : r.selected,
  );
  if (!selected.length) throw new Error("没有勾选可填写字段");
  if (selected.some((r) => r.field.value && !r.overwrite))
    throw new Error("勾选项含网页已有值。请取消勾选，或逐项确认覆盖差异。");
  if (
    !confirm(
      `确认向当前网站填写 ${selected.length} 项？网站可能立即自动保存这些内容。插件不会提交申请。`,
    )
  )
    return;
  await rpc("CHECK", { token: scan.token });
  running = true;
  paused = false;
  cancelled = false;
  renderFill();
  try {
    for (const row of selected) {
      while (paused && !cancelled) await new Promise((r) => setTimeout(r, 100));
      if (cancelled) break;
      const f = factAt(profile, row.ref);
      if (!f?.confirmed || formatValue(f.value, row.field).error) {
        row.status = "已跳过";
        row.reason = "资料未确认或格式不适配";
        continue;
      }
      try {
        const result = await rpc("WRITE", {
          token: scan.token,
          id: row.field.id,
          value: row.value,
          expected:
            row.field.value ||
            (["select", "radio", "checkbox"].includes(row.field.kind)
              ? "[]"
              : ""),
          overwrite: row.overwrite,
        });
        row.status = result.status;
        row.reason = result.reason;
        if (result.status === "已写入并验证") {
          row.field.value = row.value;
          row.selected = false;
        }
      } catch (e) {
        row.status = "填写失败";
        row.reason = e instanceof Error ? e.message : "执行异常";
        cancelled = true;
      }
      renderFill();
    }
    message(
      `本次结果：已写入并验证 ${rows.filter((r) => r.status === "已写入并验证").length}，失败 ${rows.filter((r) => r.status === "填写失败").length}。${cancelled ? "已停止后续填写。" : ""}请检查网站后手动提交。`,
    );
  } finally {
    running = false;
    paused = false;
    renderFill();
  }
}
function renderHelp() {
  main.append(
    el(
      "section",
      { class: "card" },
      el("h2", {}, "使用顺序"),
      el(
        "ol",
        {},
        ...[
          "在资料库导入 PDF / DOCX、粘贴文本或资料 JSON。核对待确认字段与合并目标。",
          "逐项接受真实内容，补充未识别资料；保存后只有已确认事实参与默认填写。",
          "打开招聘链接，自己完成登录和验证码，进入表单，再点击工具栏插件图标。",
          "扫描当前页，检查分组关联、字段、值和来源。低确定性项用手动关联或复制。",
          "关闭“只扫描”，勾选需要填写的字段，确认后填写。下一页重新扫描。",
          "检查失败 / 缺失项，在网站原生选择器上传附件，最后自己检查并提交。",
        ].map((s) => el("li", {}, s)),
      ),
      el("h2", {}, "边界与隐私"),
      note(
        "AI 尚未实现；无服务端、遥测、云同步、远程更新检查或简历上传。PDF worker / 字体资源和 DOCX 库随扩展打包。",
      ),
      note(
        "仅支持通用顶层网页原生表单；复杂学校搜索、省市级联、Shadow DOM、iframe 等请人工操作。尚未声明任何真实招聘平台已适配。",
      ),
      note(
        "本版不自动新增经历、不辅助网站附件上传、不勾选法律 / 隐私声明、不点击最终提交。",
      ),
      note(
        "撤销仅尽力恢复本地控件值，不能撤回网站已收到的数据。约半秒的稳定核验不能保证服务器端已保存。",
      ),
      note(
        "更新：先导出备份，构建后在扩展管理页点“重新加载”；保留相同目录和扩展身份，不要先卸载。",
      ),
      button("在新标签页打开资料库", () => {
        void chrome.runtime.openOptionsPage();
      }),
    ),
  );
}
chrome.tabs.onActivated.addListener(async (info) => {
  const tab = await chrome.tabs.get(info.tabId).catch(() => undefined);
  if (
    tab?.url?.startsWith(chrome.runtime.getURL("")) ||
    info.tabId === scan?.tabId
  )
    return;
  if (scan) {
    cancelled = true;
    paused = false;
    invalidate();
    if (view === "fill") renderFill();
    message("活动标签页已切换，旧计划已失效。请重新扫描。");
  }
});
chrome.tabs.onUpdated.addListener((id, change) => {
  if (scan?.tabId === id && (change.status === "loading" || change.url)) {
    cancelled = true;
    paused = false;
    invalidate();
    if (view === "fill") renderFill();
    message("页面已跳转或加载，旧计划已失效。");
  }
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.profile && !dirty && !running) {
    try {
      profile = changes.profile.newValue
        ? validateProfile(changes.profile.newValue)
        : emptyProfile();
      draft = structuredClone(profile);
      invalidate();
    } catch {
      message("资料版本异常，请先备份并检查。", true);
    }
  }
});
void report(async () => {
  await secureStorage();
  profile = await loadProfile();
  draft = structuredClone(profile);
  view = location.pathname.endsWith("options.html") ? "profile" : "fill";
  render();
  message("资料只保存在本机。首次使用请先导入并确认资料。");
})();
