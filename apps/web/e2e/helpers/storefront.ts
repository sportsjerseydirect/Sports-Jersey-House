import { expect, type Page } from "@playwright/test";

export const WELCOME_DISMISS_KEY = "sjh_welcome_lead_dismissed";

export const SAMPLE_PRODUCTS = {
  nhlDefaultTitle: "/products/nhl-connor-mcdavid-western-all-star-97-jersey",
  mlbColour: "/products/mlb-edouard-julien-minnesota-twins-47-jersey",
  soccer: "/products/alexander-isak-newcastle-united-fc-14-jersey"
} as const;

/** Prevent first-visit offer modal from blocking purchase flows in E2E. */
export async function dismissWelcomeOffer(page: Page): Promise<void> {
  await page.addInitScript((key) => {
    try {
      window.localStorage.setItem(key, "1");
    } catch {
      // ignore
    }
  }, WELCOME_DISMISS_KEY);
}

export async function closeWelcomeOfferIfVisible(page: Page): Promise<void> {
  const close = page.getByRole("button", { name: /^close$/i });
  if (await close.count()) {
    await close.first().click({ timeout: 1500 }).catch(() => undefined);
  }
}

export async function selectSizeOnPdp(page: Page, sizeLabel?: string): Promise<void> {
  const sizeGroup = page.getByRole("radiogroup", { name: /select size/i });
  await expect(sizeGroup).toBeVisible({ timeout: 15000 });

  const pickSize = async (): Promise<void> => {
    let sizeChoice = sizeLabel
      ? sizeGroup.getByRole("radio", { name: sizeLabel, exact: true })
      : sizeGroup.getByRole("radio").first();

    if (sizeLabel && (await sizeChoice.count()) === 0) {
      sizeChoice = sizeGroup.getByRole("radio").first();
    }

    await sizeChoice.scrollIntoViewIfNeeded();
    await sizeChoice.click({ force: true });
    await expect(sizeChoice).toHaveAttribute("aria-checked", "true", { timeout: 5000 });
  };

  await expect(pickSize).toPass({ timeout: 20_000 });
}

export async function addProductFromPdp(
  page: Page,
  slug: string,
  options: {
    size?: string;
    customisation?: { name?: string; number?: string; message?: string };
    selectColour?: boolean;
  } = {}
): Promise<void> {
  await dismissWelcomeOffer(page);
  await page.goto(slug, { waitUntil: "domcontentloaded" });
  await closeWelcomeOfferIfVisible(page);

  const colourGroup = page.getByRole("radiogroup", { name: /select colour/i });
  if (options.selectColour !== false && (await colourGroup.count())) {
    await colourGroup.getByRole("radio").first().click();
  }

  await selectSizeOnPdp(page, options.size ?? "M/Men's");

  if (options.customisation) {
    await page.getByRole("radiogroup", { name: /^Customisation$/i }).getByRole("radio", { name: /^Yes/i }).click();
    if (options.customisation.name) {
      await page.getByLabel(/^Name$/i).fill(options.customisation.name);
    }
    if (options.customisation.number) {
      await page.getByLabel(/^Number$/i).fill(options.customisation.number);
    }
    if (options.customisation.message) {
      await page.getByLabel(/any message/i).fill(options.customisation.message);
    }
  }

  await page.getByRole("button", { name: /add to cart/i }).click();
  await expect(page.getByText(/added to cart/i)).toBeVisible({ timeout: 15000 });
}

export async function addFirstCatalogProduct(page: Page): Promise<void> {
  await addProductFromPdp(page, SAMPLE_PRODUCTS.nhlDefaultTitle);
}
