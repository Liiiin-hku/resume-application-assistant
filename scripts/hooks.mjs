import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { checkpoint, root } from "./checkpoint.mjs";
export async function handleHook(payload, base = root) {
  if (!payload || typeof payload !== "object")
    throw new Error("Hook 输入必须是 JSON 对象");
  const event = payload.hook_event_name;
  if (!["SessionStart", "PostToolUse", "Stop"].includes(event))
    throw new Error("不支持的 Hook 事件");
  // Never persist command text, tool response, transcript path, or chat messages.
  const tool = String(payload.tool_name || "")
    .replace(/[^\w-]/g, "_")
    .slice(0, 80);
  if (
    event === "PostToolUse" &&
    String(
      payload.tool_input?.command || payload.tool_input?.cmd || "",
    ).includes("checkpoint.mjs")
  )
    return { suppressed: true };
  const session = String(payload.session_id || "unknown")
    .replace(/[^\w-]/g, "_")
    .slice(0, 80);
  const git = spawnSync("git", ["status", "--porcelain", "-uno"], {
    cwd: base,
    encoding: "utf8",
  });
  const fileNames =
    git.status === 0
      ? git.stdout
          .split(/\r?\n/)
          .map((l) => l.slice(3))
          .filter(
            (p) =>
              /^(src|scripts|tests|docs|memory|\.codex)[/\\]/.test(p) &&
              !p.startsWith("memory/sessions"),
          )
          .slice(0, 25)
      : [];
  const code = payload.tool_response?.exit_code;
  const isFailure =
    payload.tool_response?.isError === true ||
    (typeof code === "number" && code !== 0);
  const fingerprint = crypto
    .createHash("sha256")
    .update(
      JSON.stringify([
        event,
        session,
        payload.tool_use_id ||
          payload.tool_call_id ||
          payload.id ||
          crypto.randomUUID(),
      ]),
    )
    .digest("hex");
  await checkpoint(
    {
      id: `hook-${fingerprint}`,
      session,
      step: `Hook ${event}${tool ? " " + tool : ""}`,
      result: "observed",
      summary:
        event === "PostToolUse"
          ? `观察到操作事件；执行状态：${isFailure ? "失败" : code === 0 ? "退出码0（非业务结论）" : "未知 / 未提供退出码"}。不据此宣布功能正确。`
          : "生命周期事件；见当前项目状态",
      files: fileNames.join(", ") || "无可报告变更",
      next: "按 AGENTS.md 使用 checkpoint 补充功能与验证结论",
    },
    base,
  );
  if (event === "SessionStart")
    return {
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext:
          "请依次读取 AGENTS.md、memory/PROJECT.md、memory/STATUS.md，再按需读 DECISIONS 和相关会话；核对 Git 和实际代码。不得记录个人资料。",
      },
    };
  if (event === "Stop") {
    const state = fs.readFileSync(
      path.join(base, "memory", "STATUS.md"),
      "utf8",
    );
    const recent =
      Date.now() - fs.statSync(path.join(base, "memory", "STATUS.md")).mtimeMs <
      15 * 60000;
    return {
      systemMessage:
        recent && /下一步/.test(state)
          ? "项目记忆检查：STATUS 有近期下一步；仍需人工核对业务结论和交接。"
          : "项目记忆检查：请更新 STATUS 和会话验证/下一步。Hook 不会代写业务结论。",
    };
  }
  return {};
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.join(root, "scripts", "hooks.mjs")
) {
  try {
    const input = fs.readFileSync(0, "utf8");
    if (input.length > 2 * 1024 * 1024) throw new Error("Hook 输入过大");
    console.log(JSON.stringify(await handleHook(JSON.parse(input))));
  } catch (e) {
    console.error(`项目 Hook 写入失败：${e.message}`);
    process.exitCode = 1;
  }
}
