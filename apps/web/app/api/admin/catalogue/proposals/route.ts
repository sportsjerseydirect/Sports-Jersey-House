import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  listCatalogueProposals,
  listReviewQueue,
  reviewCatalogueProposal
} from "@sjh/database";
import { ADMIN_SESSION_COOKIE, isAdminAccessAllowed } from "@/lib/auth";

async function requireAdmin(): Promise<NextResponse | null> {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (await isAdminAccessAllowed(token)) {
    return null;
  }
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const reviewSchema = z.object({
  proposalNumber: z.string().trim().min(1),
  decision: z.enum(["approved", "rejected"]),
  notes: z.string().trim().max(2000).optional()
});

export async function GET() {
  const denied = await requireAdmin();
  if (denied) {
    return denied;
  }

  try {
    const [proposals, reviewQueue] = await Promise.all([
      listCatalogueProposals(50),
      listReviewQueue(50)
    ]);
    return NextResponse.json({ proposals, reviewQueue });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to list proposals.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const denied = await requireAdmin();
  if (denied) {
    return denied;
  }

  const body = reviewSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid proposal review." }, { status: 400 });
  }

  try {
    // Approve/reject only — never publish or delete catalogue products.
    const proposal = await reviewCatalogueProposal(body.data.proposalNumber, {
      decision: body.data.decision,
      reviewedBy: "admin",
      ...(body.data.notes !== undefined ? { notes: body.data.notes } : {})
    });
    return NextResponse.json({ proposal });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to review proposal.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
