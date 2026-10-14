import { isValidCategory } from "./categories.js";

const STORAGE_KEY = "spendwise-transactions-v1";
const BUDGET_KEY = "spendwise-budgets-v1";

// Some browsers and in-app previews block localStorage. When that happens
// the app keeps working from memory, and isStoragePersistent() lets the UI
// warn that the data will be lost on reload.
const memoryCopy = new Map();
let persistent = true;

export function isStoragePersistent() {
  return persistent;
}

function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.warn("Browser storage is not available:", error);
    persistent = false;
    return memoryCopy.get(key) ?? null;
  }
}

function writeStorage(key, text) {
  try {
    localStorage.setItem(key, text);
    persistent = true;
  } catch (error) {
    console.warn("Browser storage is not available:", error);
    persistent = false;
    memoryCopy.set(key, text);
  }
}

// --------------------------------------------------
// Transactions
// --------------------------------------------------

function hasValidShape(item) {
  return (
    item &&
    typeof item.id === "string" &&
    typeof item.description === "string" &&
    ["income", "expense"].includes(item.type) &&
    Number.isFinite(item.amount) &&
    item.amount > 0 &&
    typeof item.category === "string" &&
    typeof item.date === "string"
  );
}

// Older saves have no createdAt, and a few have a category that
// doesn't match their type (like income under "Food & dining").
// Fix both quietly so no data is lost.
function upgrade(item) {
  const hasTimestamp = Number.isFinite(item.createdAt);
  const hasValidCategory = isValidCategory(item.type, item.category);

  if (hasTimestamp && hasValidCategory) {
    return { item, changed: false };
  }

  return {
    item: {
      ...item,
      createdAt: hasTimestamp ? item.createdAt : Date.parse(item.date) || 0,
      category: hasValidCategory ? item.category : "Other"
    },
    changed: true
  };
}

export function loadTransactions() {
  try {
    const saved = readStorage(STORAGE_KEY);

    if (!saved) return [];

    const data = JSON.parse(saved);

    if (!Array.isArray(data)) return [];

    const results = data.filter(hasValidShape).map(upgrade);
    const transactions = results.map((result) => result.item);

    if (results.some((result) => result.changed)) {
      saveTransactions(transactions);
    }

    return transactions;
  } catch (error) {
    console.error("Could not load transactions:", error);
    return [];
  }
}

export function saveTransactions(transactions) {
  try {
    writeStorage(STORAGE_KEY, JSON.stringify(transactions));
    return true;
  } catch (error) {
    console.error("Could not save transactions:", error);
    return false;
  }
}

// --------------------------------------------------
// Budgets
// --------------------------------------------------

function isAmount(value) {
  return Number.isFinite(value) && value > 0;
}

export function sanitizeTransactions(data) {
  return data.filter(hasValidShape).map((item) => upgrade(item).item);
}

// Anything missing or invalid falls back to the default for that field.
export function sanitizeBudgets(saved, defaults) {
  if (!saved || typeof saved !== "object") return defaults;

  const limits = {};

  for (const [name, fallback] of Object.entries(defaults.limits)) {
    limits[name] = isAmount(saved.limits?.[name])
      ? saved.limits[name]
      : fallback;
  }

  return {
    total: isAmount(saved.total) ? saved.total : defaults.total,
    limits
  };
}

export function loadBudgets(defaults) {
  try {
    return sanitizeBudgets(JSON.parse(readStorage(BUDGET_KEY)), defaults);
  } catch (error) {
    console.error("Could not load budgets:", error);
    return defaults;
  }
}

export function saveBudgets(budgets) {
  try {
    writeStorage(BUDGET_KEY, JSON.stringify(budgets));
    return true;
  } catch (error) {
    console.error("Could not save budgets:", error);
    return false;
  }
}