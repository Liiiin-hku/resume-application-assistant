# 关键决策

## 2026-09-05 · 根目录
沿用实际打开的 E:\Codex_Projects\简历网申投递助手；不创建正文中另一个不存在的路径。已向用户指出差异并询问，等待期间完成只读调查后按已声明默认继续。

## 2026-09-05 · 第一版选型（已实现）
使用 TypeScript + esbuild + 原生 DOM。无需服务器/大框架；MV3 扩展界面和 content script 权限分离。AI 不是基础依赖，本版不实现。Playwright 使用捆绑 Chromium 持久化隔离目录测试。

## 2026-09-05 · 实现和复用
OpenJobAutofill 只借鉴交互与模块思路，不复制源码；其 content 中全库面板及 AI/更新流程不适合本项目隔离要求。PDF.js 6.3.289、Mammoth 1.12.2 随包本地提取文字。解析保守，未知结构保留原文供人工补录；不上 OCR 和 AI。

## 2026-09-05 · 浏览器权限与可信边界
完整个人库留在可信扩展页面，storage.local/session 设置 TRUSTED_CONTEXTS。background 只接收自身 panel/options URL 的白名单请求；content 只接收隔离运行时消息及当前字段最小值，网页无资料请求通道。MV3 默认权限 activeTab/scripting/storage/sidePanel，额外来源由用户主动授权。

工具栏采用 action.onClicked 打开侧栏，关闭自动 openPanelOnActionClick 行为；真浏览器测试发现后者会绕开本例 action 授权路径。自动化测试仅使用隔离 Chromium 的 CDP browser-session / tab-target triggerAction，不更改日常浏览器。

## 2026-09-05 · 可靠性边界
原生文本控件以 setter 及事件更新，选项控件通过明确匹配选项的原生点击更新；有限等待与稳定窗口核验。真实 React 测试证明单选/多选仅设置 checked 和派发 input/change 不足以更新 state，原生点击通过 onChange 更新并在重新渲染后保持。原本未选的单选组无法可靠清空并同步框架状态，撤销时明确跳过。页面结构、来源、标签、后台重启使旧计划失效。无自动新增记录，无站点提交或声明勾选代码。自定义控件、iframe、Shadow DOM 均人工处理，不宣称商业平台已适配。保存资料使用 Web Locks 和 revision 检查；站点规则不保存个人值，重复同签名字段不保存长期规则。

## 2026-09-05 · 项目记忆
AGENTS + PROJECT/STATUS/DECISIONS + 每会话独立 Markdown + checkpoint 原子写/锁/有界日志。Hooks 仅配置支持的 SessionStart/PostToolUse/Stop；必须用户信任后才运行，不绕过信任。本会话只有语义 checkpoint 和合成测试，不能宣称逐工具自动记忆已激活。

## 2026-09-05 · GitHub 上传授权
用户新指令明确要求上传整个插件工程，并确认目标账号 Liiiin-hku；替代初始“不建远程、不推送”的限制。本项目使用私有仓库 resume-application-assistant。源码、锁文件、虚构测试和脱敏开发记忆进入 Git；可安装插件包放 Release；个人资料、凭据、依赖缓存和测试浏览器目录不上传。不创建公开仓库，不改变其他项目。远程是否已同步以 STATUS 和实时分支校验为准。
