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
  img/                  pictures (see "Placeholders" below)
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
5. Every image has alt text.
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

## Placeholders waiting on Eli

**The real image files are still not on this branch** (checked 2026-10-26: `public/img/` holds only the generated stand-ins, and no other branch or PR comment has them). Stand-ins sit at the exact filenames, so dropping the real files in needs no HTML change.

1. **`public/img/sts-town.png`** is a generated stand-in town. After the real render lands:
   - set the hero `<img>` `width`/`height` attributes in `index.html` to its real pixel size;
   - re-tune `--town-overlap` and the three pill positions (`.tag-1`, `.tag-2`, `.tag-3` in `site.css`) at 390, 768 and 1280+ px, so SMALL TOWNS stays partly behind the buildings and no pill covers the water tower. Below 720 px the pills are a plain row under the picture, so only the overlap matters there.
2. **`public/img/sts-logo-blocks.svg`** is missing, so the cube *geometry* is still drawn from the written description. The *colours* are final: S cubes top `#8A9096`, left `#3A3F44`, right `#5B6268`; T cube top `#2E8A96`, left `#0B5C67`, right `#06363D`; all letters white. When the SVG lands, match the cube shape and letterforms in the inline `<svg class="logo-mark">` in each HTML file and in `public/favicon.svg`, then re-render `public/img/favicon-32.png` and `apple-touch-icon.png`. The triangle layout and the `transform-origin` values in `site.css` assume a cube 34.6 wide by 40 tall on an 88 x 86 canvas.
3. **`public/img/keim-shop.jpg`** is a drawn stand-in. Replace with the real photo, and get the owner's okay or remove the block as above. The mockup text is final: "Keim Metal Buildings", "Steel buildings in central Kansas", "Get an estimate".
4. **Turnstile** site key and secret key.
5. **Resend** API key, domain verification, and the `LEAD_FROM` address.
6. **Cloudflare Pages** project and the custom domain.
