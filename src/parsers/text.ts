import {
  emptyProfile,
  fact,
  record,
  type Group,
  type Profile,
  type RecordItem,
} from "../core/model";
const labels: Record<string, [Group, string]> = {
  姓名: ["basics", "name"],
  name: ["basics", "name"],
  手机: ["basics", "phone"],
  电话: ["basics", "phone"],
  手机号码: ["basics", "phone"],
  phone: ["basics", "phone"],
  邮箱: ["basics", "email"],
  电子邮箱: ["basics", "email"],
  email: ["basics", "email"],
  性别: ["basics", "gender"],
  出生日期: ["basics", "birthDate"],
  出生地: ["basics", "birthplace"],
  籍贯: ["basics", "nativePlace"],
  户籍地: ["basics", "hukou"],
  现居地: ["basics", "city"],
  通讯地址: ["basics", "address"],
  学校: ["education", "school"],
  院校: ["education", "school"],
  学校名称: ["education", "school"],
  专业: ["education", "major"],
  学历: ["education", "qualification"],
  学位: ["education", "degree"],
  入学时间: ["education", "startDate"],
  毕业时间: ["education", "endDate"],
  预计毕业时间: ["education", "endDate"],
  毕业状态: ["education", "graduationStatus"],
  gpa: ["education", "gpa"],
  排名: ["education", "rank"],
  单位名称: ["work", "company"],
  实习单位: ["work", "company"],
  公司: ["work", "company"],
  职位: ["work", "title"],
  工作内容: ["work", "description"],
  项目名称: ["projects", "name"],
  项目角色: ["projects", "role"],
  项目内容: ["projects", "description"],
  项目成果: ["projects", "description"],
  技能: ["skills", "name"],
  技能名称: ["skills", "name"],
  熟练程度: ["skills", "level"],
  技能说明: ["skills", "description"],
  语言: ["languages", "name"],
  语言水平: ["languages", "level"],
  语言分数: ["languages", "score"],
  证书: ["certificates", "name"],
  证书名称: ["certificates", "name"],
  颁发机构: ["certificates", "issuer"],
  奖项: ["awards", "name"],
  奖项名称: ["awards", "name"],
  获奖时间: ["awards", "date"],
  自我评价: ["answers", "answer"],
  问题: ["answers", "question"],
  回答: ["answers", "answer"],
  意向岗位: ["job", "desiredRole"],
  意向城市: ["job", "desiredCity"],
  期望薪资: ["job", "salary"],
  到岗时间: ["job", "availability"],
  是否接受调剂: ["job", "relocation"],
  是否接受出差: ["job", "travel"],
  工作授权: ["job", "workAuthorization"],
};
export function parseText(
  text: string,
  sourceId = "粘贴文本",
): { profile: Profile; warnings: string[] } {
  if (text.length > 250000)
    throw new Error("文本过长（上限 25 万字），请仅导入简历内容");
  if (text.trim().length < 8)
    throw new Error("没有足够的可提取文字，请粘贴文本或手动录入");
  const profile = emptyProfile();
  const current: Partial<Record<Group, RecordItem>> = {};
  let group: Group = "basics";
  const lines = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  let used = 0;
  const add = (g: Group, key: string, value: string, line: string) => {
    if (/\b\d{17}[\dXx]\b|\bsk-[\w-]+|Bearer\s+/i.test(value)) return;
    let rec = current[g];
    if (!rec || (rec.facts[key]?.value && !["basics", "job"].includes(g))) {
      rec = record(g);
      profile.records.push(rec);
      current[g] = rec;
    }
    if (rec.facts[key]?.value) return; // conflicting repeat basics stay in raw review, never silently replace.
    rec.facts[key] = fact(value, "resume", sourceId, line.slice(0, 500));
    if (["school", "company", "name", "question"].includes(key))
      rec.title = value.slice(0, 100);
    if (key === "answer" && line.startsWith("自我评价")) {
      rec.title = "自我评价";
      rec.facts.question = fact("自我评价", "resume", sourceId, "自我评价");
    }
    if (line.startsWith("预计毕业时间"))
      rec.facts.graduationStatus = fact("预计毕业", "resume", sourceId, line);
    used++;
  };
  for (const line of lines) {
    if (/^(教育经历|教育背景|education|本科|硕士|博士)[:：]?$/i.test(line)) {
      group = "education";
      delete current[group];
      continue;
    }
    if (/^(工作经历|实习经历|实习与工作|work experience)[:：]?$/i.test(line)) {
      group = "work";
      delete current[group];
      continue;
    }
    if (/^(项目经历|科研经历|项目与科研|projects)[:：]?$/i.test(line)) {
      group = "projects";
      delete current[group];
      continue;
    }
    if (/^(技能|语言|证书|奖项|自我评价|求职信息)[:：]?$/.test(line)) {
      group = (
        {
          技能: "skills",
          语言: "languages",
          证书: "certificates",
          奖项: "awards",
          自我评价: "answers",
          求职信息: "job",
        } as Record<string, Group>
      )[line.replace(/[:：]$/, "")];
      continue;
    }
    // Delimited, labelled facts only; unstructured prose remains visible for manual review.
    for (const piece of line.split(/[|｜\t]/)) {
      const m = piece.trim().match(/^([^:：]{1,18})\s*[:：]\s*(.+)$/);
      if (!m) continue;
      const key = m[1].trim().toLowerCase();
      const match = labels[key];
      if (match) {
        add(match[0], match[1], m[2].trim(), piece.trim());
        continue;
      }
      if (
        ["education", "work", "projects"].includes(group) &&
        /^(开始时间|起始时间|开始日期|结束时间|结束日期)$/.test(key)
      )
        add(
          group,
          /开始|起始/.test(key) ? "startDate" : "endDate",
          m[2].trim(),
          piece.trim(),
        );
    }
  }
  // Exact isolated email is factual; do not infer school/degree/dates from proximity.
  if (!current.basics?.facts.email?.value) {
    const emails = [
      ...new Set(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []),
    ];
    if (emails.length === 1) add("basics", "email", emails[0], emails[0]);
  }
  return {
    profile,
    warnings: [
      `已提取 ${used} 个待确认字段。仅解析明确标签及唯一邮箱；其余文字请对照原文手动补充。`,
      "所有字段均未确认；不会据此直接填写。原文只在当前界面临时显示，证件和密钥不应导入。",
    ],
  };
}
