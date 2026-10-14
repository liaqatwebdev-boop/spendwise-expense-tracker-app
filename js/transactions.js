export const PAGE_SIZE = 8;

export function calculateTotals(transactions) {
  const income = transactions
    .filter((item) => item.type === "income")
    .reduce((total, item) => total + item.amount, 0);

  const expenses = transactions
    .filter((item) => item.type === "expense")
    .reduce((total, item) => total + item.amount, 0);

  return {
    income,
    expenses,
    balance: income - expenses,
    savingsRate: income > 0 ? ((income - expenses) / income) * 100 : 0
  };
}

export function formatPKR(amount) {
  return (
    "Rs. " +
    amount.toLocaleString("en-PK", {
      maximumFractionDigits: 2
    })
  );
}

// Newest date first. On the same date, the one added last comes first.
export function sortTransactions(transactions) {
  return [...transactions].sort(
    (a, b) =>
      b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0)
  );
}

function createActionButton(label, action, item) {
  const button = document.createElement("button");

  button.type = "button";
  button.className = `transaction-${action}-btn`;
  button.dataset.action = action;
  button.dataset.id = item.id;
  button.textContent = label;
  button.setAttribute("aria-label", `${label} ${item.description}`);

  return button;
}

function createRow(item) {
  const isIncome = item.type === "income";
  const row = document.createElement("tr");

  // Transaction name and icon
  const details = document.createElement("td");
  const detailsWrap = document.createElement("div");
  const icon = document.createElement("span");
  const textWrap = document.createElement("span");
  const name = document.createElement("strong");
  const note = document.createElement("small");

  detailsWrap.className = "transaction-name";
  icon.className = "transaction-icon " + (isIncome ? "salary" : "groceries");
  icon.textContent = isIncome ? "↙" : "↗";
  icon.setAttribute("aria-hidden", "true");
  name.textContent = item.description;
  note.textContent = isIncome ? "Income" : "Expense";

  textWrap.append(name, note);
  detailsWrap.append(icon, textWrap);
  details.append(detailsWrap);

  // Category and date
  const category = document.createElement("td");
  category.textContent = item.category;

  const date = document.createElement("td");
  date.textContent = item.date;

  // Amount
  const amount = document.createElement("td");
  amount.className =
    "amount " + (isIncome ? "income-amount" : "expense-amount");
  amount.textContent = `${isIncome ? "+" : "−"} ${formatPKR(item.amount)}`;

  // Status and actions
  const actionsCell = document.createElement("td");
  const actions = document.createElement("div");

  actions.className = "transaction-actions";
  actions.append(
    createActionButton("Edit", "edit", item),
    createActionButton("Delete", "delete", item)
  );
  actionsCell.append(actions);

  row.append(details, category, date, amount, actionsCell);
  return row;
}

// Draws one page of transactions and tells the caller which page
// was actually shown (the requested page may be past the end).
export function renderTransactions(transactions, requestedPage = 1) {
  const tbody = document.querySelector("#transactions tbody");

  const sorted = sortTransactions(transactions);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const result = { page, totalPages, total: sorted.length };

  if (!tbody) return result;

  tbody.replaceChildren();

  if (sorted.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");

    cell.colSpan = 5;
    cell.textContent = "No matching transactions found.";

    row.append(cell);
    tbody.append(row);
    return result;
  }

  const start = (page - 1) * PAGE_SIZE;

  for (const item of sorted.slice(start, start + PAGE_SIZE)) {
    tbody.append(createRow(item));
  }

  return result;
}

// --------------------------------------------------
// Month helpers (used by reports and charts)
// Months are plain "YYYY-MM" strings.
// --------------------------------------------------

export function monthKey(date) {
  return date.slice(0, 7);
}

export function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonth(key, offset) {
  const [year, month] = key.split("-").map(Number);
  const shifted = new Date(year, month - 1 + offset, 1);

  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}`;
}

export function formatMonth(key, style = "long") {
  const [year, month] = key.split("-").map(Number);

  return new Intl.DateTimeFormat("en", {
    month: style,
    year: style === "long" ? "numeric" : undefined
  }).format(new Date(year, month - 1, 1));
}

// Totals for one month plus expenses grouped by category (biggest first).
export function summariseMonth(transactions, key) {
  const inMonth = transactions.filter((item) => monthKey(item.date) === key);
  const spentByCategory = new Map();

  for (const item of inMonth) {
    if (item.type !== "expense") continue;

    spentByCategory.set(
      item.category,
      (spentByCategory.get(item.category) || 0) + item.amount
    );
  }

  const categories = [...spentByCategory]
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);

  return { ...calculateTotals(inMonth), categories, count: inMonth.length };
}