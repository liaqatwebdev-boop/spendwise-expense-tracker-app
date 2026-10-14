import {
  buildBackup,
  downloadFile,
  fileStamp,
  readBackup,
  transactionsToCsv
} from "./backup.js";

import { showToast } from "./toast.js";

// Adds a toolbar under the search filters: a date range on the left and
// export / backup / restore buttons on the right.
export function setupDataTools({
  anchor,
  onDateChange,
  getVisible,
  getBackupData,
  getDefaults,
  onRestore
}) {
  const tools = document.createElement("div");

  tools.className = "data-tools";

  tools.innerHTML = `
    <div class="date-range">
      <label>From <input type="date" id="range-from"></label>
      <label>To <input type="date" id="range-to"></label>
      <button type="button" class="select-btn" id="range-clear">
        Clear dates
      </button>
    </div>

    <div class="data-actions">
      <button type="button" class="select-btn" id="export-csv">Export CSV</button>
      <button type="button" class="select-btn" id="backup-data">Backup</button>
      <button type="button" class="select-btn" id="restore-data">Restore</button>
      <input type="file" id="restore-file" accept="application/json,.json" hidden>
    </div>
  `;

  anchor.after(tools);

  const fromInput = tools.querySelector("#range-from");
  const toInput = tools.querySelector("#range-to");
  const fileInput = tools.querySelector("#restore-file");

  // While a year is being typed the browser reports 0002, then 0020, then
  // 0202... Wait for a real year so the list doesn't redraw on every key.
  function isFinished(value) {
    return value === "" || value >= "1900-01-01";
  }

  function dateChanged() {
    if (isFinished(fromInput.value) && isFinished(toInput.value)) {
      onDateChange();
    }
  }

  fromInput.addEventListener("change", dateChanged);
  toInput.addEventListener("change", dateChanged);

  tools.querySelector("#range-clear").addEventListener("click", () => {
    fromInput.value = "";
    toInput.value = "";
    dateChanged();
  });

  // Exports everything the filters currently match, not just the open page.
  tools.querySelector("#export-csv").addEventListener("click", () => {
    const visible = getVisible();

    if (visible.length === 0) {
      showToast("There are no transactions to export.", "warning");
      return;
    }

    downloadFile(
      `spendwise-transactions-${fileStamp()}.csv`,
      transactionsToCsv(visible),
      "text/csv;charset=utf-8"
    );

    showToast(`Exported ${visible.length} transactions.`);
  });

  tools.querySelector("#backup-data").addEventListener("click", () => {
    const { transactions, budgets } = getBackupData();

    downloadFile(
      `spendwise-backup-${fileStamp()}.json`,
      buildBackup(transactions, budgets),
      "application/json"
    );

    showToast("Backup downloaded.");
  });

  tools.querySelector("#restore-data").addEventListener("click", () => {
    fileInput.click();
  });

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];

    if (!file) return;

    try {
      const backup = readBackup(await file.text(), getDefaults());
      const count = backup.transactions.length;

      const confirmed = window.confirm(
        `Replace your current data with this backup (${count} transactions)? ` +
          "This cannot be undone."
      );

      if (!confirmed) return;

      if (!onRestore(backup)) {
        throw new Error("Could not save the restored data.");
      }

      showToast(
        backup.skipped > 0
          ? `Restored ${count} transactions. ${backup.skipped} invalid entries were skipped.`
          : `Restored ${count} transactions.`
      );
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      fileInput.value = "";
    }
  });

  return {
    // If the dates are entered the wrong way round, treat them as a range anyway
    getDateRange() {
      const from = fromInput.value;
      const to = toInput.value;

      return from && to && from > to ? { from: to, to: from } : { from, to };
    }
  };
}