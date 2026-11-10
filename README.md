# smalltownsystems.com

The website for Small Town Systems: custom websites and Notion + AI office systems for small-town businesses in central Kansas.

Plain static HTML and CSS, one small script for the form, no framework, no build step on Cloudflare. Hosted on Cloudflare Pages. The "Get a price" form posts to a Pages Function that checks Turnstile and a honeypot, then emails the lead through Resend. The design system is written down in `DESIGN.md`.

## What's here

```
public/                    the site, served as-is
  index.html               Home: one-sentence hero with the blocks that build a website, what you get, the Keim site
                           (dark band), prices (white band), how it works, office systems (small band), the form
  websites.html            Websites: everything a site includes, the Keim site, prices
  office-systems.html      Office systems: Notion + AI, two example phones, priced per job (linked from the footer only)
  prices.html              Prices: the four sizes, what building includes, every month, the terms
  contact.html             Get a price: the two-step form
  404.html                 Not found (noindex; Cloudflare serves it with a 404 status)
  css/site.css             all styles; the design tokens are CSS variables at the top
  js/form.js               the two-step "Get a price" form
  js/motion.js             one-time motion: price cubes stack up, the Keim devices slide in, the hero phone drifts
  fonts/                   Sora, self-hosted (one variable woff2) and its license
  img/                     sts-cube.svg (the logo, exact source), keim-site-desktop.webp and keim-site-phone.webp
                           (real screenshots of the Keim site), keim-shop.jpg,
                           og.png (social preview), logo-512.png, favicons
  favicon.svg              the cube
  _headers, _redirects     security headers and font caching; /systems and /concepts/* redirects
  robots.txt, sitemap.xml
functions/api/
  contact.js               POST /api/contact (Turnstile + honeypot + Resend)
  config.js                GET  /api/config (the public Turnstile site key)
pricing.json               every price, plan name and "what's included" line (see Prices)
scripts/prices.js          stamps pricing.json into the pages; release gate
checks/run.js              automated checks, `npm test`
checks/serve.js            local preview, `npm start`
DESIGN.md                  colors, type, spacing, components
.github/workflows/         checks (npm test) and release gate (npm run release-check)
```

Pages use clean URLs (`/websites`, not `/websites.html`), as Cloudflare Pages serves them. The header and footer are the same on every page; a check enforces it, so change them everywhere at once.

Not used by the site, kept because they are Eli's source files: `public/img/sts-town.png` (the town picture), `public/img/sts-logo-blocks.svg` (the old three-cube logo) and `public/img/keim-shop.jpg`. Delete them if they are no longer wanted.

## Run it locally

Needs Node 20 or newer. No `npm install`; there are no dependencies.

```
npm start              # serves public/ at http://localhost:8787 (pages only, no form backend)
npm test               # every check below
npm run prices         # stamp pricing.json into the pages
npm run release-check  # fails while anything in pricing.json is a draft
```

For the form too: `npx wrangler pages dev public` with the env vars in a git-ignored `.dev.vars` file.

## Prices

Every price, plan name and "what's included" line lives in `pricing.json`. To change one, edit it there, run `npm run prices`, commit. The script fills every spot marked `data-price="standard.setup"` or `data-list="monthly"`; no page holds a price of its own, and `npm test` fails if a page and `pricing.json` disagree.

- **Plan names** come from a name set. `"use": "eli"` gives Starter, Premium, Ultra Premium; `"use": "plain"` gives Starter, Plus, Premium. Switching is that one word. Custom stays Custom.
- **Drafts**: anything with `"confirmed": false` shows a dotted amber underline on the page, and `npm run release-check` (the **release gate** check on GitHub) stays red. Do not merge to main while it is red; merging publishes the site.
- Confirmed by Eli on 2026-10-31: the three plan prices and page limits, Custom, office systems, the monthly list and the terms. Still drafts: the plan names and the "building it includes" list.

## The "Get a price" form

Step 1, "What do you need?" (tap any): New website, Fix or replace my website, Google listing & reviews, Notion + AI setup, Something else. "Something else" opens a write-in box. Then, still in step 1: **Business name and town** (one box, required; area or state is fine), **Your website now** (optional), and **Which plan looks right?** (the plan names from `pricing.json`, plus Not sure; optional).

Step 2, "How do we reach you?": **Name** (required), **Phone or email** (one box, required; a phone needs 7 or more digits, an email an @ and a domain), **Best way to reach you** (Call, Text or Email; optional), **Anything else?** (optional).

The lead email lists every answer, including the ones left empty. When the visitor gives an email, replies go to it. Links can preselect a choice: `/contact?need=website`, `fix`, `google`, `notion` or `other`. Without JavaScript both steps and the write-in box show as one form, and the function sends the visitor back with `#sent` or `#not-sent`.

## Motion

The hero blocks assemble once on load (CSS only). The price cubes stack up and the Keim devices slide in once, when they scroll into view, and the hero phone drifts a little on scroll (`js/motion.js`). An inline line in the page head turns these on only when the visitor has not asked for reduced motion; if `motion.js` never loads, it switches them off after 3 seconds so nothing stays hidden. With reduced motion, nothing moves.

## Checks (`npm test`)

1. Every page loads with a title, one `<h1>`, a viewport tag and `lang="en"`; the 404 page answers 404.
2. No broken internal links, images, scripts, stylesheets or anchors.
3. No phone number in `public/`, `functions/` or this README.
4. No emoji, first-person intro, reviews or roofing-trade words in the site.
5. Every image has alt text. Every cube on every page, and `favicon.svg`, is the exact geometry of `public/img/sts-cube.svg`.
6. Every page: no email address, no personal name, a canonical link (not the 404), noindex only on the 404, listed in `sitemap.xml`, the same header and footer, and prices that match `pricing.json`. The form has exactly the five approved choices, the plan names from `pricing.json` plus Not sure, Call / Text / Email, and every approved field.
7. The contact function: business and town, name, and phone or email required; a bad phone or email refused; unknown choices dropped; honeypot swallowed (and a real website answer not mistaken for it); Turnstile required; missing env vars refused; one email through Resend that shows every answer, with the right subject and reply-to; safe return paths for no-JavaScript posts.

## Cloudflare Pages setup

1. Cloudflare dashboard: Workers & Pages, Create, Pages, Connect to Git, pick this repo.
2. Build settings: Framework preset **None**, Build command **blank**, Build output directory **`public`**. Functions in `functions/` are picked up automatically.
3. Settings, Environment variables: add the five variables below for **Production** and for **Preview** (the preview ones can point at a test inbox).
4. Custom domains: add `smalltownsystems.com` and `www.smalltownsystems.com`.
5. Redeploy once after setting the variables; they are read at request time, but the first deploy may have happened before they existed.

### Turnstile

Cloudflare dashboard, Turnstile, Add widget. Hostname `smalltownsystems.com` (add the `*.pages.dev` preview hostname too if the preview form should work). Widget mode Managed. Copy the **site key** into `TURNSTILE_SITE_KEY` and the **secret key** into `TURNSTILE_SECRET_KEY`.

### Resend

Resend dashboard: add and verify the domain `smalltownsystems.com` (DNS records go in Cloudflare), then create an API key with sending access only. `LEAD_FROM` must be an address on that verified domain.

## Environment variables

| Variable | What it is | Default |
| --- | --- | --- |
| `LEAD_TO` | Where contact-form leads are emailed | `eli@smalltownsystems.com` |
| `LEAD_FROM` | The sender, on a domain verified in Resend, e.g. `Small Town Systems <leads@smalltownsystems.com>` | none, required |
| `RESEND_API_KEY` | Resend API key | none, required |
| `TURNSTILE_SITE_KEY` | Turnstile site key (public; served to the browser by `/api/config`) | none, required |
| `TURNSTILE_SECRET_KEY` | Turnstile secret key (server only) | none, required |

Never put any of these in code. Turnstile and Resend are set on Preview and Production. If one goes missing, the function answers "not configured" and the form says it is not switched on yet. The site never shows an email address or phone number; the form is the only way in.

