export function safeURL(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("请输入完整的 http:// 或 https:// 岗位链接");
  }
  if (!["http:", "https:"].includes(u.protocol) || u.username || u.password)
    throw new Error("仅允许普通 HTTP/HTTPS 网页，不允许嵌入账号密码");
  if (
    /(^|\.)(chromewebstore\.google\.com|microsoftedge\.microsoft\.com|addons\.mozilla\.org)$/.test(
      u.hostname,
    )
  )
    throw new Error("不处理扩展商店");
  if (
    /(^|[.-])(bank|banking|ebank|icbc|ccb|abchina|boc|cmbchina|pay|alipay|paypal)([.-]|$)/i.test(
      u.hostname,
    )
  )
    throw new Error("不处理银行和支付页面");
  return u;
}
