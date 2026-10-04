import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:5173");
await page.locator(".tile").first().waitFor({ timeout: 30000 });
await page.screenshot({ path: "docs/evidence/desktop.png", fullPage: true });
await page.getByRole("button", { name: "Peek at map" }).click();
await page.screenshot({
  path: "docs/evidence/complete-map.png",
  fullPage: true,
});
await page.getByLabel("Start somewhere").fill("Zurich");
await page.getByRole("button", { name: "Search location" }).click();
await page.locator(".results button").first().waitFor({ timeout: 30000 });
const address = await page.locator(".results button").first().textContent();
await page.locator(".results button").first().click();
await page.locator(".tile").first().waitFor({ timeout: 30000 });
await page.getByLabel("Distance per square").selectOption("1000");
await page.locator(".tile").first().waitFor({ timeout: 30000 });
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: "docs/evidence/mobile.png", fullPage: true });
const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth > innerWidth,
);
console.log(
  JSON.stringify({
    address,
    errors,
    overflow,
    tiles: await page.locator(".tile").count(),
  }),
);
await browser.close();
