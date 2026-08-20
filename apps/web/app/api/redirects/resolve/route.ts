import { findActiveRedirect, normalizeRedirectPath } from "@sjh/database";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const from = new URL(request.url).searchParams.get("from");

  if (!from) {
    return Response.json({ error: "Missing from path." }, { status: 400 });
  }

  try {
    const match = await findActiveRedirect(normalizeRedirectPath(from));

    if (!match) {
      return Response.json({ redirect: null });
    }

    return Response.json({ redirect: match });
  } catch (error) {
    console.warn(
      "[redirects] lookup failed:",
      error instanceof Error ? error.message : error
    );
    return Response.json({ redirect: null });
  }
}
