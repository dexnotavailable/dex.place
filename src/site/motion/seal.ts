// The press seal (site loop v3 round 5, the "alive" touch; styles/components.css .seal): a key, card or link pressed on the
// home page leaves a little pixel hanko in its section's tone where the pointer came down; it thumps down and fades out
// over 1.5 s, then is gone. Pointer-driven only: nothing runs while the page scrolls or rests. Reduced motion: none.
const PRESSABLE = "a, button, .btn, .card, .pcard, .dlf, .ftr__chip";

export function initSeal(reduced: MediaQueryList): void {
  if (!document.querySelector(".sheet--home")) return;
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (reduced.matches || e.button !== 0 || !(e.target instanceof Element)) return;
      const hit = e.target.closest(PRESSABLE);
      if (!hit || !hit.closest(".sheet--home")) return;
      const tone = getComputedStyle(hit).getPropertyValue("--band-tone").trim();
      const seal = document.createElement("i");
      seal.className = "seal";
      seal.setAttribute("aria-hidden", "true");
      seal.style.left = `${Math.round(e.clientX)}px`;
      seal.style.top = `${Math.round(e.clientY)}px`;
      if (tone) seal.style.setProperty("--seal", tone);
      seal.style.setProperty("--seal-r", `${Math.round(Math.random() * 16 - 11)}deg`);
      const gone = (): void => seal.remove();
      seal.addEventListener("animationend", gone, { once: true });
      setTimeout(gone, 1800);
      document.body.append(seal);
    },
    { passive: true },
  );
}
