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
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(list, null, 2), "utf8");
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
