// Small accessibility fixes for the static HTML, plus a focus trap for dialogs.

export function setupAccessibility() {
  const main = document.querySelector(".main-content");

  main.id = "main-content";
  main.tabIndex = -1;

  const skipLink = document.createElement("a");
  skipLink.className = "skip-link";
  skipLink.href = "#main-content";
  skipLink.textContent = "Skip to main content";
  document.body.prepend(skipLink);

  // Decorative icons shouldn't be read out
  document
    .querySelectorAll(".brand-icon, .nav-icon, .card-icon")
    .forEach((icon) => icon.setAttribute("aria-hidden", "true"));

  document
    .querySelectorAll("#transactions th")
    .forEach((heading) => heading.setAttribute("scope", "col"));

  document
    .querySelector("#transactions table")
    ?.setAttribute("aria-label", "Transactions");

  // The sidebar highlight follows the link you click
  const links = document.querySelectorAll(".nav-link");

  function markActive(active) {
    for (const link of links) {
      link.classList.toggle("active", link === active);

      if (link === active) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    }
  }

  links.forEach((link) => {
    link.addEventListener("click", () => markActive(link));
  });

  markActive(document.querySelector(".nav-link.active"));
}

// Keeps Tab and Shift+Tab inside an open dialog.
export function trapFocus(overlay) {
  overlay.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;

    const focusable = [
      ...overlay.querySelectorAll("button, input, select, a[href]")
    ].filter((element) => !element.disabled);

    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
}