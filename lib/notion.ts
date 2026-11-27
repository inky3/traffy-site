import { Client } from "@notionhq/client";
import snapshot from "@/data/snapshot.json";

// Without NOTION_TOKEN the site runs on data/snapshot.json (preview mode).
const token = process.env.NOTION_TOKEN;
export const live = Boolean(token);
const notion = token ? new Client({ auth: token }) : null;

const DS = {
  sections: process.env.NOTION_SECTIONS_DS || "4251ee1b-cf19-813b-af41-000b3f1f4052",
  activities: process.env.NOTION_ACTIVITIES_DS || "b631ee1b-cf19-83ce-a9a8-0753f6d9d98a",
  social: process.env.NOTION_SOCIAL_DS || "83f1ee1b-cf19-82dc-9eb3-07820a42679a",
};

export type Section = {
  id: string; name: string; type: string; order: number;
  subtitle: string; link: string; buttonText: string; footerGroup: string;
  images: string[];
};
export type Activity = { id: string; title: string; date: string; tags: string[]; cover: string | null };
export type Social = { id: string; title: string; url: string; source: string; types: string[]; date: string };
export type Page = { id: string; title: string; cover: string | null; blocks: any[] };

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

async function queryAll(dataSourceId: string, body: any = {}) {
  const out: any[] = [];
  let cursor: string | undefined;
  do {
    const res: any = await (notion as any).dataSources.query({
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

export async function getActivities(limit = 6): Promise<Activity[]> {
  if (!notion) return snapshot.activities.slice(0, limit);
  const res: any = await (notion as any).dataSources.query({
    data_source_id: DS.activities, page_size: limit,
    sorts: [{ property: "วันที่", direction: "descending" }],
  });
  return res.results.map((r: any) => ({
    id: clean(r.id), title: prop(r, "Name"), date: prop(r, "วันที่"),
    tags: prop(r, "ความสำคัญ") || [], cover: r.cover ? `/img/cover/${clean(r.id)}` : null,
  }));
}

export async function getSocial(limit = 8): Promise<Social[]> {
  if (!notion) return snapshot.social.slice(0, limit);
  const res: any = await (notion as any).dataSources.query({
    data_source_id: DS.social, page_size: limit,
    sorts: [{ property: "Date", direction: "descending" }],
  });
  return res.results.map((r: any) => ({
    id: clean(r.id), title: prop(r, "Name"), url: prop(r, "URL"),
    source: prop(r, "ที่มา"), types: prop(r, "ประเภท") || [], date: prop(r, "Date"),
  }));
}

/* ---------- sub-pages ---------- */
async function getBlocks(id: string): Promise<any[]> {
  const blocks: any[] = [];
  let cursor: string | undefined;
  do {
    const res: any = await notion!.blocks.children.list({ block_id: id, start_cursor: cursor, page_size: 100 });
    blocks.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);

  await Promise.all(blocks.map(async (b) => {
    // synced copies point at the original block
    const childId = b.type === "synced_block" && b.synced_block.synced_from
      ? b.synced_block.synced_from.block_id : b.id;
    if (b.has_children && b.type !== "child_page" && b.type !== "child_database") b.children = await getBlocks(childId);
    if (b.type === "link_to_page" && b.link_to_page.page_id) {
      try {
        const pg: any = await notion!.pages.retrieve({ page_id: b.link_to_page.page_id });
        b._title = plain((Object.values(pg.properties) as any[]).find((p) => p.type === "title")?.title);
      } catch { b._title = "ลิงก์"; }
    }
    if (b.type === "child_database") {
      try {
        const db: any = await notion!.databases.retrieve({ database_id: b.id });
        const rows = await queryAll(db.data_sources[0].id);
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
  try {
    const page: any = await notion.pages.retrieve({ page_id: id });
    const titleProp: any = Object.values(page.properties).find((p: any) => p.type === "title");
    return {
      id, title: plain(titleProp?.title),
      cover: page.cover ? `/img/cover/${id}` : null,
      blocks: await getBlocks(id),
    };
  } catch {
    return null; // not shared with the integration, or deleted
  }
}

/* ---------- fresh file URLs for the image proxy ---------- */
export async function fileUrl(kind: string, id: string, i = 0): Promise<string | null> {
  if (!notion) return null;
  const f = (x: any) => x?.type === "external" ? x.external.url : x?.file?.url ?? null;
  if (kind === "b") {
    const b: any = await notion.blocks.retrieve({ block_id: id });
    return f(b[b.type]);
  }
  const page: any = await notion.pages.retrieve({ page_id: id });
  if (kind === "cover") return f(page.cover);
  if (kind === "p") return f(page.properties?.Images?.files?.[i]);
  return null;
}
