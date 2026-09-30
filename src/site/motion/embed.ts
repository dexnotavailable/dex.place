/** Carry the framed mode through page links, never asset/download URLs. */
export function embedHref(href: string, current: string): string | null {
  if (!href || href.startsWith("#")) return null;
  const here = new URL(current);
  const url = new URL(href, here);
  if (url.origin !== here.origin || !(url.pathname === "/" || /^\/(docs|gallery|downloads|donate|blog|projects)(\/|$)/.test(url.pathname))) return null;
  if (/\.[^/]+$/.test(url.pathname) || url.pathname === "/" && url.hash === "#world") return null;
  url.searchParams.set("embed", "world");
  return url.pathname + url.search + url.hash;
}

export function initEmbed(): void {
  if (document.documentElement.dataset.embed !== "world") return;
  const apply = (link: HTMLAnchorElement): void => {
    if (link.target && link.target !== "_self" || link.hasAttribute("download")) return;
    const raw = link.getAttribute("href") ?? "";
    const url = new URL(raw, location.href);
    if (url.origin === location.origin && url.pathname === "/" && url.hash === "#world") {
      link.setAttribute("href", "/world/");
      link.target = "_top";
      return;
    }
    const href = embedHref(raw, location.href);
    if (href) link.setAttribute("href", href);
  };
  // The gallery caches its piece URLs during initialization, before a click.
  for (const link of document.querySelectorAll<HTMLAnchorElement>("a[href]")) apply(link);
  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const link = target?.closest<HTMLAnchorElement>("a[href]");
    if (link) apply(link);
  });
}
