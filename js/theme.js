const THEME_KEY = "spendwise-theme";

function savedTheme() {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch (error) {
    return null;
  }
}

function saveTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (error) {
    // Not saving is fine, the choice just won't survive a reload.
  }
}

function preferredTheme() {
  const saved = savedTheme();

  if (saved === "light" || saved === "dark") return saved;

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

// Loads theme.css, applies the saved (or system) theme and adds the
// toggle button next to "Add transaction".
export function setupTheme() {
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = "theme.css";
  document.head.append(stylesheet);

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "select-btn";
  toggle.id = "theme-toggle";

  const browserColor = document.querySelector('meta[name="theme-color"]');
  let theme = preferredTheme();

  function applyTheme() {
    document.documentElement.dataset.theme = theme;
    browserColor?.setAttribute("content", theme === "dark" ? "#0c1420" : "#101827");

    toggle.textContent = theme === "dark" ? "☀ Light mode" : "☾ Dark mode";
    toggle.setAttribute("aria-pressed", String(theme === "dark"));
  }

  toggle.addEventListener("click", () => {
    theme = theme === "dark" ? "light" : "dark";
    saveTheme(theme);
    applyTheme();
  });

  applyTheme();
  document.querySelector("#add-transaction").before(toggle);
}