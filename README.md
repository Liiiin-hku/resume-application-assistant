# 简历网申投递助手

个人使用的本地网申填写扩展，版本 **0.1.0**。导入简历、确认事实、扫描当前表单、预览并确认填写，最后由你检查和提交。无需 AI API、服务器、云账户或常驻 Codex。

## 下载与朋友试用

本仓库已公开，访客可直接读取、下载并安装使用，无需申请仓库协作者权限。

- [下载可直接安装的 v0.1.0 ZIP](https://github.com/Liiiin-hku/resume-application-assistant/releases/download/v0.1.0/resume-application-assistant-v0.1.0.zip)
- [完整安装步骤与反馈方法](docs/朋友试用.md)
- [版本说明和校验文件](https://github.com/Liiiin-hku/resume-application-assistant/releases/tag/v0.1.0)

解压到自己的固定文件夹，再在浏览器扩展管理页加载其中直接包含 `manifest.json` 的目录。下面的 E 盘路径是维护者本机位置，朋友无需创建相同目录。GitHub 的 **Source code ZIP** 是开发源码，不是可直接加载的安装包。

## 第一次使用

1. 在 Edge 地址栏输入 `edge://extensions`（Chrome 使用 `chrome://extensions`）。
2. 开启“开发者模式”，点击“加载解压缩的扩展 / 加载已解压的扩展程序”。
3. 选择 **`E:\Codex_Projects\简历网申投递助手\dist\extension`**。这个目录里面有 `manifest.json`；不要选择项目根目录或 ZIP 文件。
4. 固定工具栏中的插件。在普通网页点击插件图标，打开侧栏，进入“① 资料库”。
5. 导入 PDF / DOCX、粘贴文字或资料 JSON，逐项核对并接受真实字段；未识别部分可以新增记录手填。
6. 自己进入公司网申表单并完成登录，再点一次工具栏插件图标授予当前页面权限。
7. “② 当前页填写” → 扫描 → 核对经历关联、字段和值 → 关闭“只扫描” → 确认填写。手动完成附件、复杂控件、声明及最终提交。

直接使用已经构建好的插件，不需要终端或安装 Node.js。**网站可能在输入时自动保存，确认填写就可能把内容发送给网站。**

## 开发与更新

修改源代码后双击 `一键构建.cmd`，然后在扩展管理页点“重新加载”。建议先导出备份，**不要先卸载插件**。构建目录和公钥身份保持稳定。

维护命令（在项目根目录执行；Node.js 22+）：

```powershell
node scripts/workspace.mjs install
node scripts/workspace.mjs check
node scripts/workspace.mjs e2e
```

`check` 执行类型检查、单元测试、构建和产物审计；`e2e` 在项目 artifacts 内安装测试 Chromium，加载真实扩展，使用隔离测试资料目录。安装依赖或首次下载测试浏览器需要网络，日常使用插件无需这些工具。

## 范围与资料位置

- 已实现的规则和具体测试结论见 [测试报告](docs/测试报告.md)。没有声明 Moka、北森或任何真实招聘平台已适配。
- 通用引擎支持可见、可编辑的原生文本框、文本域、日期 / 月份、原生下拉、普通单选和多选。复杂控件、iframe、Shadow DOM、上传附件走人工入口。
- 不自动注册 / 登录 / 验证码、不勾选声明、不新增经历、不最终提交、不批量海投。AI 本版未实现。
- 浏览器 `storage.local` 存个人库；`data/private/` 供你主动放原件和导出备份；两者不自动同步。普通本地存储不等于加密保险箱。
- `memory/` 只存开发状态，不存真实简历、账号、密钥或证件。新开 Codex 对话按 `AGENTS.md` 读取即可接续。

完整操作见 [使用说明](docs/使用说明.md)；后续开发见 [维护说明](docs/维护说明.md)；选型依据见 [参考项目](docs/参考项目.md)。

## GitHub 备份与更新

项目公开仓库：[Liiiin-hku/resume-application-assistant](https://github.com/Liiiin-hku/resume-application-assistant)。源码、依赖锁文件、虚构测试、中文文档和脱敏开发记忆随 Git 保存。可直接安装的版本包放在 [Releases](https://github.com/Liiiin-hku/resume-application-assistant/releases)，上传状态以 memory/STATUS.md 为准。

GitHub 的 Source code ZIP 是源码，需要构建；名为 `resume-application-assistant-v版本号.zip` 的 Release 附件才是可直接加载的插件。个人简历、资料 JSON 备份、凭据、node_modules 和测试浏览器不会上传。插件不会自动联网检查 GitHub 更新。

以后可以直接让 Codex“读取本项目记忆，修改某功能，测试后将更新推送到该公开仓库”。换电脑时克隆源码并按维护说明安装依赖、构建；只使用插件时下载 Release 安装包即可。

仓库所有者授权访客查看、下载本项目，并在自己的浏览器安装和使用已发布插件；第三方组件仍遵循包内 `THIRD_PARTY_NOTICES.txt` 中各自的许可。访客没有向原仓库推送、合并代码或删除文件的权限，可以提交 Issue 反馈或从自己的 Fork 提出 Pull Request，由所有者决定是否接受。公开仓库无法阻止别人修改自己下载的副本；这与修改本仓库是两回事。

> 路径说明：本次会话实际打开的是 `E:\Codex_Projects\简历网申投递助手`。用户正文的另一种 `E:\Codex\_Projects\…` 路径不存在，已说明按当前工作区实施；没有创建第二套项目。
