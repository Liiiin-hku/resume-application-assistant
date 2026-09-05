# 简历网申投递助手 · 开发约定

目标：个人本地网申填写辅助扩展；用户核对事实、确认填写、手动提交。根目录以本文件所在目录为准：E:\Codex_Projects\简历网申投递助手。

## 开始任务
依次读本文件 → memory/PROJECT.md → memory/STATUS.md → 当前任务相关的 memory/DECISIONS.md 和至多两份 sessions 记录。核对 Git、代码和记忆；新用户要求优先。不读取相邻项目或扫描磁盘寻找简历。默认串行维护；并行须明确文件范围及合并流程。

## 命令与入口
- `node scripts/workspace.mjs install` 安装锁定依赖。
- `node scripts/workspace.mjs check` 类型、单元测试、构建、产物审计。
- `node scripts/workspace.mjs e2e` 隔离 Chromium 真扩展端到端测试。
- `node scripts/edge-smoke.mjs` 本机 Edge 隔离加载与导入冒烟；`node scripts/handoff-check.mjs` 新进程交接检查；`node scripts/report.mjs` 从实际 JSON 结果生成测试报告。
- `node scripts/checkpoint.mjs --step "步骤" --result success|failure|pending --summary "脱敏事实" --next "下一步"` 立即更新记忆。
- src/{ui,background,content,parsers,core,adapters} 是源码；dist/extension 是稳定加载目录。具体实现状态看 STATUS，不能把这些约定当作已验证结果。

## 修改边界
仅在项目根目录写代码、文档、测试、产物。破坏性更改重要旧文件前备份并验证可读；不删除未知文件。不修改全局执行策略、Codex 全局配置或系统安全设置。不建远程仓库、不推送。data/private、浏览器资料目录和导出备份均不得提交或打包。

资料与开发记忆分开：不把真实简历、登录信息、密钥、证件号码写入记忆、测试、日志。只用明确虚构资料测试。原文/手填/建议分开，未确认事实不得自动填写。不推断日期、学位、成绩、出生地或薪资。证件号码不持久化。不得自动提交、登录、验证码、勾选授权声明。无全站默认权限、远程代码、遥测或 AI 依赖。

## 每步与交接
环境检查、选型、功能实现、修复、测试/构建和重要配置后立即调用 checkpoint。成功、失败、未执行分别记录；退出码不代表业务正确。Hook 仅记录脱敏操作事件，语义结论需 checkpoint。不要只在任务结束才更新。写入失败必须明确报告。不要调用 Codex 自我生成记忆。

结束前完成适当检查，更新 STATUS 的可用功能、未验证范围、已知问题和下一步；会话记录列变更及验证证据。真扩展测试与仿真函数测试、Chromium 与本机 Edge/Chrome、合成 Hook 事件与真实 Hook 触发必须分开报告。保持文档命令与实际执行一致。
