// Reveal on scroll. Elements with [data-reveal] start visible in the HTML;
// only `html.js` hides them (motion.css), and this marks each one `.is-in`
// once it enters the viewport. Variants and stagger (--i) live in CSS.

export function initReveal(): void {
  const items = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
  if (!items.length) return;
  if (!("IntersectionObserver" in window)) {
    for (const el of items) el.classList.add("is-in");
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      }
    },
    // Start a little before the element enters, so on a fast scroll content
    // is already landing as it comes into view instead of arriving late.
    { rootMargin: "0px 0px 10% 0px", threshold: 0 },
  );
  for (const el of items) io.observe(el);
}

// Idle loops outside the scenes and floats (the word band marquee, two-frame
// pixel stickers) rest while off screen: `.is-off` pauses them (motion.css).
export function initIdle(): void {
  if (!("IntersectionObserver" in window)) return;
  const items = document.querySelectorAll<Element>(".band, .px--anim");
  if (!items.length) return;
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) entry.target.classList.toggle("is-off", !entry.isIntersecting);
  });
  for (const el of items) io.observe(el);
}
