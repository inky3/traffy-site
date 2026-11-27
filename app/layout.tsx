import Link from "next/link";
import "./globals.css";
import { getSections, toHref } from "@/lib/notion";

export const metadata = {
  title: "Traffy Fondue – เจอปัญหาเมือง แจ้งง่าย ตามได้จริง",
  description: "แพลตฟอร์มรับแจ้งปัญหาเมือง พัฒนาโดย สวทช.",
};

function A({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  const h = toHref(href);
  return h.startsWith("/")
    ? <Link href={h} className={className}>{children}</Link>
    : <a href={h} className={className} target="_blank" rel="noreferrer">{children}</a>;
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const links = (await getSections()).filter((s) => s.type === "Footer link");
  const groups = [...new Set(links.map((l) => l.footerGroup || "อื่น ๆ"))];
  const nav = links.filter((l) => ["สำหรับผู้ใช้งาน", "การติดตาม"].includes(l.footerGroup));

  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600;700&family=Nunito:wght@800&display=swap" />
      </head>
      <body>
        <header className="top">
          <div className="wrap top-in">
            <Link href="/" className="logo"><img src="/brand/icon.png" alt="" width={40} height={40} /><span>Traffy <b>Fondue</b></span></Link>
            <nav>{nav.map((l) => <A key={l.id} href={l.link}>{l.name}</A>)}</nav>
            <a className="btn btn-sm" href="https://lin.ee/pRPBNq2" target="_blank" rel="noreferrer">แจ้งปัญหา</a>
          </div>
        </header>

        <main>{children}</main>

        <footer className="foot">
          <div className="wrap foot-grid">
            <div className="foot-brand">
              <img className="foot-logo" src="/brand/logo-white.svg" alt="Traffy Fondue" width={120} height={120} />
              <p>เจอปัญหาเมือง แจ้งง่าย ตามได้จริง</p>
              <p className="muted">
                กลุ่มนวัตกรรมดิจิทัลสำหรับเมือง<br />สำนักงานพัฒนาวิทยาศาสตร์และเทคโนโลยีแห่งชาติ (สวทช.)<br />
                111 อุทยานวิทยาศาสตร์ประเทศไทย ถนนพหลโยธิน ตำบลคลองหนึ่ง อำเภอคลองหลวง จังหวัดปทุมธานี 12120
              </p>
              <p className="muted">
                <a href="mailto:traffyteam@gmail.com">traffyteam@gmail.com</a> · LINE <a href="https://lin.ee/pRPBNq2">@fonduehelp</a>
              </p>
            </div>
            {groups.map((g) => (
              <div key={g}>
                <h5>{g}</h5>
                {links.filter((l) => (l.footerGroup || "อื่น ๆ") === g).map((l) => <A key={l.id} href={l.link}>{l.name}</A>)}
              </div>
            ))}
          </div>
          <div className="wrap foot-bottom">© {new Date().getFullYear()} Traffy Fondue · NSTDA</div>
        </footer>
      </body>
    </html>
  );
}
