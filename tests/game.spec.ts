import { test, expect, type Page } from "@playwright/test";
const tile =
  '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#ececde"/><path d="M0 42L256 211 M82 0L148 256" stroke="#a9c8da" stroke-width="16"/><path d="M0 145L256 85" stroke="#fff" stroke-width="10"/><path d="M0 145L256 85" stroke="#e7bb72" stroke-width="2"/><circle cx="30" cy="30" r="17" fill="#bdcda3"/></svg>';
async function fixture(page: Page) {
  await page.route("https://tiles.openfreemap.org/styles/liberty", (r) =>
    r.fulfill({
      json: {
        version: 8,
        sources: {
          fixture: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
          },
        },
        layers: [
          { id: "map", type: "raster", source: "fixture" },
          {
            id: "labels",
            type: "symbol",
            source: "fixture",
            layout: { "text-field": "TEXT MUST BE REMOVED" },
          },
        ],
      },
    }),
  );
  await page.route("https://tile.openstreetmap.org/**", (r) =>
    r.fulfill({
      body: tile,
      contentType: "image/svg+xml",
      headers: { "access-control-allow-origin": "*" },
    }),
  );
  await page.route("https://fonts.googleapis.com/**", (r) => r.abort());
  await page.route("https://fonts.gstatic.com/**", (r) => r.abort());
}
async function ready(page: Page) {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Rotate square 1", exact: true }),
  ).toBeEnabled();
}
test.beforeEach(async ({ page }) => {
  await fixture(page);
});
test("renders nine cropped squares and responsive geometry", async ({
  page,
}) => {
  await ready(page);
  await expect(page.locator(".tile")).toHaveCount(9);
  const board = await page.locator(".board").boundingBox();
  expect(board).not.toBeNull();
  expect(Math.abs(board!.width - board!.height)).toBeLessThan(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const box = await page.locator(".tile").first().boundingBox();
  expect(box!.width).toBeGreaterThan(85);
  await expect(page.locator(".map-square").nth(8)).toHaveCSS(
    "background-position",
    "100% 100%",
  );
  await expect(page.locator(".map-square").first()).toHaveCSS(
    "background-size",
    "300% 300%",
  );
});
test("clockwise, shift-click and keyboard rotations count real moves", async ({
  page,
}) => {
  await ready(page);
  const t = page.locator(".map-square").first();
  const before = await t.getAttribute("style");
  await page
    .getByRole("button", { name: "Rotate square 1", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Rotate square 1", exact: true })
    .click({ modifiers: ["Shift"] });
  expect(await t.getAttribute("style")).toBe(before);
  await expect(page.locator(".stats")).toContainText("02");
  await page
    .getByRole("button", { name: "Rotate square 1", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Space");
  await expect(page.locator(".stats")).toContainText("04");
});
test("solve detects completion and locks the board; shuffle resets", async ({
  page,
}) => {
  await ready(page);
  for (let i = 0; i < 9; i++) {
    const style = await page
      .locator(".map-square")
      .nth(i)
      .getAttribute("style");
    const angle = Number(style!.match(/rotate\((-?\d+)deg/)![1]);
    for (let n = 0; n < (4 - ((angle / 90) % 4)) % 4; n++)
      await page
        .getByRole("button", { name: `Rotate square ${i + 1}`, exact: true })
        .click();
  }
  await expect(page.locator(".outcome")).toContainText("Everything connects");
  await expect(page.locator(".tile").first()).toBeDisabled();
  await page.getByRole("button", { name: "New shuffle" }).click();
  await expect(page.locator(".tile").first()).toBeEnabled();
  await expect(page.locator(".stats")).toContainText("00");
});
test("peek preserves turns, disables moves and marks assistance", async ({
  page,
}) => {
  await ready(page);
  const style = await page.locator(".map-square").first().getAttribute("style");
  await page.getByRole("button", { name: "Peek at map" }).click();
  await expect(page.locator(".tile").first()).toBeDisabled();
  for (const el of await page.locator(".map-square").all())
    expect(await el.getAttribute("style")).toContain("rotate(0deg)");
  await page.getByRole("button", { name: "Back to puzzle" }).click();
  expect(await page.locator(".map-square").first().getAttribute("style")).toBe(
    style,
  );
  for (let i = 0; i < 9; i++) {
    const tileStyle = await page
      .locator(".map-square")
      .nth(i)
      .getAttribute("style");
    const angle = Number(tileStyle.match(/rotate\((-?\d+)deg/)[1]);
    for (let n = 0; n < (4 - ((angle / 90) % 4)) % 4; n++) {
      await page
        .getByRole("button", { name: `Rotate square ${i + 1}`, exact: true })
        .click();
    }
  }
  await expect(page.locator(".outcome")).toContainText("with a peek");
});
test("coordinates, scale, preset and reload persist the selected map", async ({
  page,
}) => {
  await ready(page);
  await page.getByLabel("Start somewhere").fill("-33.86, 151.2");
  await page.getByRole("button", { name: "Search location" }).click();
  await expect(page.locator("h2")).toHaveText("-33.8600, 151.2000");
  await expect(page.locator(".game-heading p")).toContainText("33.8600° S");
  await page.getByLabel("Distance per square").selectOption("1000");
  await expect(page).toHaveURL(/m=1000/);
  await page.reload();
  await expect(page.locator("h2")).toHaveText("-33.8600, 151.2000");
  await expect(page.getByLabel("Distance per square")).toHaveValue("1000");
  await page.getByRole("button", { name: "Bern · River bend" }).click();
  await expect(page.locator("h2")).toHaveText("Bern · River bend");
});
test("address results require selection and support multiple matches", async ({
  page,
}) => {
  await page.route("https://photon.komoot.io/**", (r) =>
    r.fulfill({
      json: {
        features: [
          {
            properties: {
              name: "Test Street",
              city: "Bern",
              country: "Switzerland",
            },
            geometry: { coordinates: [7.44, 46.94] },
          },
          {
            properties: { name: "Test Street", city: "Zurich" },
            geometry: { coordinates: [8.54, 47.37] },
          },
        ],
      },
    }),
  );
  await ready(page);
  await page.getByLabel("Start somewhere").fill("Test Street");
  await page.getByRole("button", { name: "Search location" }).click();
  await expect(page.locator(".results button")).toHaveCount(2);
  await expect(page.locator("h2")).toHaveText("Prague · Old Town");
  await page
    .getByRole("button", { name: "Test Street · Bern · Switzerland" })
    .click();
  await expect(page.locator("h2")).toHaveText(
    "Test Street · Bern · Switzerland",
  );
});
test("invalid coordinates, empty search and no matches are explained", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("button", { name: "Search location" }).click();
  await expect(page.getByRole("alert")).toContainText("Enter a place");
  await page.getByLabel("Start somewhere").fill("90, 0");
  await page.getByRole("button", { name: "Search location" }).click();
  await expect(page.getByRole("alert")).toContainText("−85 and 85");
  await page.route("https://photon.komoot.io/**", (r) =>
    r.fulfill({ json: { features: [] } }),
  );
  await page.getByLabel("Start somewhere").fill("Nowhere");
  await page.getByRole("button", { name: "Search location" }).click();
  await expect(page.getByRole("alert")).toContainText("No places found");
});
test("map failure has a functioning retry", async ({ page }) => {
  await page.route("https://tile.openstreetmap.org/**", (r) => r.abort());
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText(
    "Map tiles could not be loaded",
  );
  await fixture(page);
  await page.getByRole("button", { name: "Retry map" }).click();
  await expect(page.locator(".tile").first()).toBeEnabled();
});
test("search failure leaves current puzzle usable", async ({ page }) => {
  await page.route("https://photon.komoot.io/**", (r) =>
    r.fulfill({ status: 503, body: "unavailable" }),
  );
  await ready(page);
  await page.getByLabel("Start somewhere").fill("Bern");
  await page.getByRole("button", { name: "Search location" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Address search is unavailable",
  );
  await expect(page.locator(".tile").first()).toBeEnabled();
});
test("stale address response cannot override a preset", async ({ page }) => {
  let release: () => void = () => {};
  const pending = new Promise<void>((r) => {
    release = r;
  });
  await page.route("https://photon.komoot.io/**", async (r) => {
    await pending;
    await r.fulfill({ json: { features: [] } }).catch(() => {});
  });
  await ready(page);
  await page.getByLabel("Start somewhere").fill("Slow");
  await page.getByRole("button", { name: "Search location" }).click();
  await page.getByRole("button", { name: "Venice · Canals" }).click();
  release();
  await expect(page.locator("h2")).toHaveText("Venice · Canals");
  await expect(
    page.getByRole("button", { name: "Search location" }),
  ).toBeEnabled();
  await expect(page.locator(".results")).toHaveCount(0);
});
test("invalid shared links fall back safely", async ({ page }) => {
  await page.goto("/#lat=99&lon=181&m=0");
  await expect(page.locator("h2")).toHaveText("Prague · Old Town");
  await expect(page.locator(".tile").first()).toBeEnabled();
});
test("sharing gives useful feedback", async ({ page }) => {
  await ready(page);
  await page.getByRole("button", { name: "Share place" }).click();
  await expect(page.locator(".outcome")).toContainText(
    /Link copied|Copy the address bar/,
  );
});

test("version links work under the Pages subpath", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Space Bunny’s version" }).click();
  await expect(page).toHaveURL(/\/space-bunny\/$/);
  await expect(page.locator("h1")).toHaveText("maptcha");
  await page.getByRole("link", { name: "Original version" }).click();
  await expect(page.locator(".brand")).toContainText("maptcha");
});

test("changing location cancels stalled style resources and removes the old renderer", async ({
  page,
}) => {
  let release: () => void = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("https://fixtures.invalid/slow.json", async (route) => {
    await pending;
    await route
      .fulfill({
        json: { tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"] },
      })
      .catch(() => {});
  });
  await page.route("https://tiles.openfreemap.org/styles/liberty", (route) =>
    route.fulfill({
      json: {
        version: 8,
        sources: {
          fixture: {
            type: "raster",
            url: "https://fixtures.invalid/slow.json",
            tileSize: 256,
          },
        },
        layers: [{ id: "map", type: "raster", source: "fixture" }],
      },
    }),
  );
  await page.goto("/");
  await expect(page.locator("[data-map-renderer]")).toHaveCount(1);
  await fixture(page);
  await page.getByRole("button", { name: "Bern · River bend" }).click();
  await expect(page.locator(".tile")).toHaveCount(9);
  await expect(page.locator("[data-map-renderer]")).toHaveCount(0);
  release();
  await expect(page.locator("h2")).toHaveText("Bern · River bend");
});
