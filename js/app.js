import { PERSONA } from "./persona.js";
import { knowledgeAsText, verseOfTheDay } from "./knowledge.js";
import { renderMarkdown } from "./markdown.js";

const API_URL = "https://api.anthropic.com/v1/messages";
const STORE = { key: "ratha.apiKey", model: "ratha.model", chat: "ratha.chat" };
const MAX_HISTORY = 20; // messages sent back to the model

const STARTERS = [
  "నా career గురించి చాలా confused గా ఉన్నా. ఏ path తీసుకోవాలో తెలియట్లేదు.",
  "కోపం వచ్చినప్పుడు నోటికి ఏది వస్తే అది మాట్లాడేస్తాను. ఎలా control చేయాలి?",
  "Exam fail అయ్యాను. మళ్ళీ start చేయాలంటే motivation లేదు.",
  "Family expectations కి, నా dreams కి మధ్య ఎలా balance చేయాలి?",
  "Phone లో ఎక్కువ time waste చేస్తున్నా. Discipline ఎలా తెచ్చుకోవాలి?",
];

// ---------- storage (always guarded; storage can be blocked) ----------
const store = {
  get(k, fallback = null) { try { return localStorage.getItem(k) ?? fallback; } catch { return fallback; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

// ---------- elements ----------
const $ = id => document.getElementById(id);
const thread = $("thread"), welcome = $("welcome"), input = $("input");
const composer = $("composer"), sendBtn = $("sendBtn"), stopBtn = $("stopBtn");
const dialog = $("settings");

let messages = [];
try { messages = JSON.parse(store.get(STORE.chat, "[]")) || []; } catch { messages = []; }
let controller = null;

const systemBlocks = [
  { type: "text", text: PERSONA },
  { type: "text", text: knowledgeAsText(), cache_control: { type: "ephemeral" } },
];

// ---------- welcome ----------
const v = verseOfTheDay();
$("votdRef").textContent = v.ref;
$("votdText").textContent = v.teaching;

for (const q of STARTERS) {
  const li = document.createElement("li");
  const b = document.createElement("button");
  b.type = "button"; b.textContent = q;
  b.addEventListener("click", () => send(q));
  li.append(b); $("starters").append(li);
}

// ---------- rendering ----------
const wheelSvg = () => {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("class", "wheel"); s.setAttribute("aria-hidden", "true");
  const u = document.createElementNS("http://www.w3.org/2000/svg", "use");
  u.setAttribute("href", "#wheel"); s.append(u); return s;
};

function addUser(text) {
  const li = document.createElement("li");
  li.className = "msg-user";
  const b = document.createElement("div");
  b.className = "bubble"; b.textContent = text;
  li.append(b); thread.append(li);
}

function addAssistant(text = "", { thinking = false } = {}) {
  const li = document.createElement("li");
  li.className = "msg-ai" + (thinking ? " thinking" : "");
  const content = document.createElement("div");
  content.className = "content";
  const answer = document.createElement("div");
  answer.className = "answer";
  if (thinking && !text) answer.innerHTML = '<p class="thinking-label">ఆలోచిస్తున్నాను…</p>';
  else answer.innerHTML = renderMarkdown(text);
  content.append(answer);
  li.append(wheelSvg(), content);
  thread.append(li);
  return { li, content, answer };
}

function addTools(view, text) {
  const tools = document.createElement("div");
  tools.className = "msg-tools";
  const copy = document.createElement("button");
  copy.className = "ghost"; copy.type = "button"; copy.textContent = "Copy";
  copy.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(text); copy.textContent = "Copied"; }
    catch { copy.textContent = "Copy failed"; }
    setTimeout(() => (copy.textContent = "Copy"), 1600);
  });
  tools.append(copy);
  view.content.append(tools);
}

function showError(view, title, detail, { settings = false, retry = null } = {}) {
  view.li.classList.remove("thinking");
  view.answer.innerHTML = "";
  const box = document.createElement("div");
  box.className = "error";
  const t = document.createElement("strong"); t.textContent = title;
  const d = document.createElement("div"); d.textContent = detail;
  box.append(t, d);
  if (settings) {
    const b = document.createElement("button"); b.className = "ghost"; b.type = "button";
    b.textContent = "Settings తెరవండి"; b.addEventListener("click", openSettings); box.append(b);
  }
  if (retry) {
    const b = document.createElement("button"); b.className = "ghost"; b.type = "button";
    b.textContent = "మళ్ళీ try చేయండి"; b.addEventListener("click", () => { view.li.remove(); retry(); }); box.append(b);
  }
  view.answer.append(box);
}

function renderAll() {
  thread.innerHTML = "";
  welcome.hidden = messages.length > 0;
  for (const m of messages) {
    if (m.role === "user") addUser(m.content);
    else addTools(addAssistant(m.content), m.content);
  }
}

const scrollDown = () => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
const save = () => store.set(STORE.chat, JSON.stringify(messages));

function setBusy(busy) {
  sendBtn.hidden = busy; stopBtn.hidden = !busy;
  input.disabled = busy;
}

// ---------- API ----------
async function streamReply(history, onText, signal) {
  const res = await fetch(API_URL, {
    method: "POST",
    signal,
    headers: {
      "content-type": "application/json",
      "x-api-key": store.get(STORE.key, ""),
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: store.get(STORE.model, "claude-sonnet-5-5"),
      max_tokens: 2048,
      stream: true,
      system: systemBlocks,
      messages: history,
    }),
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); msg = j?.error?.message || msg; } catch {}
    const err = new Error(msg); err.status = res.status; throw err;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "", full = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const events = buf.split("\n\n");
    buf = events.pop();
    for (const ev of events) {
      const dataLine = ev.split("\n").find(l => l.startsWith("data:"));
      if (!dataLine) continue;
      let data; try { data = JSON.parse(dataLine.slice(5)); } catch { continue; }
      if (data.type === "content_block_delta" && data.delta?.type === "text_delta") {
        full += data.delta.text; onText(full);
      } else if (data.type === "error") {
        throw new Error(data.error?.message || "Stream error");
      }
    }
  }
  return full;
}

// ---------- send ----------
async function send(text) {
  text = text.trim();
  if (!text || controller) return;

  if (!store.get(STORE.key)) {
    welcome.hidden = true;
    if (!messages.length) thread.innerHTML = "";
    addUser(text);
    const view = addAssistant("", { thinking: true });
    showError(view, "API key కావాలి", "Settings లో మీ Claude API key పెట్టండి. తర్వాత మళ్ళీ అడగండి.", { settings: true });
    input.value = text; autosize();
    return;
  }

  // If the previous question never got an answer (error), fold it into this one
  // so roles keep alternating.
  const last = messages[messages.length - 1];
  if (last?.role === "user") last.content += "\n\n" + text;
  else messages.push({ role: "user", content: text });
  save();
  welcome.hidden = true;
  if (thread.children.length === 0 || thread.querySelector(".error")) renderAll();
  else addUser(text);
  input.value = ""; autosize();
  await respond();
}

async function respond() {
  const view = addAssistant("", { thinking: true });
  scrollDown();
  setBusy(true);
  controller = new AbortController();
  let latest = "";
  let pending = false;

  try {
    const history = messages.slice(-MAX_HISTORY);
    if (history[0]?.role !== "user") history.shift();
    const full = await streamReply(history, t => {
      latest = t;
      if (!pending) {
        pending = true;
        requestAnimationFrame(() => {
          view.answer.innerHTML = renderMarkdown(latest);
          pending = false;
          const nearBottom = window.innerHeight + window.scrollY > document.body.scrollHeight - 160;
          if (nearBottom) window.scrollTo(0, document.body.scrollHeight);
        });
      }
    }, controller.signal);
    finish(view, full);
  } catch (err) {
    if (err.name === "AbortError") { finish(view, latest, true); }
    else {
      const auth = err.status === 401 || err.status === 403;
      showError(view,
        auth ? "API key పని చేయట్లేదు" : err.status === 429 ? "చాలా requests వచ్చాయి" : "Answer రాలేదు",
        err.message,
        { settings: auth, retry: auth ? null : respond });
    }
  } finally {
    controller = null;
    setBusy(false);
    input.focus();
  }
}

function finish(view, text, stopped = false) {
  view.li.classList.remove("thinking");
  if (!text.trim()) {
    view.answer.innerHTML = '<p class="thinking-label">Answer ఆపేశారు.</p>';
    messages.pop(); save(); // drop the unanswered question so history stays valid
    return;
  }
  if (stopped) text += "\n\n*(మధ్యలో ఆపేశారు)*";
  view.answer.innerHTML = renderMarkdown(text);
  messages.push({ role: "assistant", content: text });
  save();
  addTools(view, text);
}

// ---------- composer ----------
function autosize() { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, window.innerHeight * 0.4) + "px"; }
input.addEventListener("input", autosize);
input.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(input.value); }
});
composer.addEventListener("submit", e => { e.preventDefault(); send(input.value); });
stopBtn.addEventListener("click", () => controller?.abort());

// ---------- header ----------
function newChat() {
  controller?.abort();
  messages = []; save(); renderAll(); input.focus();
}
$("newChatBtn").addEventListener("click", newChat);
$("homeBtn").addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

// ---------- settings ----------
function openSettings() {
  $("apiKey").value = store.get(STORE.key, "");
  $("model").value = store.get(STORE.model, "claude-sonnet-5-5");
  dialog.showModal();
}
$("settingsBtn").addEventListener("click", openSettings);
$("cancelSettings").addEventListener("click", () => dialog.close());
$("settingsForm").addEventListener("submit", () => {
  const key = $("apiKey").value.trim();
  key ? store.set(STORE.key, key) : store.del(STORE.key);
  store.set(STORE.model, $("model").value);
  const err = thread.querySelector(".error");
  if (err && !messages.length) { thread.innerHTML = ""; welcome.hidden = false; }
});
$("clearAll").addEventListener("click", () => {
  if (confirm("అన్ని chats delete అవుతాయి. Continue?")) { newChat(); dialog.close(); }
});

renderAll();
if (!store.get(STORE.key)) setTimeout(openSettings, 400);
