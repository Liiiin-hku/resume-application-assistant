# 项目长期说明

根目录：E:\Codex_Projects\简历网申投递助手（会话真实工作区；正文另一种路径不存在，已说明采用当前目录）。

目标：Windows 上优先 Edge、兼容 Chrome 的个人网申辅助 MV3 插件。无需后端、API 或常驻 Codex。导入 → 待确认事实 → 用户审核 → 扫描当前页 → 预览 → 确认填写 → 核验 → 人工提交。

当前架构：TypeScript + esbuild，原生 DOM UI，PDF.js/Mammoth 本地文本解析；可信扩展页面管理资料，service worker 处理权限和消息，隔离 content script 扫描和写入。通用规则引擎与站点适配器分离。AI 本阶段不实现。React 只用于测试，不打入生产扩展。

模块入口：src/ui 管理资料、导入差异、扫描预览和用户操作；src/parsers 本地解析；src/core 维护事实模型、存储、映射和日期；src/background 校验可信消息和当前目标页；src/content 扫描及逐项写入核验；src/adapters 定义适配器边界。scripts/workspace.mjs 是 install / build / check / e2e 的统一维护入口。dist/extension 是固定加载目录，src/extension-key.json 只有固定公钥，用于保持扩展身份。

稳定边界：按用户动作申请 activeTab；完整资料不进入网页；无远程代码/云同步/遥测。默认不覆盖已有值、不提交、不勾选声明、不跨页自主投递。字段事实需确认，经历用稳定 ID，日期只改格式。普通 storage.local 不是加密保险箱。

开发记忆在 memory/；个人库在浏览器扩展本地存储；用户自放原件在 data/private/，彼此不自动同步。开发记忆只记脱敏工程事实。

模块和实际状态以源码及 STATUS 核实。测试环境、实际通过项和未执行项见 docs/测试报告.md。默认串行维护。不同 worktree 需显式合并，不实时共享文件。
