import { Client } from "@notionhq/client";
import snapshot from "@/data/snapshot.json";

// Without NOTION_TOKEN the site runs on data/snapshot.json (preview mode).
const token = process.env.NOTION_TOKEN;
export const live = Boolean(token);
const notion = token ? new Client({ auth: token }) : null;
// News & Activities live in another workspace -> its own token (falls back to the main one)
const feedToken = process.env.NOTION_FEED_TOKEN || token;
const feed = feedToken ? new Client({ auth: feedToken }) : null;
const clients = [notion, feed].filter((c, i, a) => c && a.indexOf(c) === i) as Client[];

const DS = {
  sections: process.env.NOTION_SECTIONS_DS || "4251ee1b-cf19-813b-af41-000b3f1f4052",
  // database (or page holding the database) from the links the team already updates
  activities: process.env.NOTION_ACTIVITIES_DB || "b8b1ee1bcf1982238d4981aa288a229c",
  social: process.env.NOTION_SOCIAL_DB || "6301ee1bcf198351a73c81672cc7236f",
};

export type Section = {
  id: string; name: string; type: string; order: number;
  subtitle: string; link: string; buttonText: string; footerGroup: string;
  images: string[];
};
export type Activity = { id: string; title: string; date: string; tags: string[]; cover: string | null };
export type Social = { id: string; title: string; url: string; source: string; types: string[]; date: string; cover: string | null };
export type Page = { id: string; title: string; cover: string | null; blocks: any[]; date?: string; tags?: string[]; sourceUrl?: string };

/* ---------- helpers ---------- */
export const plain = (rt: any[] = []) => rt.map((t) => t.plain_text).join("");
const clean = (id: string) => id.replace(/-/g, "");

function prop(page: any, name: string): any {
  const p = page.properties?.[name];
  if (!p) return "";
  switch (p.type) {
    case "title": return plain(p.title);
    case "rich_text": return plain(p.rich_text);
    case "number": return p.number ?? 0;
    case "url": return p.url ?? "";
    case "select": return p.select?.name ?? "";
    case "multi_select": return p.multi_select.map((o: any) => o.name);
    case "date": return p.date?.start ?? "";
    case "checkbox": return p.checkbox;
    case "files": return p.files;
    default: return "";
  }
}

/** Notion page links become site routes; everything else stays as-is. */
export function toHref(url?: string | null): string {
  if (!url) return "#";
  if (url.startsWith("/")) {
    const m = url.match(/([0-9a-f]{32})/i);
    return m ? `/p/${m[1]}` : url;
  }
  if (/notion\.(so|site|com)/.test(url)) {
    const m = url.replace(/-/g, "").match(/([0-9a-f]{32})/i);
    if (m) return `/p/${m[1]}`;
  }
  return url;
}

async function queryAll(dataSourceId: string, body: any = {}, c: Client = notion!) {
  const out: any[] = [];
  let cursor: string | undefined;
  do {
    const res: any = await (c as any).dataSources.query({
      data_source_id: dataSourceId, start_cursor: cursor, page_size: 100, ...body,
    });
    out.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return out;
}

/* ---------- homepage data ---------- */
export async function getSections(): Promise<Section[]> {
  if (!notion) return snapshot.sections as Section[];
  const rows = await queryAll(DS.sections, {
    filter: { property: "Show", checkbox: { equals: true } },
    sorts: [{ property: "Order", direction: "ascending" }],
  });
  return rows.map((r) => ({
    id: clean(r.id),
    name: prop(r, "Name"),
    type: prop(r, "Type"),
    order: prop(r, "Order"),
    subtitle: prop(r, "Subtitle"),
    link: prop(r, "Link"),
    buttonText: prop(r, "Button text"),
    footerGroup: prop(r, "Footer group"),
    images: (prop(r, "Images") || []).map((_: any, i: number) => `/img/p/${clean(r.id)}?i=${i}`),
  }));
}

/* ---------- feeds (any schema: finds title / date / tags / url / image itself) ---------- */
const byType = (r: any, t: string) => (Object.values(r.properties) as any[]).find((p) => p.type === t);
const named = (r: any, names: string[], t: string) =>
  names.map((n) => r.properties[n]).find((p) => p?.type === t) || byType(r, t);

const dsCache: Record<string, string> = {};
async function dataSourceOf(id: string): Promise<string> {
  if (dsCache[id]) return dsCache[id];
  try {
    const db: any = await feed!.databases.retrieve({ database_id: id });
    return (dsCache[id] = db.data_sources[0].id);
  } catch {
    // the link is a page that contains the database
    const kids: any = await feed!.blocks.children.list({ block_id: id, page_size: 100 });
    const child = kids.results.find((b: any) => b.type === "child_database");
    if (!child) throw new Error(`No database found in ${id}`);
    const db: any = await feed!.databases.retrieve({ database_id: child.id });
    return (dsCache[id] = db.data_sources[0].id);
  }
}

/** cover -> first Files property -> first picture inside the page */
async function imageOf(r: any): Promise<string | null> {
  const id = clean(r.id);
  if (r.cover) return `/img/cover/${id}`;
  const files = (Object.values(r.properties) as any[]).find((p) => p.type === "files" && p.files.length);
  if (files) return `/img/p/${id}?i=0`;
  try {
    const kids: any = await feed!.blocks.children.list({ block_id: r.id, page_size: 30 });
    const img = kids.results.find((b: any) => b.type === "image");
    return img ? `/img/b/${clean(img.id)}` : null;
  } catch { return null; }
}

async function latest(dbId: string, limit: number) {
  const dsId = await dataSourceOf(dbId);
  const ds: any = await (feed as any).dataSources.retrieve({ data_source_id: dsId });
  const dateProp = Object.values(ds.properties as any).find((p: any) => p.type === "date") as any;
  const res: any = await (feed as any).dataSources.query({
    data_source_id: dsId, page_size: limit,
    sorts: dateProp ? [{ property: dateProp.name, direction: "descending" }]
      : [{ timestamp: "created_time", direction: "descending" }],
  });
  return res.results as any[];
}

export async function getActivities(limit = 4): Promise<Activity[]> {
  if (!feed) return snapshot.activities.slice(0, limit);
  const rows = await latest(DS.activities, limit).catch((e) => { console.error(e); return []; });
  return Promise.all(rows.map(async (r) => ({
    id: clean(r.id),
    title: plain(byType(r, "title")?.title),
    date: byType(r, "date")?.date?.start ?? r.created_time,
    tags: (named(r, ["ความสำคัญ", "Tags"], "multi_select")?.multi_select || []).map((o: any) => o.name),
    cover: await imageOf(r),
  })));
}

export async function getSocial(limit = 4): Promise<Social[]> {
  if (!feed) return snapshot.social.slice(0, limit).map((s) => ({ ...s, cover: null }));
  const rows = await latest(DS.social, limit).catch((e) => { console.error(e); return []; });
  return Promise.all(rows.map(async (r) => ({
    id: clean(r.id),
    title: plain(byType(r, "title")?.title),
    url: byType(r, "url")?.url || "",
    source: plain(named(r, ["ที่มา", "Source"], "rich_text")?.rich_text),
    types: (named(r, ["ประเภท", "Tags"], "multi_select")?.multi_select || []).map((o: any) => o.name),
    date: byType(r, "date")?.date?.start ?? r.created_time,
    cover: await imageOf(r),
  })));
}

async function getBlocks(id: string, c: Client = notion!): Promise<any[]> {
  const blocks: any[] = [];
  let cursor: string | undefined;
  do {
    const res: any = await c.blocks.children.list({ block_id: id, start_cursor: cursor, page_size: 100 });
    blocks.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);

  await Promise.all(blocks.map(async (b) => {
    // synced copies point at the original block
    const childId = b.type === "synced_block" && b.synced_block.synced_from
      ? b.synced_block.synced_from.block_id : b.id;
    if (b.has_children && b.type !== "child_page" && b.type !== "child_database") b.children = await getBlocks(childId, c);
    if (b.type === "link_to_page" && b.link_to_page.page_id) {
      try {
        const pg: any = await c.pages.retrieve({ page_id: b.link_to_page.page_id });
        b._title = plain((Object.values(pg.properties) as any[]).find((p) => p.type === "title")?.title);
      } catch { b._title = "ลิงก์"; }
    }
    if (b.type === "child_database") {
      try {
        const db: any = await c.databases.retrieve({ database_id: b.id });
        const rows = await queryAll(db.data_sources[0].id, {}, c);
        b._rows = rows.slice(0, 30).map((r: any) => ({
          id: clean(r.id),
          title: plain((Object.values(r.properties) as any[]).find((p) => p.type === "title")?.title),
          cover: r.cover ? `/img/cover/${clean(r.id)}` : null,
        }));
      } catch { b._rows = []; }
    }
  }));
  return blocks;
}

export async function getPage(id: string): Promise<Page | null> {
  if (!notion) return (snapshot.pages as any)[id] ?? null;
  for (const c of clients) {
    try {
      const page: any = await c.pages.retrieve({ page_id: id });
      const titleProp: any = Object.values(page.properties).find((p: any) => p.type === "title");
      const props = Object.values(page.properties) as any[];
      return {
        id, title: plain(titleProp?.title),
        cover: page.cover ? `/img/cover/${id}` : null,
        blocks: await getBlocks(id, c),
        // database rows (news / activities) carry these
        date: props.find((p) => p.type === "date")?.date?.start,
        tags: props.filter((p) => p.type === "multi_select").flatMap((p) => p.multi_select.map((o: any) => o.name))
          .filter((t: string) => t !== "Facebook"),
        sourceUrl: props.find((p) => p.type === "url")?.url || undefined,
      };
    } catch { /* not in this workspace, try the next */ }
  }
  return null; // not shared with the integration, or deleted
}

/* ---------- fresh file URLs for the image proxy ---------- */
export async function fileUrl(kind: string, id: string, i = 0): Promise<string | null> {
  const f = (x: any) => x?.type === "external" ? x.external.url : x?.file?.url ?? null;
  for (const c of clients) {
    try {
      if (kind === "b") {
        const b: any = await c.blocks.retrieve({ block_id: id });
        return f(b[b.type]);
      }
      const page: any = await c.pages.retrieve({ page_id: id });
      if (kind === "cover") return f(page.cover);
      const files = page.properties?.Images?.files?.length ? page.properties.Images
        : (Object.values(page.properties) as any[]).find((p) => p.type === "files" && p.files.length);
      return f(files?.files?.[i]);
    } catch { /* try next workspace */ }
  }
  return null;
}
