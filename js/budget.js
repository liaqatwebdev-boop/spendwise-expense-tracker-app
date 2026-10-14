import { trapFocus } from "./a11y.js";
import { CATEGORIES } from "./categories.js";

const budgetedCategories = CATEGORIES.filter((category) => category.limit);

// Wires the "•••" button in the budget panel to a settings dialog.
// The dialog only edits numbers; saving and redrawing is up to onSave.
export function setupBudgetSettings({
  trigger,
  getBudgets,
  getDefaults,
  onSave
}) {
  const overlay = document.createElement("div");

  overlay.className = "sw-modal-overlay";
  overlay.hidden = true;

  overlay.innerHTML = `
    <section
      class="sw-modal budget-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="budget-modal-title"
      tabindex="-1"
    >
      <h2 id="budget-modal-title">Budget settings</h2>
      <p>Set your monthly spending limits in PKR.</p>

      <form id="budget-form" novalidate>
        <label class="budget-field">
          <span>Total monthly budget</span>
          <input id="budget-total" type="number" min="1" step="1" required>
        </label>

        <div class="budget-field-grid" id="budget-categories"></div>

        <p class="budget-error" id="budget-error" role="alert"></p>

        <div class="sw-modal-actions">
          <button type="button" class="sw-cancel-btn" id="budget-cancel">
            Cancel
          </button>
          <button type="submit" class="budget-save-btn">Save budget</button>
        </div>

        <button type="button" class="budget-reset-btn" id="budget-reset">
          Reset to defaults
        </button>
      </form>
    </section>
  `;

  document.body.append(overlay);
  trapFocus(overlay);

  const form = overlay.querySelector("#budget-form");
  const totalInput = overlay.querySelector("#budget-total");
  const fieldGrid = overlay.querySelector("#budget-categories");
  const errorText = overlay.querySelector("#budget-error");

  const limitInputs = budgetedCategories.map((category) => {
    const label = document.createElement("label");
    const name = document.createElement("span");
    const input = document.createElement("input");

    label.className = "budget-field";
    name.textContent = category.name;

    input.type = "number";
    input.name = category.name;
    input.min = "1";
    input.step = "1";
    input.required = true;

    label.append(name, input);
    fieldGrid.append(label);

    return input;
  });

  function fillForm(budgets) {
    totalInput.value = budgets.total;

    for (const input of limitInputs) {
      input.value = budgets.limits[input.name];
    }
  }

  function open() {
    fillForm(getBudgets());
    errorText.textContent = "";

    overlay.hidden = false;
    document.body.classList.add("sw-modal-open");
    totalInput.focus();
  }

  function close() {
    overlay.hidden = true;
    document.body.classList.remove("sw-modal-open");
    trigger.focus();
  }

  trigger.setAttribute("aria-label", "Edit budget limits");
  trigger.setAttribute("aria-haspopup", "dialog");
  trigger.title = "Edit budget limits";

  trigger.addEventListener("click", open);
  overlay.querySelector("#budget-cancel").addEventListener("click", close);

  overlay.querySelector("#budget-reset").addEventListener("click", () => {
    fillForm(getDefaults());
    errorText.textContent = "";
  });

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !overlay.hidden) close();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const values = [totalInput, ...limitInputs].map((input) =>
      Number(input.value)
    );

    if (values.some((value) => !Number.isFinite(value) || value <= 0)) {
      errorText.textContent = "Enter an amount greater than zero in every field.";
      return;
    }

    const limits = {};

    for (const input of limitInputs) {
      limits[input.name] = Math.round(Number(input.value));
    }

    const saved = onSave({
      total: Math.round(Number(totalInput.value)),
      limits
    });

    if (!saved) {
      errorText.textContent = "Could not save the budget. Please try again.";
      return;
    }

    close();
  });
}

// Budgets at 80% or more (overall, or per category) for one month.
export function getBudgetAlerts(transactions, month, budgets) {
  const spentByCategory = {};
  let totalSpent = 0;

  for (const item of transactions) {
    if (item.type !== "expense" || item.date.slice(0, 7) !== month) continue;

    totalSpent += item.amount;
    spentByCategory[item.category] =
      (spentByCategory[item.category] || 0) + item.amount;
  }

  const checks = [
    { label: "Overall budget", spent: totalSpent, limit: budgets.total },
    ...Object.entries(budgets.limits).map(([name, limit]) => ({
      label: name,
      spent: spentByCategory[name] || 0,
      limit
    }))
  ];

  return checks
    .map((check) => ({ ...check, percent: (check.spent / check.limit) * 100 }))
    .filter((check) => check.percent >= 80)
    .map((check) => {
      const over = check.percent >= 100;
      const used = Math.round(check.percent);

      return {
        label: check.label,
        level: over ? "over" : "warning",
        message: over
          ? `${check.label}: over budget (${used}% used)`
          : `${check.label}: ${used}% of budget used`
      };
    });
}