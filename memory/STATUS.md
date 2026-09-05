# 当前状态

阶段：0.1.0 已构建，可加载；本地功能验收通过。用户确认账号 Liiiin-hku 后，首次 GitHub 工程上传及安装版本发布均已完成。

远程：私有仓库 https://github.com/Liiiin-hku/resume-application-assistant；本项目 origin 已关联，main 已推送并通过 ls-remote 比对。68 个必要工程文件包含源码、锁文件、虚构测试、文档和开发记忆；个人资料、凭据、缓存未上传。本机 Git 凭据管理器的实际 OAuth 权限和保存登录由用户明确批准；未读取到模型上下文或记录任何凭据。

Release：https://github.com/Liiiin-hku/resume-application-assistant/releases/tag/v0.1.0 已发布，标签指向 349063d05ba554de8d441a0d1ac735bae46ce70f。附件 resume-application-assistant-v0.1.0.zip（2475346 字节、202 文件）和 SHA256SUMS.txt 均为 uploaded，GitHub 返回的 SHA256 与本地一致。ZIP SHA256：1069ca0925a64f2811ca170bcf9d782fae03781cd2beed11de31107f2e5e6ba4。后续 main 中交接文档提交不移动已发布标签。

发布方式：浏览器附件上传因文件 URL 权限返回 Not allowed，未调整浏览器权限；改用已获用户授权的本机 Git 凭据，通过 scripts/github-release.mjs 的固定仓库官方 API 完成。脚本的凭据仅在进程内使用，不输出、不持久化到项目。原始核验结果在 artifacts/github-release.json，网页也已显示已发布版本。

- 当前目录为空起步，已初始化本地 Git；没有读取相邻项目或真实简历。
- Windows PowerShell，Node 24.19.0，pnpm 11.19.0；npm 不在 PATH；Git 可用。
- Codex CLI 0.153.1，features 中 hooks=stable/true；尚未确认项目 Hook 信任或触发。
- Edge 152.0.4191.62 位于常见路径；Chrome 常见系统/用户路径未发现。
- GitHub 未认证 API 限流；改用公开网页/raw/git 读取，不将失败记录为成功。
- 未访问其他业务项目或个人简历。

已实现：结构化资料/稳定记录ID、导入差异和事实确认、PDF/DOCX/粘贴/JSON、备份编辑清空；顶层通用字段扫描、分组关联、预览和站点手动关系；原生文本/日期/选项填写核验、已有内容保护、暂停取消失败重试与有限撤销。侧栏及选项页可用。AI/复杂自定义控件/自动新增记录/网站附件上传均未实现，提供人工处理入口。

最近验证（2026-09-05）：类型检查、21 项单元测试、11 项真正加载扩展的 Chromium 151 E2E 及构建审计全部通过。新增真实 React 19 受控文本、单选、多选和重新渲染验证，修复了选项只改 DOM 未进入组件 state 的问题。本机 Edge 152 的隔离加载、界面启动和 DOCX 解析冒烟通过；不等于 Edge 全表单或人工安装验收。Windows 一键构建在正常 PATH 和没有 Node 的临时 PATH 下均通过；锁定依赖安装入口通过。报告证据在 artifacts/；详情在 docs/测试报告.md。

已知限制：没有真实招聘站的验证；复杂自定义控件、iframe、Shadow DOM、原先未选单选组的撤销等需人工处理。加密 PDF 的处理分支已实现但缺少真实样本回归，复杂排版的提取次序需人工审核。Edge / Chrome 人工安装与权限弹窗需用户首次使用时验证。所有测试资料均为虚构，不应与真实个人库混用。

非功能遗留：清理本次 artifacts/node_modules-before-store 和 artifacts/memory-tests 时自动审批返回 blocked by policy，命令未执行；未绕过限制，保留这两个 Git 忽略的临时目录，不打包、不影响运行。后续无需为使用插件先清理它们。

记忆：checkpoint 可运行，合成 Hook 的启动/事件/Stop、失败状态/并发锁/去重已测试。Codex 0.153.1 声明 Hooks stable=true；.codex/hooks.json 已交付，但未由用户信任，也未观察到真实 Hook 触发。当前依赖人工语义 checkpoint。

下一步：后续修改先核对 origin、Git 状态和本文件；完成相应回归后按用户要求推送 main，发布新安装包需提升版本，不覆盖 v0.1.0。产品验证优先做 Edge 人工安装及首个真实岗位只扫描核对，再补站点回归。项目 Hook 按需在新 Codex 会话中经 /hooks 审阅信任，GitHub 上传不代表 Hook 已启用。

<!-- checkpoint -->
最近步骤：GitHub上传和Release最终交接
结果：success；用户确认账号和本机Git授权后，68个工程文件与提交历史已上传私有仓库。v0.1.0已发布，安装ZIP及SHA256文件远程状态uploaded，大小与GitHub SHA256均匹配；发布标签349063d。生产插件代码未更改，沿用此前21单元和11E2E通过结果；新增打包及API发布已实际执行通过
下一步：用户可从私有仓库维护源码或下载Release；后续修正读取AGENTS和STATUS，测试后按要求推送，不覆盖旧版本
记录：sessions/2026-09-05-01a06f31-9000-7821-bd48-761f6b62f6f7.md
时间：2026-09-05T03:23:54.366Z
