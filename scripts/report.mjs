import fs from 'node:fs';import path from 'node:path';import {root} from './checkpoint.mjs';
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const unit=read('artifacts/unit-results.json'),e2e=read('artifacts/e2e-results.json'),audit=read('artifacts/bundle-audit.json'),edge=read('artifacts/edge-smoke.json'),handoff=read('artifacts/handoff-check.json');
const specs=[];function walk(suites){for(const s of suites){specs.push(...(s.specs||[]));walk(s.suites||[]);}}walk(e2e.suites);
const rows=specs.map(s=>`| ${s.title.replaceAll('|','/')} | ${s.ok?'通过':'失败 / 未完成'} |`).join('\n');
const allPass=unit.numFailedTests===0&&specs.length>=11&&specs.every(s=>s.ok)&&audit.result==='pass'&&edge.result==='pass'&&handoff.result==='pass';
const text=`# 测试报告 · 0.1.0

实际测试日期：2026-09-05，Windows，Asia/Shanghai。报告生成时间：${new Date().toISOString()}。当前结论：**${allPass?'本地验收通过；真实站点与人工安装仍待验证':'存在失败或未完成项，请查看原始报告'}**。

## 环境与汇总

| 检查 | 实际环境 | 结果 |
| --- | --- | --- |
| 类型检查 | Node 24.19.0 / TypeScript 7.0.2 | 维护入口 check 已执行通过 |
| 单元测试 | Vitest 5.0.0 | ${unit.numPassedTests} 通过，${unit.numFailedTests} 失败 |
| 真扩展 E2E | Playwright 1.62.1，捆绑 Chromium 151.0.7922.34；隔离持久化测试目录 | ${specs.filter(s=>s.ok).length} 通过 / ${specs.length} 项 |
| 本机 Edge 冒烟 | Edge ${edge.version||'版本未取得'}；headless 隔离目录，以 CDP 加载交付扩展 | ${edge.result==='pass'?'通过：MV3 页面启动、本地 DOCX 解析、两条教育待确认记录':'失败：'+edge.error} |
| 本机 Edge 人工安装与全表单回归 | 未复用日常浏览器资料 | 未执行；自动化冒烟不能替代人工验收 |
| 本机 Google Chrome | 常见系统 / 用户安装路径未找到 | 未执行；Chromium 通过不等于 Chrome 人工通过 |
| 真实招聘网站 | 没有用户提供的实际岗位页面、登录和授权 | 未执行；Moka / 北森 / 企业自建站均待验证 |
| Windows 构建入口 | UTF-8 / CRLF cmd；普通 PATH 及不含 Node 的临时 PATH 两种环境 | 均实际构建成功；回退使用已安装的 Codex Node |
| 依赖安装入口 | node scripts/workspace.mjs install；锁定安装 | 实际执行成功；修复 Windows cmd 引号转义 |
| 产物审计 | ${audit.files} 文件，${audit.bytes.toLocaleString('en-US')} 字节 | ${audit.result}；无默认 host 权限、测试资料、memory、用户目录和源图 |
| 共享记忆 | 原子写入 / 锁 / 去重 / 失败与并发；新进程交接文件检查 | 单元测试及 handoff-check 通过 |
| 真实 Codex Hook | CLI 0.153.1 声明支持；项目配置已提供 | 未触发验证，等待用户信任和新会话；只有合成事件通过 |

## 扩展端到端明细

浏览器确实加载 dist/extension 的 MV3 service worker，UI、content script、storage 和消息通信均使用真实扩展 API。没有把 chrome.storage 或注入函数替换成网页 mock。工具栏授权通过 Chromium 官方 CDP Extensions.triggerAction 在 browser session 的 tab target 上触发；专用测试开关仅用于隔离测试浏览器。

| 场景 | 结果 |
| --- | --- |
${rows}

dynamic.html 是包含异步加载、值回退和数据模型的受控仿真；react.html 额外使用真正 React / React DOM 19.2.8，并检查组件 state 和重新渲染后的值。React 仅是测试依赖，不进入生产扩展。

## 核验边界

- PDF：实际文字 PDF 成功提取并进入待确认区；DOCX：本地生成的两段教育经历成功解析；无文字 PDF（模拟扫描件）、损坏 PDF / DOCX 明确报错。加密 PDF 的专用错误分支已实现，但本轮没有真实加密文件用例，记为待验证。复杂双栏简历的抽取顺序也需人工核对。
- 不推断日期精度、学校、成绩、薪资等事实；单元测试覆盖至今 / 预计毕业与来源确认。默认只解析明确标签和唯一邮箱，没有声称通用智能简历理解。
- 已有内容保护、逐项覆盖差异、同名字段冲突、本科硕士关联、重复扫描不新增、声明不勾选和最终提交计数为 0 都有实际断言。
- 暂停 / 取消仅停止后续项；当前项可能已发出。撤销保护后续用户修改；原先未选的单选组无法可靠清空，跳过人工处理。
- PDF/DOCX 解析场景记录请求，未出现非本地 HTTP/HTTPS 外发；AI 本版没有实现或网络入口。CSP connect-src self，网页脚本不能读取资料库或调用可信后台。网站自己的自动保存不在此网络保证内。
- iframe、Shadow DOM、搜索选择器、级联地址、自定义日期和特殊 pattern 控件保守交人工。附件由网站原生文件选择器上传。无未经实测的平台适配声明。

## 修复过的问题（不是当前未解决失败）

1. 首次构建的 UI 括号与 PDF.js 6 参数差异；均修复并重验。
2. 自动打开侧栏的 API 行为没有走预期 action 授权；改为 action.onClicked 显式打开，实际 activeTab 流程通过。
3. 测试原生页面的 option 标签笔误，及 label 含整个下拉选项文本；修正 fixture 和标签提取。
4. 复合标签“姓名 / 手机号码”与邮箱 placeholder 冲突漏判；现在拒绝默认匹配。
5. Mammoth 的动态导入需要 default export；修复后 PDF / DOCX 真扩展解析通过。
6. 真实 React 单选/多选只改变 DOM、未写入 state；改为精确选项原生点击，新增真实框架回归。
7. .cmd 的 LF 中文解析异常及 Node spawn 的 Windows 引号包装；统一 CRLF 并使用明确的 Windows 参数处理，正常 / 回退入口均执行通过。
8. pnpm 11 不读取 .npmrc 的普通设置；迁移至 workspace YAML 并重新安装到项目内缓存，保留源码与锁文件。

本轮非功能遗留：清理 artifacts/node_modules-before-store 和 artifacts/memory-tests 的命令在执行前被自动审批拒绝，只返回 blocked by policy。未删除、未换工具绕过；这两处临时目录保留并被 Git 忽略，不进入插件包，也不影响使用。

## 复现与证据

在项目根目录运行 node scripts/workspace.mjs check，再运行 node scripts/workspace.mjs e2e。自动测试用虚构资料和新建隔离目录；不需要用户真实简历或招聘登录。需要单独检查 Edge：node scripts/edge-smoke.mjs。

原始结果：artifacts/unit-results.json、artifacts/e2e-results.json、artifacts/playwright-report/index.html、artifacts/edge-smoke.json、artifacts/bundle-audit.json、artifacts/handoff-check.json。截图：artifacts/填写预览.png、artifacts/资料库.png、artifacts/Edge资料导入.png。失败时报告包含具体断言和截图；不要把含真实资料的页面直接加入报告。

产物 SHA-256 摘要（按审计脚本的文件清单算法）：${audit.bundleHash}。

普通用户下一步：在 Edge 扩展管理页手动加载固定目录，先用虚构 JSON 在空库练习，再导出 / 清空示例后导入真实资料。第一次真实岗位先只扫描，核对字段与经历，再确认填写。
`;
fs.writeFileSync(path.join(root,'docs','测试报告.md'),text);console.log(`测试报告已生成：${allPass?'本地验收通过':'存在未通过项'}`);if(!allPass)process.exitCode=1;
