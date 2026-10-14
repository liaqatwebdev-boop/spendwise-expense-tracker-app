// Single source of truth for categories and budget limits.
// Add or rename a category here and the form, filters and
// budget bars all pick it up.

export const MONTHLY_BUDGET = 50000;

export const CATEGORIES = [
  { name: "Food & dining", kind: "expense", limit: 20000 },
  { name: "Transport", kind: "expense", limit: 10000 },
  { name: "Shopping", kind: "expense", limit: 10000 },
  { name: "Bills", kind: "expense", limit: 5000 },
  { name: "Health", kind: "expense", limit: 2500 },
  { name: "Salary", kind: "income" },
  { name: "Freelance", kind: "income" },
  { name: "Other", kind: "both", limit: 2500 }
];

export function categoriesFor(type) {
  return CATEGORIES.filter(
    (category) => category.kind === type || category.kind === "both"
  );
}

export function getCategory(name) {
  return CATEGORIES.find((category) => category.name === name);
}

export function isValidCategory(type, name) {
  return categoriesFor(type).some((category) => category.name === name);
}

// The starting budget: the total plus one limit per budgeted category.
// Users can change these later, and their version is saved in storage.js.
export function defaultBudgets() {
  const limits = {};

  for (const category of CATEGORIES) {
    if (category.limit) limits[category.name] = category.limit;
  }

  return { total: MONTHLY_BUDGET, limits };
}