import { SITE_CONFIG } from "./config.js?v=20261126e";
import { PROFILE } from "./data.js?v=20261126e";
import { renderQrSvg } from "./qr.js?v=20261126e";

/* ==========================================================================
   1. Conditional Polyfill Loading (Popover)
   ========================================================================== */
if (!Object.hasOwn(HTMLElement.prototype, "popover")) {
  import("https://unpkg.com/@oddbird/popover-polyfill@0.6.1/dist/popover.min.js").catch(() => { });
}

const supportsScopedTransition = "startViewTransition" in Element.prototype;
function runScopedTransition(scopeEl, updateDOM) {
  if (!supportsScopedTransition || !scopeEl) {
    updateDOM();
    return;
  }
  try {
    const transition = scopeEl.startViewTransition(() => updateDOM());
    transition.ready.catch(() => { });
  } catch {
    updateDOM();
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 3500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/* ==========================================================================
   2. Color Scheme & Titanium Finish Controller (dark-mode-toggle)
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
  } catch { }
  applyScheme(value === "light" || value === "dark" ? value : null);
}

function toggleComfortScheme() {
  const target = getResolvedScheme() === "dark" ? "light" : "dark";
  const sys = systemDarkQuery.matches ? "dark" : "light";
  setStoredScheme(target === sys ? null : target);
}

const VALID_PRESETS = ["ultramarine", "natural", "emerald", "cyber"];

function applyPreset(preset) {
  const safe = VALID_PRESETS.includes(preset) ? preset : "ultramarine";
  document.documentElement.dataset.theme = safe;
  try {
    localStorage.setItem("accent-preset", safe);
  } catch { }
  for (const btn of presetButtons) {
    btn.setAttribute("aria-pressed", String(btn.dataset.preset === safe));
  }
}

function applyGrid(enabled) {
  document.documentElement.dataset.grid = enabled ? "on" : "off";
  if (gridToggle) gridToggle.checked = enabled;
  try {
    localStorage.setItem("canvas-texture", enabled ? "on" : "off");
  } catch { }
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

// Update auto readout when OS shifts without removing any pinned preference
systemDarkQuery.addEventListener("change", () => applyScheme(getStoredScheme()));

window.addEventListener("storage", (e) => {
  if (e.key === "color-scheme") applyScheme(getStoredScheme());
  if (e.key === "accent-preset") applyPreset(e.newValue || "ultramarine");
  if (e.key === "canvas-texture") applyGrid(e.newValue !== "off");
});

applyScheme(getStoredScheme());
applyPreset(document.documentElement.dataset.theme || "ultramarine");
applyGrid(document.documentElement.dataset.grid !== "off");

/* ==========================================================================
   3. Tabbed Interface + Scoped Transitions + Find-in-Page Sync
   ========================================================================== */
const tablist = document.getElementById("profile-tablist");
const panelsStage = document.getElementById("panels-stage");
const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
const panels = tabs.map((tab) =>
  document.querySelector(`[role="tabpanel"][aria-labelledby="${tab.id}"]`)
);

function selectTab(targetTab, { focusTab = false, updateHash = true, animate = true } = {}) {
  if (!targetTab) return;
  const apply = () => {
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
  };

  if (animate) runScopedTransition(panelsStage, apply);
  else apply();

  targetTab.scrollIntoView({ block: "nearest", inline: "nearest", container: "nearest" });
  if (focusTab) targetTab.focus();
  if (updateHash && targetTab.dataset.hash) {
    history.replaceState(null, "", `#${targetTab.dataset.hash}`);
  }
}

for (const tab of tabs) {
  tab.addEventListener("click", () => selectTab(tab));
}

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

panelsStage.addEventListener("beforematch", (e) => {
  const matchedPanel = e.target.closest('[role="tabpanel"]');
  if (!matchedPanel) return;
  const tabId = matchedPanel.getAttribute("aria-labelledby");
  const tab = tabs.find((t) => t.id === tabId);
  if (tab) selectTab(tab, { updateHash: false, animate: false });
});

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

function syncTabFromHash() {
  const hash = location.hash.replace("#", "").toLowerCase();
  const match = tabs.find((t) => t.dataset.hash === hash);
  if (match) selectTab(match, { updateHash: false, animate: false });
}
window.addEventListener("hashchange", syncTabFromHash);
syncTabFromHash();

document.addEventListener("click", (e) => {
  const trigger = e.target.closest("[data-jump-tab]");
  if (!trigger) return;
  const target = document.getElementById(trigger.dataset.jumpTab);
  if (target) {
    selectTab(target, { focusTab: true });
    document.getElementById("main-tabs")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});

/* ==========================================================================
   4. Bento Pillars, Mentorship Modules, Capabilities, Trace & Timeline
   ========================================================================== */
// Render Flagship Bento Showcase
const pillarsGrid = document.getElementById("pillars-grid");
PROFILE.pillars.forEach((pillar, idx) => {
  const card = document.createElement("article");
  card.className = "bento-card reveal-item";
  if (idx === 0) card.classList.add("bento-hero");
  else if (idx === 1) card.classList.add("bento-wide");

  const badge = document.createElement("span");
  badge.className = "bento-badge";
  badge.textContent = pillar.badge;
  const h3 = document.createElement("h3");
  h3.textContent = pillar.title;
  const p = document.createElement("p");
  p.textContent = pillar.detail;
  card.append(badge, h3, p);
  pillarsGrid.append(card);
});

// Render Mentorship Connect Modules (jump straight to Schedule tab with focus preselected)
const modulesEl = document.getElementById("mentorship-modules");
PROFILE.sessionTopics.forEach((topic, idx) => {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "module-btn reveal-item";

  const top = document.createElement("span");
  top.className = "module-top";
  const num = document.createElement("span");
  num.className = "module-num";
  num.textContent = `MODULE 0${idx + 1}`;
  const cta = document.createElement("span");
  cta.className = "module-cta";
  cta.textContent = "Configure Session →";
  top.append(num, cta);

  const title = document.createElement("span");
  title.className = "module-title";
  title.textContent = topic.title;

  const sub = document.createElement("span");
  sub.className = "module-sub";
  sub.textContent = topic.subtitle;

  btn.append(top, title, sub);
  btn.addEventListener("click", () => {
    const radio = document.querySelector(`input[name="topic"][value="${topic.id}"]`);
    if (radio) {
      radio.checked = true;
      updateCheckoutSummary();
    }
    const schedTab = document.getElementById("tab-schedule");
    selectTab(schedTab, { focusTab: true });
    document.getElementById("main-tabs")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  modulesEl.append(btn);
});

// Render Clean 4-Lane Developer Workbench (Languages, Cloud, IDEs, AI Agents)
const devStackDock = document.getElementById("dev-stack-dock");
if (devStackDock && Array.isArray(PROFILE.devWorkbenchLanes)) {
  let tileIdx = 0;
  for (const lane of PROFILE.devWorkbenchLanes) {
    const group = document.createElement("div");
    group.className = "workbench-lane";

    const heading = document.createElement("p");
    heading.className = "lane-label";
    heading.textContent = lane.label;

    const row = document.createElement("div");
    row.className = "lane-tiles";

    for (const item of lane.items) {
      const tile = document.createElement("span");
      tile.className = "stack-tile";
      tile.style.setProperty("--stagger", `${tileIdx * 30}ms`);
      tile.style.setProperty("--brand-color", item.color);
      tileIdx++;

      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "brand-svg");
      svg.setAttribute("aria-hidden", "true");
      const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
      use.setAttribute("href", `#brand-${item.icon}`);
      svg.append(use);

      const label = document.createElement("span");
      label.className = "stack-tile-name";
      label.textContent = item.name;

      tile.append(svg, label);
      row.append(tile);
    }

    group.append(heading, row);
    devStackDock.append(group);
  }
}

// Persistent Capabilities Matrix with Scoped View Transitions (keeps DOM identity for match-element)
const skillsGrid = document.getElementById("skills-grid");
const filterChips = Array.from(document.querySelectorAll("[data-skill-filter]"));
const skillNodes = PROFILE.skillsCatalog.map((skill) => {
  const li = document.createElement("li");
  li.className = "skill-item";
  li.dataset.domain = skill.domain;

  const head = document.createElement("span");
  head.className = "skill-head";
  if (skill.icon) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "brand-svg skill-brand-svg");
    svg.setAttribute("aria-hidden", "true");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", `#brand-${skill.icon}`);
    svg.append(use);
    head.append(svg);
  }
  const name = document.createElement("span");
  name.className = "skill-name";
  name.textContent = skill.name;
  head.append(name);

  const lvl = document.createElement("span");
  lvl.className = "skill-level";
  lvl.textContent = skill.level;
  li.append(head, lvl);
  skillsGrid.append(li);
  return li;
});

function filterSkills(filter) {
  runScopedTransition(skillsGrid, () => {
    for (const li of skillNodes) {
      const visible = filter === "all" || li.dataset.domain === filter;
      li.hidden = !visible;
    }
  });
}

for (const chip of filterChips) {
  chip.addEventListener("click", () => {
    for (const c of filterChips) c.setAttribute("aria-pressed", String(c === chip));
    filterSkills(chip.dataset.skillFilter);
  });
}

// Trace Simulator
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
   5. Toast Notifications & Single Polite Announcer
   ========================================================================== */
const politeAnnouncer = document.getElementById("polite-announcer");
const toastEl = document.getElementById("status-toast");
const toastMsgEl = document.getElementById("toast-message");
let toastTimer = null;

function showToast(message) {
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
   6. Copy Buttons (Invoker command="--copy" + fallback)
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
   7. Schedule a 1-Hour Session (₹500 INR) + UPI QR + Razorpay Handle
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
const summaryFeeEl = document.getElementById("summary-fee");
const step4FeeLabelEl = document.getElementById("step4-fee-label");
const discountCodeInput = document.getElementById("discount-code");
const applyDiscountBtn = document.getElementById("apply-discount-btn");
const removeDiscountBtn = document.getElementById("remove-discount-btn");
const discountFeedbackEl = document.getElementById("discount-feedback");
const confirmBookingBtn = document.getElementById("confirm-booking-btn");
const upiQrContainer = document.getElementById("upi-qr-container");
const upiIdValueEl = document.getElementById("upi-id-value");
const upiCaptionEl = document.getElementById("upi-caption");
const upiDeepLinkEl = document.getElementById("upi-deep-link");
const razorpayLinkEl = document.getElementById("razorpay-link");
const razorpayCheckoutBtn = document.getElementById("razorpay-checkout-btn");
const razorpayErrorEl = document.getElementById("razorpay-error");
const razorpayErrorTextEl = document.getElementById("razorpay-error-text");
const setupNoticeEl = document.getElementById("setup-notice");
const savedBookingsBox = document.getElementById("saved-bookings-box");
const savedBookingsList = document.getElementById("saved-bookings-list");

const visitorTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
localTzEl.textContent = visitorTz;

const razorpayApiBase = (SITE_CONFIG.razorpayApiBaseUrl || "").trim().replace(/\/+$/, "");
const isLiveUpiConfigured = Boolean(SITE_CONFIG.upiId && SITE_CONFIG.upiId.trim());
const isLiveRazorpayConfigured = Boolean(
  SITE_CONFIG.razorpayPaymentLink && SITE_CONFIG.razorpayPaymentLink.trim()
);

if (!isLiveUpiConfigured && !isLiveRazorpayConfigured && !razorpayApiBase) {
  setupNoticeEl.hidden = false;
  upiIdValueEl.textContent = "Set upiId in config.js";
  upiCaptionEl.textContent = "Preview UPI QR (₹500 INR) — update config.js to go live";
} else {
  upiIdValueEl.textContent = isLiveUpiConfigured ? SITE_CONFIG.upiId.trim() : "Via Razorpay below";
}

const serverBookedDates = new Set();

function isDateBooked(dateStr) {
  return serverBookedDates.has(dateStr) || getSavedBookings().some((b) => b.dateStr === dateStr);
}

async function syncBackendCapabilities() {
  if (!razorpayApiBase) return;
  try {
    const res = await fetchWithTimeout(`${razorpayApiBase}/health`, {}, 3500);
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      if (data.configured && razorpayCheckoutBtn) {
        razorpayCheckoutBtn.hidden = false;
      }
      if (Array.isArray(data.booked_dates)) {
        for (const d of data.booked_dates) serverBookedDates.add(d);
        if (isDateBooked(dateInput.value)) {
          selectNextAvailableTuesday();
        } else {
          renderDateStrip();
        }
      }
    }
  } catch {
    // Backend unavailable or TLS not yet active — keep UPI QR and Razorpay.me handle active
  }
}
syncBackendCapabilities();

if (isLiveRazorpayConfigured) {
  razorpayLinkEl.href = SITE_CONFIG.razorpayPaymentLink.trim();
  razorpayLinkEl.hidden = false;
}

function getIstNowParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return {
    dateStr: `${map.year}-${map.month}-${map.day}`,
    hour: Number(map.hour),
    minute: Number(map.minute),
  };
}

function getIstWeekday(dateStr) {
  const dt = new Date(`${dateStr}T12:00:00+05:30`);
  const day = dt.getUTCDay();
  return {
    dayOfWeek: day,
    isTuesday: day === 2,
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

function getUpcomingTuesdays(count = 8) {
  const nowIst = getIstNowParts();
  const baseUtc = new Date(`${nowIst.dateStr}T12:00:00Z`);
  let daysUntilTue = (2 - baseUtc.getUTCDay() + 7) % 7;
  // If today is Tuesday and 6 PM IST is less than 1 hour away or already passed, jump to next Tuesday
  if (daysUntilTue === 0 && (nowIst.hour > 17 || (nowIst.hour === 17 && nowIst.minute > 0))) {
    daysUntilTue = 7;
  }
  const results = [];
  for (let i = 0; i < count; i++) {
    const dt = new Date(baseUtc.getTime());
    dt.setUTCDate(baseUtc.getUTCDate() + daysUntilTue + i * 7);
    const str = dt.toISOString().slice(0, 10);
    results.push({ str, ...getIstWeekday(str) });
  }
  return results;
}

function formatVisitorLocalSlot(dateStr, slot) {
  const start = new Date(`${dateStr}T${String(slot.hour).padStart(2, "0")}:${String(slot.minute).padStart(2, "0")}:00+05:30`);
  const end = new Date(start.getTime() + SITE_CONFIG.sessionDurationMins * 60000);
  if (visitorTz === "Asia/Kolkata") return "Every Tuesday · 60 min · IST";
  const fmt = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: visitorTz,
    timeZoneName: "short",
  });
  return `Your time: ${fmt.format(start)} – ${fmt.format(end)}`;
}

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

const upcomingDates = getUpcomingTuesdays(16);
const firstAvailableTuesday = upcomingDates[0].str;
const heroNextSlotEl = document.getElementById("hero-next-slot");

function updateHeroNextSlot() {
  if (!heroNextSlotEl) return;
  const nextFree = upcomingDates.find((d) => !isDateBooked(d.str)) || upcomingDates[0];
  heroNextSlotEl.textContent = `Senior SWE @ Dell · Next 1:1 Seat: Tue, ${nextFree.dayNum} · 6:00 PM IST`;
}

function selectNextAvailableTuesday() {
  const nextFree = upcomingDates.find((d) => !isDateBooked(d.str));
  dateInput.value = nextFree ? nextFree.str : "";
  validateDateInputRule();
  renderDateStrip();
  renderSlotsForDate(dateInput.value);
  updateCheckoutSummary();
  updateHeroNextSlot();
}

dateInput.min = firstAvailableTuesday;
dateInput.step = "7";
dateInput.value = (upcomingDates.find((d) => !isDateBooked(d.str)) || upcomingDates[0]).str;
updateHeroNextSlot();

function isValidSessionTuesday(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  if (dateStr < firstAvailableTuesday) return false;
  return getIstWeekday(dateStr).isTuesday;
}

function validateDateInputRule() {
  if (!dateInput.value) {
    dateInput.setCustomValidity("");
    return false;
  }
  if (!isValidSessionTuesday(dateInput.value)) {
    dateInput.setCustomValidity("Sessions are available on upcoming Tuesdays only (6:00 PM IST).");
    return false;
  }
  if (isDateBooked(dateInput.value)) {
    dateInput.setCustomValidity("This Tuesday 6:00 PM IST slot is already booked. Please choose another Tuesday.");
    return false;
  }
  dateInput.setCustomValidity("");
  return true;
}

function renderDateStrip() {
  dateStripEl.innerHTML = "";
  const available = upcomingDates.filter((d) => !isDateBooked(d.str)).slice(0, 8);
  if (available.length === 0) {
    const empty = document.createElement("p");
    empty.className = "field-hint";
    empty.textContent = "All upcoming Tuesday 6:00 PM IST slots are currently booked.";
    dateStripEl.append(empty);
    return;
  }
  for (const d of available) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "date-chip";
    btn.setAttribute("aria-pressed", String(dateInput.value === d.str));
    const daySpan = document.createElement("span");
    daySpan.className = "date-chip-day";
    daySpan.textContent = `${d.dayShort} · 6 PM`;
    const numSpan = document.createElement("span");
    numSpan.className = "date-chip-num";
    numSpan.textContent = d.dayNum;
    btn.append(daySpan, numSpan);
    btn.addEventListener("click", () => {
      dateInput.value = d.str;
      validateDateInputRule();
      dateInput.dispatchEvent(new Event("change", { bubbles: true }));
    });
    dateStripEl.append(btn);
  }
}

function renderSlotsForDate(dateStr) {
  slotsGridEl.innerHTML = "";
  if (!isValidSessionTuesday(dateStr) || isDateBooked(dateStr)) {
    const notice = document.createElement("p");
    notice.className = "field-hint";
    notice.textContent = isDateBooked(dateStr)
      ? "This Tuesday 6:00 PM IST slot is already booked — choose an available Tuesday above."
      : "No session slots on non-Tuesdays — choose any upcoming Tuesday above for the 6:00 PM IST slot.";
    slotsGridEl.append(notice);
    return;
  }
  const list = PROFILE.timeSlots.slots;
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
  if (!isValidSessionTuesday(dateStr) || isDateBooked(dateStr)) return null;
  const list = PROFILE.timeSlots.slots;
  const checked = bookingForm.querySelector('input[name="timeSlot"]:checked');
  return list.find((s) => s.id === checked?.value) || null;
}

let appliedDiscount = null;

function getActiveFeeInr() {
  return appliedDiscount ? appliedDiscount.feeInr : SITE_CONFIG.sessionFeeInr;
}

function getDiscountIdentity() {
  return {
    email: (document.getElementById("guest-email")?.value || "").trim().toLowerCase(),
    profile: (document.getElementById("guest-profile")?.value || "").trim().toLowerCase().replace(/\/+$/, ""),
    name: (document.getElementById("guest-name")?.value || "").trim().toLowerCase().replace(/\s+/g, " "),
  };
}

function getUsedDiscounts() {
  try {
    const parsed = JSON.parse(localStorage.getItem("ag_used_discounts") || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isDiscountUsedLocally(code) {
  const id = getDiscountIdentity();
  return getUsedDiscounts().some(
    (r) =>
      r &&
      r.code === code &&
      ((id.email && r.email === id.email) ||
        (id.profile && r.profile === id.profile) ||
        (id.name && r.name === id.name))
  );
}

function recordUsedDiscount(booking) {
  if (!booking?.discountCode) return;
  const list = getUsedDiscounts();
  list.push({
    code: String(booking.discountCode).toUpperCase(),
    email: String(booking.email || "").trim().toLowerCase(),
    profile: String(booking.profile || "").trim().toLowerCase().replace(/\/+$/, ""),
    name: String(booking.name || "").trim().toLowerCase().replace(/\s+/g, " "),
  });
  try {
    localStorage.setItem("ag_used_discounts", JSON.stringify(list.slice(-50)));
  } catch { }
}

function setDiscountFeedback(message, state = "") {
  if (!discountFeedbackEl) return;
  if (!message) {
    discountFeedbackEl.hidden = true;
    discountFeedbackEl.textContent = "";
    discountFeedbackEl.removeAttribute("data-state");
    return;
  }
  discountFeedbackEl.textContent = message;
  if (state) discountFeedbackEl.dataset.state = state;
  discountFeedbackEl.hidden = false;
}

function buildUpiUri(note) {
  const pa = isLiveUpiConfigured ? SITE_CONFIG.upiId.trim() : "configure-upi-in-config@upi";
  const params = new URLSearchParams({
    pa,
    pn: SITE_CONFIG.upiPayeeName || SITE_CONFIG.ownerName,
    am: `${getActiveFeeInr()}.00`,
    cu: SITE_CONFIG.sessionCurrency,
    tn: note.slice(0, 50),
  });
  return `upi://pay?${params.toString()}`;
}

function updateCheckoutSummary() {
  const topic = getSelectedTopic();
  const dateStr = dateInput.value;
  const slot = getSelectedSlot();
  const feeInr = getActiveFeeInr();

  summaryTopicEl.textContent = topic.title;
  if (dateStr && slot) {
    const info = getIstWeekday(dateStr);
    summaryDatetimeEl.textContent = `${info.fullLabel} · ${slot.label}`;
  } else {
    summaryDatetimeEl.textContent = "Select a Tuesday (6:00 PM IST)";
  }

  if (summaryFeeEl) {
    summaryFeeEl.textContent = appliedDiscount
      ? `₹${feeInr} INR (50% OFF · ${appliedDiscount.code})`
      : `₹${feeInr} INR`;
  }
  if (step4FeeLabelEl) step4FeeLabelEl.textContent = `₹${feeInr} INR`;
  if (razorpayCheckoutBtn && razorpayCheckoutBtn.getAttribute("aria-busy") !== "true") {
    razorpayCheckoutBtn.textContent = `Pay ₹${feeInr} via Razorpay Checkout`;
  }
  if (upiDeepLinkEl) upiDeepLinkEl.textContent = `Open UPI App · Pay ₹${feeInr}`;
  if (confirmBookingBtn) {
    const labelSpan = confirmBookingBtn.querySelector("span");
    if (labelSpan) labelSpan.textContent = `Lock In 1-Hour Session · ₹${feeInr} INR`;
  }

  const upiNote = `1hr Session: ${topic.id} ${dateStr || ""}`.trim();
  const upiUri = buildUpiUri(upiNote);
  upiDeepLinkEl.href = upiUri;
  if (upiCaptionEl && isLiveUpiConfigured) {
    upiCaptionEl.textContent = `Instant ₹${feeInr} UPI QR · Zero Fee`;
  }
  upiQrContainer.innerHTML = renderQrSvg(
    upiUri,
    `UPI QR code to pay ₹${feeInr} INR to ${SITE_CONFIG.ownerName}`
  );
}

async function applyDiscountCode() {
  const raw = (discountCodeInput?.value || "").trim().toUpperCase();
  if (!raw) {
    appliedDiscount = null;
    if (removeDiscountBtn) removeDiscountBtn.hidden = true;
    setDiscountFeedback("Enter an invite code first.", "error");
    updateCheckoutSummary();
    return;
  }

  if (isDiscountUsedLocally(raw)) {
    appliedDiscount = null;
    if (removeDiscountBtn) removeDiscountBtn.hidden = true;
    setDiscountFeedback("This invite code has already been used with your email or details.", "error");
    updateCheckoutSummary();
    return;
  }

  if (!razorpayApiBase) {
    appliedDiscount = null;
    if (removeDiscountBtn) removeDiscountBtn.hidden = true;
    setDiscountFeedback("Discount validation requires the live booking backend.", "error");
    updateCheckoutSummary();
    return;
  }

  const id = getDiscountIdentity();
  try {
    const res = await fetchWithTimeout(
      `${razorpayApiBase}/api/validate-discount`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: raw, email: id.email, profile: id.profile, name: id.name }),
      },
      3000
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.valid) {
      appliedDiscount = null;
      if (removeDiscountBtn) removeDiscountBtn.hidden = true;
      setDiscountFeedback(data.error || "Invalid or already used invite code.", "error");
      updateCheckoutSummary();
      return;
    }
    appliedDiscount = {
      code: data.code || raw,
      discountPct: data.discountPct || 50,
      feeInr: data.finalAmountInr || Math.round(SITE_CONFIG.sessionFeeInr / 2),
    };
  } catch {
    appliedDiscount = null;
    if (removeDiscountBtn) removeDiscountBtn.hidden = true;
    setDiscountFeedback("Unable to verify invite code right now. Please try again.", "error");
    updateCheckoutSummary();
    return;
  }

  if (discountCodeInput) discountCodeInput.value = appliedDiscount.code;
  if (removeDiscountBtn) removeDiscountBtn.hidden = false;
  setDiscountFeedback(
    `Invite code applied — 50% off (₹${appliedDiscount.feeInr} INR).`,
    "valid"
  );
  updateCheckoutSummary();
}

function clearDiscountCode() {
  appliedDiscount = null;
  if (discountCodeInput) discountCodeInput.value = "";
  if (removeDiscountBtn) removeDiscountBtn.hidden = true;
  setDiscountFeedback("");
  updateCheckoutSummary();
}

applyDiscountBtn?.addEventListener("click", applyDiscountCode);
removeDiscountBtn?.addEventListener("click", clearDiscountCode);

dateInput.addEventListener("input", validateDateInputRule);
dateInput.addEventListener("change", () => {
  validateDateInputRule();
  renderDateStrip();
  renderSlotsForDate(dateInput.value);
  updateCheckoutSummary();
  slotErrorEl.hidden = Boolean(getSelectedSlot());
});

validateDateInputRule();
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
    if (el.matches?.('#guest-email, #guest-profile, #upi-utr, #discount-code') && typeof el.value === "string") {
      const trimmed = el.value.trim();
      if (trimmed !== el.value) el.value = trimmed;
    }
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
  if (razorpayErrorEl && !razorpayErrorEl.hidden) showRazorpayError("");
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
   9. Booking Pass, .ics Invite & Animated Native <dialog> Modals
   ========================================================================== */
const bookingDialog = document.getElementById("booking-dialog");
const dialogSubtitle = document.getElementById("dialog-subtitle");
const dialogPassSummary = document.getElementById("dialog-pass-summary");
const downloadIcsBtn = document.getElementById("download-ics-btn");
const gcalLinkBtn = document.getElementById("gcal-link-btn");
const sendConfirmBtn = document.getElementById("send-confirm-btn");

let activeBooking = null;

// Animate-to-from-top-layer exit fallback for Firefox / Safari
let supportsDisplayTransition;
function canTransitionDisplay() {
  if (supportsDisplayTransition !== undefined) return supportsDisplayTransition;
  if (!window.CSS?.supports?.("transition-behavior", "allow-discrete") || !document.body) {
    return false;
  }
  const probe = document.createElement("div");
  probe.style.cssText = "transition: display 1s allow-discrete !important; display: block;";
  document.body.appendChild(probe);
  getComputedStyle(probe).display;
  probe.style.display = "none";
  supportsDisplayTransition = getComputedStyle(probe).display === "block";
  probe.remove();
  return supportsDisplayTransition;
}

function supportsTopLayerExit() {
  return window.CSS?.supports?.("overlay", "auto") && canTransitionDisplay();
}

async function closeTopLayer(dialog) {
  if (!supportsTopLayerExit()) {
    dialog.setAttribute("data-closing", "");
    const animations = dialog.getAnimations({ subtree: true });
    if (animations.length > 0) {
      await Promise.race([
        Promise.allSettled(animations.map((a) => a.finished)),
        new Promise((r) => setTimeout(r, 1000)),
      ]);
    }
    if (!dialog.hasAttribute("data-closing")) return;
    dialog.removeAttribute("data-closing");
  }
  dialog.close();
}

function formatIcsUtc(dateObj) {
  return dateObj.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function stripCrlf(val) {
  return String(val ?? "").replace(/[\r\n\u0000-\u001f]+/g, " ").trim();
}

function buildIcsContent(booking) {
  const start = new Date(booking.startIso);
  const end = new Date(booking.endIso);
  const location = stripCrlf(booking.meetUrl || SITE_CONFIG.meetingLink || SITE_CONFIG.meetingPlatform);
  const hostEmail = stripCrlf(SITE_CONFIG.contactEmail || "ayushbpl10@gmail.com");
  const guestName = stripCrlf(booking.name);
  const guestEmail = stripCrlf(booking.email);
  const topicTitle = stripCrlf(booking.topicTitle);
  const safeId = stripCrlf(booking.id);
  const safeUtr = stripCrlf(booking.utr);
  const safeMeet = stripCrlf(booking.meetUrl);
  const bookingFee = booking.feeInr || getActiveFeeInr();
  const desc = [
    `1:1 Session with ${stripCrlf(SITE_CONFIG.ownerName)}`,
    `Booking ID: ${safeId}`,
    `Topic: ${topicTitle}`,
    `Fee: ₹${bookingFee} INR${booking.discountCode ? ` (${stripCrlf(booking.discountCode)} · 50% OFF)` : ""}`,
    safeUtr ? `Payment Ref / UTR: ${safeUtr}` : "Payment Ref / UTR: Pending verification",
    safeMeet ? `Google Meet: ${safeMeet}` : "",
    `Agenda: ${stripCrlf(booking.agenda)}`,
    `Location: ${location}`,
  ]
    .filter(Boolean)
    .join("\\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Ayush Gupta//1on1 Session//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${safeId}@ayushbpl10.github.io`,
    `DTSTAMP:${formatIcsUtc(new Date())}`,
    `DTSTART:${formatIcsUtc(start)}`,
    `DTEND:${formatIcsUtc(end)}`,
    `ORGANIZER;CN=${stripCrlf(SITE_CONFIG.ownerName)}:mailto:${hostEmail}`,
    `ATTENDEE;CN=${stripCrlf(SITE_CONFIG.ownerName)};RSVP=TRUE:mailto:${hostEmail}`,
    `ATTENDEE;CN=${guestName};RSVP=TRUE:mailto:${guestEmail}`,
    `SUMMARY:1:1 Session with ${stripCrlf(SITE_CONFIG.ownerName)} (${topicTitle})`,
    `DESCRIPTION:${desc}`,
    `LOCATION:${location}`,
    safeMeet ? `URL:${safeMeet}` : "",
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
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
  const location = booking.meetUrl || SITE_CONFIG.meetingLink || "Google Meet";
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `1:1 Session with ${SITE_CONFIG.ownerName} — ${booking.topicTitle}`,
    dates: `${start}/${end}`,
    ctz: "Asia/Kolkata",
    details: [
      `Booking ID: ${booking.id}`,
      `Guest: ${booking.name} (${booking.email})`,
      `Fee: ₹${booking.feeInr || getActiveFeeInr()} INR${booking.discountCode ? ` (${booking.discountCode} · 50% OFF)` : ""}`,
      `Payment Ref / UTR: ${booking.utr || "Pending"}`,
      booking.meetUrl ? `Google Meet: ${booking.meetUrl}` : "Turn on 'Add Google Meet video conferencing' when saving.",
      `Agenda: ${booking.agenda}`,
    ].join("\n"),
    location,
  });
  if (SITE_CONFIG.contactEmail) {
    params.set("add", SITE_CONFIG.contactEmail);
  }
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function getSavedBookings() {
  try {
    const parsed = JSON.parse(localStorage.getItem("ag_session_bookings") || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((b) => b && typeof b === "object" && typeof b.id === "string" && typeof b.startIso === "string")
      : [];
  } catch {
    return [];
  }
}

function saveBooking(booking) {
  const list = [booking, ...getSavedBookings()].slice(0, 5);
  try {
    localStorage.setItem("ag_session_bookings", JSON.stringify(list));
  } catch { }
  renderSavedBookings();
}

function openBookingDialog(booking) {
  activeBooking = booking;
  dialogSubtitle.textContent = `Booking ${booking.id} · ${booking.dateLabel} · ${booking.slotLabel}`;
  dialogPassSummary.innerHTML = "";

  const bookingFee = booking.feeInr || getActiveFeeInr();
  const effectiveMeetUrl = booking.meetUrl || SITE_CONFIG.meetingLink || "";
  const rows = [
    ["Booking ID", booking.id],
    ["Attendee", `${booking.name} (${booking.email})`],
    ["Topic", booking.topicTitle],
    ["When (IST)", `${booking.dateLabel} · ${booking.slotLabel} (Tuesday)`],
    ["Duration & Fee", `60 Minutes · ₹${bookingFee} INR${booking.discountCode ? ` (${booking.discountCode} · 50% OFF)` : ""}`],
    ["Payment Ref (UTR)", booking.utr || "Pending / Pay via UPI QR or Razorpay"],
    ["Google Meet", effectiveMeetUrl || "Click 'Schedule Google Meet Invite ↗' below to generate & invite Ayush"],
    [
      "Email Alert",
      booking.emailSent
        ? `Sent to ${SITE_CONFIG.contactEmail || "ayushbpl10@gmail.com"} & ${booking.email}`
        : `Click 'Email Confirmation to ${SITE_CONFIG.contactEmail || "ayushbpl10@gmail.com"} ↗' below`,
    ],
    ["Agenda", booking.agenda],
  ];
  for (const [k, v] of rows) {
    const line = document.createElement("div");
    const strong = document.createElement("strong");
    strong.textContent = `${k}: `;
    if (k === "Google Meet" && /^https:\/\/meet\.google\.com\//i.test(v)) {
      const a = document.createElement("a");
      a.href = v;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = v;
      line.append(strong, a);
    } else {
      const val = document.createElement("span");
      val.textContent = v;
      line.append(strong, val);
    }
    dialogPassSummary.append(line);
  }

  gcalLinkBtn.href = buildGcalUrl(booking);
  if (SITE_CONFIG.contactEmail) {
    const mailParams = new URLSearchParams({
      subject: `[1:1 Tuesday Session ${booking.id}] ${booking.dateLabel} 6 PM IST — ${booking.topicTitle}`,
      body: `Hi Ayush,\n\nI booked a Tuesday 6:00 PM IST 1-hour session (₹${bookingFee} INR${booking.discountCode ? ` · ${booking.discountCode}` : ""}).\nBooking ID: ${booking.id}\nDate & Time: ${booking.dateLabel} (${booking.slotLabel})\nPayment Ref / UTR: ${booking.utr || "Attaching receipt"}\n${effectiveMeetUrl ? `Google Meet: ${effectiveMeetUrl}\n` : ""}Agenda: ${booking.agenda}\n\nThanks,\n${booking.name} (${booking.email})`,
    });
    sendConfirmBtn.href = `mailto:${SITE_CONFIG.contactEmail}?${mailParams.toString()}`;
    sendConfirmBtn.textContent = `Email Confirmation to ${SITE_CONFIG.contactEmail} ↗`;
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
    btn.className = "pill-btn pill-ghost btn-compact";
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

function validateBookingInputs() {
  const slot = getSelectedSlot();
  slotErrorEl.hidden = Boolean(slot);
  if (!bookingForm.checkValidity() || !slot) {
    const firstInvalid = bookingForm.querySelector("input:invalid, select:invalid, textarea:invalid");
    if (firstInvalid) {
      const label = firstInvalid.labels?.[0]?.textContent?.replace(/\*$/, "").trim() || "highlighted field";
      showRazorpayError(`Please check "${label}" above before continuing.`);
      firstInvalid.focus();
      firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (!slot) {
      showRazorpayError("Please select an upcoming Tuesday to activate the 6:00 PM IST slot.");
      dateInput.focus();
    }
    return null;
  }
  return slot;
}

function buildBookingFromForm(slot, paymentOverride = "") {
  const topic = getSelectedTopic();
  const dateStr = dateInput.value;
  const info = getIstWeekday(dateStr);
  const start = new Date(
    `${dateStr}T${String(slot.hour).padStart(2, "0")}:${String(slot.minute).padStart(2, "0")}:00+05:30`
  );
  const end = new Date(start.getTime() + SITE_CONFIG.sessionDurationMins * 60000);
  const code = Math.random().toString(36).slice(2, 6).toUpperCase();

  return {
    id: `AG-${dateStr.slice(2, 4)}${dateStr.slice(5, 7)}-${code}`,
    name: document.getElementById("guest-name").value.trim(),
    email: document.getElementById("guest-email").value.trim(),
    profile: document.getElementById("guest-profile").value.trim(),
    agenda: document.getElementById("guest-agenda").value.trim(),
    utr: paymentOverride || document.getElementById("upi-utr").value.trim(),
    discountCode: appliedDiscount ? appliedDiscount.code : "",
    feeInr: getActiveFeeInr(),
    topicId: topic.id,
    topicTitle: topic.title,
    dateStr,
    dateLabel: info.fullLabel,
    slotLabel: slot.label,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

function showRazorpayError(message) {
  if (!razorpayErrorEl || !razorpayErrorTextEl) return;
  if (!message) {
    razorpayErrorEl.hidden = true;
    razorpayErrorTextEl.textContent = "";
    return;
  }
  razorpayErrorTextEl.textContent = message;
  razorpayErrorEl.hidden = false;
  razorpayErrorEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function setCheckoutBusy(busy, label = `Pay ₹${getActiveFeeInr()} via Razorpay Checkout`) {
  if (!razorpayCheckoutBtn) return;
  razorpayCheckoutBtn.setAttribute("aria-busy", String(busy));
  razorpayCheckoutBtn.textContent = label;
}

function ensureRazorpaySdk() {
  if (typeof window.Razorpay === "function") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => (typeof window.Razorpay === "function" ? resolve() : reject(new Error("Razorpay SDK unavailable.")));
    script.onerror = () => reject(new Error("Could not load Razorpay Checkout script."));
    document.head.append(script);
  });
}

function completeBookingPass(booking) {
  serverBookedDates.add(booking.dateStr);
  recordUsedDiscount(booking);
  clearDiscountCode();
  saveBooking(booking);

  // Clear guest inputs & advance to the next available Tuesday to prevent accidental duplicate passes
  for (const id of ["guest-name", "guest-email", "guest-profile", "guest-agenda", "upi-utr"]) {
    const field = document.getElementById(id);
    if (field) {
      field.value = "";
      field.classList.remove("user-invalid-fallback", "user-valid-fallback");
      field.setAttribute("aria-invalid", "false");
    }
  }
  selectNextAvailableTuesday();
  openBookingDialog(booking);
}

async function startRazorpayCheckout() {
  if (!razorpayApiBase) return;
  if (razorpayCheckoutBtn?.getAttribute("aria-busy") === "true") return;

  showRazorpayError("");
  const slot = validateBookingInputs();
  if (!slot) return;

  if (appliedDiscount && isDiscountUsedLocally(appliedDiscount.code)) {
    const usedCode = appliedDiscount.code;
    clearDiscountCode();
    showRazorpayError(`Discount code ${usedCode} has already been used with your email or details.`);
    return;
  }

  const topic = getSelectedTopic();
  const dateStr = dateInput.value;
  const guestName = document.getElementById("guest-name").value.trim();
  const guestEmail = document.getElementById("guest-email").value.trim();
  const guestProfile = document.getElementById("guest-profile").value.trim();

  setCheckoutBusy(true, "Creating Razorpay order…");
  try {
    await ensureRazorpaySdk();
    const orderRes = await fetchWithTimeout(
      `${razorpayApiBase}/api/create-order`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: getActiveFeeInr() * 100,
          currency: SITE_CONFIG.sessionCurrency,
          receipt: `ag_${dateStr}_${slot.id}`.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40),
          topic: topic.id,
          slot: `${dateStr} ${slot.label}`,
          slotDate: dateStr,
          discountCode: appliedDiscount ? appliedDiscount.code : "",
          email: guestEmail,
          profile: guestProfile,
          name: guestName,
        }),
      },
      10000
    );
    const orderData = await orderRes.json().catch(() => ({}));
    if (!orderRes.ok || !orderData.order_id || !orderData.key_id) {
      throw new Error(orderData.error || `Order creation failed (HTTP ${orderRes.status}).`);
    }

    const rzp = new window.Razorpay({
      key: orderData.key_id,
      amount: orderData.amount,
      currency: orderData.currency,
      name: SITE_CONFIG.ownerName,
      description: `1:1 Session — ${topic.title}`,
      order_id: orderData.order_id,
      prefill: {
        name: guestName,
        email: guestEmail,
      },
      notes: {
        topic: topic.title,
        slot: `${dateStr} ${slot.label}`,
      },
      theme: {
        color: "#005ec4",
      },
      modal: {
        ondismiss: () => {
          setCheckoutBusy(false);
          showRazorpayError("Payment cancelled before completion. You can retry or pay via UPI QR.");
        },
      },
      handler: async (paymentResp) => {
        setCheckoutBusy(true, "Verifying payment & scheduling Google Meet…");
        try {
          const verifiedRef = `${paymentResp.razorpay_payment_id} (Razorpay Verified)`;
          const pendingBooking = buildBookingFromForm(slot, verifiedRef);
          const verifyPayload = JSON.stringify({
            razorpay_order_id: paymentResp.razorpay_order_id,
            razorpay_payment_id: paymentResp.razorpay_payment_id,
            razorpay_signature: paymentResp.razorpay_signature,
            booking: pendingBooking,
          });
          // Money has already moved: retry transient network/5xx failures before giving up.
          let verifyRes;
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              verifyRes = await fetchWithTimeout(
                `${razorpayApiBase}/api/verify-payment`,
                { method: "POST", headers: { "Content-Type": "application/json" }, body: verifyPayload },
                15000
              );
              if (verifyRes.status < 500) break;
            } catch (netErr) {
              if (attempt === 3) {
                throw new Error(
                  `Payment ${paymentResp.razorpay_payment_id} succeeded, but we could not reach the server to confirm your slot. ` +
                    "Do NOT pay again — save this payment ID and email it to Ayush."
                );
              }
            }
            await new Promise((r) => setTimeout(r, 1500 * attempt));
          }
          if (!verifyRes) throw new Error(`Payment ${paymentResp.razorpay_payment_id} succeeded but verification is pending. Contact Ayush with this ID.`);
          const verifyData = await verifyRes.json().catch(() => ({}));
          if (!verifyRes.ok || !verifyData.verified) {
            throw new Error(verifyData.error || "Payment verification failed.");
          }

          const utrInput = document.getElementById("upi-utr");
          if (utrInput) utrInput.value = paymentResp.razorpay_payment_id;
          const confirmedBooking = {
            ...pendingBooking,
            meetUrl: verifyData.meet_url || SITE_CONFIG.meetingLink || "",
            emailSent: Boolean(verifyData.email_sent),
          };
          completeBookingPass(confirmedBooking);
          showRazorpayError("");
        } catch (verifyErr) {
          showRazorpayError(
            verifyErr.message || "Signature verification failed. Please save your payment ID and contact Ayush."
          );
        } finally {
          setCheckoutBusy(false);
        }
      },
    });

    rzp.on("payment.failed", (failedEvent) => {
      setCheckoutBusy(false);
      const reason = failedEvent?.error?.description || failedEvent?.error?.reason || "Payment failed.";
      showRazorpayError(`Razorpay payment failed: ${reason}`);
    });

    setCheckoutBusy(false);
    rzp.open();
  } catch (err) {
    setCheckoutBusy(false);
    showRazorpayError(err.message || "Unable to open Razorpay Checkout.");
  }
}

razorpayCheckoutBtn?.addEventListener("click", startRazorpayCheckout);

bookingForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const confirmBtn = document.getElementById("confirm-booking-btn");
  if (confirmBtn?.getAttribute("aria-busy") === "true") return;

  showRazorpayError("");
  const slot = validateBookingInputs();
  if (!slot) return;

  const utrEl = document.getElementById("upi-utr");
  const utrVal = utrEl?.value.trim() || "";
  if (!/^[A-Za-z0-9_-]{6,32}$/.test(utrVal)) {
    if (utrEl) {
      fallbackDirty.set(utrEl, { hasInteracted: true, hasBlurred: true });
      utrEl.classList.add("user-invalid-fallback");
      utrEl.classList.remove("user-valid-fallback");
      utrEl.setAttribute("aria-invalid", "true");
      utrEl.focus();
    }
    showRazorpayError(
      "Payment required: complete payment via Razorpay Checkout or enter your 6–32 character UPI UTR / Payment ID before locking in your session."
    );
    return;
  }

  if (appliedDiscount && isDiscountUsedLocally(appliedDiscount.code)) {
    const usedCode = appliedDiscount.code;
    clearDiscountCode();
    showRazorpayError(`Discount code ${usedCode} has already been used with your email or details.`);
    return;
  }

  const booking = buildBookingFromForm(slot);
  if (razorpayApiBase) {
    confirmBtn?.setAttribute("aria-busy", "true");
    try {
      const res = await fetchWithTimeout(
        `${razorpayApiBase}/api/book-session`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ booking }),
        },
        3000
      );
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 || res.status === 400) {
        if (res.status === 409 && /slot/i.test(data.error || "")) {
          serverBookedDates.add(booking.dateStr);
          selectNextAvailableTuesday();
        } else if (booking.discountCode) {
          clearDiscountCode();
        }
        showRazorpayError(data.error || "Booking validation failed.");
        return;
      }
      if (res.ok) {
        booking.meetUrl = data.meet_url || SITE_CONFIG.meetingLink || "";
        booking.emailSent = Boolean(data.email_sent);
      }
    } catch {
      // Fall back gracefully to calendar invite & mailto links inside dialog
    } finally {
      confirmBtn?.removeAttribute("aria-busy");
    }
  }
  completeBookingPass(booking);
});

for (const dlg of document.querySelectorAll("dialog")) {
  dlg.addEventListener("close", () => {
    dlg.removeAttribute("data-closing");
    dlg.returnValue = "";
  });
  dlg.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeTopLayer(dlg);
  });
}

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
      if (pressedOutside && outside(e, dialog)) closeTopLayer(dialog);
    });
  }
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest('button[command="close"]');
  if (!btn) return;
  if ("commandForElement" in HTMLButtonElement.prototype && supportsTopLayerExit()) return;
  const dlg = document.getElementById(btn.getAttribute("commandfor"));
  if (dlg) {
    e.preventDefault();
    closeTopLayer(dlg);
  }
});

/* ==========================================================================
   10. Spotlight Quick Command Palette (Ctrl+K / Cmd+K)
   ========================================================================== */
const commandDialog = document.getElementById("command-dialog");
document.getElementById("cmd-open-btn")?.addEventListener("click", () => commandDialog.showModal());

document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    if (commandDialog.open) closeTopLayer(commandDialog);
    else commandDialog.showModal();
    return;
  }
  if (!commandDialog.open || e.metaKey || e.ctrlKey || e.altKey) return;
  const key = e.key.toLowerCase();
  const keyMap = {
    "1": 'button[data-cmd-action="tab:tab-overview"]',
    "2": 'button[data-cmd-action="tab:tab-experience"]',
    "3": 'button[data-cmd-action="tab:tab-schedule"]',
    "t": 'button[data-cmd-action="theme:toggle"]',
    "l": 'a[href*="linkedin.com"]',
    "g": 'a[href*="github.com"]',
  };
  const sel = keyMap[key];
  if (sel) {
    e.preventDefault();
    commandDialog.querySelector(sel)?.click();
  }
});

commandDialog.addEventListener("click", (e) => {
  const item = e.target.closest("[data-cmd-action]");
  if (!item) return;
  const action = item.dataset.cmdAction;
  closeTopLayer(commandDialog);
  if (action.startsWith("tab:")) {
    const tab = document.getElementById(action.slice(4));
    if (tab) {
      selectTab(tab, { focusTab: true });
      document.getElementById("main-tabs")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  } else if (action === "theme:toggle") {
    toggleComfortScheme();
    showToast(`Switched to ${getResolvedScheme()} appearance`);
  }
});
