# Axiora Labs — WordPress Website (`axioralabs_wp`)

Custom-coded WordPress theme for **Axiora Labs** (axioralabs.ai) — an enterprise AI‑automation company.
This repo is the full handover package: the deployable theme, the build pipeline that generates it, and the design source assets.

> **Company:** AXIORA LABS AI (OPC) PRIVATE LIMITED · Chennai, India
> **Contact:** sales@axioralabs.ai · +91 8122784236
> **Products:** Cargora (logistics AI), TrackContainer, iClinicalAI, MeetingClosure

---

## 📁 Repo structure

| Path | What it is |
|---|---|
| `axioralabs_wp/` | **The WordPress theme** (custom PHP + CSS + JS). This is what gets deployed. |
| `axioralabs_wp.zip` | Deploy‑ready zip of the theme (upload this in WP Admin). |
| `axiora-internship/` | **The GenAI Internship plugin** — public application form + separate admin portal with status tracking. See its own [README](axiora-internship/README.md). |
| `axiora-internship.zip` | Deploy‑ready zip of the plugin (upload under Plugins → Add New). |
| `build/` | The build pipeline that generates the theme (Node.js scripts + source HTML/CSS/JS + assets). |
| `design-assets/` | Original high‑res design source images (logos, hero images, client logos). |

> The original React marketing site (the design this theme was ported from) lives in `source/` locally and is **git‑ignored** (it's ~127 MB and not needed to run the WordPress site).

---

## 🚀 Deploy the theme (WordPress on Hostinger)

1. **WP Admin → Appearance → Themes → Add New → Upload Theme** → choose `axioralabs_wp.zip`.
2. If it says *"already installed"*, click **Replace current with uploaded**, then **Activate**.
3. **Settings → Permalinks → Save Changes** (flushes rewrite rules so page slugs work).

### Pages, slugs & templates
Create each page in **Pages → Add New**, set the **URL slug exactly**, and pick the matching **Template** (Page Attributes → Template). Leave the page body empty — the template renders everything.

| Page | Slug | Template |
|---|---|---|
| Home | *(front page)* | — (uses `front-page.php`; set as static homepage in Settings → Reading) |
| Our Story | `about` | Axiora — Our Story |
| Cargora *(product)* | `cargora` | Axiora — Cargora Platform |
| Industries *(overview)* | `industries` | Axiora — Industries |
| Contact | `contact` | Axiora — Contact |
| Careers | `careers` | Axiora — Careers |
| Free AI Audit | `automation-opportunities` | Axiora — Automation Audit (Landing) |
| AI Consulting | `ai-consulting` | Axiora — AI Consulting |
| Custom AI Solutions | `custom-ai-solutions` | Axiora — Custom AI Solutions |
| AI Product Engineering | `ai-product-engineering` | Axiora — AI Product Engineering |
| Dedicated AI Engineering | `dedicated-ai-engineering` | Axiora — Dedicated AI Engineering |
| Privacy Policy | `privacy-policy` | Axiora — Privacy Policy |
| Terms & Conditions | `terms-and-conditions` | Axiora — Terms & Conditions |
| **Industries (9 detail pages):** | | |
| Logistics & Supply Chain | `logistics-supply-chain` | Axiora — Logistics & Supply Chain |
| Pharma & Life Sciences | `pharma-life-sciences` | Axiora — Pharma & Life Sciences |
| Enterprise IT & GCCs | `enterprise-it` | Axiora — Enterprise IT & GCCs |
| Manufacturing | `manufacturing-industry` | Axiora — Manufacturing |
| Banking & Financial Services | `banking-financial-services` | Axiora — Banking & Financial Services |
| Insurance | `insurance-industry` | Axiora — Insurance |
| Healthcare | `healthcare` | Axiora — Healthcare |
| Legal Services | `legal-services` | Axiora — Legal Services |
| Government & Public Sector | `government-public-sector` | Axiora — Government & Public Sector |

⚠️ Slugs must match exactly — the nav/footer links point to these. WordPress won't auto‑generate `manufacturing-industry` or `insurance-industry`, so set those manually.

### External product links (open in new tab)
- Cargora → `/cargora/` (this site) · TrackContainer → https://trackcontainer.in/
- iClinicalAI → https://iclinical.ai/ · MeetingClosure → https://meetingclosure.axioralabs.ai/

---

## 🛠️ Theme structure (`axioralabs_wp/`)

- `style.css` — theme header (name/version) only.
- `functions.php` — enqueues `assets/css/base.css` on every page + a per‑template CSS file.
- `header.php` / `footer.php` — topbar + nav + SVG icon sprite / footer. Shared on all pages.
- `front-page.php` — the homepage.
- `template-*.php` — one per page (`/* Template Name: … */`). Content is plain HTML.
- `assets/css/*.css` — `base.css` (global) + one stylesheet per section.
- `assets/js/main.js` — all interactions (scroll reveal, carousels, mobile accordion menu, hero product slider, etc.). Vanilla JS, no libraries.
- `assets/img/`, `assets/fonts/` — images + self‑hosted Outfit/Inter fonts.

To edit content/design you can either edit the theme files directly, **or** use the build pipeline below (recommended, since the theme is generated).

---

## ⚙️ Rebuilding the theme (`build/`)

The theme is **generated** from source files by Node.js scripts. Requires Node + Windows PowerShell (for image processing).

- `home_v2.html` — the **master base** (topbar + nav + footer + all base CSS/JS + the home `<main>` + icon sprite). Uses `__PLACEHOLDER__` tokens for base64 assets in `assets.json`.
- `*_main.html` — the `<main>` content for each subpage.
- `*.css` — per‑page stylesheets.
- `gen_solutions.js` — generates the 4 solutions pages.
- `assets.json` — base64 fonts/images injected into placeholders.
- **Scripts:**
  - `node build_home.js` → home preview HTML
  - `node build_page.js <main.html> <css> "<title>" <out.html>` → a subpage preview
  - `node gen_solutions.js` → solutions pages
  - `node build_theme.js` → **builds the WordPress theme** into `../axioralabs_wp/` (paths hard‑coded near top)
  - `node build_zip.js` → packs `../axioralabs_wp.zip` (custom WP‑safe PKZIP writer — use this, not Windows "compress")
- Image processing (PowerShell + System.Drawing): `hero_imgs.ps1`, `logo_process*.ps1`, `client_process.ps1`, `process_kd3.ps1`, `final_trim.ps1`, `pngtool.js`.

**Typical rebuild:** run `build_home.js` + `gen_solutions.js` + `build_page.js` (per subpage) → `build_theme.js` → `build_zip.js`.

> Note: paths inside `build_theme.js` / `build_zip.js` point to `…/Workboosterai_WP/axioralabs_wp`. Update them if you move the repo.

---

## ✅ Remaining setup (not yet done)

1. **Rename the Cargora page** in WP: title `Cargora`, slug `cargora` (was `logicopilot`).
2. **Create the 9 Industry detail pages** (slugs/templates in the table above).
3. **Domain:** axioralabs.ai (bought on GoDaddy) → already pointed to Hostinger.
4. **Forminator forms** (Contact, Careers w/ resume upload, Free AI Audit) → email to `sales@axioralabs.ai`. Recommended: install **WP Mail SMTP** (smtp.hostinger.com:465 SSL, user `sales@axioralabs.ai`) so mail delivers. Then embed each form's shortcode into the Contact / Careers / AI‑Audit templates and style to match the brand.
5. **Favicon:** baked into `header.php`; can also be set via Appearance → Customize → Site Identity.

---

## 🎓 GenAI Internship (plugin)

`axiora-internship/` is a self‑contained plugin, **not** theme code — the theme is generated by `build_theme.js`, so anything placed inside `axioralabs_wp/` is destroyed on the next rebuild. The plugin only borrows the theme's header, footer, icon sprite and CSS variables so the public page looks native.

**Install:** Plugins → Add New → Upload `axiora-internship.zip` → Activate → then Settings → Permalinks → Save Changes.

Activation creates the DB tables, the `/genai-internship/` page (the one that was 404‑ing), the *Internship Admin* role, and the private resume folder.

| | URL |
|---|---|
| Public application form | `/genai-internship/` (or shortcode `[axiora_internship_form]`) |
| Admin portal — its own login | `/internship-admin/` |
| Settings (alert email) | WP Admin → **Internship** |

**Give someone portal access:** Users → Add New → Role **Internship Admin**. They sign in at `/internship-admin/`, never wp‑admin.

**What the portal does:** dashboard (totals, 14‑day trend, pipeline breakdown, recent applications, top institutions) · searchable/filterable/sortable application list with bulk status changes and CSV export · per‑application detail with resume download, internal notes, status change (optionally emailing the applicant) and a full activity timeline.

**Pipeline:** New → In Review → Shortlisted → Interview Scheduled → Selected, plus On Hold and Not Selected. Renameable via the `axiora_internship_statuses` filter.

**Rebuild the zip:** `node build/build_plugin_zip.js`

Full details in [`axiora-internship/README.md`](axiora-internship/README.md).

---

## 🎨 Brand

- Primary `#3c59e7` · deep blue `#1a4bc5` · navy `#131f4e`/`#0b1440` · violet `#6b7cef`/`#52259b`
- Fonts: **Outfit** (headings) + **Inter** (body), self‑hosted.
- Logo: full lockup (`design-assets/logo/`) with tagline "Building Intelligence. Empowering Businesses."
