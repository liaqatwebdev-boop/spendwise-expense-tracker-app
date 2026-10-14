import {
  loadTransactions,
  saveTransactions,
  loadBudgets,
  saveBudgets,
  isStoragePersistent
} from "./storage.js";

import {
  calculateTotals,
  renderTransactions,
  formatPKR,
  formatMonth,
  summariseMonth
} from "./transactions.js";

import { initReports, renderReports } from "./charts.js";
import { setupTheme } from "./theme.js";
import { setupAccessibility, trapFocus } from "./a11y.js";
import { getBudgetAlerts, setupBudgetSettings } from "./budget.js";
import { setupDataTools } from "./datatools.js";
import { showToast } from "./toast.js";

import {
  CATEGORIES,
  categoriesFor,
  defaultBudgets,
  isValidCategory
} from "./categories.js";

const formPanel = document.querySelector("#transaction-form-panel");
const form = document.querySelector("#transaction-form");
const message = document.querySelector("#form-message");

const typeInput = document.querySelector("#transaction-type");
const descriptionInput = document.querySelector("#transaction-description");
const amountInput = document.querySelector("#transaction-amount");
const categoryInput = document.querySelector("#transaction-category");
const dateInput = document.querySelector("#transaction-date");

const addButton = document.querySelector("#add-transaction");
const closeButton = document.querySelector("#close-transaction-form");
const cancelButton = document.querySelector("#cancel-transaction");

const searchInput = document.querySelector("#transaction-search");
const typeFilter = document.querySelector("#transaction-filter");
const categoryFilter = document.querySelector("#category-filter");
const tbody = document.querySelector("#transactions tbody");
const tableWrap = document.querySelector("#transactions .table-wrap");

const submitButton = form.querySelector('[type="submit"]');
const formTitle = formPanel.querySelector(".panel-heading h3");
const formDescription = formPanel.querySelector(".panel-heading p");

let transactions = loadTransactions();
let budgets = loadBudgets(defaultBudgets());
let currentPage = 1;
let selectedMonth = getCurrentMonthString();
let chartRange = 6;
let editingId = null;
let pendingDeleteId = null;
let previousFocusedElement = null;

// --------------------------------------------------
// Pagination controls
// --------------------------------------------------

const pager = document.createElement("div");
const pagerInfo = document.createElement("span");
const previousButton = document.createElement("button");
const nextButton = document.createElement("button");

pager.className = "form-actions";
pagerInfo.className = "muted";

previousButton.type = "button";
previousButton.className = "select-btn";
previousButton.textContent = "Previous";

nextButton.type = "button";
nextButton.className = "select-btn";
nextButton.textContent = "Next";

pager.append(pagerInfo, previousButton, nextButton);

function renderPager({ page, totalPages, total }) {
  // One page needs no controls
  if (totalPages <= 1) {
    pager.remove();
    return;
  }

  pagerInfo.textContent = `Page ${page} of ${totalPages} · ${total} transactions`;
  previousButton.disabled = page <= 1;
  nextButton.disabled = page >= totalPages;

  if (!pager.isConnected) {
    tableWrap.after(pager);
  }
}

// --------------------------------------------------
// Delete confirmation modal
// --------------------------------------------------

const deleteModal = document.createElement("div");

deleteModal.className = "sw-modal-overlay";
deleteModal.id = "delete-confirm-modal";
deleteModal.hidden = true;

deleteModal.innerHTML = `
  <section
    class="sw-modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="sw-modal-title"
    aria-describedby="sw-modal-description"
    tabindex="-1"
  >
    <div class="sw-modal-icon" aria-hidden="true">
      <span>!</span>
    </div>

    <h2 id="sw-modal-title">Delete transaction?</h2>

    <p id="sw-modal-description">
      Are you sure you want to delete this transaction?
      This action cannot be undone.
    </p>

    <div class="sw-modal-transaction">
      <span class="sw-modal-transaction-label">Transaction</span>
      <strong id="sw-delete-name"></strong>
      <strong id="sw-delete-amount"></strong>
    </div>

    <div class="sw-modal-actions">
      <button type="button" class="sw-cancel-btn" id="sw-cancel-delete">
        Cancel
      </button>

      <button type="button" class="sw-delete-btn" id="sw-confirm-delete">
        Delete transaction
      </button>
    </div>
  </section>
`;

document.body.append(deleteModal);
trapFocus(deleteModal);

const deleteName = deleteModal.querySelector("#sw-delete-name");
const deleteAmount = deleteModal.querySelector("#sw-delete-amount");
const cancelDeleteButton = deleteModal.querySelector("#sw-cancel-delete");
const confirmDeleteButton = deleteModal.querySelector("#sw-confirm-delete");

// --------------------------------------------------
// Monthly budget summary styles
// --------------------------------------------------

const budgetStyle = document.createElement("style");

budgetStyle.textContent = `
  .sw-budget-live-summary {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin: 16px 0;
  }

  .sw-budget-live-card {
    min-width: 0;
    padding: 14px;
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 12px;
    background: var(--card-background, #ffffff);
  }

  .sw-budget-live-label {
    display: block;
    margin-bottom: 8px;
    color: var(--muted-color, #6b7280);
    font-size: 12px;
  }

  .sw-budget-live-value {
    display: block;
    overflow-wrap: anywhere;
    font-size: clamp(14px, 2.5vw, 20px);
    font-weight: 700;
  }

  .sw-budget-live-card.is-remaining .sw-budget-live-value {
    color: #16a34a;
  }

  .sw-budget-live-card.is-over-budget .sw-budget-live-value {
    color: #dc2626;
  }

  @media (max-width: 380px) {
    .sw-budget-live-summary {
      grid-template-columns: 1fr;
    }
  }
`;

document.head.append(budgetStyle);

// --------------------------------------------------
// Setup budget summary
// --------------------------------------------------

function setupBudgetSummary() {
  const budgetPanel = document.querySelector("#budgets");

  if (!budgetPanel) return;

  let summary = budgetPanel.querySelector(".sw-budget-live-summary");

  if (!summary) {
    summary = document.createElement("div");
    summary.className = "sw-budget-live-summary";

    summary.innerHTML = `
      <div class="sw-budget-live-card">
        <span class="sw-budget-live-label" id="sw-spent-label">Spent this month</span>
        <strong class="sw-budget-live-value" id="sw-monthly-spent">
          Rs. 0
        </strong>
      </div>

      <div class="sw-budget-live-card is-remaining">
        <span class="sw-budget-live-label" id="sw-remaining-label">
          Remaining budget
        </span>
        <strong class="sw-budget-live-value" id="sw-remaining-budget">
          ${formatPKR(budgets.total)}
        </strong>
      </div>
    `;

    const budgetTotal = budgetPanel.querySelector(".budget-total");

    if (budgetTotal) {
      budgetTotal.insertAdjacentElement("afterend", summary);
    } else {
      budgetPanel.prepend(summary);
    }
  }

  const totalBudgetHeading = budgetPanel.querySelector(".budget-total h2");

  if (totalBudgetHeading) {
    totalBudgetHeading.textContent = formatPKR(budgets.total);
  }
}

// --------------------------------------------------
// Date helpers
// --------------------------------------------------

function todayString() {
  const now = new Date();

  const localDate = new Date(
    now.getTime() - now.getTimezoneOffset() * 60000
  );

  return localDate.toISOString().slice(0, 10);
}

function getCurrentMonthString() {
  const now = new Date();

  return `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}`;
}

// --------------------------------------------------
// Update overall and category budgets
// --------------------------------------------------

function renderBudgetAlerts(budgetPanel) {
  let list = budgetPanel.querySelector(".budget-alerts");

  if (!list) {
    list = document.createElement("ul");
    list.className = "budget-alerts";
    list.setAttribute("role", "status");
    budgetPanel.querySelector(".sw-budget-live-summary").after(list);
  }

  const alerts = getBudgetAlerts(transactions, selectedMonth, budgets);

  list.hidden = alerts.length === 0;

  list.replaceChildren(
    ...alerts.map((alert) => {
      const item = document.createElement("li");

      item.className = `budget-alert is-${alert.level}`;
      item.textContent = alert.message;

      return item;
    })
  );
}

// Pop-up for any budget that just crossed 80% or 100% because of this save.
function announceNewAlerts(before, after, month) {
  const levelsBefore = new Map(
    getBudgetAlerts(before, month, budgets).map((alert) => [
      alert.label,
      alert.level
    ])
  );

  for (const alert of getBudgetAlerts(after, month, budgets)) {
    if (levelsBefore.get(alert.label) === alert.level) continue;

    showToast(alert.message, alert.level === "over" ? "error" : "warning");
  }
}

function updateBudget() {
  setupBudgetSummary();

  const budgetPanel = document.querySelector("#budgets");

  if (!budgetPanel) return;

  renderBudgetAlerts(budgetPanel);

  const currentMonth = selectedMonth;

  const monthlyExpenses = transactions.filter((item) => {
    return (
      item.type === "expense" &&
      item.date &&
      item.date.slice(0, 7) === currentMonth
    );
  });

  const spent = monthlyExpenses.reduce(
    (total, item) => total + Number(item.amount || 0),
    0
  );

  const remaining = budgets.total - spent;
  const percentage = (spent / budgets.total) * 100;
  const visualPercentage = Math.min(100, Math.max(0, percentage));

  const spentElement = budgetPanel.querySelector("#sw-monthly-spent");
  const remainingElement = budgetPanel.querySelector("#sw-remaining-budget");
  const remainingLabel = budgetPanel.querySelector("#sw-remaining-label");
  const remainingCard = remainingElement?.closest(".sw-budget-live-card");

  const spentLabel = budgetPanel.querySelector("#sw-spent-label");

  if (spentLabel) {
    spentLabel.textContent =
      selectedMonth === getCurrentMonthString()
        ? "Spent this month"
        : `Spent in ${formatMonth(selectedMonth)}`;
  }

  if (spentElement) {
    spentElement.textContent = formatPKR(spent);
  }

  if (remainingElement && remainingLabel && remainingCard) {
    if (remaining < 0) {
      remainingLabel.textContent = "Over budget by";
      remainingElement.textContent = formatPKR(Math.abs(remaining));

      remainingCard.classList.remove("is-remaining");
      remainingCard.classList.add("is-over-budget");
    } else {
      remainingLabel.textContent = "Remaining budget";
      remainingElement.textContent = formatPKR(remaining);

      remainingCard.classList.remove("is-over-budget");
      remainingCard.classList.add("is-remaining");
    }
  }

  // Overall budget ring
  const ringPercentage = budgetPanel.querySelector(
    ".budget-ring .ring-inner strong"
  );

  if (ringPercentage) {
    ringPercentage.textContent = `${percentage.toFixed(1)}%`;
  }

  const budgetRing = budgetPanel.querySelector(".budget-ring");

  if (budgetRing) {
    budgetRing.style.background = `
      conic-gradient(
        var(--green) ${visualPercentage}%,
        var(--ring-track, #e5e7eb) ${visualPercentage}% 100%
      )
    `;

    budgetRing.setAttribute(
      "aria-label",
      `${percentage.toFixed(1)} percent of monthly budget used`
    );
  }

  // Category progress bars. Limits come from the saved budgets
  const categoryRows = budgetPanel.querySelectorAll(
    ".budget-progress[data-budget-category]"
  );

  categoryRows.forEach((row) => {
    const category = row.dataset.budgetCategory;
    const categoryBudget = budgets.limits[category];

    if (!categoryBudget) return;

    const categorySpent = monthlyExpenses
      .filter((item) => item.category === category)
      .reduce((total, item) => total + Number(item.amount || 0), 0);

    const categoryRemaining = categoryBudget - categorySpent;
    const categoryPercentage = (categorySpent / categoryBudget) * 100;
    const categoryVisualPercentage = Math.min(
      100,
      Math.max(0, categoryPercentage)
    );

    const amountElement = row.querySelector(".progress-label strong");

    if (amountElement) {
      amountElement.textContent = formatPKR(categorySpent);
    }

    const progressBar = row.querySelector(".progress-track i");

    if (progressBar) {
      progressBar.style.width = `${categoryVisualPercentage}%`;
      progressBar.style.background =
        categoryPercentage > 100 ? "#dc2626" : "";

      progressBar.setAttribute(
        "aria-label",
        `${categoryPercentage.toFixed(1)} percent of ${category} budget used`
      );
    }

    const footerLabels = row.querySelectorAll(".progress-foot span");

    if (footerLabels.length >= 2) {
      footerLabels[0].textContent =
        categoryPercentage > 100
          ? `${categoryPercentage.toFixed(1)}% used — over budget`
          : `${categoryPercentage.toFixed(1)}% used`;

      footerLabels[1].textContent =
        categoryRemaining < 0
          ? `${formatPKR(Math.abs(categoryRemaining))} over budget`
          : `${formatPKR(categoryBudget)} budget`;
    }
  });
}

// --------------------------------------------------
// Form helpers
// --------------------------------------------------

// The category list depends on the transaction type, so income
// can't end up under "Food & dining" and expenses can't be "Salary".
function fillFormCategories(type, selected) {
  const names = categoriesFor(type).map((category) => category.name);

  categoryInput.replaceChildren(
    ...names.map((name) => new Option(name, name))
  );

  categoryInput.value = names.includes(selected) ? selected : names[0];
}

function resetFormFields() {
  form.reset();
  fillFormCategories("expense");
  dateInput.value = todayString();
}

function resetFormMode() {
  editingId = null;
  formTitle.textContent = "Add transaction";
  formDescription.textContent = "Record your income or an expense.";
  submitButton.textContent = "Save transaction";
}

function showForm() {
  resetFormMode();
  resetFormFields();

  formPanel.hidden = false;
  message.textContent = "";

  formPanel.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });

  descriptionInput.focus();
}

function hideForm() {
  formPanel.hidden = true;
  resetFormFields();
  message.textContent = "";
  resetFormMode();
}

// --------------------------------------------------
// Search and filters
// --------------------------------------------------

function getFilteredTransactions() {
  const searchText = searchInput.value.trim().toLowerCase();
  const selectedType = typeFilter.value;
  const selectedCategory = categoryFilter.value;
  const { from, to } = dataTools.getDateRange();

  return transactions.filter((item) => {
    const matchesSearch =
      item.description.toLowerCase().includes(searchText);

    const matchesType =
      selectedType === "all" || item.type === selectedType;

    const matchesCategory =
      selectedCategory === "all" ||
      item.category === selectedCategory;

    const matchesDate =
      (!from || item.date >= from) && (!to || item.date <= to);

    return matchesSearch && matchesType && matchesCategory && matchesDate;
  });
}

function fillCategoryFilter() {
  categoryFilter.replaceChildren(
    new Option("All categories", "all"),
    ...CATEGORIES.map((category) => new Option(category.name, category.name))
  );
}

// --------------------------------------------------
// Dashboard updates
// --------------------------------------------------

// The balance covers everything ever recorded. Income, expenses and the
// savings rate follow the month chosen in the month picker.
function renderSummaryCards() {
  const cards = document.querySelectorAll(".summary-card");

  if (cards.length < 4) return;

  const allTime = calculateTotals(transactions);
  const month = summariseMonth(transactions, selectedMonth);
  const monthName = formatMonth(selectedMonth);

  const values = [
    formatPKR(allTime.balance),
    formatPKR(month.income),
    formatPKR(month.expenses),
    `${month.savingsRate.toFixed(1)}%`
  ];

  const titles = [null, "Income", "Expenses", "Savings rate"];

  cards.forEach((card, index) => {
    card.querySelector("h2").textContent = values[index];

    if (titles[index]) {
      card.querySelector(".card-top span:first-child").textContent = titles[index];
      card.querySelector(".card-note span:last-child").textContent = monthName;
    }
  });
}

function updateDashboard() {
  renderSummaryCards();

  const result = renderTransactions(getFilteredTransactions(), currentPage);

  currentPage = result.page;
  renderPager(result);
  updateBudget();
  renderReports(transactions, selectedMonth, chartRange);
}

function showFirstPage() {
  currentPage = 1;
  updateDashboard();
}

// --------------------------------------------------
// Edit transactions
// --------------------------------------------------

function editTransaction(id) {
  const item = transactions.find((transaction) => transaction.id === id);

  if (!item) return;

  editingId = item.id;

  formPanel.hidden = false;
  formTitle.textContent = "Edit transaction";
  formDescription.textContent = "Update the transaction details.";
  submitButton.textContent = "Update transaction";

  typeInput.value = item.type;
  fillFormCategories(item.type, item.category);
  descriptionInput.value = item.description;
  amountInput.value = item.amount;
  dateInput.value = item.date;
  message.textContent = "";

  formPanel.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });

  descriptionInput.focus();
}

// --------------------------------------------------
// Delete confirmation modal
// --------------------------------------------------

function openDeleteModal(item) {
  pendingDeleteId = item.id;
  previousFocusedElement = document.activeElement;

  deleteName.textContent = item.description;
  deleteAmount.textContent =
    `${item.type === "income" ? "+" : "−"} ${formatPKR(item.amount)}`;

  deleteModal.hidden = false;
  document.body.classList.add("sw-modal-open");

  confirmDeleteButton.disabled = false;
  confirmDeleteButton.textContent = "Delete transaction";

  cancelDeleteButton.focus();
}

function closeDeleteModal() {
  deleteModal.hidden = true;
  document.body.classList.remove("sw-modal-open");
  pendingDeleteId = null;

  if (previousFocusedElement?.isConnected) {
    previousFocusedElement.focus();
  }
}

function confirmDeleteTransaction() {
  if (!pendingDeleteId) return;

  const id = pendingDeleteId;
  const item = transactions.find((transaction) => transaction.id === id);

  if (!item) {
    closeDeleteModal();
    return;
  }

  const updatedTransactions = transactions.filter(
    (transaction) => transaction.id !== id
  );

  confirmDeleteButton.disabled = true;
  confirmDeleteButton.textContent = "Deleting...";

  if (!saveTransactions(updatedTransactions)) {
    confirmDeleteButton.disabled = false;
    confirmDeleteButton.textContent = "Delete transaction";

    deleteModal.hidden = true;
    document.body.classList.remove("sw-modal-open");
    pendingDeleteId = null;

    message.textContent =
      "Could not delete this transaction. Please try again.";

    formPanel.hidden = false;
    return;
  }

  transactions = updatedTransactions;

  if (editingId === id) {
    hideForm();
  }

  closeDeleteModal();
  updateDashboard();
}

// --------------------------------------------------
// Event listeners
// --------------------------------------------------

addButton.addEventListener("click", showForm);
closeButton.addEventListener("click", hideForm);
cancelButton.addEventListener("click", hideForm);

typeInput.addEventListener("change", () => {
  fillFormCategories(typeInput.value);
});

searchInput.addEventListener("input", showFirstPage);
typeFilter.addEventListener("change", showFirstPage);
categoryFilter.addEventListener("change", showFirstPage);

previousButton.addEventListener("click", () => {
  currentPage -= 1;
  updateDashboard();
});

nextButton.addEventListener("click", () => {
  currentPage += 1;
  updateDashboard();
});

// Handle Edit and Delete buttons
tbody.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action][data-id]");

  if (!button || !tbody.contains(button)) return;

  const { action, id } = button.dataset;

  if (action === "edit") {
    editTransaction(id);
  } else if (action === "delete") {
    const item = transactions.find(
      (transaction) => transaction.id === id
    );

    if (item) openDeleteModal(item);
  }
});

cancelDeleteButton.addEventListener("click", closeDeleteModal);
confirmDeleteButton.addEventListener("click", confirmDeleteTransaction);

deleteModal.addEventListener("click", (event) => {
  if (event.target === deleteModal) {
    closeDeleteModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !deleteModal.hidden) {
    closeDeleteModal();
  }
});

// --------------------------------------------------
// Save or update transactions
// --------------------------------------------------

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const description = descriptionInput.value.trim();
  const amount = Math.round(Number(amountInput.value) * 100) / 100;
  const date = dateInput.value;
  const type = typeInput.value;
  const category = categoryInput.value;

  if (!description || description.length > 80) {
    message.textContent =
      "Please enter a description (maximum 80 characters).";
    return;
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    message.textContent = "Enter an amount greater than zero.";
    return;
  }

  if (!["income", "expense"].includes(type)) {
    message.textContent = "Please select a valid transaction type.";
    return;
  }

  if (!isValidCategory(type, category)) {
    message.textContent = "Please select a valid category for this type.";
    return;
  }

  if (
    !date ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(Date.parse(date)) ||
    date > todayString()
  ) {
    message.textContent =
      "Please enter a valid date that is not in the future.";
    return;
  }

  const existingTransaction = editingId
    ? transactions.find((item) => item.id === editingId)
    : null;

  if (editingId && !existingTransaction) {
    message.textContent =
      "Transaction not found. Please close and try again.";
    return;
  }

  const transaction = {
    id: editingId ||
      globalThis.crypto?.randomUUID?.() ||
      `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    description,
    amount,
    type,
    category,
    date,
    createdAt: existingTransaction?.createdAt ?? Date.now()
  };

  const updatedTransactions = editingId
    ? transactions.map((item) =>
        item.id === editingId ? transaction : item
      )
    : [transaction, ...transactions];

  if (!saveTransactions(updatedTransactions)) {
    message.textContent =
      "Could not save. Check browser storage and try again.";
    return;
  }

  if (type === "expense") {
    announceNewAlerts(transactions, updatedTransactions, date.slice(0, 7));
  }

  transactions = updatedTransactions;

  const wasEditing = Boolean(editingId);

  resetFormMode();
  showFirstPage();
  resetFormFields();

  message.textContent = wasEditing
    ? "Transaction updated successfully!"
    : "Transaction saved successfully!";

  if (!isStoragePersistent()) {
    message.textContent +=
      " Browser storage is blocked here, so it will be lost when you reload.";
  }
});

// --------------------------------------------------
// Initialize app
// --------------------------------------------------

const dateLabel = document.querySelector("#today-date");

if (dateLabel) {
  dateLabel.textContent = new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric"
  }).format(new Date());
}

setupTheme();
setupAccessibility();

fillCategoryFilter();
resetFormFields();

initReports({
  onMonthChange(month) {
    selectedMonth = month;
    updateDashboard();
  },
  onRangeChange(range) {
    chartRange = range;
    updateDashboard();
  }
});

setupBudgetSettings({
  trigger: document.querySelector("#budgets .more-btn"),
  getBudgets: () => budgets,
  getDefaults: defaultBudgets,
  onSave(next) {
    if (!saveBudgets(next)) return false;

    budgets = next;
    updateDashboard();
    return true;
  }
});

const dataTools = setupDataTools({
  anchor: document.querySelector(".transaction-tools"),
  onDateChange: showFirstPage,
  getVisible: getFilteredTransactions,
  getBackupData: () => ({ transactions, budgets }),
  getDefaults: defaultBudgets,
  onRestore(backup) {
    if (!saveTransactions(backup.transactions) || !saveBudgets(backup.budgets)) {
      return false;
    }

    transactions = backup.transactions;
    budgets = backup.budgets;
    currentPage = 1;
    updateDashboard();
    return true;
  }
});

updateDashboard();