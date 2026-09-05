export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, unknown> = {},
  ...children: (Node | string | undefined)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith("on") && typeof v === "function")
      node.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === "class") node.className = String(v);
    else if (k in node && !k.startsWith("aria-")) {
      try {
        (node as unknown as Record<string, unknown>)[k] = v;
      } catch {
        node.setAttribute(k, String(v));
      }
    } else node.setAttribute(k, String(v));
  }
  node.append(
    ...(children.filter((c) => c !== undefined) as (Node | string)[]),
  );
  return node;
}
export const button = (
  text: string,
  onclick: () => unknown,
  attrs: Record<string, unknown> = {},
) => el("button", { type: "button", onclick, ...attrs }, text);
export const note = (text: string, kind = "note") =>
  el("p", { class: kind }, text);
export function option(value: string, label: string) {
  return el("option", { value }, label);
}
