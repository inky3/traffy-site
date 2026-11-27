# Traffy Fondue website (content from Notion)

The team edits content in Notion. This Next.js site reads it through the Notion API and shows it in the custom design.

## Where to edit
| What | Where in Notion |
|---|---|
| Homepage sections (order, text, images, buttons, show/hide) | **Website – Homepage Sections** database (inside the Test page) |
| Activities cards (latest 4) | traffy.in.th **Activities** database (traffyfondue workspace) |
| News & social cards (latest 4) | **News & Social Media** database (traffyfondue workspace) |
| Sub-pages (สำหรับประชาชน, สำหรับหน่วยงาน, …) | Edit the Notion page as usual |
| Footer links | Rows with Type = *Footer link* in the Sections database |

A **Link** can be a website URL or a Notion page link. Notion links automatically become pages on this site (`/p/<id>`).

## Setup (one time)
1. Go to https://www.notion.so/profile/integrations, click **New integration** (Internal) and copy the secret.
2. In Notion, open the **Test** page and use **••• → Connections → add your integration**. Sub-pages inherit access.
3. Put the code on GitHub, then import it at vercel.com/new.
4. In Vercel, under Settings → Environment Variables, add:
   - `NOTION_TOKEN` = the integration secret (Traffy Web workspace)
   - `NOTION_FEED_TOKEN` = a second secret from the traffyfondue workspace, connected to the News & Social Media and Activities pages
   - `REVALIDATE_SECRET` = any long random text
5. Deploy.

Without `NOTION_TOKEN` the site runs on `data/snapshot.json` with placeholder images (preview mode).

## How updates appear
- **Automatic:** every page re-reads Notion at most every minute.
- Card images come from the page cover, else the first Files property, else the first picture inside the page.
- **Instant (optional):** in the Sections database, add an automation (*When a page is edited → Send webhook*) to
  `https://<your-site>/api/revalidate?secret=<REVALIDATE_SECRET>`.

## Notes
- Images go through `/img/...`, which fetches a fresh Notion link and caches the image. Notion's own image links expire after about an hour.
- Anything written on a Notion page shows on the site, including internal design notes. Move notes into a toggle or a separate page if they shouldn't be public.

## Run locally
```
npm install
npm run dev
```
