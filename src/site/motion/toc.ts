// Docs and blog articles (render/docs.ts). Loaded as its own chunk, only on
// pages with .prose. Everything here is an extra: without it the contents list
// is plain links and heading anchors are plain #links.
//
// - Scroll-spy: the "On this page" link for the section you are reading gets
//   aria-current="location", and a yellow key block glides behind it.
// - Heading anchors: clicking one also copies the section's full URL.
// - The compact disclosures on narrow screens close after you pick a link.

export function initToc(reduced: MediaQueryList): void {
  spy(reduced);
  anchors();
  for (const details of document.querySelectorAll<HTMLDetailsElement>("details.jump")) {
    details.addEventListener("click", (e) => {
      if ((e.target as Element | null)?.closest(".jump__panel a")) details.open = false;
    });
  }
}

function spy(reduced: MediaQueryList): void {
  const toc = document.querySelector<HTMLElement>("[data-toc]");
  const ind = toc?.querySelector<HTMLElement>(".dtoc__ind");
  if (!toc || !ind) return;
  const links = Array.from(toc.querySelectorAll<HTMLAnchorElement>('a[href^="#"]'));
  const targets = links
    .map((a) => document.getElementById(decodeURIComponent(a.hash.slice(1))))
    .filter((el): el is HTMLElement => el !== null);
  if (targets.length !== links.length || !targets.length) return;

  let current = -1;
  let raf = 0;
  const place = (i: number): void => {
    const a = links[i];
    if (!a || a.offsetParent === null) return;
    ind.style.setProperty("--y", `${a.offsetTop}px`);
    ind.style.setProperty("--h", `${a.offsetHeight}px`);
  };
  const update = (): void => {
    raf = 0;
    // The section being read is the last heading that has reached the top
    // third of the viewport; at the very bottom it is the last one.
    const line = Math.min(innerHeight * 0.33, 220);
    let i = 0;
    targets.forEach((el, n) => {
      if (el.getBoundingClientRect().top <= line) i = n;
    });
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) i = targets.length - 1;
    if (i === current) return;
    links[current]?.removeAttribute("aria-current");
    links[i]?.setAttribute("aria-current", "location");
    current = i;
    place(i);
  };
  const schedule = (): void => {
    if (!raf) raf = requestAnimationFrame(update);
  };

  // First placement without the glide, then let it move.
  ind.style.transition = "none";
  update();
  toc.setAttribute("data-ready", "");
  void ind.offsetWidth;
  ind.style.transition = "";
  if (reduced.matches) ind.style.transition = "none";

  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", () => {
    place(current);
    schedule();
  });
  void document.fonts?.ready.then(() => place(current));
}

function anchors(): void {
  document.addEventListener("click", (e) => {
    const a = (e.target as Element | null)?.closest<HTMLAnchorElement>(".prose a.anchor");
    if (!a || !navigator.clipboard) return;
    navigator.clipboard.writeText(a.href).then(
      () => {
        a.classList.add("is-copied");
        window.setTimeout(() => a.classList.remove("is-copied"), 1400);
      },
      () => undefined,
    );
  });
}
