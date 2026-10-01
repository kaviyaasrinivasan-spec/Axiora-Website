# Deployment — from where you are now

## Where you already are

| | Status |
|---|---|
| Theme uploaded (`axioralabs_wp.zip`) | ✅ done — the blog templates are live |
| Blog page created, slug `blog` | ✅ done |
| Settings → Reading → Posts page = Blog | ✅ done |
| **Settings → Reading → Homepage** | ❌ **empty — this is why your homepage shows the blog** |
| Internship plugin (`axiora-internship.zip`) | ⬜ not uploaded |
| The 3 new USA / UK / UAE articles | ⬜ not published |
| Post categories | ⬜ everything is "Uncategorized" |

Work through the steps in order. Step 1 fixes the live problem.

---

## Step 0 — Back up (2 min)

**hPanel → Websites → Manage → Backups → Create backup.**

This is the undo button for everything below. Don't skip it.

---

## Step 1 — Fix the homepage (2 min) ⚠️ do this first

Your homepage is currently showing the blog. Cause: *"A static page"* is selected but the
**Homepage** dropdown is empty, so WordPress has no page to serve at `/` and falls back to the
post index.

**Settings → Reading:**

1. Open the **Homepage** dropdown
2. Select **Home**
   - **Not in the list?** Pages → Add New → title **Home** → body **empty** → template
     **Default template** → Publish. Then come back and select it.
3. Confirm **Posts page** is still **Blog**
4. **Save Changes**

> Homepage and Posts page must be **two different pages**. Never set both to Blog.

**Check:** open `axioralabs.ai` in a private window. You should see the hero, products, clients,
FAQ — and **no** blog section. If it still looks wrong, Ctrl+F5 and purge Hostinger's cache.

---

## Step 2 — Flush permalinks (30 sec)

**Settings → Permalinks → Save Changes.** Change nothing, just press Save.

**Check:** `axioralabs.ai/blog/` lists your 2 posts. Click one — it should open a properly styled
article with a hero, a narrow readable text column and a share row. Click a category chip — it
should filter, not 404.

---

## Step 3 — Create categories (5 min)

Every post is currently *Uncategorized*, which is why the filter bar on `/blog/` has one dead chip.

**Posts → Categories**, add:

| Name | Slug |
|---|---|
| AI Strategy | `ai-strategy` |
| Industry Insights | `industry-insights` |

Then **Posts → All Posts**, and for each of your 2 existing posts: Quick Edit → tick **AI Strategy**
→ untick Uncategorized → Update.

---

## Step 4 — Publish the three new articles (30 min)

**Good news:** you have only 2 posts published — the Singapore one and *"AI Consulting Services in
the USA: Building an AI Strategy for Growth"*. Neither collides with the three new articles, so
publish all three as **new posts**. No duplicate-content problem, no redirects needed.

**Decide the URL shape first.** Your USA source document asks for `/blog/…`, your live posts have no
prefix. If you want everything under `/blog/`, set **Settings → Permalinks → Custom Structure** to
`/blog/%postname%/` **now** — changing it after publishing breaks every existing post URL.

For each of the three, from [`blog-content/PUBLISHING-usa-uk-uae.md`](blog-content/PUBLISHING-usa-uk-uae.md):

1. **Posts → Add New**
2. Paste the **post title** from the sheet
3. Editor **⋮ → Code editor** (`Ctrl+Shift+Alt+M`)
4. Paste the whole `.html` file
5. Switch back to the visual editor and check it looks right
6. Set the **slug** exactly as listed
7. **Category → AI Strategy**
8. Scroll to the **Yoast SEO** panel → paste the **meta title** and **meta description** from the sheet
9. Upload the **featured image** (1600×900, under 250 KB), renamed to the exact filename in the
   sheet, and set its **alt text**
10. **Publish**

| File | Slug |
|---|---|
| `ai-automation-consulting-services-usa.html` | `ai-automation-consulting-services-usa` |
| `ai-automation-consulting-services-uk.html` | `ai-automation-consulting-services-uk` |
| `ai-automation-consulting-services-uae.html` | `ai-automation-consulting-services-uae` |

**Check:** `/blog/` now lists 5 posts, newest first, in a card grid.

---

## Step 5 — Internship plugin (10 min)

Independent of everything above. Skip if you're not ready.

**Before uploading:** Pages → search "internship" and "genai". If a page already exists at
`/genai-internship/`, stop and tell me — the plugin would take that page over. If nothing exists,
carry on.

1. **Plugins → Add New → Upload Plugin** → `axiora-internship.zip` → Install Now → **Activate**
2. **Settings → Permalinks → Save Changes** (again — the plugin adds new URLs)
3. **Users → Add New** → create the reviewer → Role **Internship Admin**
4. **WP Admin → Internship** → set the alert email address

**Check:**

- `axioralabs.ai/genai-internship/` shows the application form on your normal site design
- Submit a test application → success message with a reference like `AXI-2026-0001`
- `axioralabs.ai/internship-admin/` → branded login → sign in → your test application is listed
- Open it → change the status → the change sticks

Then delete the test application from the portal.

**Email:** install **WP Mail SMTP** (smtp.hostinger.com:465, SSL, `sales@axioralabs.ai`) or the
notification emails fail silently. Applications still save without it.

---

## Step 6 — Final check

| URL | Expected |
|---|---|
| `axioralabs.ai` | Homepage. No blog section. |
| Footer | **Blog** under Careers |
| `/blog/` | 5 posts, card grid, working category chips |
| Any post | Styled article, share row, related posts |
| `/genai-internship/` | Application form |
| `/internship-admin/` | Portal login |
| A made-up URL | Proper 404 page |

Check the homepage and `/blog/` on your phone too.

---

## If something breaks

| Symptom | Fix |
|---|---|
| Homepage still shows the blog | Homepage dropdown in Settings → Reading is still empty |
| `/blog/` is empty | Posts page isn't set, or you assigned a template to the Blog page — it must stay **Default template** |
| Posts 404 | Settings → Permalinks → Save Changes, then Ctrl+F5 |
| Article looks unstyled | Cached CSS. Hard-refresh and purge Hostinger cache. |
| `/internship-admin/` 404s | Save permalinks again after activating the plugin |
| PHP error on plugin activation | Deactivate the plugin, send me the error text |
| Anything worse | Restore the Step 0 backup |
