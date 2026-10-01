# Publishing sheet — USA / UK / UAE consulting pages

Three posts built from your SEO documents. Every value below is taken **verbatim** from the
source PDFs — meta titles, descriptions, slugs, image filenames and alt text.

---

## Heading structure — read this first

Each `.html` file **starts at `<h2>`**. There is no `<h1>` inside the body, and that is deliberate:

- WordPress renders your **post title** as the page's `<h1>` (`single.php`, line 15).
- Adding another `<h1>` in the body would put **two H1s on one page** — a genuine SEO fault that
  splits the page's primary topic signal.

So the `#` in your source docs becomes the **post title field**, and `##` / `###` become the
`<h2>` / `<h3>` tags already in the HTML. The hierarchy your writer specified is preserved exactly.

The body copy sits under each heading as short paragraphs and bullet lists. Headings alone with no
text underneath would give Google nothing to index and reads as keyword stuffing — the structure is
what helps you rank, not the absence of sentences.

---

## 1. USA

| Field | Value |
|---|---|
| **File** | `ai-automation-consulting-services-usa.html` |
| **Post title** | AI Automation Consulting Services in the USA: Identifying High-Impact AI Opportunities |
| **Meta title** | AI Automation Consulting Services USA \| Axiora Labs AI |
| **Meta description** | AI Automation consulting services in the USA to identify high-impact opportunities, assess ROI and readiness, and build a practical AI automation roadmap. |
| **URL slug** | `ai-automation-consulting-services-usa` |
| **Image filename** | `ai-automation-consulting-services-usa.webp` |
| **Image alt text** | AI Automation Consulting Services in the USA for identifying high-impact AI opportunities |
| **Image title text** | AI Automation Consulting Services in the USA |
| **Category** | AI Strategy |
| **Spelling** | US English (analyze, prioritize, organization) — as written in your doc |

## 2. UK

| Field | Value |
|---|---|
| **File** | `ai-automation-consulting-services-uk.html` |
| **Post title** | AI Automation Consulting Services for UK Businesses: A Practical Guide |
| **Meta title** | AI Automation Consulting Services UK \| Axiora Labs AI |
| **Meta description** | AI automation consulting for UK businesses to identify high-impact opportunities, assess readiness and ROI, and develop a practical automation roadmap. |
| **URL slug** | `ai-automation-consulting-services-uk` |
| **Image filename** | `ai-automation-consulting-services-uk.webp` |
| **Image alt text** | AI Automation Consulting Services for UK businesses identifying high-impact AI opportunities |
| **Image title text** | AI Automation Consulting Services for UK Businesses |
| **Category** | AI Strategy |
| **Spelling** | British English (analyse, prioritise, organisation) |

## 3. UAE

| Field | Value |
|---|---|
| **File** | `ai-automation-consulting-services-uae.html` |
| **Post title** | AI Automation Consulting Services in the UAE for Digital Transformation |
| **Meta title** | AI Automation Consulting Services UAE \| Axiora Labs AI |
| **Meta description** | AI automation consulting services in the UAE to identify high-impact opportunities, assess ROI and readiness, and support digital transformation. |
| **URL slug** | `ai-automation-consulting-services-uae` |
| **Image filename** | `ai-automation-consulting-services-uae.webp` |
| **Image alt text** | AI Automation Consulting Services in the UAE supporting business digital transformation |
| **Image title text** | AI Automation Consulting Services in the UAE for Digital Transformation |
| **Category** | AI Strategy |
| **Spelling** | British English |

---

## Three things to decide

**1. The USA slug has a `/blog/` prefix in your doc.**
The USA document specifies `/blog/ai-automation-consulting-services-usa`, while the UK and UAE
documents give bare slugs. Your already-published post sits at `axioralabs.ai/ai-consulting-services-usa-strategy/`
— no `/blog/` prefix — so the site currently uses bare slugs, and I've used bare slugs for all three
to stay consistent.

If you want every post under `/blog/`, change **Settings → Permalinks → Custom Structure** to
`/blog/%postname%/`. Do this **before** publishing — changing it later breaks the URL of every post
already live and needs redirects.

**2. These supersede three existing files.**
`05-ai-automation-consulting-usa.html`, `06-…-uk.html` and `07-…-uae.html` are earlier versions of
these same three articles with different slugs. The new files follow your SEO documents exactly.
I have **not deleted** the old ones — tell me and I will.

If the old versions are already published, do **not** publish these as new posts. Update the
existing posts in place and keep the live slug, or you create duplicate content competing with
itself. Ask me if you want the redirect plan instead.

**3. Two headings differ between your doc's outline and its body copy.**
In the UK document, the contents list at the end and the article body disagree:

| Contents list (p.18) | Body copy (p.3–4) | Used in the file |
|---|---|---|
| Avoid Investing in the Wrong AI Tools | Avoid Wrong AI Investments | Body version |
| Develop a Practical AI Strategy | Define a Realistic AI Strategy | Body version |

I used the body versions since they match the prose that follows them. Say the word if you'd
rather have the contents-list wording — it's a two-line change.

---

## Publishing steps

1. **Posts → Add New**, paste the post title.
2. Editor **⋮ → Code editor**, paste the file contents.
3. Set the **slug** from the table above.
4. **Yoast SEO** panel at the bottom of the edit screen: paste the **meta title** and
   **meta description**. Don't rely on Yoast's auto-generated versions — yours are written to length.
5. Upload the featured image, renamed to the **exact filename** above, and set the **alt text**.
6. Category **AI Strategy**. Publish.

### FAQ rich results

All three end with a Frequently Asked Questions section using `<h3>` for each question. To make those
eligible for FAQ rich results in Google, add them through **Yoast → FAQ block** rather than pasting
JSON-LD into the editor — WordPress strips `<script>` tags from the editor for anyone below
administrator, so hand-pasted schema silently disappears for most users.

### Internal links

Each post links to `/automation-opportunities/` and `/ai-consulting/`. Confirm both pages exist and
are published, or the links will 404 — the site has no `page.php` fallback problem any more, but a
missing page is still a missing page.
