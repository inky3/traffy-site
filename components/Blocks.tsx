import Link from "next/link";
import { toHref } from "@/lib/notion";

/* Renders Notion API blocks with the site's own styling. */

function Text({ rt = [] }: { rt?: any[] }) {
  return (
    <>
      {rt.map((t, i) => {
        const a = t.annotations || {};
        let el: React.ReactNode = t.plain_text;
        if (a.code) el = <code>{el}</code>;
        if (a.bold) el = <strong>{el}</strong>;
        if (a.italic) el = <em>{el}</em>;
        if (a.strikethrough) el = <s>{el}</s>;
        if (a.underline) el = <u>{el}</u>;
        const href = t.href || t.text?.link?.url;
        if (href) {
          const h = toHref(href);
          el = h.startsWith("/") ? <Link href={h}>{el}</Link> : <a href={h} target="_blank" rel="noreferrer">{el}</a>;
        }
        const color = a.color && a.color !== "default" ? `c-${a.color}` : undefined;
        return <span key={i} className={color}>{el}</span>;
      })}
    </>
  );
}

const youtubeId = (u = "") => u.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/)?.[1];

/** canva.link/xyz -> full canva.com design URL (follows the redirect once, cached by the page) */
async function expandShortLink(u: string): Promise<string> {
  if (!/canva\.link\//.test(u)) return u;
  try {
    const r = await fetch(u, { redirect: "manual", next: { revalidate: 86400 } });
    return r.headers.get("location") || u;
  } catch { return u; }
}

export const isSlides = (u = "") => /canva\.(link|com\/design)|docs\.google\.com\/presentation/.test(u);

export async function embedSrc(raw: string): Promise<string | null> {
  const u = await expandShortLink(raw);
  const yt = youtubeId(u);
  if (yt) return `https://www.youtube.com/embed/${yt}`;
  const canva = u.match(/canva\.com\/design\/([^/]+)\/([^/?]+)/);
  if (canva) return `https://www.canva.com/design/${canva[1]}/${canva[2]}/view?embed`;
  if (/docs\.google\.com\/presentation/.test(u)) return u.replace(/\/(edit|pub|view).*$/, "/embed");
  if (/canva\.link|facebook\.com/.test(u)) return null; // can't be framed
  return u;
}

export async function Embed({ url, title }: { url: string; title?: string }) {
  const src = await embedSrc(url);
  if (!src) return <LinkCard href={url} title={title || "เปิดเอกสาร"} />;
  return (
    <div className={`frame${isSlides(url) ? " frame-slides" : ""}`}>
      <iframe src={src} title={title || "embed"} loading="lazy" allowFullScreen allow="fullscreen" />
    </div>
  );
}

export function LinkCard({ href, title, sub }: { href: string; title: string; sub?: string }) {
  const h = toHref(href);
  const inner = (<><span className="lc-title">{title}</span>{sub && <span className="lc-sub">{sub}</span>}<span className="lc-arrow">→</span></>);
  return h.startsWith("/")
    ? <Link href={h} className="linkcard">{inner}</Link>
    : <a href={h} className="linkcard" target="_blank" rel="noreferrer">{inner}</a>;
}

function imgSrc(b: any) {
  const v = b.image;
  if (v?._src) return v._src; // snapshot
  return v?.type === "external" ? v.external.url : `/img/b/${b.id.replace(/-/g, "")}`;
}

function Block({ b }: { b: any }) {
  const v = b[b.type] || {};
  const kids = b.children ? <Blocks blocks={b.children} /> : null;
  switch (b.type) {
    case "paragraph": return v.rich_text?.length ? <p><Text rt={v.rich_text} /></p> : <div className="sp" />;
    case "heading_1": return <h2><Text rt={v.rich_text} /></h2>;
    case "heading_2": return <h3><Text rt={v.rich_text} /></h3>;
    case "heading_3": return <h4><Text rt={v.rich_text} /></h4>;
    case "quote": return <blockquote><Text rt={v.rich_text} />{kids}</blockquote>;
    case "callout": return <div className="callout">{v.icon?.emoji && <span>{v.icon.emoji}</span>}<div><Text rt={v.rich_text} />{kids}</div></div>;
    case "divider": return <hr />;
    case "to_do": return <label className="todo"><input type="checkbox" checked={v.checked} readOnly /> <Text rt={v.rich_text} /></label>;
    case "toggle": return <details><summary><Text rt={v.rich_text} /></summary>{kids}</details>;
    case "code": return <pre><code>{v.rich_text?.map((t: any) => t.plain_text).join("")}</code></pre>;
    case "image": return (
      <figure>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imgSrc(b)} alt={v.caption?.map((t: any) => t.plain_text).join("") || ""} loading="lazy" />
        {v.caption?.length > 0 && <figcaption><Text rt={v.caption} /></figcaption>}
      </figure>
    );
    case "video": case "embed": {
      const url = v.type === "file" ? v.file.url : v.external?.url || v.url;
      return <Embed url={url} />;
    }
    case "bookmark": case "link_preview": return <LinkCard href={v.url} title={v.caption?.length ? v.caption.map((t: any) => t.plain_text).join("") : v.url} />;
    case "file": case "pdf": return <LinkCard href={v.type === "external" ? v.external.url : `/img/b/${b.id.replace(/-/g, "")}`} title={v.name || "ดาวน์โหลดไฟล์"} />;
    case "child_page": return <LinkCard href={`/p/${b.id.replace(/-/g, "")}`} title={v.title} />;
    case "link_to_page": return <LinkCard href={`/p/${(v.page_id || "").replace(/-/g, "")}`} title={b._title || "ลิงก์"} />;
    case "child_database": return (
      <div className="db">
        {v.title && <h4>{v.title}</h4>}
        <div className="cards">
          {(b._rows || []).map((r: any) => (
            <Link key={r.id} href={`/p/${r.id}`} className="card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {r.cover && <img src={r.cover} alt="" loading="lazy" />}
              <span className="card-title">{r.title}</span>
            </Link>
          ))}
        </div>
      </div>
    );
    case "column_list": return <div className="cols">{b.children?.map((c: any) => (
      <div className="col" key={c.id} style={{ flex: c.column?.width_ratio ?? 1 }}><Blocks blocks={c.children || []} /></div>
    ))}</div>;
    case "synced_block": return kids;
    case "table": return (
      <div className="table-wrap"><table><tbody>
        {b.children?.map((row: any, i: number) => (
          <tr key={row.id}>{row.table_row.cells.map((c: any, j: number) =>
            (v.has_column_header && i === 0) || (v.has_row_header && j === 0)
              ? <th key={j}><Text rt={c} /></th> : <td key={j}><Text rt={c} /></td>)}</tr>
        ))}
      </tbody></table></div>
    );
    default: return null; // unsupported: skip quietly
  }
}

/** Facebook/Twemoji emoji pasted into Notion arrive as separate image blocks. */
const isEmojiImg = (b: any) =>
  b?.type === "image" && b.image?.type === "external" && /emoji\.php|\/emoji\/|twemoji/.test(b.image.external.url);

export function Blocks({ blocks }: { blocks: any[] }) {
  // group consecutive list items into <ul>/<ol>; fold emoji images into the next line
  const out: React.ReactNode[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (isEmojiImg(b)) {
      const emojis: any[] = [];
      while (i < blocks.length && isEmojiImg(blocks[i])) emojis.push(blocks[i++]);
      const next = blocks[i];
      const icons = emojis.map((e) => <img key={e.id} className="emoji" src={e.image.external.url} alt="" />);
      if (next && ["paragraph", "heading_1", "heading_2", "heading_3"].includes(next.type)) {
        const Tag = ({ paragraph: "p", heading_1: "h2", heading_2: "h3", heading_3: "h4" } as any)[next.type];
        out.push(<Tag key={next.id}>{icons} <Text rt={next[next.type].rich_text} /></Tag>);
      } else { out.push(<p key={emojis[0].id}>{icons}</p>); i--; }
      continue;
    }
    if (b.type === "bulleted_list_item" || b.type === "numbered_list_item") {
      const t = b.type, items = [];
      while (i < blocks.length && blocks[i].type === t) {
        const x = blocks[i];
        items.push(<li key={x.id}><Text rt={x[t].rich_text} />{x.children && <Blocks blocks={x.children} />}</li>);
        i++;
      }
      i--;
      out.push(t === "bulleted_list_item" ? <ul key={b.id}>{items}</ul> : <ol key={b.id}>{items}</ol>);
    } else out.push(<Block key={b.id} b={b} />);
  }
  return <>{out}</>;
}
