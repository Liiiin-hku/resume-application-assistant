import { parseText } from "./text";
export async function extractFile(
  file: File,
): Promise<{ text: string; sourceId: string }> {
  if (file.size > 20 * 1024 * 1024)
    throw new Error("文件超过 20 MB，请使用精简简历或粘贴文本");
  const bytes = await file.arrayBuffer();
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
  )
    .slice(0, 8)
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
  const sourceId = `${file.name.slice(0, 100)} · ${hash}`;
  let text = "";
  if (/\.pdf$/i.test(file.name)) {
    const pdf = await import("pdfjs-dist");
    pdf.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL(
      "vendor/pdf.worker.mjs",
    );
    const task = pdf.getDocument({
      data: new Uint8Array(bytes),
      useWasm: false,
      enableXfa: false,
      cMapUrl: chrome.runtime.getURL("vendor/cmaps/"),
      cMapPacked: true,
      standardFontDataUrl: chrome.runtime.getURL("vendor/standard_fonts/"),
      stopAtErrors: true,
    });
    try {
      const doc = await task.promise;
      if (doc.numPages > 60) throw new Error("PDF 超过 60 页，请仅导入简历页");
      for (let n = 1; n <= doc.numPages; n++) {
        const content = await (await doc.getPage(n)).getTextContent();
        let y: number | undefined;
        for (const item of content.items)
          if ("str" in item) {
            const currentY = item.transform[5];
            if (y !== undefined && Math.abs(y - currentY) > 3) text += "\n";
            text += item.str + (item.hasEOL ? "\n" : " ");
            y = currentY;
          }
        text += "\n";
      }
    } catch (e) {
      const name = e instanceof Error ? e.name : "";
      throw new Error(
        name === "PasswordException"
          ? "PDF 已加密，请在本机解密后导入，或粘贴文本"
          : "PDF 解析失败或文件损坏，请粘贴文本 / 手动录入",
      );
    } finally {
      await task.destroy();
    }
  } else if (/\.docx$/i.test(file.name)) {
    try {
      const { default: mammoth } = await import("mammoth/mammoth.browser");
      const result = await mammoth.extractRawText({ arrayBuffer: bytes });
      text = result.value;
    } catch {
      throw new Error(
        "DOCX 解析失败：可能加密、损坏或并非 DOCX 文件。请粘贴文本 / 手动录入",
      );
    }
  } else throw new Error("仅支持 PDF、DOCX；其他文件请打开后复制文本");
  if (text.trim().length < 8)
    throw new Error(
      "没有提取到可用文本，可能是扫描件或图片简历。本版不含 OCR，请粘贴文本 / 手动录入",
    );
  return { text, sourceId };
}
export { parseText };
