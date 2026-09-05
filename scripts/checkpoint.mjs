import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

export const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const safe = (s) =>
  String(s ?? "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[邮箱已脱敏]")
    .replace(/\b1[3-9]\d{9}\b/g, "[手机号已脱敏]")
    .replace(/\b\d{17}[\dXx]\b/g, "[证件已脱敏]")
    .replace(/(?:sk-|Bearer\s+)[\w.-]+/g, "[密钥已脱敏]")
    .slice(0, 900);
export function atomicWrite(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temp, value, { encoding: "utf8", flag: "wx" });
    fs.renameSync(temp, file);
  } finally {
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
  }
}
export async function checkpoint(event, base = root) {
  if (!["success", "failure", "pending", "observed"].includes(event.result))
    throw new Error("result 必须为 success/failure/pending/observed");
  const mem = path.join(base, "memory");
  fs.mkdirSync(mem, { recursive: true });
  const lock = path.join(mem, ".lock");
  let fd;
  for (let n = 0; n < 40; n++) {
    try {
      fd = fs.openSync(lock, "wx");
      break;
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
      if (Date.now() - fs.statSync(lock).mtimeMs > 120000)
        throw new Error(
          "记忆锁过期；先确认无其他写入进程，再人工移除 memory/.lock",
        );
      await new Promise((r) => setTimeout(r, 50));
    }
  }
  if (fd === undefined) throw new Error("记忆写入锁被占用；本次未写入，请重试");
  try {
    const dedupFile = path.join(mem, ".events.json");
    const ids = fs.existsSync(dedupFile)
      ? JSON.parse(fs.readFileSync(dedupFile, "utf8"))
      : [];
    const id = event.id || crypto.randomUUID();
    if (ids.includes(id)) return { duplicate: true };
    const session = safe(
      event.session || process.env.CODEX_THREAD_ID || "manual",
    )
      .replace(/[^\w-]/g, "_")
      .slice(0, 80);
    const time = new Date().toISOString();
    const file = path.join(
      mem,
      "sessions",
      `${time.slice(0, 10)}-${session}.md`,
    );
    const old = fs.existsSync(file)
      ? fs.readFileSync(file, "utf8")
      : `# 会话 ${session}\n\n仅工程事件，不含聊天全文或工具原始输入输出。\n`;
    const entry = `\n- ${time} | ${safe(event.step)} | ${event.result}\n  - ${safe(event.summary)}\n  - 变更：${safe(event.files || "见 Git diff")}\n  - 下一步：${safe(event.next || "见 STATUS")}\n`;
    // Keep a bounded tail; STATUS and DECISIONS retain durable conclusions.
    atomicWrite(
      file,
      old.length > 65000
        ? `# 会话 ${session}（早期事件已裁剪）\n${old.slice(-45000)}${entry}`
        : old + entry,
    );
    if (event.result !== "observed") {
      const status = path.join(mem, "STATUS.md");
      const text = fs.existsSync(status)
        ? fs.readFileSync(status, "utf8")
        : "# 当前状态\n";
      const durable = text.split("\n<!-- checkpoint -->")[0];
      atomicWrite(
        status,
        `${durable}\n<!-- checkpoint -->\n最近步骤：${safe(event.step)}\n结果：${event.result}；${safe(event.summary)}\n下一步：${safe(event.next || "待更新")}\n记录：sessions/${path.basename(file)}\n时间：${time}\n`,
      );
    }
    atomicWrite(dedupFile, JSON.stringify([...ids.slice(-499), id]));
    return { written: true, session, result: event.result };
  } finally {
    fs.closeSync(fd);
    fs.unlinkSync(lock);
  }
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const args = Object.fromEntries(
    process.argv
      .slice(2)
      .reduce(
        (a, v, i, all) =>
          i % 2 === 0 ? [...a, [v.replace(/^--/, ""), all[i + 1]]] : a,
        [],
      ),
  );
  try {
    if (!args.step || !args.summary)
      throw new Error(
        "需 --step --result --summary，可选 --next --files --session --id",
      );
    console.log(JSON.stringify(await checkpoint(args)));
  } catch (e) {
    console.error(`记忆写入失败：${e.message}`);
    process.exitCode = 1;
  }
}
