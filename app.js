import { SITE_CONFIG } from "./config.js";
import { PROFILE } from "./data.js";
import { renderQrSvg } from "./qr.js";

/* ==========================================================================
   1. Polyfill feature-detection (only load if missing)
   ========================================================================== */
if (!Object.hasOwn(HTMLElement.prototype, "popover")) {
  import("https://unpkg.com/@oddbird/popover-polyfill@latest/dist/popover.min.js").catch(() => {});
}

/* ==========================================================================
   2. Theme & Color Scheme Controller (dark-mode-toggle guidance)
   ========================================================================== */
const metaScheme = document.querySelector('meta[name="color-scheme"]');
const systemDarkQuery = window.matchMedia("(prefers-color-scheme: dark)");
const quickToggleBtn = document.getElementById("theme-quick-toggle");
const schemeButtons = Array.from(document.querySelectorAll("[data-scheme-choice]"));
const presetButtons = Array.from(document.querySelectorAll("[data-preset]"));
const gridToggle = document.getElementById("grid-toggle");
const systemHint = document.getElementById("system-scheme-hint");

function getStoredScheme() {
  try {
    const val = localStorage.getItem("color-scheme");
    return val === "light" || val === "dark" ? val : null;
  } catch {
    return null;
  }
}

function getResolvedScheme() {
  const stored = getStoredScheme();
  if (stored) return stored;
  return systemDarkQuery.matches ? "dark" : "light";
}

function applyScheme(storedValue) {
  metaScheme.content = storedValue ?? "light dark";
  const currentChoice = storedValue ?? "system";
  for (const btn of schemeButtons) {
    btn.setAttribute("aria-pressed", String(btn.dataset.schemeChoice === currentChoice));
  }
  if (systemHint) {
    systemHint.textContent = `(${systemDarkQuery.matches ? "Dark" : "Light"})`;
  }
}

function setStoredScheme(value) {
  try {
    if (value === "light" || value === "dark") {
      localStorage.setItem("color-scheme", value);
    } else {
      localStorage.removeItem("color-scheme");
    }
  } catch {}
  applyScheme(value === "light" || value === "dark" ? value : null);
}

function toggleComfortScheme() {
  const target = getResolvedScheme() === "dark" ? "light" : "dark";
  const sys = systemDarkQuery.matches ? "dark" : "light";
  // If target matches current system preference, revert to system default
  setStoredScheme(target === sys ? null : target);
}

function applyPreset(preset) {
  const safe = ["telemetry", "gopher", "solar", "blueprint"].includes(preset) ? preset : "telemetry";
  document.documentElement.dataset.theme = safe;
  try {
    localStorage.setItem("accent-preset", safe);
  } catch {}
  for (const btn of presetButtons) {
    btn.setAttribute("aria-pressed", String(btn.dataset.preset === safe));
  }
}

function applyGrid(enabled) {
  document.documentElement.dataset.grid = enabled ? "on" : "off";
  if (gridToggle) gridToggle.checked = enabled;
  try {
    localStorage.setItem("blueprint-grid", enabled ? "on" : "off");
  } catch {}
}

quickToggleBtn?.addEventListener("click", toggleComfortScheme);
for (const btn of schemeButtons) {
  btn.addEventListener("click", () => {
    const choice = btn.dataset.schemeChoice;
    setStoredScheme(choice === "system" ? null : choice);
  });
}
for (const btn of presetButtons) {
  btn.addEventListener("click", () => applyPreset(btn.dataset.preset));
}
gridToggle?.addEventListener("change", () => applyGrid(gridToggle.checked));

// Update resolved display when OS changes, without ever deleting a pinned preference
systemDarkQuery.addEventListener("change", () => applyScheme(getStoredScheme()));

window.addEventListener("storage", (e) => {
  if (e.key === "color-scheme") applyScheme(getStoredScheme());
  if (e.key === "accent-preset") applyPreset(e.newValue || "telemetry");
  if (e.key === "blueprint-grid") applyGrid(e.newValue !== "off");
});

applyScheme(getStoredScheme());
applyPreset(document.documentElement.dataset.theme || "telemetry");
applyGrid(document.documentElement.dataset.grid !== "off");

/* ==========================================================================
   3. Tabbed Interface (tabs + search-hidden-content guidance)
   ========================================================================== */
const tablist = document.getElementById("profile-tablist");
const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
const panels = tabs.map((tab) =>
  document.querySelector(`[role="tabpanel"][aria-labelledby="${tab.id}"]`)
);

function selectTab(targetTab, { focusTab = false, updateHash = true } = {}) {
  if (!targetTab) return;
  for (let i = 0; i < tabs.length; i++) {
    const tab = tabs[i];
    const panel = panels[i];
    const selected = tab === targetTab;
    tab.setAttribute("aria-selected", String(selected));
    tab.toggleAttribute("focusgroupstart", selected);
    if (selected) {
      panel.removeAttribute("hidden");
      if (!panel.querySelector("a, button, input, select, textarea, details")) {
        panel.setAttribute("tabindex", "0");
      }
    } else {
      panel.hidden = "until-found";
      panel.removeAttribute("tabindex");
    }
  }
  targetTab.scrollIntoView({ block: "nearest", inline: "nearest", container: "nearest" });
  if (focusTab) targetTab.focus();
  if (updateHash && targetTab.dataset.hash) {
    history.replaceState(null, "", `#${targetTab.dataset.hash}`);
  }
}

for (const tab of tabs) {
  tab.addEventListener("click", () => selectTab(tab));
}

// Keyboard navigation fallback for browsers without native focusgroup
tablist.addEventListener("keydown", (e) => {
  const idx = tabs.indexOf(document.activeElement);
  if (idx === -1) return;
  let nextIdx = null;
  if (e.key === "ArrowRight") nextIdx = (idx + 1) % tabs.length;
  else if (e.key === "ArrowLeft") nextIdx = (idx - 1 + tabs.length) % tabs.length;
  else if (e.key === "Home") nextIdx = 0;
  else if (e.key === "End") nextIdx = tabs.length - 1;
  if (nextIdx !== null) {
    e.preventDefault();
    selectTab(tabs[nextIdx], { focusTab: true });
  }
});

// Sync tab when browser Find-in-page reveals a hidden="until-found" panel
document.querySelector(".panels-stage").addEventListener("beforematch", (e) => {
  const matchedPanel = e.target.closest('[role="tabpanel"]');
  if (!matchedPanel) return;
  const tabId = matchedPanel.getAttribute("aria-labelledby");
  const tab = tabs.find((t) => t.id === tabId);
  if (tab) selectTab(tab, { updateHash: false });
});

// Tablist scrollability fade fallback if scroll-driven animations unsupported
if (!CSS.supports("animation-timeline", "scroll()")) {
  const first = tablist.firstElementChild;
  const last = tablist.lastElementChild;
  if (first && last) {
    const obs = new IntersectionObserver(
      (entries) => {
        for (const { target, intersectionRatio } of entries) {
          tablist.classList.toggle(target === first ? "more-start" : "more-end", intersectionRatio < 1);
        }
      },
      { root: tablist, threshold: 1, rootMargin: "1px" }
    );
    obs.observe(first);
    obs.observe(last);
  }
}

// Deep-link via URL hash (#schedule, #experience, #overview)
function syncTabFromHash() {
  const hash = location.hash.replace("#", "").toLowerCase();
  const match = tabs.find((t) => t.dataset.hash === hash);
  if (match) selectTab(match, { updateHash: false });
}
window.addEventListener("hashchange", syncTabFromHash);
syncTabFromHash();

// Jump-to-tab CTAs
document.addEventListener("click", (e) => {
  const trigger = e.target.closest("[data-jump-tab]");
  if (!trigger) return;
  const target = document.getElementById(trigger.dataset.jumpTab);
  if (target) {
    selectTab(target, { focusTab: true });
    target.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
});

/* ==========================================================================
   4. Interactive Distributed Trace Simulator & Profile Content
   ========================================================================== */
const traceSpansEl = document.getElementById("trace-spans");
const traceInspectorEl = document.getElementById("trace-inspector");

function renderTraceInspector(span) {
  traceInspectorEl.innerHTML = "";
  const title = document.createElement("h3");
  title.textContent = `${span.service} · ${span.operation}`;
  const desc = document.createElement("p");
  desc.textContent = span.impact;
  const tags = document.createElement("div");
  tags.className = "mini-tags";
  for (const t of span.stack) {
    const tag = document.createElement("span");
    tag.className = "mini-tag";
    tag.textContent = t;
    tags.append(tag);
  }
  traceInspectorEl.append(title, desc, tags);
}

PROFILE.traceSpans.forEach((span, idx) => {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "span-btn";
  btn.setAttribute("aria-pressed", String(idx === 0));

  const meta = document.createElement("div");
  meta.className = "span-meta";
  const svc = document.createElement("span");
  svc.textContent = span.service;
  const ms = document.createElement("span");
  ms.textContent = `${span.durationMs}ms`;
  meta.append(svc, ms);

  const track = document.createElement("div");
  track.className = "span-track";
  const bar = document.createElement("div");
  bar.className = "span-bar";
  bar.style.insetInlineStart = `${span.offsetPct}%`;
  bar.style.inlineSize = `${span.widthPct}%`;
  track.append(bar);

  btn.append(meta, track);
  btn.addEventListener("click", () => {
    for (const other of traceSpansEl.querySelectorAll(".span-btn")) {
      other.setAttribute("aria-pressed", String(other === btn));
    }
    renderTraceInspector(span);
  });
  traceSpansEl.append(btn);
});
renderTraceInspector(PROFILE.traceSpans[0]);

// Pillars
const pillarsGrid = document.getElementById("pillars-grid");
for (const pillar of PROFILE.pillars) {
  const card = document.createElement("article");
  card.className = "pillar-card";
  const badge = document.createElement("span");
  badge.className = "pillar-badge";
  badge.textContent = pillar.badge;
  const h3 = document.createElement("h3");
  h3.textContent = pillar.title;
  const p = document.createElement("p");
  p.textContent = pillar.detail;
  card.append(badge, h3, p);
  pillarsGrid.append(card);
}

// Filterable Skills Catalog
const skillsGrid = document.getElementById("skills-grid");
const filterChips = Array.from(document.querySelectorAll("[data-skill-filter]"));

function renderSkills(filter) {
  skillsGrid.innerHTML = "";
  const items =
    filter === "all"
      ? PROFILE.skillsCatalog
      : PROFILE.skillsCatalog.filter((s) => s.domain === filter);
  for (const skill of items) {
    const li = document.createElement("li");
    li.className = "skill-item";
    const name = document.createElement("span");
    name.className = "skill-name";
    name.textContent = skill.name;
    const lvl = document.createElement("span");
    lvl.className = "skill-level";
    lvl.textContent = skill.level;
    li.append(name, lvl);
    skillsGrid.append(li);
  }
}

for (const chip of filterChips) {
  chip.addEventListener("click", () => {
    for (const c of filterChips) c.setAttribute("aria-pressed", String(c === chip));
    renderSkills(chip.dataset.skillFilter);
  });
}
renderSkills("all");

// Experience Timeline
const timelineEl = document.getElementById("experience-timeline");
for (const company of PROFILE.experience) {
  const block = document.createElement("article");
  block.className = "company-block";

  const head = document.createElement("div");
  head.className = "company-head";
  const h3 = document.createElement("h3");
  h3.textContent = company.company;
  const tenure = document.createElement("span");
  tenure.className = "company-tenure";
  tenure.textContent = company.totalTenure;
  head.append(h3, tenure);

  const stack = document.createElement("div");
  stack.className = "roles-stack";

  for (const role of company.roles) {
    const roleCard = document.createElement("div");
    roleCard.className = "role-card";

    const top = document.createElement("div");
    top.className = "role-top";
    const h4 = document.createElement("h4");
    h4.textContent = role.title;
    const period = document.createElement("span");
    period.className = "role-period";
    period.textContent = role.period;
    top.append(h4, period);

    const team = document.createElement("p");
    team.className = "role-team";
    team.textContent = role.team;

    const detailsWrap = document.createElement("div");
    detailsWrap.className = "role-details";
    role.highlights.forEach((hl, idx) => {
      const det = document.createElement("details");
      if (company.company === "Dell Technologies" && idx === 0) det.open = true;
      const sum = document.createElement("summary");
      sum.textContent = hl.heading;
      const p = document.createElement("p");
      p.textContent = hl.detail;
      det.append(sum, p);
      detailsWrap.append(det);
    });

    const tags = document.createElement("div");
    tags.className = "mini-tags";
    for (const t of role.tags) {
      const tag = document.createElement("span");
      tag.className = "mini-tag";
      tag.textContent = t;
      tags.append(tag);
    }

    roleCard.append(top, team, detailsWrap, tags);
    stack.append(roleCard);
  }

  block.append(head, stack);
  timelineEl.append(block);
}

document.getElementById("expand-all-exp")?.addEventListener("click", () => {
  timelineEl.querySelectorAll("details").forEach((d) => (d.open = true));
});
document.getElementById("collapse-all-exp")?.addEventListener("click", () => {
  timelineEl.querySelectorAll("details").forEach((d) => (d.open = false));
});

/* ==========================================================================
   5. Toast & Polite Live Region Notifications
   ========================================================================== */
const politeAnnouncer = document.getElementById("polite-announcer");
const toastEl = document.getElementById("status-toast");
const toastMsgEl = document.getElementById("toast-message");
let toastTimer = null;

function showToast(message) {
  // Never surface background toasts while a modal dialog is open
  if (document.querySelector("dialog[open]")) return;
  toastMsgEl.textContent = message;
  try {
    toastEl.showPopover();
  } catch {
    toastEl.classList.add(":popover-open");
  }
  if (typeof document.ariaNotify === "function") {
    document.ariaNotify(message);
  } else {
    politeAnnouncer.textContent = "";
    requestAnimationFrame(() => (politeAnnouncer.textContent = message));
  }
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    if (!toastEl.contains(document.activeElement)) {
      try {
        toastEl.hidePopover();
      } catch {
        toastEl.classList.remove(":popover-open");
      }
    }
  }, 3500);
}

/* ==========================================================================
   6. Copy Buttons (copy-button guidance: command="--copy" + fallback)
   ========================================================================== */
const copyTimers = new WeakMap();
let lastCopyAnnouncement = "";

function reportCopy(button, ok) {
  const tip = button.nextElementSibling;
  clearTimeout(copyTimers.get(button));
  button.removeAttribute("data-copied");
  button.removeAttribute("data-failed");
  let message = ok ? "Copied" : "Copy failed";
  if (message === lastCopyAnnouncement) message += "\u00A0";
  lastCopyAnnouncement = message;
  tip.textContent = "";
  void button.offsetWidth;
  button.setAttribute(ok ? "data-copied" : "data-failed", "");
  requestAnimationFrame(() => (tip.textContent = message));
  copyTimers.set(
    button,
    setTimeout(() => {
      button.removeAttribute("data-copied");
      button.removeAttribute("data-failed");
      tip.textContent = "";
    }, 2000)
  );
}

function legacyCopy(text) {
  const previousFocus = document.activeElement;
  const field = Object.assign(document.createElement("textarea"), { value: text });
  field.setAttribute("readonly", "");
  field.style.cssText = "position:fixed;inset-block-start:0;opacity:0";
  document.body.append(field);
  field.select();
  try {
    return document.execCommand("copy");
  } finally {
    field.remove();
    previousFocus?.focus({ preventScroll: true });
  }
}

async function performCopy(button, target) {
  const text = target.matches("input, textarea") ? target.value : target.innerText.trim();
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    reportCopy(button, true);
  } catch {
    reportCopy(button, legacyCopy(text));
  }
}

document.addEventListener(
  "command",
  (event) => {
    if (event.command?.startsWith("--copy") && event.target) {
      performCopy(event.source, event.target);
    }
  },
  true
);

if (!("CommandEvent" in window)) {
  document.addEventListener("click", (event) => {
    if (event.defaultPrevented) return;
    const button = event.target.closest('button[command^="--copy"]');
    if (!button) return;
    const target = document.getElementById(button.getAttribute("commandfor"));
    if (target) performCopy(button, target);
  });
}

/* ==========================================================================
   7. Schedule a 1-Hour Session (₹500 INR) + UPI QR + Validation
   ========================================================================== */
const bookingForm = document.getElementById("booking-form");
const topicOptionsEl = document.getElementById("topic-options");
const dateStripEl = document.getElementById("date-strip");
const dateInput = document.getElementById("session-date");
const slotsGridEl = document.getElementById("slots-grid");
const slotErrorEl = document.getElementById("slot-error");
const localTzEl = document.getElementById("local-tz-display");
const summaryTopicEl = document.getElementById("summary-topic");
const summaryDatetimeEl = document.getElementById("summary-datetime");
const upiQrContainer = document.getElementById("upi-qr-container");
const upiIdValueEl = document.getElementById("upi-id-value");
const upiCaptionEl = document.getElementById("upi-caption");
const upiDeepLinkEl = document.getElementById("upi-deep-link");
const razorpayLinkEl = document.getElementById("razorpay-link");
const setupNoticeEl = document.getElementById("setup-notice");
const savedBookingsBox = document.getElementById("saved-bookings-box");
const savedBookingsList = document.getElementById("saved-bookings-list");

const visitorTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
localTzEl.textContent = visitorTz;

const isLiveUpiConfigured = Boolean(SITE_CONFIG.upiId && SITE_CONFIG.upiId.trim());
if (!isLiveUpiConfigured) {
  setupNoticeEl.hidden = false;
  upiIdValueEl.textContent = "Set upiId in config.js";
  upiCaptionEl.textContent = "Preview UPI QR (₹500 INR) — update config.js to go live";
} else {
  upiIdValueEl.textContent = SITE_CONFIG.upiId.trim();
}

if (SITE_CONFIG.razorpayPaymentLink) {
  razorpayLinkEl.href = SITE_CONFIG.razorpayPaymentLink;
  razorpayLinkEl.hidden = false;
}

// Format YYYY-MM-DD in IST
function getIstDateString(dateObj) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dateObj);
}

function getIstWeekday(dateStr) {
  const dt = new Date(`${dateStr}T12:00:00+05:30`);
  const day = dt.getUTCDay(); // 12:00 IST is 06:30 UTC same calendar day
  return {
    isWeekend: day === 0 || day === 6,
    dayShort: new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Asia/Kolkata" }).format(dt),
    dayNum: new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(dt),
    fullLabel: new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    }).format(dt),
  };
}

function formatVisitorLocalSlot(dateStr, slot) {
  const start = new Date(`${dateStr}T${String(slot.hour).padStart(2, "0")}:${String(slot.minute).padStart(2, "0")}:00+05:30`);
  const end = new Date(start.getTime() + SITE_CONFIG.sessionDurationMins * 60000);
  if (visitorTz === "Asia/Kolkata") return "60 min · IST";
  const fmt = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: visitorTz,
    timeZoneName: "short",
  });
  return `Your time: ${fmt.format(start)} – ${fmt.format(end)}`;
}

// Render Topics
PROFILE.sessionTopics.forEach((topic, idx) => {
  const label = document.createElement("label");
  label.className = "radio-card";

  const radio = document.createElement("input");
  radio.type = "radio";
  radio.name = "topic";
  radio.value = topic.id;
  if (idx === 0) radio.checked = true;
  radio.addEventListener("change", updateCheckoutSummary);

  const textWrap = document.createElement("span");
  const title = document.createElement("span");
  title.className = "radio-card-title";
  title.textContent = topic.title;
  const sub = document.createElement("span");
  sub.className = "radio-card-sub";
  sub.textContent = topic.subtitle;
  textWrap.append(title, sub);

  label.append(radio, textWrap);
  topicOptionsEl.append(label);
});

// Date limits & quick 14-day chips
const todayIst = getIstDateString(new Date());
dateInput.min = todayIst;
const upcomingDates = [];
for (let i = 1; i <= 14; i++) {
  const d = new Date(Date.now() + i * 86400000);
  const str = getIstDateString(d);
  const info = getIstWeekday(str);
  upcomingDates.push({ str, ...info });
}
dateInput.value = upcomingDates[0].str;

function renderDateStrip() {
  dateStripEl.innerHTML = "";
  for (const d of upcomingDates) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "date-chip";
    btn.setAttribute("aria-pressed", String(dateInput.value === d.str));
    const daySpan = document.createElement("span");
    daySpan.className = "date-chip-day";
    daySpan.textContent = d.dayShort;
    const numSpan = document.createElement("span");
    numSpan.className = "date-chip-num";
    numSpan.textContent = d.dayNum;
    btn.append(daySpan, numSpan);
    btn.addEventListener("click", () => {
      dateInput.value = d.str;
      dateInput.dispatchEvent(new Event("change", { bubbles: true }));
    });
    dateStripEl.append(btn);
  }
}

function renderSlotsForDate(dateStr) {
  slotsGridEl.innerHTML = "";
  if (!dateStr) return;
  const { isWeekend } = getIstWeekday(dateStr);
  const list = isWeekend ? PROFILE.timeSlots.weekend : PROFILE.timeSlots.weekday;
  list.forEach((slot, idx) => {
    const label = document.createElement("label");
    label.className = "slot-radio";

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "timeSlot";
    radio.value = slot.id;
    if (idx === 0) radio.checked = true;
    radio.addEventListener("change", () => {
      slotErrorEl.hidden = true;
      updateCheckoutSummary();
    });

    const wrap = document.createElement("span");
    const ist = document.createElement("span");
    ist.className = "slot-ist";
    ist.textContent = slot.label;
    const loc = document.createElement("span");
    loc.className = "slot-local";
    loc.textContent = formatVisitorLocalSlot(dateStr, slot);
    wrap.append(ist, loc);

    label.append(radio, wrap);
    slotsGridEl.append(label);
  });
}

function getSelectedTopic() {
  const checked = bookingForm.querySelector('input[name="topic"]:checked');
  return PROFILE.sessionTopics.find((t) => t.id === checked?.value) || PROFILE.sessionTopics[0];
}

function getSelectedSlot() {
  const dateStr = dateInput.value;
  if (!dateStr) return null;
  const { isWeekend } = getIstWeekday(dateStr);
  const list = isWeekend ? PROFILE.timeSlots.weekend : PROFILE.timeSlots.weekday;
  const checked = bookingForm.querySelector('input[name="timeSlot"]:checked');
  return list.find((s) => s.id === checked?.value) || null;
}

function buildUpiUri(note) {
  const pa = isLiveUpiConfigured ? SITE_CONFIG.upiId.trim() : "configure-upi-in-config@upi";
  const params = new URLSearchParams({
    pa,
    pn: SITE_CONFIG.upiPayeeName || SITE_CONFIG.ownerName,
    am: `${SITE_CONFIG.sessionFeeInr}.00`,
    cu: SITE_CONFIG.sessionCurrency,
    tn: note.slice(0, 50),
  });
  return `upi://pay?${params.toString()}`;
}

function updateCheckoutSummary() {
  const topic = getSelectedTopic();
  const dateStr = dateInput.value;
  const slot = getSelectedSlot();

  summaryTopicEl.textContent = topic.title;
  if (dateStr && slot) {
    const info = getIstWeekday(dateStr);
    summaryDatetimeEl.textContent = `${info.fullLabel} · ${slot.label}`;
  } else {
    summaryDatetimeEl.textContent = "Select a date & slot";
  }

  const upiNote = `1hr Session: ${topic.id} ${dateStr || ""}`.trim();
  const upiUri = buildUpiUri(upiNote);
  upiDeepLinkEl.href = upiUri;
  upiQrContainer.innerHTML = renderQrSvg(
    upiUri,
    `UPI QR code to pay ₹${SITE_CONFIG.sessionFeeInr} INR to ${SITE_CONFIG.ownerName}`
  );
}

dateInput.addEventListener("change", () => {
  renderDateStrip();
  renderSlotsForDate(dateInput.value);
  updateCheckoutSummary();
});

renderDateStrip();
renderSlotsForDate(dateInput.value);
updateCheckoutSummary();

/* ==========================================================================
   8. Accessible Form Validation (:user-invalid + ARIA sync + fallback)
   ========================================================================== */
const linkError = (el, shown) => {
  const errorId = el.dataset.error;
  if (!errorId) return;
  const ids = (el.getAttribute("aria-describedby") || "")
    .split(/\s+/)
    .filter((id) => id && id !== errorId);
  if (shown) ids.push(errorId);
  if (ids.length) el.setAttribute("aria-describedby", ids.join(" "));
  else el.removeAttribute("aria-describedby");
};

let announceTimer;
let announcedField;
const spokenText = (node) => {
  const copy = node.cloneNode(true);
  copy.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
  copy
    .querySelectorAll('[role="img"][aria-label]')
    .forEach((n) => n.replaceWith(`${n.getAttribute("aria-label")}: `));
  return copy.textContent.replace(/\s+/g, " ").trim();
};

const announceError = (el) => {
  const error = document.getElementById(el.dataset.error);
  if (!error) return;
  const label = el.labels?.[0] ? `${spokenText(el.labels[0])}: ` : "";
  clearTimeout(announceTimer);
  politeAnnouncer.textContent = "";
  announcedField = el;
  announceTimer = setTimeout(() => {
    politeAnnouncer.textContent = label + spokenText(error);
  }, 500);
};

const flagged = new WeakSet();
const announced = new WeakSet();
const supportsUserInvalid = CSS.supports("selector(:user-invalid)");
const fallbackDirty = new WeakMap();

const syncAria = (el, announce = false) => {
  if (!el.matches?.("input, select, textarea")) return;
  if (el.validity?.valid) {
    el.classList.remove("user-invalid-fallback");
  }
  const invalid =
    el.classList.contains("user-invalid-fallback") ||
    (supportsUserInvalid && el.matches(":user-invalid"));
  if (invalid) {
    if (announce && !announced.has(el)) {
      announceError(el);
      announced.add(el);
    }
    el.setAttribute("aria-invalid", "true");
    linkError(el, true);
    flagged.add(el);
  } else if (flagged.has(el) || el.getAttribute("aria-invalid") !== "true") {
    el.setAttribute("aria-invalid", "false");
    linkError(el, false);
    flagged.delete(el);
    announced.delete(el);
    if (announcedField === el) {
      clearTimeout(announceTimer);
      politeAnnouncer.textContent = "";
    }
  }
};

bookingForm.querySelectorAll("input, select, textarea").forEach((el) => syncAria(el));

bookingForm.addEventListener(
  "blur",
  (e) => {
    const el = e.target;
    if (!supportsUserInvalid && el.checkValidity) {
      const st = fallbackDirty.get(el) || { hasInteracted: false, hasBlurred: false };
      st.hasBlurred = true;
      fallbackDirty.set(el, st);
      if (st.hasInteracted) {
        el.classList.toggle("user-invalid-fallback", !el.validity.valid);
        el.classList.toggle("user-valid-fallback", el.validity.valid);
      }
    }
    syncAria(el, true);
  },
  true
);

bookingForm.addEventListener("input", (e) => {
  const el = e.target;
  if (!supportsUserInvalid && el.checkValidity) {
    const st = fallbackDirty.get(el) || { hasInteracted: false, hasBlurred: false };
    st.hasInteracted = true;
    fallbackDirty.set(el, st);
    if (st.hasBlurred) {
      el.classList.toggle("user-invalid-fallback", !el.validity.valid);
      el.classList.toggle("user-valid-fallback", el.validity.valid);
    }
  }
  if (el.hasAttribute("aria-invalid")) syncAria(el);
});

bookingForm.addEventListener(
  "invalid",
  (e) => {
    const el = e.target;
    if (!supportsUserInvalid || !el.matches(":user-invalid")) {
      fallbackDirty.set(el, { hasInteracted: true, hasBlurred: true });
      el.classList.add("user-invalid-fallback");
    }
    announced.add(el);
    syncAria(el);
  },
  true
);

/* ==========================================================================
   9. Booking Submission, .ics Calendar Invite & Native <dialog> Modals
   ========================================================================== */
const bookingDialog = document.getElementById("booking-dialog");
const dialogSubtitle = document.getElementById("dialog-subtitle");
const dialogPassSummary = document.getElementById("dialog-pass-summary");
const downloadIcsBtn = document.getElementById("download-ics-btn");
const gcalLinkBtn = document.getElementById("gcal-link-btn");
const sendConfirmBtn = document.getElementById("send-confirm-btn");

let activeBooking = null;

function formatIcsUtc(dateObj) {
  return dateObj.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function buildIcsContent(booking) {
  const start = new Date(booking.startIso);
  const end = new Date(booking.endIso);
  const desc = [
    `1:1 Session with ${SITE_CONFIG.ownerName}`,
    `Booking ID: ${booking.id}`,
    `Topic: ${booking.topicTitle}`,
    `Fee: ₹${SITE_CONFIG.sessionFeeInr} INR`,
    booking.utr ? `UPI Ref / UTR: ${booking.utr}` : "UPI Ref / UTR: Pending verification",
    `Agenda: ${booking.agenda.replace(/\r?\n/g, " ")}`,
    `Platform: ${SITE_CONFIG.meetingPlatform}`,
  ].join("\\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Ayush Gupta//1on1 Session//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${booking.id}@ayushbpl10.github.io`,
    `DTSTAMP:${formatIcsUtc(new Date())}`,
    `DTSTART:${formatIcsUtc(start)}`,
    `DTEND:${formatIcsUtc(end)}`,
    `SUMMARY:1:1 Session with ${SITE_CONFIG.ownerName} (${booking.topicTitle})`,
    `DESCRIPTION:${desc}`,
    `LOCATION:${SITE_CONFIG.meetingPlatform}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function downloadIcs(booking) {
  const blob = new Blob([buildIcsContent(booking)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ayush-gupta-session-${booking.id}.ics`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildGcalUrl(booking) {
  const start = formatIcsUtc(new Date(booking.startIso));
  const end = formatIcsUtc(new Date(booking.endIso));
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `1:1 Session with ${SITE_CONFIG.ownerName} — ${booking.topicTitle}`,
    dates: `${start}/${end}`,
    details: `Booking ID: ${booking.id}\nFee: ₹${SITE_CONFIG.sessionFeeInr} INR\nUTR: ${booking.utr || "Pending"}\nAgenda: ${booking.agenda}`,
    location: SITE_CONFIG.meetingPlatform,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function getSavedBookings() {
  try {
    return JSON.parse(localStorage.getItem("ag_session_bookings") || "[]");
  } catch {
    return [];
  }
}

function saveBooking(booking) {
  const list = [booking, ...getSavedBookings()].slice(0, 5);
  try {
    localStorage.setItem("ag_session_bookings", JSON.stringify(list));
  } catch {}
  renderSavedBookings();
}

function openBookingDialog(booking) {
  activeBooking = booking;
  dialogSubtitle.textContent = `Booking ${booking.id} · ${booking.dateLabel} · ${booking.slotLabel}`;
  dialogPassSummary.innerHTML = "";

  const rows = [
    ["Booking ID", booking.id],
    ["Attendee", `${booking.name} (${booking.email})`],
    ["Topic", booking.topicTitle],
    ["When (IST)", `${booking.dateLabel} · ${booking.slotLabel}`],
    ["Duration & Fee", `60 Minutes · ₹${SITE_CONFIG.sessionFeeInr} INR`],
    ["Payment Ref (UTR)", booking.utr || "Pending / Pay via UPI QR"],
    ["Agenda", booking.agenda],
  ];
  for (const [k, v] of rows) {
    const line = document.createElement("div");
    const strong = document.createElement("strong");
    strong.textContent = `${k}: `;
    const val = document.createElement("span");
    val.textContent = v;
    line.append(strong, val);
    dialogPassSummary.append(line);
  }

  gcalLinkBtn.href = buildGcalUrl(booking);
  if (SITE_CONFIG.contactEmail) {
    const mailParams = new URLSearchParams({
      subject: `[1:1 Session Booking ${booking.id}] ${booking.topicTitle}`,
      body: `Hi Ayush,\n\nI booked a 1-hour session (₹500 INR).\nBooking ID: ${booking.id}\nDate & Time: ${booking.dateLabel} (${booking.slotLabel})\nUTR: ${booking.utr || "Attaching screenshot"}\nAgenda: ${booking.agenda}\n\nThanks,\n${booking.name}`,
    });
    sendConfirmBtn.href = `mailto:${SITE_CONFIG.contactEmail}?${mailParams.toString()}`;
    sendConfirmBtn.textContent = "Email Confirmation ↗";
  } else {
    sendConfirmBtn.href = SITE_CONFIG.linkedinUrl;
    sendConfirmBtn.textContent = "Share Booking ID on LinkedIn ↗";
  }

  bookingDialog.showModal();
}

function renderSavedBookings() {
  const list = getSavedBookings();
  savedBookingsList.innerHTML = "";
  savedBookingsBox.hidden = list.length === 0;
  for (const b of list) {
    const li = document.createElement("li");
    li.className = "saved-booking-item";
    const info = document.createElement("span");
    info.textContent = `${b.id} · ${b.dateLabel}`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-ghost btn-compact";
    btn.textContent = "View Pass";
    btn.addEventListener("click", () => openBookingDialog(b));
    li.append(info, btn);
    savedBookingsList.append(li);
  }
}
renderSavedBookings();

downloadIcsBtn.addEventListener("click", () => {
  if (activeBooking) downloadIcs(activeBooking);
});

bookingForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const slot = getSelectedSlot();
  if (!slot) {
    slotErrorEl.hidden = false;
  } else {
    slotErrorEl.hidden = true;
  }

  if (!bookingForm.checkValidity() || !slot) {
    const firstInvalid = bookingForm.querySelector(":invalid");
    firstInvalid?.focus();
    return;
  }

  const topic = getSelectedTopic();
  const dateStr = dateInput.value;
  const info = getIstWeekday(dateStr);
  const start = new Date(
    `${dateStr}T${String(slot.hour).padStart(2, "0")}:${String(slot.minute).padStart(2, "0")}:00+05:30`
  );
  const end = new Date(start.getTime() + SITE_CONFIG.sessionDurationMins * 60000);
  const code = Math.random().toString(36).slice(2, 6).toUpperCase();

  const booking = {
    id: `AG-${dateStr.slice(2, 4)}${dateStr.slice(5, 7)}-${code}`,
    name: document.getElementById("guest-name").value.trim(),
    email: document.getElementById("guest-email").value.trim(),
    profile: document.getElementById("guest-profile").value.trim(),
    agenda: document.getElementById("guest-agenda").value.trim(),
    utr: document.getElementById("upi-utr").value.trim(),
    topicId: topic.id,
    topicTitle: topic.title,
    dateStr,
    dateLabel: info.fullLabel,
    slotLabel: slot.label,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };

  saveBooking(booking);
  openBookingDialog(booking);
});

// Reset dialog.returnValue on close per dialog guide
for (const dlg of document.querySelectorAll("dialog")) {
  dlg.addEventListener("close", () => {
    dlg.returnValue = "";
  });
}

// Fallback for closedby="any" (pointerdown + pointerup outside dialog rect)
if (!("closedBy" in HTMLDialogElement.prototype)) {
  const outside = (e, dialog) => {
    const r = dialog.getBoundingClientRect();
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  };
  for (const dialog of document.querySelectorAll('dialog[closedby="any"]')) {
    let pressedOutside = false;
    dialog.addEventListener("pointerdown", (e) => {
      pressedOutside = outside(e, dialog);
    });
    dialog.addEventListener("pointerup", (e) => {
      if (pressedOutside && outside(e, dialog)) dialog.close();
    });
  }
}

// Fallback for command="close" on dialog buttons
if (!("commandForElement" in HTMLButtonElement.prototype)) {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest('button[command="close"]');
    if (!btn) return;
    const dlg = document.getElementById(btn.getAttribute("commandfor"));
    dlg?.close();
  });
}

/* ==========================================================================
   10. Command Palette (Ctrl+K / Cmd+K)
   ========================================================================== */
const commandDialog = document.getElementById("command-dialog");
document.getElementById("cmd-open-btn")?.addEventListener("click", () => commandDialog.showModal());

document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    if (commandDialog.open) commandDialog.close();
    else commandDialog.showModal();
  }
});

commandDialog.addEventListener("click", (e) => {
  const item = e.target.closest("[data-cmd-action]");
  if (!item) return;
  const action = item.dataset.cmdAction;
  commandDialog.close();
  if (action.startsWith("tab:")) {
    const tab = document.getElementById(action.slice(4));
    if (tab) selectTab(tab, { focusTab: true });
  } else if (action === "theme:toggle") {
    toggleComfortScheme();
    showToast(`Switched to ${getResolvedScheme()} theme`);
  }
});
