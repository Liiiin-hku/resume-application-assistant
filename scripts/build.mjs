import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { build } from "esbuild";
import { root, checkpoint } from "./checkpoint.mjs";

process.chdir(root);
const stage = path.join(root, "artifacts", "extension-stage");
const out = path.join(root, "dist", "extension");
function safeRemove(p) {
  const full = path.resolve(p);
  if (
    !full.startsWith(root + path.sep) ||
    ![stage, out, path.join(root, "artifacts", "previous-extension")].includes(
      full,
    )
  )
    throw new Error("构建清理路径不在白名单");
  if (fs.existsSync(full)) fs.rmSync(full, { recursive: true });
}
try {
  safeRemove(stage);
  fs.mkdirSync(stage, { recursive: true });
  const common = {
    bundle: true,
    platform: "browser",
    target: ["chrome120"],
    logLevel: "warning",
    legalComments: "linked",
    minify: false,
  };
  await build({
    ...common,
    entryPoints: {
      app: "src/ui/app.ts",
      background: "src/background/index.ts",
    },
    outdir: stage,
    format: "esm",
    splitting: true,
    chunkNames: "chunks/[name]-[hash]",
  });
  await build({
    ...common,
    entryPoints: ["src/content/index.ts"],
    outfile: path.join(stage, "content.js"),
    format: "iife",
  });
  for (const file of ["panel.html", "style.css"])
    fs.copyFileSync(path.join(root, "src", "ui", file), path.join(stage, file));
  fs.copyFileSync(
    path.join(stage, "panel.html"),
    path.join(stage, "options.html"),
  );
  fs.mkdirSync(path.join(stage, "vendor"), { recursive: true });
  // Resolve through Node's URL parser for non-ASCII Windows paths.
  const { fileURLToPath } = await import("node:url");
  const pdfRoot = path.dirname(
    fileURLToPath(import.meta.resolve("pdfjs-dist/package.json")),
  );
  fs.copyFileSync(
    path.join(pdfRoot, "build", "pdf.worker.mjs"),
    path.join(stage, "vendor", "pdf.worker.mjs"),
  );
  for (const folder of ["cmaps", "standard_fonts"])
    fs.cpSync(path.join(pdfRoot, folder), path.join(stage, "vendor", folder), {
      recursive: true,
    });
  const identityFile = path.join(root, "src", "extension-key.json");
  if (!fs.existsSync(identityFile)) {
    const { publicKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });
    fs.writeFileSync(
      identityFile,
      JSON.stringify(
        {
          key: publicKey
            .export({ type: "spki", format: "der" })
            .toString("base64"),
        },
        null,
        2,
      ),
    );
  }
  const manifest = {
    manifest_version: 3,
    name: "简历网申投递助手",
    version: JSON.parse(fs.readFileSync("package.json", "utf8")).version,
    description: "本地资料核对、网页字段预览与确认填写；不自动提交。",
    minimum_chrome_version: "151",
    key: JSON.parse(fs.readFileSync(identityFile, "utf8")).key,
    permissions: ["activeTab", "scripting", "storage", "sidePanel"],
    optional_host_permissions: ["https://*/*", "http://*/*"],
    background: { service_worker: "background.js", type: "module" },
    action: { default_title: "打开简历网申投递助手" },
    side_panel: { default_path: "panel.html" },
    options_page: "options.html",
    content_security_policy: {
      extension_pages:
        "script-src 'self'; object-src 'none'; connect-src 'self'; worker-src 'self'; img-src 'self' data:; style-src 'self'; base-uri 'none'; form-action 'none'",
    },
  };
  fs.writeFileSync(
    path.join(stage, "manifest.json"),
    JSON.stringify(manifest, null, 2),
  );
  // All package licenses in the resolved dependency graph are kept; no source fixture is bundled.
  const notice = ["第三方许可（由本地依赖生成；业务代码独立编写）\n"];
  const mods = path.join(root, "node_modules", ".pnpm");
  for (const folder of fs.readdirSync(mods)) {
    const base = path.join(mods, folder, "node_modules");
    if (!fs.existsSync(base)) continue;
    for (const name of fs.readdirSync(base)) {
      if (name.startsWith("@")) continue;
      const pkg = path.join(base, name);
      if (!fs.existsSync(path.join(pkg, "package.json"))) continue;
      const meta = JSON.parse(
        fs.readFileSync(path.join(pkg, "package.json"), "utf8"),
      );
      const licenses = fs
        .readdirSync(pkg)
        .filter((f) => /^(license|licence|notice)(\.|$)/i.test(f));
      for (const file of licenses)
        if (fs.statSync(path.join(pkg, file)).isFile())
          notice.push(
            `\n## ${meta.name}@${meta.version} (${meta.license || "见许可"})\n` +
              fs.readFileSync(path.join(pkg, file), "utf8"),
          );
    }
  }
  fs.writeFileSync(
    path.join(stage, "THIRD_PARTY_NOTICES.txt"),
    [...new Set(notice)].join("\n"),
  );
  if (fs.existsSync(out)) {
    const previous = path.join(root, "artifacts", "previous-extension");
    safeRemove(previous);
    fs.cpSync(out, previous, { recursive: true });
    JSON.parse(fs.readFileSync(path.join(previous, "manifest.json"), "utf8"));
    // Verify every copied file before replacing the old build.
    for (const file of fs
      .readdirSync(out, { recursive: true })
      .filter((f) => fs.statSync(path.join(out, f)).isFile())) {
      const digest = (p) =>
        crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
      if (digest(path.join(out, file)) !== digest(path.join(previous, file)))
        throw new Error("旧构建备份校验失败");
    }
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  safeRemove(out);
  fs.renameSync(stage, out);
  await checkpoint({
    step: "构建",
    result: "success",
    summary:
      "esbuild 生成 MV3 插件目录；保留稳定公钥身份；PDF资源随包。仅构建成功，不代表业务测试通过",
    files: "dist/extension",
    next: "运行类型检查、单元测试和扩展端到端测试",
  });
  console.log(`构建成功：${out}`);
} catch (e) {
  await checkpoint({
    step: "构建",
    result: "failure",
    summary: e.message,
    next: "修复构建错误后重试",
  });
  throw e;
}
