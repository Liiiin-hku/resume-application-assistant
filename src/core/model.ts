export const groups = [
  "basics",
  "education",
  "work",
  "projects",
  "skills",
  "languages",
  "certificates",
  "awards",
  "answers",
  "job",
] as const;
export type Group = (typeof groups)[number];
export const groupLabels: Record<Group, string> = {
  basics: "基本信息",
  education: "教育经历",
  work: "实习 / 工作",
  projects: "项目 / 科研",
  skills: "技能",
  languages: "语言",
  certificates: "证书",
  awards: "奖项",
  answers: "自我评价 / 问答",
  job: "求职信息",
};
export const fields: Record<Group, Record<string, string>> = {
  basics: {
    name: "姓名",
    phone: "手机号码",
    email: "电子邮箱",
    gender: "性别",
    birthDate: "出生日期",
    birthplace: "出生地",
    nativePlace: "籍贯",
    hukou: "户籍地",
    city: "现居地",
    address: "通讯地址",
    website: "个人网站",
    politics: "政治面貌",
  },
  education: {
    school: "学校名称",
    major: "专业",
    qualification: "学历",
    degree: "学位",
    startDate: "入学时间",
    endDate: "结束 / 毕业时间",
    graduationStatus: "毕业状态",
    gpa: "GPA",
    rank: "排名",
  },
  work: {
    company: "单位名称",
    title: "职位",
    startDate: "开始时间",
    endDate: "结束时间",
    description: "职责与成果",
  },
  projects: {
    name: "项目名称",
    role: "项目角色",
    startDate: "开始时间",
    endDate: "结束时间",
    description: "项目内容与成果",
  },
  skills: { name: "技能名称", level: "熟练程度", description: "技能说明" },
  languages: { name: "语言", level: "语言水平", score: "语言分数" },
  certificates: { name: "证书名称", date: "获得时间", issuer: "颁发机构" },
  awards: { name: "奖项名称", date: "获奖时间", description: "奖项说明" },
  answers: { question: "问题标题", answer: "回答内容" },
  job: {
    desiredRole: "意向岗位",
    desiredCity: "意向城市",
    salary: "期望薪资",
    availability: "到岗时间",
    workAuthorization: "工作授权",
    relocation: "是否接受调剂",
    travel: "是否接受出差",
  },
};
export type Fact = {
  value: string;
  confirmed: boolean;
  source: "resume" | "manual" | "suggestion";
  sourceId: string;
  excerpt: string;
};
export type RecordItem = {
  id: string;
  group: Group;
  title: string;
  facts: Record<string, Fact>;
};
export type Profile = {
  schemaVersion: 1;
  id: string;
  name: string;
  demo: boolean;
  revision: number;
  records: RecordItem[];
};
export type FieldRef = { recordId: string; key: string };
export type SiteRule = {
  origin: string;
  path: string;
  signature: string;
  ref: FieldRef;
};
export type Control = {
  id: string;
  signature: string;
  label: string;
  hints: string[];
  context: string;
  groupId: string;
  kind: string;
  value: string;
  options: { value: string; label: string; disabled: boolean }[];
  required: boolean;
  blocked: string;
  autocomplete: string;
  maxLength: number;
  pattern: string;
  min: string;
  max: string;
};
export type Scan = {
  token: string;
  url: string;
  title: string;
  fingerprint: string;
  fields: Control[];
  warnings: string[];
  tabId: number;
  epoch: number;
};
export type RowStatus =
  "待填写" | "已写入并验证" | "已跳过" | "缺少资料" | "待确认" | "填写失败";
export type PlanRow = {
  field: Control;
  ref?: FieldRef;
  value: string;
  reason: string;
  status: RowStatus;
  selected: boolean;
  overwrite: boolean;
  sensitive: boolean;
  source: string;
};
export const emptyProfile = (): Profile => ({
  schemaVersion: 1,
  id: crypto.randomUUID(),
  name: "我的资料",
  demo: false,
  revision: 0,
  records: [],
});
export const fact = (
  value = "",
  source: Fact["source"] = "manual",
  sourceId = "",
  excerpt = "",
): Fact => ({ value, confirmed: false, source, sourceId, excerpt });
export const record = (group: Group, title = ""): RecordItem => ({
  id: crypto.randomUUID(),
  group,
  title: title || groupLabels[group],
  facts: Object.fromEntries(Object.keys(fields[group]).map((k) => [k, fact()])),
});
export const factAt = (p: Profile, ref?: FieldRef) =>
  ref
    ? p.records.find((r) => r.id === ref.recordId)?.facts[ref.key]
    : undefined;
export const sensitiveKey = (key: string) =>
  ["politics", "birthDate", "workAuthorization"].includes(key);
export function validateProfile(input: unknown): Profile {
  if (!input || typeof input !== "object")
    throw new Error("资料 JSON 必须是对象");
  if (
    /\b\d{17}[\dXx]\b|\bsk-[\w-]{12,}|\bBearer\s+[\w.-]{12,}/.test(
      JSON.stringify(input),
    )
  )
    throw new Error("资料或来源中含证件号码 / 密钥，请移除后再导入或保存");
  const p = input as Profile;
  if (p.schemaVersion !== 1)
    throw new Error(
      "资料版本不支持；请使用本插件 schemaVersion=1 的备份，不会覆盖现有资料",
    );
  if (!Array.isArray(p.records) || p.records.length > 250)
    throw new Error("记录格式或数量不合法");
  const clean = emptyProfile();
  clean.id = identifier(p.id);
  clean.name = short(p.name, 100);
  clean.demo = p.demo === true;
  clean.revision = Number.isSafeInteger(p.revision) ? p.revision : 0;
  const seen = new Set<string>();
  clean.records = p.records.map((r) => {
    if (!groups.includes(r.group) || !r.facts || typeof r.facts !== "object")
      throw new Error("记录类别或事实不合法");
    const id = identifier(r.id);
    if (seen.has(id)) throw new Error("记录 ID 重复");
    seen.add(id);
    const fs: Record<string, Fact> = {};
    for (const [key, f] of Object.entries(r.facts)) {
      if (!Object.hasOwn(fields[r.group], key))
        throw new Error("存在不支持的字段（证件号码和密钥不可保存）");
      if (
        !f ||
        typeof f.value !== "string" ||
        !["resume", "manual", "suggestion"].includes(f.source)
      )
        throw new Error("事实格式不合法");
      const value = short(f.value, 12000);
      // Structured storage deliberately rejects common ID/key patterns even in free text.
      if (/\b\d{17}[\dXx]\b|\bsk-[\w-]{12,}|\bBearer\s+[\w.-]{12,}/.test(value))
        throw new Error(
          "请移除证件号码 / API Key 后再保存；本版不持久化这些内容",
        );
      fs[key] = {
        value,
        confirmed: f.confirmed === true,
        source: f.source,
        sourceId: short(f.sourceId, 160),
        excerpt: short(f.excerpt, 500).replace(
          /\b\d{17}[\dXx]\b/g,
          "[证件已移除]",
        ),
      };
    }
    return { id, group: r.group, title: short(r.title, 120), facts: fs };
  });
  return clean;
}
function short(s: unknown, max: number) {
  if (typeof s !== "string" || s.length > max)
    throw new Error("资料文本长度或类型不合法");
  return s;
}
function identifier(s: unknown) {
  const id = short(s, 80);
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error("记录 ID 不合法");
  return id;
}
export function diffProfiles(current: Profile, incoming: Profile) {
  return incoming.records.flatMap((r) =>
    Object.entries(r.facts)
      .filter(([, f]) => f.value)
      .map(([key, f]) => {
        const old = current.records.find((x) => x.id === r.id)?.facts[key];
        return {
          record: r,
          key,
          fact: f,
          old,
          changed: !old || old.value !== f.value,
        };
      }),
  );
}
