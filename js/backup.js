import { sanitizeBudgets, sanitizeTransactions } from "./storage.js";
import { sortTransactions } from "./transactions.js";

const BACKUP_VERSION = 1;

function csvCell(value) {
  let text = String(value);

  // A leading = + - @ would be run as a formula by Excel, so neutralise it.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;

  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function transactionsToCsv(transactions) {
  const rows = [
    ["Date", "Type", "Category", "Description", "Amount (PKR)"],
    ...sortTransactions(transactions).map((item) => [
      item.date,
      item.type,
      item.category,
      item.description,
      item.amount
    ])
  ];

  // The BOM makes Excel read the file as UTF-8.
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export function buildBackup(transactions, budgets) {
  return JSON.stringify(
    {
      app: "spendwise",
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      transactions,
      budgets
    },
    null,
    2
  );
}

// Returns clean data, or throws an Error whose message is safe to show.
export function readBackup(text, defaults) {
  let data;

  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error("This file is not valid JSON.");
  }

  if (data?.app !== "spendwise" || !Array.isArray(data.transactions)) {
    throw new Error("This is not a SpendWise backup file.");
  }

  const transactions = sanitizeTransactions(data.transactions);

  return {
    transactions,
    skipped: data.transactions.length - transactions.length,
    budgets: sanitizeBudgets(data.budgets, defaults)
  };
}

export function fileStamp() {
  return new Date().toLocaleDateString("en-CA");
}

export function downloadFile(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}