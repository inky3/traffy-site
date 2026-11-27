import { notFound } from "next/navigation";
import { getPage } from "@/lib/notion";
import { Blocks } from "@/components/Blocks";

export const revalidate = 60;
export const dynamicParams = true;
export function generateStaticParams() { return []; } // pages build on first visit, then cache

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const page = await getPage((await params).id);
  return { title: page ? `${page.title} – Traffy Fondue` : "Traffy Fondue" };
}

export default async function SubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{32}$/i.test(id)) notFound();
  const page = await getPage(id);
  if (!page) notFound();
  return (
    <>
      <section className="page-head">
        <div className="wrap">
          {(page.date || page.tags?.length) && <div className="page-meta">
            {page.date && <span className="page-date">{new Date(page.date).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}</span>}
            {page.tags?.map((t) => <span key={t} className="page-tag">{t}</span>)}
          </div>}
          <h1>{page.title}</h1>
          {page.sourceUrl && <a className="btn btn-sm page-source" href={page.sourceUrl} target="_blank" rel="noreferrer">ดูโพสต์ต้นฉบับ ↗</a>}
        </div>
      </section>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {page.cover && <div className="wrap"><img className="page-cover" src={page.cover} alt="" /></div>}
      <article className="wrap prose"><Blocks blocks={page.blocks} /></article>
    </>
  );
}
