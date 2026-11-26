import fs from "node:fs";
import path from "node:path";

function readSlots(filePath) {
  if (!filePath) return [];
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((d) => typeof d === "string") : [];
  } catch {
    return [];
  }
}

function writeSlots(filePath, list) {
  if (!filePath) return;
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(list, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to persist booked slots:", err?.message || err);
  }
}

export function createSlotStore({ filePath = "" } = {}) {
  const booked = new Set(readSlots(filePath));

  return {
    list: () => Array.from(booked).sort(),
    isBooked: (dateStr) => booked.has(String(dateStr || "").trim()),
    book: (dateStr) => {
      const clean = String(dateStr || "").trim();
      if (!clean || booked.has(clean)) return false;
      booked.add(clean);
      writeSlots(filePath, Array.from(booked).sort());
      return true;
    },
  };
}

export function createPaymentRefStore({ filePath = "" } = {}) {
  const refs = new Set(readSlots(filePath).map((r) => r.toLowerCase()));

  return {
    has: (ref) => {
      const clean = String(ref || "").trim().toLowerCase();
      return Boolean(clean) && refs.has(clean);
    },
    add: (ref) => {
      const clean = String(ref || "").trim().toLowerCase();
      if (!clean || refs.has(clean)) return false;
      refs.add(clean);
      writeSlots(filePath, Array.from(refs).sort());
      return true;
    },
  };
}
