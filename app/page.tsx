import Link from "next/link";
import { getSections, getActivities, getSocial, toHref, type Section } from "@/lib/notion";
import { Embed, LinkCard } from "@/components/Blocks";

export const revalidate = 60; // re-read Notion at most every minute // re-read Notion at most every 5 min (plus instant via /api/revalidate)

const thDate = (d: string) => d ? new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" }) : "";

function Btn({ s, ghost }: { s: Section; ghost?: boolean }) {
  if (!s.link || !s.buttonText) return null;
  const h = toHref(s.link);
  const cls = ghost ? "btn btn-ghost" : "btn";
  return h.startsWith("/") ? <Link href={h} className={cls}>{s.buttonText}</Link>
    : <a href={h} className={cls} target="_blank" rel="noreferrer">{s.buttonText}</a>;
}

/* eslint-disable @next/next/no-img-element */
function Hero({ s }: { s: Section }) {
  return (
    <section className="hero">
      <img className="hero-cover" src={s.images[0] || "/brand/cover.webp"} alt={s.subtitle || s.name} />
      <div className="wrap hero-bar">
        <div>
          <h1>{s.name}</h1>
          <p className="lead">{s.subtitle}</p>
        </div>
        <div className="row"><Btn s={s} /><a className="btn btn-ghost" href="#activities">ดูความเคลื่อนไหว</a></div>
      </div>
    </section>
  );
}

function Audience({ items }: { items: Section[] }) {
  return (
    <section className="wrap sec">
      <div className="aud">
        {items.map((s, i) => (
          <Link key={s.id} href={toHref(s.link)} className={`aud-card ${i % 2 ? "aud-blue" : "aud-orange"}`}>
            {s.images[0] && <img src={s.images[0]} alt="" />}
            <div className="aud-body">
              <h3>{s.name}</h3>
              <p>{s.subtitle}</p>
              <span className="aud-cta">{s.buttonText || "ดูเพิ่มเติม"} →</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Banner({ s }: { s: Section }) {
  if (!s.images.length) return null;
  const imgs = s.images.map((src, i) => <img key={i} src={src} alt={s.name} loading="lazy" />);
  return <section className="wrap sec"><div className={`banner n${Math.min(s.images.length, 3)}`}>
    {s.link ? <a href={toHref(s.link)}>{imgs}</a> : imgs}
  </div></section>;
}

function Head({ s, extra }: { s: Section; extra?: React.ReactNode }) {
  return (
    <div className="sec-head">
      <div><h2>{s.name}</h2>{s.subtitle && <p className="muted">{s.subtitle}</p>}</div>
      {extra}
    </div>
  );
}

async function Activities({ s }: { s: Section }) {
  const items = await getActivities(4);
  return (
    <section className="wrap sec" id="activities">
      <Head s={s} extra={<Btn s={s} ghost />} />
      <div className="cards">
        {items.map((a) => (
          <Link key={a.id} href={`/p/${a.id}`} className="card">
            {a.cover ? <img src={a.cover} alt="" loading="lazy" /> : <div className="card-ph" />}
            <div className="card-body">
              <span className="date">{thDate(a.date)}</span>
              <span className="card-title">{a.title}</span>
              <div className="tags">{a.tags.slice(0, 3).map((t) => <span key={t} className="tag">{t}</span>)}</div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

async function SocialFeed({ s }: { s: Section }) {
  const items = await getSocial(4);
  return (
    <section className="soft"><div className="wrap sec">
      <Head s={s} />
      <div className="cards cards-4">
        {items.map((n) => (
          <a key={n.id} href={n.url || "#"} target="_blank" rel="noreferrer" className="news">
            {n.cover ? <img src={n.cover} alt="" loading="lazy" /> : <div className="card-ph" />}
            <div className="tags">{n.types.map((t) => <span key={t} className="tag tag-blue">{t}</span>)}</div>
            <span className="news-title">{n.title}</span>
            <span className="news-src">{n.source} · {thDate(n.date)}</span>
          </a>
        ))}
      </div>
    </div></section>
  );
}

function Grid({ s }: { s: Section }) {
  if (!s.images.length) return null;
  return <section className="wrap sec"><Head s={s} />
    <div className="grid">{s.images.map((src, i) => <img key={i} src={src} alt="" loading="lazy" />)}</div>
  </section>;
}

function EmbedSec({ s }: { s: Section }) {
  return <section className="wrap sec"><Head s={s} extra={<a className="btn btn-ghost" href={s.link} target="_blank" rel="noreferrer">เปิดเว็บไซต์ ↗</a>} />
    <div className="browser"><div className="browser-bar"><i /><i /><i /><span>{s.link.replace(/^https?:\/\//, "")}</span></div>
      <iframe src={s.link} title={s.name} loading="lazy" /></div>
  </section>;
}

function Guides({ items }: { items: Section[] }) {
  return <section className="soft"><div className="wrap sec">
    <Head s={items[0]} />
    <div className="guides">{items.map((s) => <LinkCard key={s.id} href={s.link} title={s.buttonText || s.name} sub={items.length > 1 ? s.subtitle : undefined} />)}</div>
  </div></section>;
}

export default async function Home() {
  const sections = (await getSections()).filter((s) => s.type !== "Footer link");
  // merge neighbouring rows of the same group-type (e.g. two audience cards)
  const blocks: Section[][] = [];
  for (const s of sections) {
    const last = blocks.at(-1);
    if (last && last[0].type === s.type && ["Audience card", "Guides"].includes(s.type)) last.push(s);
    else blocks.push([s]);
  }
  return (
    <>
      {blocks.map((g) => {
        const s = g[0];
        switch (s.type) {
          case "Hero": return <Hero key={s.id} s={s} />;
          case "Audience card": return <Audience key={s.id} items={g} />;
          case "Banner": return <Banner key={s.id} s={s} />;
          case "Video": return <section key={s.id} className="wrap sec"><Embed url={s.link} title={s.name} /></section>;
          case "Social feed": return <SocialFeed key={s.id} s={s} />;
          case "Activities feed": return <Activities key={s.id} s={s} />;
          case "Image grid": return <Grid key={s.id} s={s} />;
          case "Embed": return <EmbedSec key={s.id} s={s} />;
          case "Guides": return <Guides key={s.id} items={g} />;
          default: return null;
        }
      })}
    </>
  );
}
