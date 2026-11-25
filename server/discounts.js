import fs from "node:fs";
import path from "node:path";

export const DEFAULT_DISCOUNT_CODE = "";
export const BASE_FEE_INR = 500;
export const BASE_FEE_PAISE = 50000;
export const DISCOUNT_PERCENT = 50;

export function normalizeIdentity({ email, profile, name } = {}) {
  return {
    emailKey: String(email || "").trim().toLowerCase(),
    profileKey: String(profile || "").trim().toLowerCase().replace(/\/+$/, ""),
    nameKey: String(name || "").trim().toLowerCase().replace(/\s+/g, " "),
  };
}

function readRecords(filePath) {
  if (!filePath) return [];
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRecords(filePath, records) {
  if (!filePath) return;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(records, null, 2), "utf8");
}

export function createDiscountStore({ code = DEFAULT_DISCOUNT_CODE, filePath = "" } = {}) {
  const configuredCode = String(code || "").trim().toUpperCase();
  const records = readRecords(filePath);

  function validate({ code: inputCode, email, profile, name } = {}) {
    const cleanCode = String(inputCode || "").trim().toUpperCase();
    if (!cleanCode) {
      return {
        ok: true,
        applied: false,
        code: "",
        discountPct: 0,
        amountInr: BASE_FEE_INR,
        amountPaise: BASE_FEE_PAISE,
      };
    }

    if (!configuredCode || cleanCode !== configuredCode) {
      return {
        ok: false,
        status: 400,
        error: "Invalid discount code.",
      };
    }

    const id = normalizeIdentity({ email, profile, name });
    const alreadyUsed = records.some(
      (r) =>
        r.code === configuredCode &&
        ((id.emailKey && r.emailKey === id.emailKey) ||
          (id.profileKey && r.profileKey === id.profileKey) ||
          (id.nameKey && r.nameKey === id.nameKey))
    );

    if (alreadyUsed) {
      return {
        ok: false,
        status: 409,
        error: `Discount code ${configuredCode} has already been used with your email or details.`,
      };
    }

    const discountedInr = Math.round((BASE_FEE_INR * (100 - DISCOUNT_PERCENT)) / 100);
    return {
      ok: true,
      applied: true,
      code: configuredCode,
      discountPct: DISCOUNT_PERCENT,
      amountInr: discountedInr,
      amountPaise: discountedInr * 100,
    };
  }

  function redeem({ code: inputCode, email, profile, name } = {}) {
    const check = validate({ code: inputCode, email, profile, name });
    if (!check.ok || !check.applied) return check;

    const id = normalizeIdentity({ email, profile, name });
    records.push({
      code: configuredCode,
      emailKey: id.emailKey,
      profileKey: id.profileKey,
      nameKey: id.nameKey,
      redeemedAt: new Date().toISOString(),
    });
    writeRecords(filePath, records);
    return check;
  }

  return { validate, redeem, getCode: () => configuredCode };
}
