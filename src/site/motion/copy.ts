// Copy buttons ([data-copy]); hidden without JS. Announces the result.

export function initCopy(): void {
  if (!document.querySelector("[data-copy]")) return;
  const live = document.createElement("div");
  live.className = "sr";
  live.setAttribute("aria-live", "polite");
  document.body.append(live);
  const say = (text: string): void => {
    live.textContent = "";
    requestAnimationFrame(() => (live.textContent = text));
  };

  document.addEventListener("click", (e) => {
    const button = (e.target as Element | null)?.closest<HTMLButtonElement>("[data-copy]");
    if (!button) return;
    const value = button.dataset.copy ?? "";
    navigator.clipboard.writeText(value).then(
      () => {
        button.classList.add("is-done");
        say("Copied");
        window.setTimeout(() => button.classList.remove("is-done"), 1600);
      },
      () => say("Copy failed. Select the text instead."),
    );
  });
}
