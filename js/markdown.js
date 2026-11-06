// Small, safe Markdown renderer for Ratha's answers.
// Escapes all HTML first, then applies a limited set of formatting:
// headings, bold/italic, inline code, blockquotes, lists, hr, paragraphs.

const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
}

export function renderMarkdown(src) {
  const lines = src.replace(/\r/g, "").split("\n");
  const out = [];
  let para = [], list = null, quote = [];

  const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para = []; } };
  const flushList = () => { if (list) { out.push(`<${list.type}>${list.items.map(i => `<li>${inline(i)}</li>`).join("")}</${list.type}>`); list = null; } };
  const flushQuote = () => { if (quote.length) { out.push(`<blockquote>${renderMarkdown(quote.join("\n"))}</blockquote>`); quote = []; } };
  const flushAll = () => { flushPara(); flushList(); flushQuote(); };

  for (const raw of lines) {
    const line = raw.trimEnd();
    let m;
    if (/^\s*>\s?/.test(line)) { flushPara(); flushList(); quote.push(line.replace(/^\s*>\s?/, "")); continue; }
    flushQuote();
    if (!line.trim()) { flushPara(); flushList(); continue; }
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) { flushAll(); const n = Math.min(m[1].length + 1, 4); out.push(`<h${n}>${inline(m[2])}</h${n}>`); continue; }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { flushAll(); out.push("<hr>"); continue; }
    if ((m = line.match(/^\s*[-*•]\s+(.*)$/))) { flushPara(); if (list?.type !== "ul") { flushList(); list = { type: "ul", items: [] }; } list.items.push(m[1]); continue; }
    if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) { flushPara(); if (list?.type !== "ol") { flushList(); list = { type: "ol", items: [] }; } list.items.push(m[1]); continue; }
    if (list && /^\s{2,}\S/.test(raw)) { list.items[list.items.length - 1] += " " + line.trim(); continue; }
    flushList();
    para.push(line.trim());
  }
  flushAll();
  return out.join("\n");
}
