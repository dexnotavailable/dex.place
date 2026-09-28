import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const proofRoot = "design/proof";

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
}

async function bypassIntro(page: Page) {
  await page.addInitScript(() => window.sessionStorage.setItem("dex:intro-seen", "1"));
}

async function seekChapter(page: Page, id: string, progress = 0) {
  await page.evaluate(
    ({ chapterId, chapterProgress }) => {
      const section = document.getElementById(chapterId);
      if (!section) throw new Error(`Missing chapter: ${chapterId}`);
      const travel = Math.max(0, section.offsetHeight - window.innerHeight);
      window.scrollTo(0, section.offsetTop + travel * chapterProgress);
    },
    { chapterId: id, chapterProgress: progress },
  );
  await page.waitForTimeout(850);
}

function watchConsole(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test("opening has an immediate exit and resolves into the exhibition", async ({ page }, testInfo) => {
  const errors = watchConsole(page);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Skip introduction" })).toBeVisible();
  await expect(page.getByLabel("dex", { exact: true })).toBeVisible();
  await page.screenshot({ path: `${proofRoot}/intro-${testInfo.project.name}.png` });
  await page.getByRole("button", { name: "Skip introduction" }).click();
  await expect(page.getByRole("button", { name: "Open site index" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("current exhibition keeps controls attached to their scenes", async ({ page }, testInfo) => {
  const errors = watchConsole(page);
  await bypassIntro(page);
  await page.goto("/");
  await settle(page);

  await page.evaluate(() => window.scrollTo({ top: 820, behavior: "auto" }));
  await page.waitForTimeout(650);

  await expect(page.getByRole("heading", { name: "dexCode" })).toBeVisible();
  await page.screenshot({ path: `${proofRoot}/home-${testInfo.project.name}.png` });
  await expect(page).toHaveScreenshot(`home-${testInfo.project.name}.png`, { fullPage: false });

  const composer = page.getByLabel("Ask the dexCode website preview to change the page");
  await expect(composer).toBeVisible();
  await composer.fill("play music");
  await composer.press("Enter");
  await expect(page.getByText("PLAYER PREVIEW")).toBeVisible({ timeout: 4_000 });

  await page.getByRole("button", { name: "Open site index" }).click();
  const index = page.getByRole("dialog", { name: "Site index" });
  await expect(index).toBeVisible();
  await expect(index.getByRole("link", { name: /02 SP13/ })).toBeVisible();
  await page.waitForTimeout(750);
  await page.screenshot({ path: `${proofRoot}/index-${testInfo.project.name}.png` });
  await page.getByRole("button", { name: "Close index" }).click();

  await seekChapter(page, "sp13", 0.82);
  await expect(page.getByText("VISION · IN DEVELOPMENT")).toBeVisible();
  await page.screenshot({ path: `${proofRoot}/sp13-home-${testInfo.project.name}.png` });

  await seekChapter(page, "artwork", 0.82);
  await expect(page.getByRole("button", { name: "EFFECTS" })).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: `${proofRoot}/artwork-home-${testInfo.project.name}.png` });

  await seekChapter(page, "vnmc");
  await expect(page.getByRole("link", { name: /VNMC LAN/ })).toBeVisible();
  await page.screenshot({ path: `${proofRoot}/vnmc-home-${testInfo.project.name}.png` });

  const viewportFits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  expect(viewportFits).toBe(true);

  expect(errors).toEqual([]);
});

test("project, artwork, and archive records are directly addressable", async ({ page }, testInfo) => {
  const errors = watchConsole(page);
  await bypassIntro(page);

  await page.goto("/projects/sp13");
  await expect(page.getByRole("heading", { name: "SP13" })).toBeVisible();
  await expect(page.getByText("VISION · IN DEVELOPMENT")).toBeVisible();
  await page.getByRole("button", { name: "VISION" }).click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${proofRoot}/sp13-record-${testInfo.project.name}.png` });

  await page.goto("/art/dex");
  await expect(page.getByRole("heading", { name: "DEX", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "EFFECTS" }).click();
  await expect(page.getByRole("button", { name: "EFFECTS" })).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${proofRoot}/art-dex-${testInfo.project.name}.png` });

  await page.goto("/archive/vnmc-lan");
  await expect(page.getByRole("heading", { name: "VNMC LAN" })).toBeVisible();
  await expect(page.getByText("DOCUMENTARY RECORD")).toBeVisible();
  await expect(page.getByText("~80M VND · 03 PROGRAMS")).toBeVisible();
  await page.screenshot({ path: `${proofRoot}/vnmc-record-${testInfo.project.name}.png` });
  expect(errors).toEqual([]);
});

test("all primary routes have no serious automated accessibility violations", async ({ page }) => {
  await bypassIntro(page);
  const routes = [
    "/",
    "/projects/dexcode",
    "/projects/sp13",
    "/art",
    "/art/dex",
    "/archive",
    "/archive/vnmc-lan",
    "/index",
    "/info",
  ];

  for (const route of routes) {
    await page.goto(route);
    await settle(page);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    const serious = results.violations.filter((violation) =>
      violation.impact === "critical" || violation.impact === "serious",
    );
    expect(serious, `serious accessibility violations on ${route}`).toEqual([]);
  }
});

test("chapter hashes and browser Back restore exhibition position", async ({ page }) => {
  await bypassIntro(page);
  await page.goto("/#artwork");
  await settle(page);
  await expect(page.locator("#artwork")).toBeInViewport();
  const storedPosition = await page.evaluate(() => window.scrollY);
  expect(storedPosition).toBeGreaterThan(1_000);

  await page.getByRole("button", { name: "Open site index" }).click();
  const index = page.getByRole("dialog", { name: "Site index" });
  await index.getByRole("link", { name: /02 SP13/ }).click();
  await expect(page).toHaveURL(/\/projects\/sp13$/);
  await expect(page.getByRole("heading", { name: "SP13" })).toBeFocused();
  await page.goBack();
  await expect(page).toHaveURL(/\/#artwork$/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(storedPosition - 100);
});

test("reduced motion preserves the same content and controls", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await bypassIntro(page);
  await page.goto("/");
  await page.evaluate(() => window.scrollTo({ top: 820, behavior: "auto" }));
  await expect(page.getByRole("heading", { name: "dexCode" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open site index" })).toBeVisible();
  await page.getByRole("button", { name: "Open site index" }).click();
  const index = page.getByRole("dialog", { name: "Site index" });
  await index.getByRole("link", { name: /02 SP13/ }).click();
  await expect(page).toHaveURL(/\/projects\/sp13$/);
  await expect(page.getByRole("heading", { name: "SP13" })).toBeVisible();
});
