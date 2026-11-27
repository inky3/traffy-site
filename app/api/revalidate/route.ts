import { revalidatePath } from "next/cache";

// Call this to refresh the site right after a Notion edit:
//   POST https://<your-site>/api/revalidate?secret=<REVALIDATE_SECRET>
// Works with a Notion database automation ("Send webhook") or a Notion integration webhook.
export async function POST(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret") || req.headers.get("x-revalidate-secret");
  const body = await req.json().catch(() => ({}));

  // Notion integration webhooks send a one-time verification token on setup.
  if (body?.verification_token) {
    console.log("Notion webhook verification token:", body.verification_token);
    return Response.json({ ok: true });
  }
  if (!process.env.REVALIDATE_SECRET || secret !== process.env.REVALIDATE_SECRET) {
    return Response.json({ ok: false }, { status: 401 });
  }
  revalidatePath("/", "layout"); // refresh every page
  return Response.json({ ok: true, revalidated: new Date().toISOString() });
}
