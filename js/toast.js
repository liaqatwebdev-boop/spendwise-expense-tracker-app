// Small pop-up messages in the bottom corner. Kinds: success, warning, error.
const stack = document.createElement("div");

stack.className = "toast-stack";
stack.setAttribute("role", "status");
stack.setAttribute("aria-live", "polite");
document.body.append(stack);

export function showToast(message, kind = "success") {
  const toast = document.createElement("div");

  toast.className = `toast is-${kind}`;
  toast.textContent = message;
  stack.append(toast);

  setTimeout(() => toast.remove(), 5000);
}