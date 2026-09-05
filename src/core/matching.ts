import {
  fields,
  factAt,
  sensitiveKey,
  type Control,
  type FieldRef,
  type Group,
  type PlanRow,
  type Profile,
  type SiteRule,
} from "./model";
export const normalize = (s: string) =>
  s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, "");
const synonyms: Record<string, string[]> = {
  "basics.name": [
    "姓名",
    "本人姓名",
    "中文姓名",
    "申请人姓名",
    "name",
    "fullname",
    "applicantname",
  ],
  "basics.phone": [
    "手机",
    "手机号码",
    "手机号",
    "联系电话",
    "mobile",
    "phone",
    "telephone",
    "tel",
  ],
  "basics.email": ["邮箱", "电子邮箱", "电子邮件", "email", "emailaddress"],
  "basics.gender": ["性别", "gender", "sex"],
  "basics.birthDate": ["出生日期", "birthdate", "dateofbirth"],
  "basics.birthplace": ["出生地", "birthplace"],
  "basics.nativePlace": ["籍贯", "nativeplace"],
  "basics.hukou": ["户籍地", "户籍所在地", "hukou"],
  "basics.city": ["现居地", "现居城市", "currentcity"],
  "basics.address": ["通讯地址", "通信地址", "address"],
  "basics.website": ["个人网站", "website"],
  "basics.politics": ["政治面貌", "politics"],
  "education.school": [
    "学校",
    "院校",
    "学校名称",
    "毕业院校",
    "毕业学校",
    "school",
    "university",
    "institution",
  ],
  "education.major": ["专业", "所学专业", "major", "fieldofstudy"],
  "education.qualification": [
    "学历",
    "最高学历",
    "qualification",
    "educationlevel",
  ],
  "education.degree": ["学位", "degree"],
  "education.startDate": ["入学时间", "入学日期", "educationstartdate"],
  "education.endDate": [
    "毕业时间",
    "毕业日期",
    "预计毕业时间",
    "educationenddate",
  ],
  "education.graduationStatus": ["毕业状态", "graduationstatus"],
  "education.gpa": ["gpa", "绩点"],
  "education.rank": ["排名", "ranking"],
  "work.company": [
    "公司",
    "单位名称",
    "公司名称",
    "实习单位",
    "company",
    "employer",
  ],
  "work.title": ["职位", "岗位名称", "职务", "jobtitle"],
  "work.description": ["工作内容", "工作职责", "实习内容", "工作成果"],
  "projects.name": ["项目名称", "科研项目名称", "projectname"],
  "projects.role": ["项目角色", "担任角色", "projectrole"],
  "projects.description": [
    "项目描述",
    "项目内容",
    "项目职责",
    "项目成果",
    "projectdescription",
  ],
  "job.desiredRole": ["意向岗位", "期望岗位", "desiredrole"],
  "job.desiredCity": ["意向城市", "期望城市", "desiredcity"],
  "job.salary": ["期望薪资", "期望薪酬", "薪资要求", "expectedsalary"],
  "job.availability": ["到岗时间", "可到岗日期", "availability"],
  "job.workAuthorization": ["工作授权", "workauthorization"],
  "job.relocation": ["是否接受调剂", "是否接受调动", "relocation"],
  "job.travel": ["是否接受出差", "travel"],
  "skills.name": ["技能名称", "skill"],
  "skills.level": ["熟练程度", "技能水平"],
  "languages.name": ["语言", "language"],
  "languages.level": ["语言水平", "语言能力"],
  "languages.score": ["语言分数", "语言成绩"],
  "certificates.name": ["证书名称", "certificate"],
  "certificates.date": ["证书获得时间"],
  "awards.name": ["奖项名称", "award"],
  "awards.date": ["获奖时间"],
};
const dangerous =
  /(验证码|密码|口令|短信码|隐私|协议|声明|授权声明|背景调查|同意|承诺|签名|签字|captcha|password|otp|verification.?code|consent|terms|privacy|declaration|signature|身份证|护照|证件号码|银行卡|健康|残疾|宗教|passport|national.?id|bank.?account)/i;
export function blockedLabel(s: string) {
  return dangerous.test(s);
}
export function groupHint(s: string): Group | undefined {
  if (/紧急|联系人|推荐人|父亲|母亲|配偶|emergency|reference|referee/i.test(s))
    return undefined;
  if (/教育|学历|本科|硕士|博士|education|bachelor|master|university/i.test(s))
    return "education";
  if (/项目|科研|project|research/i.test(s)) return "projects";
  if (/工作经历|实习|任职|work experience|employment|internship/i.test(s))
    return "work";
  return undefined;
}
export function identify(
  field: Control,
): { group: Group; key: string; reason: string } | undefined {
  const context = field.context;
  if (
    /紧急|联系人|推荐人|父亲|母亲|配偶|emergency|referee|reference/i.test(
      context + " " + field.label,
    )
  )
    return;
  const hint = groupHint(context);
  const candidates = new Map<string, string>();
  for (const raw of field.hints.flatMap((h) => [
    h,
    ...h.split(/[/|、,，;；]|\s+or\s+|或/i),
  ])) {
    let n = normalize(
      raw.replace(/[（(][^）)]*[）)]/g, "").replace(/必填|required/gi, ""),
    );
    if (!n) continue;
    if (
      hint &&
      ["开始时间", "开始日期", "startdate", "起始时间"]
        .map(normalize)
        .includes(n)
    )
      candidates.set(`${hint}.startDate`, "分组与明确起始日期标签");
    if (hint && ["结束时间", "结束日期", "enddate"].map(normalize).includes(n))
      candidates.set(`${hint}.endDate`, "分组与明确结束日期标签");
    if (hint === "education") n = n.replace(/^(本科|硕士|博士)/, "");
    for (const [key, aliases] of Object.entries(synonyms)) {
      if (aliases.some((a) => normalize(a) === n)) {
        const g = key.split(".")[0];
        if (hint && ["education", "projects", "work"].includes(g) && hint !== g)
          continue;
        candidates.set(key, `中英文精确同义字段：${raw}`);
      }
    }
  }
  // Generic 'name' means the enclosing repeat entity when context is explicit.
  if (hint && candidates.has("basics.name")) {
    candidates.delete("basics.name");
    candidates.set(
      hint === "education"
        ? "education.school"
        : hint === "work"
          ? "work.company"
          : "projects.name",
      "分组内名称",
    );
  }
  if (candidates.size !== 1) return;
  const [entry, reason] = [...candidates][0];
  const [g, key] = entry.split(".");
  return { group: g as Group, key, reason };
}
export function formatValue(
  value: string,
  f: Control,
): { value: string; error?: string } {
  let result = value.trim();
  if (["date", "month"].includes(f.kind)) {
    const m = result.match(
      /^(\d{4})(?:[-/.年](\d{1,2}))?(?:[-/.月](\d{1,2})日?)?月?$/,
    );
    const need = f.kind === "date" ? 3 : 2;
    if (!m || !m[need])
      return {
        value: result,
        error: "日期精度不足；不会补月份或日期（至今 / 预计毕业请人工处理）",
      };
    const y = +m[1],
      month = +m[2],
      day = m[3] ? +m[3] : 1;
    if (
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > new Date(y, month, 0).getDate()
    )
      return { value: result, error: "日期不合法" };
    result =
      `${m[1]}-${m[2].padStart(2, "0")}` +
      (need === 3 ? `-${m[3].padStart(2, "0")}` : "");
  }
  if (f.kind === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result))
    return { value: result, error: "邮箱格式不合法" };
  if (f.maxLength > 0 && result.length > f.maxLength)
    return { value: result, error: "内容超过网页字数限制；不截断事实" };
  if (f.kind === "number" && !/^-?\d+(\.\d+)?$/.test(result))
    return { value: result, error: "网页需要数字，请人工确认单位" };
  if (
    ["date", "month", "number"].includes(f.kind) &&
    ((f.min &&
      (f.kind === "number"
        ? Number(result) < Number(f.min)
        : result < f.min)) ||
      (f.max &&
        (f.kind === "number"
          ? Number(result) > Number(f.max)
          : result > f.max)))
  )
    return { value: result, error: "超出网页允许范围" };
  if (f.pattern)
    return { value: result, error: "网站指定了自定义格式；请人工检查并填写" };
  if (f.kind === "select" || f.kind === "radio" || f.kind === "checkbox") {
    const values =
      f.kind === "checkbox"
        ? result
            .split(/[、,，;；\n]/)
            .map((v) => v.trim())
            .filter(Boolean)
        : [result];
    const opts = values.map((v) =>
      f.options.filter(
        (o) => !o.disabled && normalize(o.label) === normalize(v),
      ),
    );
    if (opts.some((o) => o.length !== 1))
      return { value: result, error: "选项不存在或重名；请在网页手动选择" };
    result = JSON.stringify(opts.map((o) => o[0].value));
  }
  if (f.kind === "custom")
    return { value: result, error: "自定义控件需人工确认选项；通用引擎不操作" };
  return { value: result };
}
export function buildPlan(
  profile: Profile,
  controls: Control[],
  url: string,
  rules: SiteRule[] = [],
  associations: Record<string, string> = {},
): PlanRow[] {
  const u = new URL(url);
  return controls.map((field) => {
    const row: PlanRow = {
      field,
      value: "",
      reason: "无法唯一识别，请手动关联资料字段",
      status: "待确认",
      selected: false,
      overwrite: false,
      sensitive: false,
      source: "",
    };
    if (field.blocked || blockedLabel(field.label))
      return {
        ...row,
        reason: field.blocked || "敏感 / 声明字段需在网页人工填写",
        status: "已跳过",
      };
    const mapped = identify(field);
    const siteRule = rules.find(
      (r) =>
        r.origin === u.origin &&
        r.path === u.pathname &&
        r.signature === field.signature,
    );
    let ref: FieldRef | undefined = siteRule?.ref;
    let reason = siteRule
      ? "本站手动字段规则（页面路径和结构一致）"
      : mapped?.reason || row.reason;
    if (!ref && mapped) {
      let records = profile.records.filter((r) => r.group === mapped.group);
      const associated = associations[field.groupId];
      if (associated) records = records.filter((r) => r.id === associated);
      else if (records.length > 1 && mapped.group === "education") {
        const match = (field.context + " " + field.label).match(
          /本科|硕士|博士/,
        );
        if (match)
          records = records.filter(
            (r) =>
              r.facts.qualification?.confirmed &&
              r.facts.qualification.value === match[0],
          );
      }
      if (records.length === 1)
        ref = { recordId: records[0].id, key: mapped.key };
      else if (!records.length)
        return { ...row, status: "缺少资料", reason: "资料库没有相应经历" };
      else return { ...row, reason: "多条经历：请先确认本组对应哪一条记录" };
    }
    if (!ref) {
      const answers = profile.records.filter(
        (r) =>
          r.group === "answers" &&
          r.facts.question?.confirmed &&
          normalize(r.facts.question.value) === normalize(field.label),
      );
      if (answers.length === 1) {
        ref = { recordId: answers[0].id, key: "answer" };
        reason = "已确认常用问答标题精确匹配";
      }
    }
    return ref ? planForRef(profile, field, ref, reason) : row;
  });
}
export function planForRef(
  profile: Profile,
  field: Control,
  ref: FieldRef,
  reason = "本次手动关联",
): PlanRow {
  const f = factAt(profile, ref);
  const converted = formatValue(f?.value || "", field);
  const sensitive = sensitiveKey(ref.key);
  const status: PlanRow["status"] = !f?.value
    ? "缺少资料"
    : !f.confirmed || sensitive || converted.error
      ? "待确认"
      : field.value
        ? "已跳过"
        : "待填写";
  return {
    field,
    ref,
    value: converted.value,
    status,
    selected: status === "待填写",
    overwrite: false,
    sensitive,
    source: f
      ? `${f.source === "resume" ? "简历原文" : f.source === "manual" ? "手动事实" : "规则建议"} · ${f.sourceId || "手动录入"}${f.excerpt ? " · " + f.excerpt : ""}`
      : "",
    reason: !f?.value
      ? "资料缺失"
      : !f.confirmed
        ? "资料尚未确认"
        : converted.error ||
          (sensitive
            ? "此字段每次填写需单独确认"
            : field.value
              ? "网页已有内容，默认保留"
              : reason),
  };
}
export function refLabel(p: Profile, ref: FieldRef) {
  const r = p.records.find((r) => r.id === ref.recordId);
  return r ? `${r.title} / ${fields[r.group][ref.key]}` : "记录已删除";
}
