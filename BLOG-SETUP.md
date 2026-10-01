# Blog setup — one-time steps in WordPress

The theme now has real blog templates. Three steps in WP Admin and the Blog page is live.

---

## 1. Upload the theme

**Appearance → Themes → Add New → Upload Theme** → `axioralabs_wp.zip` → *Replace current with uploaded* → **Activate**.

## 2. Create the Blog page

1. **Pages → Add New**
2. Title: **Blog** — this is what shows as the big heading on the page, so if you'd rather it read
   *AI Strategy & Insights*, name it that.
3. URL slug: `blog` (so the footer link `/blog/` resolves).
4. **Leave the body empty.** Anything you type in the *Excerpt* box becomes the paragraph under the
   heading; if you leave it blank the page uses a sensible default.
5. Publish.

## 3. Point WordPress at it

**Settings → Reading**

- *Your homepage displays* → **A static page**
- *Homepage* → your existing home page
- *Posts page* → **Blog**

Save. Then **Settings → Permalinks → Save Changes** once.

That's it. `/blog/` now lists every post, and the footer link under *Careers* goes straight there.

---

## What changed in the theme

| File | What it does |
|---|---|
| `home.php` | **The Blog page.** Hero + post grid + pagination + subscribe band. |
| `archive.php` | Category, tag, author and date archives. |
| `single.php` | An individual article — contents sidebar, article, subscribe band. |
| `search.php` | Search results. |
| `page.php` | Fallback for any page not using an "Axiora — …" template. Without it those pages rendered *Page not found*. |
| `404.php` | A real not-found page. |
| `parts-blog-loop.php` | The shared post grid used by the three listing templates. |
| `parts-newsletter.php` | The signup form, in two variants — sidebar card and full-width band. |
| `inc-blog.php` | Table of contents + the subscriber handler behind the form. |
| `assets/css/blog.css` | All blog styling. |
| `assets/js/blog.js` | Contents scroll-spy, reading progress, no-reload signup. |
| `footer.php` | **Blog** added to Quick Links, below Careers. |
| `front-page.php` | **Blog section removed from the homepage.** |
| `functions.php` | Blog helpers: reading time, excerpt, featured-image fallback, page title/intro. |

The homepage blog block was hardcoded markup with three posts written into it by hand — it did not
update when you published. It has been removed from both `front-page.php` and the build source
`build/home_v2.html`, so a theme rebuild will not bring it back.

---

## Posts appear on the Blog page only

Nothing else lists posts. The homepage is static, the nav is unchanged, and the only entry point is
the footer link. If you later want *Blog* in the top navigation too, it goes in `build/home_v2.html`
(the nav is generated from there into `header.php`).

---

## Publishing a post

**Posts → Add New.** Title, body, then in the sidebar set **Category**, **Excerpt** and a
**Featured image** (1600 × 900, under 250 KB, with alt text).

The excerpt is what shows on the Blog page card — if you leave it empty the theme trims the first
lines of the article instead, which reads less well. Worth filling in.

Posts without a featured image get a branded gradient panel rather than a broken layout, so a
missing image degrades gracefully — but the grid looks considerably better with real images.

Article source files and the per-post slugs, meta descriptions, categories and tags are in
[`blog-content/README.md`](blog-content/README.md).

---

## Table of contents

Articles with **three or more `<h2>`/`<h3>` headings** get a contents panel in a sticky left
sidebar. Nothing to configure — it is built from the headings you already write, and the ids are
added automatically, so `/blog/your-post/#what-is-ai-automation-consulting` links straight to a
section.

- Fewer than three headings → no sidebar, and the article falls back to the centred single-column
  layout. Short posts don't get a half-empty rail.
- On phones and tablets the panel collapses to a **Table of Contents** bar above the article; tap to
  open, and it closes itself after you jump.
- The entry for the section you are reading highlights as you scroll.

To force a specific anchor, give the heading your own id in the block editor (*Advanced → HTML
anchor*) — an id you set by hand is kept.

---

## Newsletter signups

The form appears in three places: the sidebar of every article with a contents panel, and the band
at the foot of the Blog page, the archives and every article.

**Where the emails go.** Every signup is stored in WP Admin under **Subscribers**, showing the
address, the page it came from and the date. Select all → *Export* if you want a CSV for your email
tool. A notification also goes to the WordPress admin email address (**Settings → General**) on each
new signup.

To send those notifications somewhere else, drop this in a small plugin or a child theme:

```php
add_filter('wb_subscribe_notify_email', function(){ return 'marketing@axioralabs.ai'; });
```

**What the reader sees.** Every click answers inline. The line under the button normally reads
*"No spam. Unsubscribe anytime"*; on submit it is replaced in the same slot by the result — red with
*"That does not look like a valid email address"* and a red field, or green with *"You're on the
list"*. Because the two share one fixed-height slot, the Subscribe button never moves. The button
reads *Subscribing…* while it saves. The browser's own validation bubble is switched off
(`novalidate`) so the styled message is the only one that appears.

If the server ever answers with something other than JSON — a security plugin or a redirect, say —
the message says so and the full reply is logged to the browser console under `[axiora]`, rather
than being reported as a network failure.

Duplicate addresses are answered with *"You're already subscribed"* rather than stored twice. The
form carries a honeypot field and a per-IP throttle, so it does not need a captcha. It works with
JavaScript off too — it just reloads the page instead of answering inline.

Any valid address is accepted, Gmail and Outlook included. To turn free-provider addresses away
instead, that rule belongs in `wb_handle_subscribe()` in `inc-blog.php` — say the word and it is a
few lines.

Nothing is sent to the subscribers automatically. This collects the list; sending the actual emails
is still a Mailchimp/Brevo/etc. job.

---

## Rebuilding

```bash
cd build
node build_theme.js                                         # regenerates the generated templates
WP_ROOT="<path to this repo>" node build_zip.js             # repacks axioralabs_wp.zip
```

Run them **from inside `build/`** — `gen_solutions.js` reads `assets.json` relative to the working
directory, so `node build/build_theme.js` from the repo root exits with `ENOENT: assets.json`.

`build_theme.js` writes `functions.php`, `header.php`, `footer.php`, `front-page.php`, `index.php`
and the `template-*.php` files. The blog templates listed above are hand-written and are **not**
regenerated — the build never deletes files it doesn't write, so they survive a rebuild. Edit them
directly in `axioralabs_wp/`.

> `build_theme.js` used to also write `single.php`, from an old version built on `.post-hero` /
> `.post-content-body` / `.wrap-narrow` — class names that do not exist in `blog.css`. A rebuild
> would have silently replaced the article layout with unstyled full-width text. That generator has
> been removed; don't reinstate it.
