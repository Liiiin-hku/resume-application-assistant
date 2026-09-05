import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, afterAll } from "vitest";
// @ts-expect-error JavaScript maintenance entry, exercised directly.
import { checkpoint, root } from "../../scripts/checkpoint.mjs";
// @ts-expect-error JavaScript hook entry, exercised directly.
import { handleHook } from "../../scripts/hooks.mjs";
const sandboxes:string[]=[];
afterAll(()=>{const base=path.join(root,'artifacts','memory-tests');for(const p of sandboxes)if(p.startsWith(base+path.sep))fs.rmSync(p,{recursive:true,force:true});});
function sandbox() {
  const base = path.join(
    root,
    "artifacts",
    "memory-tests",
    crypto.randomUUID() + "-中文路径",
  );
  fs.mkdirSync(path.join(base, "memory"), { recursive: true });
  fs.writeFileSync(
    path.join(base, "memory", "STATUS.md"),
    "# 测试状态\n下一步：验证写入\n",
  );
  sandboxes.push(base);return base;
}
describe("项目记忆", () => {
  it("中文路径原子写入、失败保持失败、去重", async () => {
    const base = sandbox();
    const event = {
      step: "虚构失败测试",
      summary: "操作没有成功",
      result: "failure",
      next: "修复错误",
      session: "test",
      id: "same-event",
    };
    await checkpoint(event, base);
    const second = await checkpoint(event, base);
    expect(second.duplicate).toBe(true);
    const status = fs.readFileSync(
      path.join(base, "memory", "STATUS.md"),
      "utf8",
    );
    expect(status).toContain("failure");
    expect(status).not.toContain("结果：success");
    expect(status).toContain("修复错误");
    const file = fs.readdirSync(path.join(base, "memory", "sessions"))[0];
    expect(
      fs
        .readFileSync(path.join(base, "memory", "sessions", file), "utf8")
        .match(/虚构失败测试/g),
    ).toHaveLength(1);
  });
  it("并发写入有锁且不会丢事件", async () => {
    const base = sandbox();
    await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        checkpoint(
          {
            step: `步骤${i}`,
            summary: "合成事件",
            result: "pending",
            session: "parallel-test",
          },
          base,
        ),
      ),
    );
    const file = fs.readdirSync(path.join(base, "memory", "sessions"))[0];
    expect(
      fs
        .readFileSync(path.join(base, "memory", "sessions", file), "utf8")
        .match(/合成事件/g),
    ).toHaveLength(8);
    expect(fs.existsSync(path.join(base, "memory", ".lock"))).toBe(false);
  });
  it("写入失败抛错不假报成功", async () => {
    const base = sandbox();
    fs.writeFileSync(path.join(base, "memory", ".lock"), "occupied");
    await expect(
      checkpoint(
        { step: "锁测试", summary: "未写入", result: "pending" },
        base,
      ),
    ).rejects.toThrow("锁");
    expect(
      fs.readFileSync(path.join(base, "memory", "STATUS.md"), "utf8"),
    ).not.toContain("未写入");
  });
  it("合成Hook脱敏、未知状态不当成功、启动和Stop能找到状态", async () => {
    const base = sandbox();
    const response = await handleHook(
      { hook_event_name: "SessionStart", session_id: "synthetic" },
      base,
    );
    expect(response.hookSpecificOutput.additionalContext).toContain(
      "memory/STATUS.md",
    );
    await handleHook(
      {
        hook_event_name: "PostToolUse",
        session_id: "synthetic",
        tool_name: "Bash",
        tool_use_id: "f1",
        tool_input: { command: "SENSITIVE_COMMAND" },
        tool_response: { exit_code: 1, output: "SENSITIVE_OUTPUT" },
      },
      base,
    );
    const files = fs.readdirSync(path.join(base, "memory", "sessions"));
    const text = files
      .map((f) =>
        fs.readFileSync(path.join(base, "memory", "sessions", f), "utf8"),
      )
      .join("");
    expect(text).toContain("执行状态：失败");
    expect(text).not.toContain("SENSITIVE");
    const stop = await handleHook(
      { hook_event_name: "Stop", session_id: "synthetic" },
      base,
    );
    expect(stop.systemMessage).toContain("STATUS");
  });
});
