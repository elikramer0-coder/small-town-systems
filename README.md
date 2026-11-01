# smalltownsystems.com

The website for Small Town Systems: custom websites and simple Notion + Claude office setups for local businesses in central Kansas.

Plain static HTML and CSS, one small script for the contact form, no framework, no build step. Hosted on Cloudflare Pages. The contact form posts to a Cloudflare Pages Function that checks Turnstile and a honeypot, then emails the lead through Resend.

## Where this stands (Phase 1 of the redesign)

Three home page directions are up for review at `/concepts/` (A, B and C). They are full pages with real copy, marked `noindex` and linked from nowhere. The old pages (`index`, `websites`, `systems`, `contact`) are still the first version and get replaced in Phase 2, once one direction is picked. Until then they still show the old three-cube logo and an email address, which the new direction drops.

## What's here

```
public/                 the site, served as-is
  index.html            Home
  websites.html         Websites (the 5-page site, prices, what you own)
  systems.html          Systems (Notion + Claude setup)
  contact.html          Contact form + email
  404.html              Not-found page (Cloudflare Pages serves it automatically)
  css/site.css          all styles, including the logo animation
  js/contact.js         old contact form script (old contact page only)
  js/form.js            contact form script for new pages: any <form data-contact>, no email address in any message
  concepts/             the three home page directions (a.html, b.html, c.html), their styles, and an index with screenshots
  img/                  sts-cube.svg (the logo, exact source), town pictures, keim-shop.jpg, favicons
  favicon.svg           the cube logo
  _headers              keeps /concepts/ out of search results
pricing.json            every price and "what's included" line on the site (see Prices)
scripts/prices.js       stamps pricing.json into the pages; `npm run prices`, `npm run release-check`
functions/api/
  contact.js            POST /api/contact  (Turnstile + honeypot + Resend)
  config.js             GET  /api/config   (hands the browser the public Turnstile site key)
checks/
  run.js                automated checks, `npm test`
  serve.js              local preview server, `npm start`
.github/workflows/checks.yml        runs `npm test` on every push and pull request
.github/workflows/release-gate.yml  red while any price is a draft; don't merge to main while it's red
```

Pages link to each other with clean URLs (`/websites`, not `/websites.html`), which is how Cloudflare Pages serves them. The local preview server does the same.

## Run it locally

Needs Node 20 or newer. No `npm install`; there are no dependencies.

```
npm start      # serves public/ at http://localhost:8787 (pages only, no form backend)
npm test       # runs every check below
```

To run the contact form locally too, use Cloudflare's own tool: `npx wrangler pages dev public` with the env vars in a `.dev.vars` file (that file is git-ignored).

## Prices

Every price and every "what's included" line lives in `pricing.json`, one line per plan. To change a price: edit that line, run `npm run prices`, commit. The script rewrites every spot in the pages marked `data-price="standard.setup"` (or `data-list="monthly"`), so no page holds a price of its own. `npm test` fails if a page and `pricing.json` disagree.

Anything with `"confirmed": false` is a draft. Drafts show on the page with a dotted amber underline, and `npm run release-check` (the **release gate** check on GitHub) stays red until every one is set to `"confirmed": true`. All plan prices, the custom price, and the three lists (building, monthly, terms) are drafts until Eli confirms them. The office-systems price ("Priced per job. Ask.") is confirmed.

## Checks (`npm test`)

1. Every page loads over HTTP with a title, exactly one `<h1>`, a viewport tag and `lang="en"`.
2. No broken internal links, images, scripts, stylesheets or in-page anchors.
3. No phone number anywhere in `public/`, `functions/` or this README.
4. No emoji, no first-person intro, no customer reviews (the checker looks for the literal phrases), and no roofing-trade words anywhere in `public/` or `functions/`, so the examples read as mixed trades.
5. Every image has alt text. The cube logo on every new page and in `favicon.svg` is the exact geometry of `public/img/sts-cube.svg`.
6. New pages: no email address, no personal name, marked `noindex` (concepts only), and every price and list matches `pricing.json`.
7. The contact function rejects missing fields, bad emails and oversized fields; swallows the honeypot without sending; refuses without a Turnstile pass; refuses when env vars are missing; sends one email through Resend when everything is right. A plain (no-JavaScript) form post goes back to the page it came from with `#sent` or `#not-sent`; anything but a plain path on this site falls back to `/contact`.

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

Never put any of these in code. Until `LEAD_FROM`, `RESEND_API_KEY` and `TURNSTILE_SECRET_KEY` are set, the function answers "not configured" and the page tells visitors to email instead. Until `TURNSTILE_SITE_KEY` is set, the Send button stays disabled with the same message.

## Removing the Keim example

The owner has not yet approved being shown. The Keim phone on the home page is one block between the comments `KEIM EXAMPLE: START` and `KEIM EXAMPLE: END` in `public/index.html`. Delete that block and `public/img/keim-shop.jpg`; the other two phones re-centre on their own.

## Logo

The logo is the single cube in `public/img/sts-cube.svg` (teal top, charcoal sides, white S, S and T). Pages use it inline, copied exactly; `favicon.svg` is the same file. Now and then it does a small hop and wobble; it never spins, and with reduced motion turned on it stays still. The three-cube triangle is retired; `sts-logo-blocks.svg` is kept only as the old source.

## Hero tuning (old home page)

Applies to the old home page only, which Phase 2 replaces. Tuned for the real `sts-town.png` (1800 x 1451) at 390, 720, 768, 1024, 1280, 1440, 1600 and 1920 px wide:

- `--town-overlap` (0.85, desktop) and `--town-overlap-phone` (0.7, under 720 px) in `site.css` set how far the picture climbs over the giant letters. At these values the grain elevator, silos and water tower stand in front of TOWNS (about 12% of its letter pixels hidden on phones, 17 to 19% on wider screens) and SMALL stays fully clear.
- The three pills (`.tag-1`, `.tag-2`, `.tag-3`) are placed in % of the picture: off the left corner, in the open space right of the church, and on the shadow under the front corner. None of them touches the water tower or the letters at any of those widths. Under 720 px they become a plain row under the picture.

## Still waiting on Eli

1. **Pick a direction** at `/concepts/` (A, B or C). Phase 2 builds the whole site in it.
2. **Confirm the prices and lists** in `pricing.json` (plans, custom, what building includes, what each month includes, the terms). Each is a one-line change; the release gate stays red until all are confirmed.
3. **Keim example**: approved. A real screenshot of their live site would replace the drawn phone.
