import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // These checks exercise the browser without writing to any backend.
  await page.route(/https:\/\//, (route) => route.abort());
  await page.route(/http:\/\/[^/]+:(8080|9099|9199|5001)\//, (route) => route.abort());
});

test("original homepage renders on a first visit while Firebase is unavailable", async ({ page }) => {
  const failures = [];
  page.on("pageerror", (error) => failures.push(error.message));
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Promociones de la tienda" });
  await expect(carousel).toBeVisible();
  const image = carousel.locator('img[fetchpriority="high"]').first();
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((img) => img.complete && img.naturalWidth > 0)).toBeTruthy();
  expect(await image.getAttribute("srcset")).toContain(".webp");
  await page.waitForTimeout(5000);
  await expect(carousel).toBeVisible();
  expect(failures).toEqual([]);
});

test("mobile sizes keep navigation inside the viewport and close the menu with Escape", async ({ page }) => {
  for (const width of [320, 375, 768]) {
    await page.setViewportSize({ width, height: 850 });
    await page.goto("/");
    await expect(page.getByRole("region", { name: "Promociones de la tienda" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    const consent = page.getByRole("button", { name: "Entendido" });
    await expect(consent).toBeVisible();
    const consentBox = await consent.boundingBox();
    expect(consentBox.x + consentBox.width).toBeLessThanOrEqual(width);
    expect(consentBox.height).toBeGreaterThanOrEqual(44);
    const menu = page.getByRole("button", { name: "Abrir menú" });
    const box = await menu.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    await menu.click();
    await expect(page.getByRole("button", { name: "Cerrar menú" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
  }
});

test("horizontal swipe changes the 3D promotion without opening its image", async ({ page }) => {
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Promociones de la tienda" });
  await expect(carousel).toBeVisible();
  await carousel.getByRole("button", { name: "Pausar promociones" }).click();
  const box = await carousel.boundingBox();
  const session = await page.context().newCDPSession(page);
  const x = Math.round(box.x + box.width * 0.8), y = Math.round(box.y + box.height * 0.4);
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x - 140, y }] });
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(carousel.getByRole("button", { name: "Ver promoción 2", exact: true })).toHaveAttribute("aria-current", "true");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("returning from a product restores filters, loaded results and scroll position", async ({ page }) => {
  await page.addInitScript(() => {
    const products = Array.from({ length: 64 }, (_, index) => ({ id: `fixture-${index}`, slug: `fixture-${index}`, name: `Herramienta ${String(index).padStart(3, "0")}`, price: index + 1, isActive: true, images: ["/demo-product.svg"] }));
    sessionStorage.setItem("dalse_catalog_dalseshop", JSON.stringify({ products, expires: Date.now() + 300000 }));
  });
  await page.goto("/productos");
  await page.getByRole("textbox", { name: "Buscar en el catálogo" }).fill("Herramienta");
  await page.getByRole("combobox", { name: "Ordenar productos" }).selectOption("name");
  await page.getByRole("button", { name: "Cargar más productos" }).click();
  const product = page.getByRole("link", { name: "Herramienta 030", exact: true }).last();
  await product.scrollIntoViewIfNeeded();
  const scroll = await page.evaluate(() => scrollY);
  const url = page.url();
  await product.click();
  await expect(page).toHaveURL(/\/productos\/fixture-30/);
  await page.goBack();
  await expect(page).toHaveURL(url);
  await expect(page.getByRole("textbox", { name: "Buscar en el catálogo" })).toHaveValue("Herramienta");
  await expect(page.getByRole("combobox", { name: "Ordenar productos" })).toHaveValue("name");
  await expect(product).toBeVisible();
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(scroll - 60);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(scroll + 60);
});

test("upload optimization preserves transparency, proportions and small images", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { createImageVariants } = await import("/src/lib/imageVariants.mjs");
    async function file(width, height) {
      const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d"); ctx.fillStyle = "#ff0000"; ctx.fillRect(0, 0, width / 2, height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      return new File([blob], "original.png", { type: "image/png" });
    }
    const large = await createImageVariants(await file(2000, 1000));
    const variants = [];
    for (const variant of large.variants) {
      const bitmap = await createImageBitmap(variant.blob);
      const canvas = document.createElement("canvas"); canvas.width = bitmap.width; canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d"); ctx.drawImage(bitmap, 0, 0);
      variants.push({ width: bitmap.width, height: bitmap.height, type: variant.blob.type, alpha: ctx.getImageData(bitmap.width - 1, 0, 1, 1).data[3] });
      bitmap.close();
    }
    const small = await createImageVariants(await file(80, 40));
    const gif = await createImageVariants(new File(["GIF89a"], "animated.gif", { type: "image/gif" }));
    return { variants, small: small.variants.map((v) => v.width), gif };
  });
  expect(result.variants.map((v) => v.width)).toEqual([160, 480, 960, 1440, 1920]);
  for (const variant of result.variants) { expect(variant.height).toBe(variant.width / 2); expect(variant.alpha).toBe(0); expect(variant.type).toBe("image/webp"); }
  expect(result.small).toEqual([80]);
  expect(result.gif).toBeNull();
});

test("reduced motion disables automatic slide changes", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const first = page.getByRole("button", { name: "Ver promoción 1", exact: true });
  await expect(first).toHaveAttribute("aria-current", "true");
  await page.waitForTimeout(4000);
  await expect(first).toHaveAttribute("aria-current", "true");
  await page.getByRole("button", { name: "Promoción siguiente", exact: true }).click();
  await expect(page.getByRole("button", { name: "Ver promoción 2", exact: true })).toHaveAttribute("aria-current", "true");
});
