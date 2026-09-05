import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { root } from "./checkpoint.mjs";
const base = path.join(root, "tests", "fixtures");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};
http
  .createServer((req, res) => {
    const name =
      decodeURIComponent(new URL(req.url, "http://localhost").pathname).slice(
        1,
      ) || "native.html";
    const file = path.resolve(base, name);
    if (
      !file.startsWith(base + path.sep) ||
      !fs.existsSync(file) ||
      !fs.statSync(file).isFile()
    ) {
      res.writeHead(404).end("Not found");
      return;
    }
    res.setHeader(
      "Content-Type",
      types[path.extname(file)] || "application/octet-stream",
    );
    res.end(fs.readFileSync(file));
  })
  .listen(4173, "127.0.0.1", () =>
    console.log("虚构测试页面 http://127.0.0.1:4173/native.html"),
  );
