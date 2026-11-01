// Automated checks for smalltownsystems.com. Run with `npm test`. No dependencies.
//
//  1. every page loads over HTTP (200, a <title>, exactly one <h1>, a viewport tag)
//  2. no broken internal links, images, scripts, stylesheets or in-page anchors
//  3. no phone number anywhere in the site, the functions or the README
//  4. nothing on the "do not" list: emoji, "I'm Eli", a personal-story opener
//     and no roofing-trade words in the site itself (the examples must read as mixed trades)
//  5. every <img> has alt text; the cube logo on every page and in favicon.svg is the exact geometry
//     of public/img/sts-cube.svg
//  5c. every page: no email address, no personal name, canonical link (404 excepted), noindex only on
//     the 404, listed in sitemap.xml, the same header and footer, and prices that match pricing.json;
//     every "Get a price" form offers exactly the four approved choices
//  6. the contact function: needs, name, email or phone, honeypot, Turnstile, Resend, return paths
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStaticServer, resolveFile } from './static-server.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const FUNCTIONS = path.join(ROOT, 'functions');

let failures = 0;
let passes = 0;
function ok(label) { passes += 1; console.log(`  ok   ${label}`); }
function fail(label, detail) { failures += 1; console.log(`  FAIL ${label}${detail ? `\n       ${detail}` : ''}`); }
function check(condition, label, detail) { condition ? ok(label) : fail(label, detail); }

async function walk(dir, exts) {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full, exts));
    else if (!exts || exts.includes(path.extname(entry.name).toLowerCase())) out.push(full);
  }
  return out;
}

const urlFor = (file) => {
  const rel = path.relative(PUBLIC, file).replace(/\\/g, '/');
  return rel === 'index.html' ? '/' : '/' + rel.replace(/\.html$/, '');
};

// ---------- 1. pages load ----------
async function checkPagesLoad(base, pages) {
  console.log('\nPages load');
  for (const file of pages) {
    const rel = path.relative(PUBLIC, file).replace(/\\/g, '/');
    // the 404 page is checked through a path that does not exist, the way visitors meet it
    const url = rel === 'index.html' ? '/' : rel === '404.html' ? '/this-page-does-not-exist' : '/' + rel.replace(/\.html$/, '');
    const res = await fetch(base + url);
    const html = await res.text();
    const expected = rel === '404.html' ? 404 : 200;
    check(res.status === expected, `${url} responds ${expected}`, `got ${res.status}`);
    check(/<title>[^<]+<\/title>/.test(html), `${url} has a <title>`);
    check((html.match(/<h1[\s>]/g) || []).length === 1, `${url} has exactly one <h1>`);
    check(/<meta name="viewport"/.test(html), `${url} has a viewport meta tag`);
    check(/<html lang="en">/.test(html), `${url} declares lang="en"`);
  }
}

// ---------- 2. internal links ----------
async function checkLinks(pages) {
  console.log('\nInternal links');
  const cssFiles = await walk(PUBLIC, ['.css']);
  const sources = [...pages, ...cssFiles];
  let broken = 0;
  let total = 0;
  for (const file of sources) {
    const text = await fs.readFile(file, 'utf8');
    const refs = new Set();
    for (const m of text.matchAll(/\b(?:href|src|action)=["']([^"']+)["']/g)) refs.add(m[1]);
    for (const m of text.matchAll(/url\(["']?([^"')]+)["']?\)/g)) refs.add(m[1]);
    const ids = new Set([...text.matchAll(/\bid=["']([^"']+)["']/g)].map((m) => m[1]));

    for (const ref of refs) {
      if (/^(https?:|mailto:|tel:|data:|javascript:)/i.test(ref)) continue;
      total += 1;
      const [pathPart, hash] = ref.split('#');
      let target = null;
      if (pathPart === '') {
        target = file; // same-page anchor
      } else if (pathPart.startsWith('/api/')) {
        const fn = path.join(FUNCTIONS, pathPart.slice(1) + '.js');
        try { await fs.access(fn); target = fn; } catch { target = null; }
      } else {
        const abs = pathPart.startsWith('/')
          ? pathPart
          : '/' + path.posix.join(path.posix.dirname(path.relative(PUBLIC, file).replace(/\\/g, '/')), pathPart);
        target = await resolveFile(PUBLIC, abs);
      }
      if (!target) {
        broken += 1;
        fail(`${path.relative(ROOT, file)} -> ${ref}`, 'target does not exist');
        continue;
      }
      if (hash) {
        const targetText = target === file ? text : await fs.readFile(target, 'utf8');
        const targetIds = target === file ? ids : new Set([...targetText.matchAll(/\bid=["']([^"']+)["']/g)].map((m) => m[1]));
        if (!targetIds.has(hash)) {
          broken += 1;
          fail(`${path.relative(ROOT, file)} -> ${ref}`, `no element with id="${hash}"`);
        }
      }
    }
  }
  check(broken === 0, `${total} internal references checked, ${broken} broken`);
}

// ---------- 3 & 4. forbidden content ----------
const PHONE_PATTERNS = [
  /\(\d{3}\)\s*\d{3}[-.\s]?\d{4}/,          // (620) 555-0100
  /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/,         // 620-555-0100, 620.555.0100, 620 555 0100
  /\b1[-.\s]\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/,  // 1-620-555-0100
  /\b\d{10}\b/,                              // 6205550100
  /\btel:/i,                                 // tel: links
];
const FORBIDDEN = [
  { re: /I['’]m Eli/i, why: 'personal intro ("I\'m Eli")' },
  { re: /\bmy story\b/i, why: 'personal story' },
  { re: /\p{Extended_Pictographic}/u, why: 'emoji' },
  { re: /\btestimonial/i, why: 'testimonials' },
];

async function checkForbiddenContent() {
  console.log('\nForbidden content');
  const textExts = ['.html', '.css', '.js', '.svg', '.txt', '.md', '.json'];
  const files = [
    ...await walk(PUBLIC, textExts),
    ...await walk(FUNCTIONS, textExts),
    path.join(ROOT, 'README.md'),
  ];
  let phoneHits = 0;
  let otherHits = 0;
  for (const file of files) {
    let text;
    try { text = await fs.readFile(file, 'utf8'); } catch { continue; }
    const rel = path.relative(ROOT, file);
    for (const re of PHONE_PATTERNS) {
      const m = text.match(re);
      if (m) { phoneHits += 1; fail(`phone number in ${rel}`, `matched "${m[0]}"`); }
    }
    for (const { re, why } of FORBIDDEN) {
      const m = text.match(re);
      if (m) { otherHits += 1; fail(`${why} in ${rel}`, `matched "${m[0]}"`); }
    }
  }
  check(phoneHits === 0, `no phone number in ${files.length} files`);
  check(otherHits === 0, 'no emoji, personal intro or testimonials');

  // The site's examples must read as general small business, never roofing.
  const ROOFING = /\b(?:re-?roof\w*|roof\w*|gutter\w*|shingle\w*)\b/i;
  const siteFiles = [...await walk(PUBLIC, textExts), ...await walk(FUNCTIONS, textExts)];
  let roofHits = 0;
  for (const file of siteFiles) {
    const m = (await fs.readFile(file, 'utf8')).match(ROOFING);
    if (m) { roofHits += 1; fail(`roofing word in ${path.relative(ROOT, file)}`, `matched "${m[0]}"`); }
  }
  check(roofHits === 0, `no roofing words in ${siteFiles.length} site files`);
}

// ---------- 5. alt text ----------
async function checkAltText(pages) {
  console.log('\nImages');
  let missing = 0;
  let count = 0;
  for (const file of pages) {
    const text = await fs.readFile(file, 'utf8');
    for (const m of text.matchAll(/<img\b[^>]*>/g)) {
      count += 1;
      if (!/\balt=/.test(m[0])) { missing += 1; fail(`img without alt in ${path.relative(ROOT, file)}`, m[0]); }
    }
  }
  check(missing === 0, `${count} <img> tags, all with alt`);
}

// ---------- 5b. logo geometry ----------
const isNewPage = () => true; // every page follows the new rules now

async function checkLogo(pages) {
  console.log('\nLogo');
  const src = await fs.readFile(path.join(PUBLIC, 'img', 'sts-cube.svg'), 'utf8');
  const parts = [...src.matchAll(/<(?:polygon|path)\b[^>]*\/>/g)].map((m) => m[0]);
  check(parts.length === 6, `source cube has 3 faces and 3 letters (found ${parts.length})`);
  const targets = [{ name: 'public/favicon.svg', svgs: [await fs.readFile(path.join(PUBLIC, 'favicon.svg'), 'utf8')] }];
  for (const f of pages.filter(isNewPage)) {
    const html = await fs.readFile(f, 'utf8');
    targets.push({ name: path.relative(ROOT, f), svgs: [...html.matchAll(/<svg class="[^"]*"\s+viewBox="52 -12 216 248"[\s\S]*?<\/svg>/g)].map((m) => m[0]) });
  }
  for (const { name, svgs } of targets) {
    const bad = svgs.filter((svg) => parts.some((part) => !svg.includes(part)));
    check(svgs.length > 0 && bad.length === 0, `${name}: ${svgs.length} cube logo(s), all exact source geometry`, svgs.length ? 'a cube differs from public/img/sts-cube.svg' : 'no cube logo found');
  }
}

// ---------- 5c. new-page rules and prices ----------
async function checkNewPages(pages) {
  console.log('\nNew pages and prices');
  const { loadPricing, stamp } = await import(path.join(ROOT, 'scripts', 'prices.js'));
  const pricing = await loadPricing();
  const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/i;
  const NAME = /\bEli\b|\bKramer\b/;
  const shared = [path.join(PUBLIC, 'js', 'form.js')];
  for (const f of [...pages.filter(isNewPage), ...shared]) {
    const text = await fs.readFile(f, 'utf8');
    const rel = path.relative(ROOT, f);
    const email = text.match(EMAIL);
    check(!email, `${rel}: no email address shown`, email && `found "${email[0]}"`);
    const name = text.match(NAME);
    check(!name, `${rel}: no personal name`, name && `found "${name[0]}"`);
    if (!f.endsWith('.html')) continue;
    const is404 = path.basename(f) === '404.html';
    const noindex = /<meta name="robots" content="noindex/.test(text);
    check(is404 ? noindex : !noindex, is404 ? `${rel}: noindex (not-found page)` : `${rel}: indexable`);
    if (!is404) {
      const want = 'https://smalltownsystems.com' + urlFor(f);
      const canon = (text.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
      check(canon === want, `${rel}: canonical ${want}`, `found ${canon}`);
    }
  }

  // sitemap lists every indexable page, and nothing else
  const sitemap = await fs.readFile(path.join(PUBLIC, 'sitemap.xml'), 'utf8');
  const listed = [...sitemap.matchAll(/<loc>https:\/\/smalltownsystems\.com([^<]*)<\/loc>/g)].map((m) => m[1]).sort();
  const expected = pages.filter((f) => path.basename(f) !== '404.html').map(urlFor).sort();
  check(JSON.stringify(listed) === JSON.stringify(expected), `sitemap.xml lists exactly the ${expected.length} pages`, `sitemap: ${listed.join(' ')} / pages: ${expected.join(' ')}`);

  // one header and one footer, the same everywhere (only the current-page marker differs)
  const part = (html, tag) => ((html.match(new RegExp(`<${tag} class="(?:top|foot)[\\s\\S]*?</${tag}>`)) || [''])[0]).replace(/ aria-current="page"/g, '');
  const firstHtml = await fs.readFile(pages[0], 'utf8');
  for (const tag of ['header', 'footer']) {
    const ref = part(firstHtml, tag);
    let same = ref.length > 0;
    for (const f of pages) if (part(await fs.readFile(f, 'utf8'), tag) !== ref) { same = false; fail(`${path.relative(ROOT, f)}: ${tag} differs from ${path.relative(ROOT, pages[0])}`); }
    check(same, `same ${tag} on all ${pages.length} pages`);
  }

  // the "Get a price" form offers exactly the four approved choices, in order
  const NEEDS = ['New website', 'Fix or replace my website', 'Google listing &amp; reviews', 'Notion + AI'];
  let forms = 0;
  for (const f of pages) {
    const html = await fs.readFile(f, 'utf8');
    for (const m of html.matchAll(/<form class="get-price"[\s\S]*?<\/form>/g)) {
      forms += 1;
      const values = [...m[0].matchAll(/name="needs" value="([^"]+)"/g)].map((x) => x[1]);
      check(JSON.stringify(values) === JSON.stringify(NEEDS), `${path.relative(ROOT, f)}: form choices are the approved four`, `found ${values.join(' | ')}`);
    }
  }
  check(forms >= 2, `"Get a price" form on the home and contact pages (${forms} found)`);
  let drift = 0;
  let stamped = 0;
  for (const f of pages) {
    const html = await fs.readFile(f, 'utf8');
    stamped += (html.match(/\bdata-(?:price|list)="/g) || []).length;
    let next;
    try { next = stamp(html, pricing); } catch (e) { drift += 1; fail(`${path.relative(ROOT, f)}: price placeholder`, e.message); continue; }
    if (next !== html) { drift += 1; fail(`${path.relative(ROOT, f)} does not match pricing.json`, 'run `npm run prices` and commit'); }
  }
  check(drift === 0, `${stamped} price and list spots match pricing.json`);
}

// ---------- 6. contact function ----------
async function checkContactFunction() {
  console.log('\nContact function');
  const { onRequestPost } = await import(path.join(FUNCTIONS, 'api', 'contact.js'));
  const { onRequestGet } = await import(path.join(FUNCTIONS, 'api', 'config.js'));

  const ENV = {
    RESEND_API_KEY: 're_test',
    LEAD_FROM: 'Small Town Systems <leads@example.com>',
    TURNSTILE_SECRET_KEY: 'ts_test',
  };
  const GOOD = { needs: ['New website', 'Google listing & reviews'], name: 'Pat', business: 'Main Street Hardware', email: 'pat@example.com', phone: '', message: 'Our old site is slow.', 'cf-turnstile-response': 'token' };

  const calls = [];
  let turnstileSays = true;
  let resendSays = 200;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.includes('challenges.cloudflare.com')) {
      calls.push({ to: 'turnstile', body: init.body });
      return new Response(JSON.stringify({ success: turnstileSays }), { status: 200 });
    }
    if (u.includes('api.resend.com')) {
      calls.push({ to: 'resend', body: JSON.parse(init.body), headers: init.headers });
      return new Response(JSON.stringify({ id: 'email_1' }), { status: resendSays });
    }
    throw new Error('unexpected fetch ' + u);
  };

  async function post(fields, { env = ENV, json = true } = {}) {
    calls.length = 0;
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(fields)) for (const v of [].concat(value)) body.append(key, v);
    const request = new Request('https://smalltownsystems.com/api/contact', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        ...(json ? { accept: 'application/json' } : { accept: 'text/html' }),
      },
      body,
    });
    const res = await onRequestPost({ request, env });
    let data = null;
    if (json) { try { data = await res.json(); } catch { data = null; } }
    return { res, data, resendCalls: calls.filter((c) => c.to === 'resend'), turnstileCalls: calls.filter((c) => c.to === 'turnstile') };
  }

  try {
    let r = await post({ ...GOOD, name: '' });
    check(r.res.status === 400 && r.data?.error === 'missing' && r.data.fields?.includes('name'), 'missing name -> 400 missing');
    check(r.resendCalls.length === 0, 'missing name -> nothing sent');

    r = await post({ ...GOOD, email: '', phone: '' });
    check(r.res.status === 400 && r.data?.error === 'missing' && r.data.fields?.includes('email_or_phone'), 'no email and no phone -> 400 missing');

    r = await post({ ...GOOD, email: '', phone: '555 0100' });
    check(r.res.status === 200 && r.data?.ok === true, 'phone only, no email -> accepted');
    check(r.resendCalls.length === 1 && !('reply_to' in r.resendCalls[0].body), 'phone only -> sent, with no reply-to');

    r = await post({ ...GOOD, email: 'not-an-email' });
    check(r.res.status === 400 && r.data?.error === 'email', 'bad email -> 400 email');

    r = await post({ ...GOOD, needs: [] , message: '' });
    check(r.res.status === 200, 'nothing ticked and no message -> still accepted (name + email is enough)');

    r = await post({ ...GOOD, needs: ['New website', 'Free iPhone', 'Notion + AI'] });
    check(/What they need: New website, Notion \+ AI\n/.test(r.resendCalls[0]?.body?.text || ''), 'unknown choices are dropped; known ones are listed in the email');

    r = await post({ ...GOOD, website: 'http://spam.example' });
    check(r.res.status === 200 && r.data?.ok === true, 'honeypot filled -> fake 200 so the bot moves on');
    check(r.resendCalls.length === 0 && r.turnstileCalls.length === 0, 'honeypot filled -> nothing sent, nothing verified');

    r = await post({ ...GOOD, message: 'x'.repeat(2001) });
    check(r.res.status === 400 && r.data?.error === 'too_long', 'oversized field -> 400 too_long');

    r = await post(GOOD, { env: {} });
    check(r.res.status === 500 && r.data?.error === 'not_configured', 'missing env vars -> 500 not_configured');
    check(r.resendCalls.length === 0, 'missing env vars -> nothing sent');

    r = await post({ ...GOOD, 'cf-turnstile-response': '' });
    check(r.res.status === 400 && r.data?.error === 'turnstile', 'no Turnstile token -> 400 turnstile');

    turnstileSays = false;
    r = await post(GOOD);
    check(r.res.status === 400 && r.data?.error === 'turnstile' && r.resendCalls.length === 0, 'Turnstile says no -> 400, nothing sent');
    turnstileSays = true;

    r = await post(GOOD);
    check(r.res.status === 200 && r.data?.ok === true, 'good submission -> 200 ok');
    check(r.turnstileCalls.length === 1, 'good submission -> Turnstile verified once');
    const sent = r.resendCalls[0]?.body;
    check(r.resendCalls.length === 1, 'good submission -> one email through Resend');
    check(sent?.to?.[0] === 'eli@smalltownsystems.com', 'LEAD_TO unset -> defaults to eli@smalltownsystems.com');
    check(sent?.reply_to === GOOD.email, 'reply-to is the visitor');
    check(sent?.from === ENV.LEAD_FROM, 'from is LEAD_FROM');
    check(typeof sent?.text === 'string' && [GOOD.name, GOOD.business, GOOD.email, GOOD.message, 'New website, Google listing & reviews'].every((t) => sent.text.includes(t)), 'email body carries name, business, email, needs and message');
    check(sent?.subject === 'New lead: Pat, Main Street Hardware', 'subject names the person and the business');
    check(r.resendCalls[0].headers.authorization === 'Bearer re_test', 'Resend key sent as bearer token');

    r = await post(GOOD, { env: { ...ENV, LEAD_TO: 'other@example.com' } });
    check(r.resendCalls[0]?.body?.to?.[0] === 'other@example.com', 'LEAD_TO set -> used');

    resendSays = 500;
    r = await post(GOOD);
    check(r.res.status === 502 && r.data?.error === 'send_failed', 'Resend failure -> 502 send_failed');
    resendSays = 200;

    r = await post(GOOD, { json: false });
    check(r.res.status === 303 && r.res.headers.get('location') === 'https://smalltownsystems.com/contact#sent', 'plain form post -> redirect to /contact#sent');
    r = await post({ ...GOOD, name: '' }, { json: false });
    check(r.res.status === 303 && r.res.headers.get('location') === 'https://smalltownsystems.com/contact#error', 'plain form post with error -> redirect to /contact#error');

    r = await post({ ...GOOD, _return: '/concepts/a' }, { json: false });
    check(r.res.status === 303 && r.res.headers.get('location') === 'https://smalltownsystems.com/concepts/a#sent', 'plain post with _return -> back to that page #sent');
    r = await post({ ...GOOD, name: '', _return: '/concepts/a' }, { json: false });
    check(r.res.headers.get('location') === 'https://smalltownsystems.com/concepts/a#not-sent', 'plain post with _return and an error -> back to that page #not-sent');
    for (const evil of ['//evil.example/x', 'https://evil.example/', '/a b', 'javascript:alert(1)']) {
      r = await post({ ...GOOD, _return: evil }, { json: false });
      check(r.res.headers.get('location') === 'https://smalltownsystems.com/contact#sent', `_return "${evil}" ignored, falls back to /contact`);
    }

    const cfg = await onRequestGet({ env: { TURNSTILE_SITE_KEY: 'site_123' } }).json();
    check(cfg.turnstileSiteKey === 'site_123', '/api/config serves the Turnstile site key');
    const cfgEmpty = await onRequestGet({ env: {} }).json();
    check(cfgEmpty.turnstileSiteKey === null, '/api/config returns null when the key is not set');
  } finally {
    globalThis.fetch = realFetch;
  }
}

// ---------- run ----------
const pages = await walk(PUBLIC, ['.html']);
const server = createStaticServer(PUBLIC);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
try {
  await checkPagesLoad(base, pages);
  await checkLinks(pages);
  await checkForbiddenContent();
  await checkAltText(pages);
  await checkLogo(pages);
  await checkNewPages(pages);
  await checkContactFunction();
} finally {
  server.close();
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
