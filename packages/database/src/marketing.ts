import { desc, eq } from "drizzle-orm";
import { createDatabaseClient } from "./client";
import {
  abandonedCheckouts,
  emailSubscribers,
  marketingLeads
} from "./schema-commerce";

function resolveDatabaseUrl(databaseUrl?: string): string {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required for marketing operations.");
  }
  return url;
}

export type MarketingLeadSnapshot = {
  id: string;
  email: string | null;
  phone: string | null;
  source: string;
  offerCode: string | null;
  createdAt: Date;
};

export type EmailSubscriberSnapshot = {
  id: string;
  email: string;
  source: string;
  isActive: boolean;
  segments: string[];
  createdAt: Date;
};

export type AbandonedCheckoutSnapshot = {
  id: string;
  email: string | null;
  phone: string | null;
  itemCount: number | null;
  subtotalAmount: string | null;
  recoveredAt: Date | null;
  createdAt: Date;
};

export async function captureMarketingLead(
  input: {
    email?: string;
    phone?: string;
    source?: "popup" | "checkout" | "footer" | "abandoned_cart" | "other";
    offerCode?: string;
  },
  databaseUrl?: string
): Promise<{ lead: MarketingLeadSnapshot; subscriber: EmailSubscriberSnapshot | null }> {
  const email = input.email?.trim().toLowerCase() || null;
  const phone = input.phone?.trim() || null;
  if (!email && !phone) {
    throw new Error("Email or phone is required.");
  }

  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const source = input.source ?? "popup";
  const offerCode = input.offerCode?.trim() || "WELCOME10";

  const [lead] = await db
    .insert(marketingLeads)
    .values({
      email,
      phone,
      source,
      offerCode,
      metadata: { capturedAt: new Date().toISOString() }
    })
    .returning();

  if (!lead) {
    throw new Error("Failed to capture lead.");
  }

  let subscriber: EmailSubscriberSnapshot | null = null;
  if (email) {
    const [existing] = await db
      .select()
      .from(emailSubscribers)
      .where(eq(emailSubscribers.email, email))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(emailSubscribers)
        .set({
          isActive: true,
          unsubscribedAt: null,
          source,
          updatedAt: new Date()
        })
        .where(eq(emailSubscribers.id, existing.id))
        .returning();
      if (updated) {
        subscriber = {
          id: updated.id,
          email: updated.email,
          source: updated.source,
          isActive: updated.isActive,
          segments: updated.segments ?? [],
          createdAt: updated.createdAt
        };
      }
    } else {
      const [created] = await db
        .insert(emailSubscribers)
        .values({
          email,
          source,
          isActive: true,
          segments: ["welcome10"]
        })
        .returning();
      if (created) {
        subscriber = {
          id: created.id,
          email: created.email,
          source: created.source,
          isActive: created.isActive,
          segments: created.segments ?? [],
          createdAt: created.createdAt
        };
      }
    }
  }

  return {
    lead: {
      id: lead.id,
      email: lead.email,
      phone: lead.phone,
      source: lead.source,
      offerCode: lead.offerCode,
      createdAt: lead.createdAt
    },
    subscriber
  };
}

export async function listMarketingLeads(
  limit = 50,
  databaseUrl?: string
): Promise<MarketingLeadSnapshot[]> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const rows = await db
    .select()
    .from(marketingLeads)
    .orderBy(desc(marketingLeads.createdAt))
    .limit(limit);
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    phone: row.phone,
    source: row.source,
    offerCode: row.offerCode,
    createdAt: row.createdAt
  }));
}

export async function listEmailSubscribers(
  limit = 50,
  databaseUrl?: string
): Promise<EmailSubscriberSnapshot[]> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const rows = await db
    .select()
    .from(emailSubscribers)
    .where(eq(emailSubscribers.isActive, true))
    .orderBy(desc(emailSubscribers.createdAt))
    .limit(limit);
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    source: row.source,
    isActive: row.isActive,
    segments: row.segments ?? [],
    createdAt: row.createdAt
  }));
}

export async function listAbandonedCheckouts(
  limit = 50,
  databaseUrl?: string
): Promise<AbandonedCheckoutSnapshot[]> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const rows = await db
    .select()
    .from(abandonedCheckouts)
    .orderBy(desc(abandonedCheckouts.createdAt))
    .limit(limit);

  return rows.map((row) => {
    const payload =
      row.checkoutPayload && typeof row.checkoutPayload === "object"
        ? (row.checkoutPayload as { itemCount?: number; subtotalAmount?: string })
        : {};
    return {
      id: row.id,
      email: row.email,
      phone: row.phone,
      itemCount: payload.itemCount ?? null,
      subtotalAmount: payload.subtotalAmount ?? null,
      recoveredAt: row.recoveredAt,
      createdAt: row.createdAt
    };
  });
}

export function buildAbandonedCheckoutEmailDraft(input: {
  email: string | null;
  offerCode?: string;
}): { to: string | null; subject: string; bodyText: string } {
  return {
    to: input.email,
    subject: "Still thinking it over? Your jersey cart is waiting",
    bodyText: [
      "You left items in your Sports Jersey House cart.",
      "",
      input.offerCode ? `Use code ${input.offerCode} for 10% off your first order.` : "",
      "",
      "This is a DRAFT lifecycle email — not sent automatically."
    ]
      .filter(Boolean)
      .join("\n")
  };
}
