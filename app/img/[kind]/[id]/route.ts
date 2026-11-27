import { fileUrl, live } from "@/lib/notion";

// Notion file links expire after ~1 hour. This route asks Notion for a fresh
// link each time and lets the CDN cache the image itself for a day.
export async function GET(req: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  const i = Number(new URL(req.url).searchParams.get("i") || 0);
  if (!["b", "p", "cover"].includes(kind) || !/^[0-9a-f]{32}$/i.test(id)) return new Response("bad request", { status: 400 });

  if (!live) return placeholder(kind === "cover" ? "ภาพปก" : "รูปจาก Notion");

  try {
    const url = await fileUrl(kind, id, i);
    if (!url) return new Response("not found", { status: 404 });
    const img = await fetch(url);
    if (!img.ok) return new Response("upstream error", { status: 502 });
    return new Response(img.body, {
      headers: {
        "Content-Type": img.headers.get("content-type") || "image/png",
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}

function placeholder(label: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e8eefb"/><stop offset="1" stop-color="#fde9db"/></linearGradient></defs>
  <rect width="1200" height="675" fill="url(#g)"/>
  <text x="600" y="350" font-family="sans-serif" font-size="40" fill="#8a97b4" text-anchor="middle">${label}</text></svg>`;
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml" } });
}
