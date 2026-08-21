import { and, eq, inArray, isNull } from "drizzle-orm";
import { createDatabaseClient } from "./client";
import { emailSubscribers, marketingLeads, orders } from "./schema-commerce";
import { marketingOffers } from "./schema-ops";

function resolveDatabaseUrl(databaseUrl?: string): string {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required for offer operations.");
  }
  return url;
}

export type MarketingOfferSnapshot = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  percentOff: string | null;
  amountOff: string | null;
  currencyCode: string;
  isActive: boolean;
  requiresLeadCapture: boolean;
  firstOrderOnly: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
};

export type Welcome10Eligibility = {
  eligible: boolean;
  offer: MarketingOfferSnapshot | null;
  reasons: string[];
  checks: {
    offerActive: boolean;
    requiresLeadCapture: boolean;
    leadCaptured: boolean;
    firstOrderOnly: boolean;
    firstOrderOk: boolean;
  };
};

function mapOffer(row: typeof marketingOffers.$inferSelect): MarketingOfferSnapshot {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description,
    percentOff: row.percentOff,
    amountOff: row.amountOff,
    currencyCode: row.currencyCode,
    isActive: row.isActive,
    requiresLeadCapture: row.requiresLeadCapture,
    firstOrderOnly: row.firstOrderOnly,
    startsAt: row.startsAt,
    endsAt: row.endsAt
  };
}

function money(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") {
    return 0;
  }
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number): string {
  return Math.max(0, Math.round(value * 100) / 100).toFixed(2);
}

export async function getOfferByCode(
  code: string,
  databaseUrl?: string
): Promise<MarketingOfferSnapshot | null> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const normalized = code.trim().toUpperCase();
  const [row] = await db
    .select()
    .from(marketingOffers)
    .where(and(eq(marketingOffers.code, normalized), isNull(marketingOffers.deletedAt)))
    .limit(1);

  return row ? mapOffer(row) : null;
}

export async function evaluateWelcome10Eligibility(
  input: { email?: string; sessionHasLead?: boolean } = {},
  databaseUrl?: string
): Promise<Welcome10Eligibility> {
  const url = resolveDatabaseUrl(databaseUrl);
  const db = createDatabaseClient(url);
  const offer = await getOfferByCode("WELCOME10", url);
  const reasons: string[] = [];

  if (!offer || !offer.isActive) {
    return {
      eligible: false,
      offer: offer ?? null,
      reasons: ["WELCOME10 offer is not active."],
      checks: {
        offerActive: false,
        requiresLeadCapture: true,
        leadCaptured: false,
        firstOrderOnly: true,
        firstOrderOk: false
      }
    };
  }

  const now = new Date();
  let offerActive: boolean = true;
  if (offer.startsAt && offer.startsAt > now) {
    offerActive = false;
    reasons.push("Offer has not started yet.");
  }
  if (offer.endsAt && offer.endsAt < now) {
    offerActive = false;
    reasons.push("Offer has ended.");
  }

  const email = input.email?.trim().toLowerCase() || null;
  let leadCaptured = input.sessionHasLead === true;

  if (!leadCaptured && email) {
    const [lead] = await db
      .select({ id: marketingLeads.id })
      .from(marketingLeads)
      .where(eq(marketingLeads.email, email))
      .limit(1);

    const [subscriber] = await db
      .select()
      .from(emailSubscribers)
      .where(and(eq(emailSubscribers.email, email), eq(emailSubscribers.isActive, true)))
      .limit(1);

    leadCaptured = Boolean(lead || subscriber);
  }

  const requiresLeadCapture = offer.requiresLeadCapture;
  if (requiresLeadCapture && !leadCaptured) {
    reasons.push("Lead capture required before WELCOME10 can apply.");
  }

  let firstOrderOk = true;
  if (offer.firstOrderOnly && email) {
    const [prior] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(
        and(
          eq(orders.email, email),
          isNull(orders.deletedAt),
          inArray(orders.status, [
            "pending_payment",
            "paid",
            "processing",
            "submitted_to_supplier",
            "partially_shipped",
            "shipped",
            "delivered",
            "issue"
          ])
        )
      )
      .limit(1);
    firstOrderOk = !prior;
    if (prior) {
      reasons.push("Offer is first-order only; prior paid/pending order found for this email.");
    }
  }

  const eligible =
    offerActive &&
    (!requiresLeadCapture || leadCaptured) &&
    (!offer.firstOrderOnly || firstOrderOk);

  if (!eligible && reasons.length === 0) {
    reasons.push("Not eligible for WELCOME10.");
  }

  return {
    eligible,
    offer,
    reasons,
    checks: {
      offerActive,
      requiresLeadCapture,
      leadCaptured,
      firstOrderOnly: offer.firstOrderOnly,
      firstOrderOk
    }
  };
}

export function computeDiscountForSubtotal(
  subtotal: number | string,
  percentOff: number | string
): { discountAmount: string; percentOff: number } {
  const sub = money(subtotal);
  const percent = money(percentOff);
  const discountAmount = formatMoney((sub * percent) / 100);
  return { discountAmount, percentOff: percent };
}

export function applyOfferToAmounts(
  subtotal: number | string,
  offer: Pick<MarketingOfferSnapshot, "percentOff" | "amountOff">
): {
  subtotalAmount: string;
  discountAmount: string;
  totalAfterDiscount: string;
  percentOff: number | null;
} {
  const sub = money(subtotal);
  let discount = 0;
  let percentOff: number | null = null;

  if (offer.percentOff !== null && offer.percentOff !== undefined && offer.percentOff !== "") {
    percentOff = money(offer.percentOff);
    discount = (sub * percentOff) / 100;
  } else if (offer.amountOff !== null && offer.amountOff !== undefined && offer.amountOff !== "") {
    discount = money(offer.amountOff);
  }

  discount = Math.min(discount, sub);
  const discountAmount = formatMoney(discount);
  return {
    subtotalAmount: formatMoney(sub),
    discountAmount,
    totalAfterDiscount: formatMoney(sub - discount),
    percentOff
  };
}
