import { CATEGORIES } from "./categories.js";

import {
  currentMonthKey,
  formatMonth,
  formatPKR,
  monthKey,
  shiftMonth,
  summariseMonth
} from "./transactions.js";

const SVG_NS = "http://www.w3.org/2000/svg";

const CATEGORY_COLORS = [
  "#19a875", "#8171df", "#f0a44b", "#e76b70",
  "#4aa3df", "#d68fd6", "#6b7a90", "#8bc34a"
];

// The report styles live in their own file, loaded from here so
// index.htm doesn't need another link. The path is relative to index.htm.
const stylesheet = document.createElement("link");
stylesheet.rel = "stylesheet";
stylesheet.href = "charts.css";
document.head.append(stylesheet);

let monthSelect;
let rangeSelect;
let chartBox;
let reportStats;
let reportPeriod;
let donutPeriod;
let donutBox;
let donutLegend;

// --------------------------------------------------
// Small helpers
// --------------------------------------------------

function svg(tag, attributes = {}, text) {
  const element = document.createElementNS(SVG_NS, tag);

  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }

  if (text !== undefined) element.textContent = text;

  return element;
}

function colorFor(categoryName) {
  const index = CATEGORIES.findIndex((item) => item.name === categoryName);

  return CATEGORY_COLORS[Math.max(0, index) % CATEGORY_COLORS.length];
}

// 2500 -> "2.5k", 1200000 -> "1.2M"
function compact(value) {
  if (value >= 1000000) return `${+(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${+(value / 1000).toFixed(1)}k`;

  return String(Math.round(value));
}

// Rounds the tallest bar up to a clean number so the y-axis reads well.
function niceMax(value) {
  if (value <= 0) return 4000;

  const rough = value / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10]
    .map((multiplier) => multiplier * magnitude)
    .find((candidate) => candidate >= rough);

  return step * 4;
}

function daysInMonth(key) {
  const [year, month] = key.split("-").map(Number);

  return new Date(year, month, 0).getDate();
}

// --------------------------------------------------
// Setup: swaps the static placeholders for working controls
// and adds the report section under the cash flow / budget row.
// --------------------------------------------------

export function initReports({ onMonthChange, onRangeChange }) {
  const period = document.querySelector(".period-select");
  const periodDot = period.querySelector(".period-dot");

  monthSelect = document.createElement("select");
  monthSelect.id = "report-month";
  monthSelect.setAttribute("aria-label", "Choose month");
  period.replaceChildren(periodDot, monthSelect);

  rangeSelect = document.createElement("select");
  rangeSelect.id = "chart-range";
  rangeSelect.className = "select-btn";
  rangeSelect.setAttribute("aria-label", "Cash flow range");

  for (const months of [3, 6, 12]) {
    rangeSelect.append(new Option(`Last ${months} months`, months));
  }

  rangeSelect.value = "6";
  document.querySelector("#analytics .select-btn").replaceWith(rangeSelect);
  chartBox = document.querySelector("#analytics .chart");

  const section = document.createElement("section");
  section.className = "content-grid";

  section.innerHTML = `
    <article class="panel" id="reports">
      <div class="panel-heading">
        <div>
          <h3>Monthly report</h3>
          <p id="report-period"></p>
        </div>
      </div>
      <div class="report-stats" id="report-stats"></div>
    </article>

    <article class="panel" id="category-chart">
      <div class="panel-heading">
        <div>
          <h3>Spending by category</h3>
          <p id="donut-period"></p>
        </div>
      </div>
      <div class="donut-wrap">
        <div id="donut"></div>
        <ul class="donut-legend" id="donut-legend"></ul>
      </div>
    </article>
  `;

  document.querySelector(".content-grid").after(section);

  reportStats = section.querySelector("#report-stats");
  reportPeriod = section.querySelector("#report-period");
  donutPeriod = section.querySelector("#donut-period");
  donutBox = section.querySelector("#donut");
  donutLegend = section.querySelector("#donut-legend");

  monthSelect.addEventListener("change", () => {
    onMonthChange(monthSelect.value);
  });

  rangeSelect.addEventListener("change", () => {
    onRangeChange(Number(rangeSelect.value));
  });
}

// --------------------------------------------------
// Rendering
// --------------------------------------------------

export function renderReports(transactions, month, range) {
  const current = summariseMonth(transactions, month);
  const previous = summariseMonth(transactions, shiftMonth(month, -1));

  syncMonthOptions(transactions, month);
  renderStats(current, previous, month);
  renderCashFlow(transactions, month, range);
  renderDonut(current, month);
}

// The picker lists every month that has data, plus this month
// and whichever month is currently selected.
function syncMonthOptions(transactions, selected) {
  const months = new Set([currentMonthKey(), selected]);

  for (const item of transactions) {
    months.add(monthKey(item.date));
  }

  const keys = [...months].sort().reverse();
  const shown = [...monthSelect.options].map((option) => option.value);

  if (shown.join() !== keys.join()) {
    monthSelect.replaceChildren(
      ...keys.map((key) => new Option(formatMonth(key), key))
    );
  }

  monthSelect.value = selected;
}

function compareNote(now, before, beforeKey) {
  const name = formatMonth(beforeKey);

  if (before === 0) return now === 0 ? "" : `No spending in ${name}`;

  const change = ((now - before) / before) * 100;

  if (Math.abs(change) < 0.05) return `Same as ${name}`;

  return `${Math.abs(change).toFixed(1)}% ${change > 0 ? "more" : "less"} than ${name}`;
}

function renderStats(current, previous, month) {
  const previousKey = shiftMonth(month, -1);
  const daysCounted =
    month === currentMonthKey() ? new Date().getDate() : daysInMonth(month);
  const top = current.categories[0];

  let netTone = "";
  if (current.balance > 0) netTone = "is-positive";
  if (current.balance < 0) netTone = "is-negative";

  const stats = [
    { label: "Income", value: formatPKR(current.income) },
    {
      label: "Expenses",
      value: formatPKR(current.expenses),
      note: compareNote(current.expenses, previous.expenses, previousKey)
    },
    { label: "Net savings", value: formatPKR(current.balance), tone: netTone },
    {
      label: "Savings rate",
      value: current.income > 0 ? `${current.savingsRate.toFixed(1)}%` : "—"
    },
    {
      label: "Top spending",
      value: top ? top.name : "—",
      note: top
        ? `${formatPKR(top.amount)} · ${Math.round((top.amount / current.expenses) * 100)}% of expenses`
        : "No expenses yet"
    },
    {
      label: "Daily average",
      value: formatPKR(current.expenses / daysCounted),
      note: "Expenses per day"
    }
  ];

  reportPeriod.textContent =
    `${formatMonth(month)} · ${current.count} ${current.count === 1 ? "transaction" : "transactions"}`;

  reportStats.replaceChildren(
    ...stats.map(({ label, value, note, tone = "" }) => {
      const card = document.createElement("div");
      const labelText = document.createElement("span");
      const valueText = document.createElement("strong");

      card.className = `report-stat ${tone}`.trim();
      labelText.className = "muted";
      labelText.textContent = label;
      valueText.textContent = value;
      card.append(labelText, valueText);

      if (note) {
        const noteText = document.createElement("small");
        noteText.textContent = note;
        card.append(noteText);
      }

      return card;
    })
  );
}

function renderCashFlow(transactions, month, range) {
  const keys = Array.from({ length: range }, (_, index) =>
    shiftMonth(month, index - range + 1)
  );

  const months = keys.map((key) => ({
    key,
    ...summariseMonth(transactions, key)
  }));

  const highest = Math.max(
    ...months.map((item) => Math.max(item.income, item.expenses))
  );
  const top = niceMax(highest);

  const width = 640;
  const height = 210;
  const left = 44;
  const right = 8;
  const topPadding = 8;
  const bottom = 24;
  const plotWidth = width - left - right;
  const plotHeight = height - topPadding - bottom;

  const chart = svg("svg", {
    viewBox: `0 0 ${width} ${height}`,
    role: "img",
    "aria-label": `Income and expenses for the last ${range} months`
  });

  // Horizontal grid with y-axis labels
  for (let step = 0; step <= 4; step++) {
    const y = topPadding + plotHeight - (plotHeight * step) / 4;

    chart.append(
      svg("line", { x1: left, x2: width - right, y1: y, y2: y, class: "chart-grid-line" }),
      svg(
        "text",
        { x: left - 8, y: y + 3, "text-anchor": "end", class: "chart-axis-label" },
        compact((top * step) / 4)
      )
    );
  }

  const slot = plotWidth / range;
  const barWidth = Math.min(18, slot * 0.28);

  months.forEach((item, index) => {
    const centre = left + slot * index + slot / 2;
    const selected = item.key === month ? " is-selected" : "";

    const bars = [
      { kind: "income", value: item.income, x: centre - barWidth - 2 },
      { kind: "expense", value: item.expenses, x: centre + 2 }
    ];

    for (const bar of bars) {
      const barHeight = (bar.value / top) * plotHeight;

      const rect = svg("rect", {
        x: bar.x,
        y: topPadding + plotHeight - barHeight,
        width: barWidth,
        height: barHeight,
        rx: 3,
        class: `chart-bar-${bar.kind}${selected}`
      });

      rect.append(
        svg("title", {}, `${formatMonth(item.key)} ${bar.kind}: ${formatPKR(bar.value)}`)
      );

      chart.append(rect);
    }

    chart.append(
      svg(
        "text",
        { x: centre, y: height - 6, "text-anchor": "middle", class: "chart-axis-label" },
        formatMonth(item.key, "short")
      )
    );
  });

  chartBox.replaceChildren(chart);
}

function renderDonut(current, month) {
  const radius = 60;
  const circumference = 2 * Math.PI * radius;

  const chart = svg("svg", {
    viewBox: "0 0 160 160",
    role: "img",
    "aria-label": `Spending by category for ${formatMonth(month)}`
  });

  chart.append(
    svg("circle", { cx: 80, cy: 80, r: radius, fill: "none", "stroke-width": 22, class: "donut-track" })
  );

  let offset = 0;

  for (const category of current.categories) {
    const length = (category.amount / current.expenses) * circumference;

    const arc = svg("circle", {
      cx: 80,
      cy: 80,
      r: radius,
      fill: "none",
      stroke: colorFor(category.name),
      "stroke-width": 22,
      "stroke-dasharray": `${length} ${circumference - length}`,
      "stroke-dashoffset": -offset,
      transform: "rotate(-90 80 80)"
    });

    arc.append(svg("title", {}, `${category.name}: ${formatPKR(category.amount)}`));
    chart.append(arc);
    offset += length;
  }

  chart.append(
    svg("text", { x: 80, y: 76, "text-anchor": "middle", class: "donut-caption" }, "Spent"),
    svg("text", { x: 80, y: 94, "text-anchor": "middle", class: "donut-total" }, `Rs. ${compact(current.expenses)}`)
  );

  donutBox.replaceChildren(chart);
  donutPeriod.textContent = formatMonth(month);

  if (current.categories.length === 0) {
    const empty = document.createElement("li");

    empty.className = "muted";
    empty.textContent = "No expenses recorded this month.";
    donutLegend.replaceChildren(empty);
    return;
  }

  donutLegend.replaceChildren(
    ...current.categories.map((category) => {
      const item = document.createElement("li");
      const dot = document.createElement("i");
      const name = document.createElement("span");
      const amount = document.createElement("span");
      const percent = document.createElement("span");

      dot.className = "donut-dot";
      dot.style.background = colorFor(category.name);
      name.className = "legend-name";
      name.textContent = category.name;
      amount.className = "legend-amount";
      amount.textContent = formatPKR(category.amount);
      percent.className = "legend-percent";
      percent.textContent = `${Math.round((category.amount / current.expenses) * 100)}%`;

      item.append(dot, name, amount, percent);
      return item;
    })
  );
}