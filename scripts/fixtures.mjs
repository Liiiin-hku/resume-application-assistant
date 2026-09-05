import fs from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { Document, Paragraph, Packer } from "docx";
import { root } from "./checkpoint.mjs";
import { build } from "esbuild";
const out = path.join(root, "tests", "fixtures");
fs.mkdirSync(out, { recursive: true });
const F = (v) => ({
  value: v,
  confirmed: true,
  source: "manual",
  sourceId: "明确虚构示例",
  excerpt: "",
});
const profile = {
  schemaVersion: 1,
  id: "fictional-profile",
  name: "虚构示例，请勿用于真实投递",
  demo: true,
  revision: 0,
  records: [
    {
      id: "basic-demo",
      group: "basics",
      title: "虚构测试员甲",
      facts: {
        name: F("虚构测试员甲"),
        phone: F("13800000000"),
        email: F("fictional@example.invalid"),
        city: F("示例市甲"),
        gender: F("女"),
        birthplace: F("出生示例地"),
      },
    },
    {
      id: "edu-undergrad",
      group: "education",
      title: "虚构大学甲 / 本科",
      facts: {
        school: F("虚构大学甲"),
        major: F("虚构机械工程"),
        qualification: F("本科"),
        startDate: F("2020.09"),
        endDate: F("2024年6月30日"),
      },
    },
    {
      id: "edu-master",
      group: "education",
      title: "虚构大学乙 / 硕士",
      facts: {
        school: F("虚构大学乙"),
        major: F("虚构机器人"),
        qualification: F("硕士"),
        startDate: F("2024-09"),
        endDate: F("至今"),
      },
    },
    {
      id: "project-demo",
      group: "projects",
      title: "虚构项目甲",
      facts: {
        name: F("虚构装配测试项目"),
        startDate: F("2025-03"),
        description: F("虚构说明：只用于本地表单测试，不代表真实经历。"),
      },
    },
    {
      id: "job-demo",
      group: "job",
      title: "虚构求职信息",
      facts: { desiredCity: F("示例市甲、示例市乙") },
    },
  ],
};
fs.writeFileSync(
  path.join(out, "虚构示例资料.json"),
  JSON.stringify(profile, null, 2),
);
const lines = [
  "姓名：虚构测试员甲",
  "手机号码：13800000000",
  "邮箱：fictional@example.invalid",
  "教育经历",
  "学校：虚构大学甲",
  "专业：虚构机械工程",
  "学历：本科",
  "入学时间：2020.09",
  "毕业时间：2024年6月30日",
  "教育经历",
  "学校：虚构大学乙",
  "学历：硕士",
  "毕业时间：至今",
  "项目经历",
  "项目名称：虚构装配测试项目",
  "开始时间：2025-03",
  "项目内容：虚构说明，仅用于测试。",
];
fs.writeFileSync(path.join(out, "虚构简历.txt"), lines.join("\n"));
fs.writeFileSync(
  path.join(out, "虚构简历.docx"),
  await Packer.toBuffer(
    new Document({
      sections: [{ children: lines.map((s) => new Paragraph(s)) }],
    }),
  ),
);
const pdf = await PDFDocument.create();
const font = await pdf.embedFont(StandardFonts.Helvetica);
const page = pdf.addPage();
page.drawText(
  "name: Fictional Applicant\nemail: fictional@example.invalid\nFICTIONAL TEST RESUME",
  { x: 50, y: 750, size: 14, font, lineHeight: 28 },
);
fs.writeFileSync(path.join(out, "fictional-text.pdf"), await pdf.save());
const blank = await PDFDocument.create();
blank.addPage();
fs.writeFileSync(path.join(out, "no-text.pdf"), await blank.save());
fs.writeFileSync(path.join(out, "corrupted.pdf"), "not a pdf");
fs.writeFileSync(path.join(out, "corrupted.docx"), "not a zip");
console.log("虚构 JSON / TXT / PDF / DOCX / 损坏样例已生成到 tests/fixtures");
await build({
  entryPoints: [path.join(out, "react-entry.jsx")],
  outfile: path.join(out, "react.bundle.js"),
  bundle: true,
  platform: "browser",
  minify: true,
  define: { "process.env.NODE_ENV": '"production"' },
  legalComments: "linked",
});
