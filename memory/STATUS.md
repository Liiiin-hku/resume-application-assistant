# 当前状态

阶段：0.1.0 已构建，可加载；本地功能验收通过。GitHub 工程和安装版本已发布；2026-09-05 用户新要求下已改为公开，朋友可匿名下载试用。

远程：公开仓库 https://github.com/Liiiin-hku/resume-application-assistant；本项目 origin 已关联。首次上传的源码、锁文件、虚构测试、文档和开发记忆均在 main；个人资料、凭据、缓存未上传。本轮公开说明及记忆同步状态见末尾 checkpoint。本机 Git 凭据管理器的实际 OAuth 权限和保存登录由用户明确批准；凭据只在进程内经官方 API 使用，不输出到模型或保存到项目。

权限与匿名访问（2026-09-05 实测）：GitHub 返回 private=false、visibility=public。协作者接口只有 Liiiin-hku（admin）；无其他协作者、待接受邀请或部署密钥，Actions 运行记录为 0。普通访客可读取、下载、Fork 或提反馈，不具有原仓库直接写入、合并或删除代码权限。未额外添加协作者、修改自动合并或分支保护配置。

无 Authorization / Cookie 的仓库页、Release 页、raw README、安装 ZIP 和 SHA256SUMS 均 HTTP 200，下载内容与本地摘要一致。首轮匿名 REST API 因共享出口剩余额度为 0 返回 403，实际网页与附件下载验证通过，未把 API 失败记为成功。证据：artifacts/github-public-inspect.json、github-public-make-public.json、github-public-verify-public.json；这些脱敏本地报告不入 Git。朋友操作入口：docs/朋友试用.md。

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

本轮公开与试用交接验证（2026-09-05）：生产插件未改动，未重跑上述功能测试。重新检查发布脚本语法、202 个构建文件审计、安装 ZIP 逐文件 SHA256、匿名下载摘要以及新 Node 进程的记忆读取交接，均通过。发布脚本的 public 可见性条件已修正；未借此重发 v0.1.0 或实际发布新版本，旧标签与附件保持不变。

已知限制：没有真实招聘站的验证；复杂自定义控件、iframe、Shadow DOM、原先未选单选组的撤销等需人工处理。加密 PDF 的处理分支已实现但缺少真实样本回归，复杂排版的提取次序需人工审核。Edge / Chrome 人工安装与权限弹窗需用户首次使用时验证。所有测试资料均为虚构，不应与真实个人库混用。

非功能遗留：清理本次 artifacts/node_modules-before-store 和 artifacts/memory-tests 时自动审批返回 blocked by policy，命令未执行；未绕过限制，保留这两个 Git 忽略的临时目录，不打包、不影响运行。后续无需为使用插件先清理它们。

记忆：checkpoint 可运行，合成 Hook 的启动/事件/Stop、失败状态/并发锁/去重已测试。Codex 0.153.1 声明 Hooks stable=true；.codex/hooks.json 已交付，但未由用户信任，也未观察到真实 Hook 触发。当前依赖人工语义 checkpoint。

下一步：给朋友发送 v0.1.0 Release 安装链接与 docs/朋友试用.md，收集 Edge / Chrome 版本、脱敏复现步骤和首个真实岗位只扫描结果；不要授予协作者写权限。后续维护先核对 origin、Git 状态和本文件，修复并完成相应回归后按要求推送 main；发布新安装包需提升版本，不覆盖 v0.1.0。项目 Hook 仍需在新 Codex 会话中经 /hooks 审阅信任，仓库公开不代表 Hook 已启用。

<!-- checkpoint -->
最近步骤：公开交接文档首次提交
结果：failure；git commit因当前未配置作者身份而停止，尚未生成本轮提交或推送；仓库public和匿名下载均已验证成功，不受这次本地提交失败影响
下一步：核对既有提交身份，使用本项目范围的身份提交，禁止修改全局Git配置
记录：sessions/2026-09-05-01a06f31-9000-7821-bd48-761f6b62f6f7.md
时间：2026-09-05T15:24:55.671Z
