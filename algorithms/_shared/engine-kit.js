export function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* ---------- Helpers para construir nós estruturados (sem HTML) ---------- */
/** @returns {{ type: "strong", text: string }} */
export function strong(v) {
  return { type: "strong", text: String(v) };
}
/** @returns {{ type: "code", text: string }} */
export function code(v) {
  return { type: "code", text: String(v) };
}

export function elementsForHeadTail(list) {
  return list.map((v, idx) => ({
    text: String(v),
    role: idx === 0 ? "primary" : "secondary",
    status: "active",
    id: String(idx),
  }));
}

export function highlightCode(rawLine, lang) {
  let text = escapeHtml(rawLine);
  if (lang.keywords) {
    text = text.replace(lang.keywords, '<span class="kw">$1</span>');
  }
  if (lang.types) {
    text = text.replace(lang.types, '<span class="ty">$1</span>');
  }
  if (lang.macros) {
    text = text.replace(lang.macros, '<span class="ty">$&</span>');
  }
  return text;
}
