# smalltownsystems.com

The website for Small Town Systems: custom websites and simple Notion + Claude office setups for local businesses in central Kansas.

Plain static HTML and CSS, one small script for the contact form, no framework, no build step. Hosted on Cloudflare Pages. The contact form posts to a Cloudflare Pages Function that checks Turnstile and a honeypot, then emails the lead through Resend.

## What's here

```
public/                 the site, served as-is
  index.html            Home
  websites.html         Websites (the 5-page site, prices, what you own)
  systems.html          Systems (Notion + Claude setup)
  contact.html          Contact form + email
  404.html              Not-found page (Cloudflare Pages serves it automatically)
  css/site.css          all styles, including the logo animation
  js/contact.js         contact form: Turnstile, submit, success/failure messages
  img/                  sts-town.png (hero), keim-shop.jpg (Keim example), sts-logo-blocks.svg (logo source), favicons
  favicon.svg           static version of the logo
functions/api/
  contact.js            POST /api/contact  (Turnstile + honeypot + Resend)
  config.js             GET  /api/config   (hands the browser the public Turnstile site key)
checks/
  run.js                automated checks, `npm test`
  serve.js              local preview server, `npm start`
.github/workflows/checks.yml   runs `npm test` on every push and pull request
```

Pages link to each other with clean URLs (`/websites`, not `/websites.html`), which is how Cloudflare Pages serves them. The local preview server does the same.

## Run it locally

Needs Node 20 or newer. No `npm install`; there are no dependencies.

```
npm start      # serves public/ at http://localhost:8787 (pages only, no form backend)
npm test       # runs every check below
```

To run the contact form locally too, use Cloudflare's own tool: `npx wrangler pages dev public` with the env vars in a `.dev.vars` file (that file is git-ignored).

## Checks (`npm test`)

1. Every page loads over HTTP with a title, exactly one `<h1>`, a viewport tag and `lang="en"`.
2. No broken internal links, images, scripts, stylesheets or in-page anchors.
3. No phone number anywhere in `public/`, `functions/` or this README.
4. No emoji, no first-person intro, no customer reviews (the checker looks for the literal phrases), and no roofing-trade words anywhere in `public/` or `functions/`, so the examples read as mixed trades.
5. Every image has alt text, and the logo on every page and in `favicon.svg` contains the exact polygons and letter paths from `public/img/sts-logo-blocks.svg`.
6. The contact function rejects missing fields, bad emails and oversized fields; swallows the honeypot without sending; refuses without a Turnstile pass; refuses when env vars are missing; sends one email through Resend when everything is right; and redirects plain (no-JavaScript) form posts to `/contact#sent` or `/contact#error`.

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

`public/img/sts-logo-blocks.svg` is the source: three isometric cubes in a row (S, T, S). The nav logo and `public/favicon.svg` copy its nine face polygons and three letter paths exactly and only move each cube into a triangle, teal T on top. The S cubes are darker on the left and the T cube darker on the right, as in the source. The cubes sit 146 units apart, more than two cube-heights tip to tip, so they never touch while they dance and rotate. If the source logo changes, the logo check in `npm test` fails until the inline `<svg class="logo-mark">` in each page and `favicon.svg` are rebuilt from it; the animation's `transform-origin` values in `site.css` are the triangle's centroid and each cube's centre.

## Hero tuning

Tuned for the real `sts-town.png` (1800 x 1451) at 390, 720, 768, 1024, 1280, 1440, 1600 and 1920 px wide:

- `--town-overlap` (0.85, desktop) and `--town-overlap-phone` (0.7, under 720 px) in `site.css` set how far the picture climbs over the giant letters. At these values the grain elevator, silos and water tower stand in front of TOWNS (about 12% of its letter pixels hidden on phones, 17 to 19% on wider screens) and SMALL stays fully clear.
- The three pills (`.tag-1`, `.tag-2`, `.tag-3`) are placed in % of the picture: off the left corner, in the open space right of the church, and on the shadow under the front corner. None of them touches the water tower or the letters at any of those widths. Under 720 px they become a plain row under the picture.

## Still waiting on Eli

1. **Keim's okay** to be shown. Until then, remove the block as described above if the site goes live first.
2. **Turnstile** site key and secret key, set as Pages environment variables.
3. **Resend** API key, domain verification, and the `LEAD_FROM` address.
4. **Custom domain** on the Cloudflare Pages project.

Until 2 and 3 are set for the environment being viewed (Preview or Production), the contact form shows "The form isn't connected yet" and points visitors to the email address.
