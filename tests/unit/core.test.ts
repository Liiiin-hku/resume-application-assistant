import { describe, it, expect } from "vitest";
import { parseText } from "../../src/parsers/text";
import {
  emptyProfile,
  record,
  fact,
  validateProfile,
  diffProfiles,
  type Control,
} from "../../src/core/model";
import { buildPlan, formatValue, identify } from "../../src/core/matching";
import { safeURL } from "../../src/core/url";
const control = (label: string, extra: Partial<Control> = {}): Control => ({
  id: "field",
  label,
  hints: [label],
  context: "",
  groupId: "a",
  kind: "text",
  value: "",
  options: [],
  blocked: "",
  required: false,
  signature: label,
  autocomplete: "",
  maxLength: 0,
  pattern: "",
  min: "",
  max: "",
  ...extra,
});
function profile() {
  const p = emptyProfile(),
    b = record("basics"),
    e = record("education");
  b.facts.name = { ...fact("虚构甲"), confirmed: true };
  e.facts.school = { ...fact("虚构学校"), confirmed: true };
  e.facts.qualification = { ...fact("本科"), confirmed: true };
  p.records = [b, e];
  return p;
}
describe("事实、解析与导入", () => {
  it("明确事实待确认；本科硕士不同稳定记录，不推断毕业日期", () => {
    const { profile: p } = parseText(
      "姓名：虚构甲\n教育经历\n学校：虚构大学甲\n学历：本科\n毕业时间：2024\n教育经历\n学校：虚构大学乙\n学历：硕士\n毕业时间：至今",
    );
    expect(p.records.filter((r) => r.group === "education")).toHaveLength(2);
    expect(new Set(p.records.map((r) => r.id)).size).toBe(p.records.length);
    expect(p.records[2].facts.endDate.value).toBe("至今");
    expect(
      p.records.every((r) => Object.values(r.facts).every((f) => !f.confirmed)),
    ).toBe(true);
  });
  it("预计毕业保持状态；熟悉不会升级为精通", () => {
    const p = parseText(
      "学校：虚构学校\n预计毕业时间：2027-06\n技能：SolidWorks\n熟练程度：熟悉",
    ).profile;
    expect(p.records[0].facts.graduationStatus.value).toBe("预计毕业");
    expect(p.records[1].facts.level.value).toBe("熟悉");
  });
  it("不从松散文字捏造学校和GPA", () => {
    const p = parseText("某大学旁参加活动，熟悉机械。曾参加研发。").profile;
    expect(p.records).toHaveLength(0);
  });
  it("版本、重复ID、陌生字段和密钥拒绝", () => {
    const p = profile();
    expect(() => validateProfile({ ...p, schemaVersion: 2 })).toThrow();
    expect(() =>
      validateProfile({ ...p, records: [p.records[0], p.records[0]] }),
    ).toThrow();
    p.records[0].facts.apiKey = fact("secret");
    expect(() => validateProfile(p)).toThrow();
    delete p.records[0].facts.apiKey;
    p.records[0].facts.name = fact("sk-TEST_SECRET_CANARY");
    expect(() => validateProfile(p)).toThrow();
  });
  it("重导入差异不修改当前资料", () => {
    const p = profile(),
      q = structuredClone(p);
    q.records[0].facts.name.value = "新虚构甲";
    const diff = diffProfiles(p, q);
    expect(diff.find((x) => x.key === "name")?.old?.value).toBe("虚构甲");
    expect(p.records[0].facts.name.value).toBe("虚构甲");
  });
});
describe("语义与保守填写规则", () => {
  it("确认且明确才默认选择；网页已有内容不覆盖", () => {
    const p = profile();
    expect(
      buildPlan(p, [control("姓名")], "https://example.com")[0].selected,
    ).toBe(true);
    expect(
      buildPlan(
        p,
        [control("姓名", { value: "网页原值" })],
        "https://example.com",
      )[0].selected,
    ).toBe(false);
    p.records[0].facts.name.confirmed = false;
    expect(
      buildPlan(p, [control("姓名")], "https://example.com")[0].status,
    ).toBe("待确认");
  });
  it("紧急联系人和本人不混用", () => {
    expect(
      identify(control("姓名", { context: "紧急联系人" })),
    ).toBeUndefined();
    expect(
      identify(control("手机号码", { context: "紧急联系人" })),
    ).toBeUndefined();
  });
  it("冲突标签不自动匹配", () => {
    expect(
      identify(control("姓名", { hints: ["姓名", "电子邮箱"] })),
    ).toBeUndefined();
    expect(
      identify(
        control("姓名 / 手机号码", { hints: ["姓名 / 手机号码", "电子邮箱"] }),
      ),
    ).toBeUndefined();
  });
  it("出生地/籍贯/户籍/现居地不混同", () => {
    expect(
      ["出生地", "籍贯", "户籍地", "现居地"].map(
        (s) => identify(control(s))?.key,
      ),
    ).toEqual(["birthplace", "nativePlace", "hukou", "city"]);
  });
  it("两条教育必须关联或有明确层次", () => {
    const p = profile(),
      e = record("education");
    e.facts.school = { ...fact("虚构大学乙"), confirmed: true };
    e.facts.qualification = { ...fact("硕士"), confirmed: true };
    p.records.push(e);
    expect(
      buildPlan(
        p,
        [control("学校", { context: "教育经历" })],
        "https://example.com",
      )[0].selected,
    ).toBe(false);
    expect(
      buildPlan(
        p,
        [control("学校", { context: "硕士教育经历" })],
        "https://example.com",
      )[0].value,
    ).toBe("虚构大学乙");
    expect(
      buildPlan(
        p,
        [control("学校", { context: "教育经历" })],
        "https://example.com",
        [],
        { a: e.id },
      )[0].ref?.recordId,
    ).toBe(e.id);
  });
  it("缺少资料、法律声明、证件不填", () => {
    const p = profile();
    expect(
      buildPlan(p, [control("电子邮箱")], "https://example.com")[0].status,
    ).toBe("缺少资料");
    expect(
      buildPlan(p, [control("同意隐私协议")], "https://example.com")[0].status,
    ).toBe("已跳过");
    expect(
      buildPlan(p, [control("身份证号码")], "https://example.com")[0].selected,
    ).toBe(false);
  });
  it("日期转换不补精度，拒绝无效日", () => {
    expect(
      formatValue("2024年6月30日", control("", { kind: "date" })).value,
    ).toBe("2024-06-30");
    for (const v of ["2024", "2024-06", "至今", "预计2027年6月", "2024-02-31"])
      expect(formatValue(v, control("", { kind: "date" })).error).toBeTruthy();
    expect(formatValue("2020.9", control("", { kind: "month" })).value).toBe(
      "2020-09",
    );
  });
  it("下拉只选唯一真实标签，不模糊补选", () => {
    const c = control("学历", {
      kind: "select",
      options: [{ value: "bs", label: "本科", disabled: false }],
    });
    expect(formatValue("本科", c).value).toBe('["bs"]');
    expect(formatValue("硕士", c).error).toBeTruthy();
    c.options.push({ value: "x", label: "本科", disabled: false });
    expect(formatValue("本科", c).error).toBeTruthy();
  });
  it("自定义控件保留人工选择", () => {
    expect(
      formatValue("虚构学校", control("学校", { kind: "custom" })).error,
    ).toBeTruthy();
  });
  it("数字范围按数值比较，自定义pattern保留人工", () => {
    expect(
      formatValue(
        "12",
        control("数量", { kind: "number", min: "2", max: "20" }),
      ).error,
    ).toBeUndefined();
    expect(
      formatValue("8", control("数量", { kind: "number", max: "7" })).error,
    ).toBeTruthy();
    expect(
      formatValue("abc", control("备注", { pattern: "[0-9]+" })).error,
    ).toBeTruthy();
  });
  it("站点规则仅匹配来源、路径和签名", () => {
    const p = profile();
    const ref = { recordId: p.records[0].id, key: "name" },
      c = control("内部备注");
    const rule = {
      origin: "https://a.example",
      path: "/apply",
      signature: c.signature,
      ref,
    };
    expect(buildPlan(p, [c], "https://a.example/apply", [rule])[0].ref).toEqual(
      ref,
    );
    expect(
      buildPlan(p, [c], "https://b.example/apply", [rule])[0].ref,
    ).toBeUndefined();
  });
  it("拒绝设置页、商店、银行和含口令的URL", () => {
    for (const url of [
      "edge://extensions",
      "file:///C:/x",
      "https://chromewebstore.google.com/detail/a",
      "https://bank.example.com/",
      "https://user:pass@example.com/",
    ])
      expect(() => safeURL(url)).toThrow();
    expect(safeURL("https://jobs.example.com/apply").hostname).toBe(
      "jobs.example.com",
    );
  });
});
