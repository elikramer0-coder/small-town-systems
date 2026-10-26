// Automated checks for smalltownsystems.com. Run with `npm test`. No dependencies.
//
//  1. every page loads over HTTP (200, a <title>, exactly one <h1>, a viewport tag)
//  2. no broken internal links, images, scripts, stylesheets or in-page anchors
//  3. no phone number anywhere in the site, the functions or the README
//  4. nothing on the "do not" list: emoji, "I'm Eli", a personal-story opener
//     and no roofing-trade words in the site itself (the examples must read as mixed trades)
//  5. every <img> has an alt attribute, and the logo on every page (and the favicon) is built from
//     the exact polygons and letter paths in public/img/sts-logo-blocks.svg
//  6. the contact function rejects missing fields, bad emails and the honeypot,
//     refuses when Turnstile fails, and sends through Resend when everything is right
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
async function checkLogo(pages) {
  console.log('\nLogo');
  const src = await fs.readFile(path.join(PUBLIC, 'img', 'sts-logo-blocks.svg'), 'utf8');
  const parts = [...src.matchAll(/<(?:polygon|path)\b[^>]*\/>/g)].map((m) => m[0]);
  check(parts.length === 12, `source logo has 9 faces and 3 letters (found ${parts.length})`);
  const targets = [
    ...await Promise.all(pages.map(async (f) => {
      const html = await fs.readFile(f, 'utf8');
      const m = html.match(/<svg class="logo-mark"[\s\S]*?<\/svg>/);
      return { name: path.relative(ROOT, f), svg: m ? m[0] : '' };
    })),
    { name: 'public/favicon.svg', svg: await fs.readFile(path.join(PUBLIC, 'favicon.svg'), 'utf8') },
  ];
  for (const { name, svg } of targets) {
    const missingParts = parts.filter((part) => !svg.includes(part));
    check(svg && missingParts.length === 0, `${name} logo uses the exact source geometry`, missingParts[0]);
  }
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
  const GOOD = { name: 'Pat', email: 'pat@example.com', phone: '', business: 'Hardware store on Main.', 'cf-turnstile-response': 'token' };

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
    const body = new URLSearchParams(fields);
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

    r = await post({ ...GOOD, email: '' });
    check(r.res.status === 400 && r.data?.error === 'missing', 'missing email -> 400 missing');

    r = await post({ ...GOOD, business: '   ' });
    check(r.res.status === 400 && r.data?.error === 'missing', 'blank business -> 400 missing');

    r = await post({ ...GOOD, email: 'not-an-email' });
    check(r.res.status === 400 && r.data?.error === 'email', 'bad email -> 400 email');

    r = await post({ ...GOOD, website: 'http://spam.example' });
    check(r.res.status === 200 && r.data?.ok === true, 'honeypot filled -> fake 200 so the bot moves on');
    check(r.resendCalls.length === 0 && r.turnstileCalls.length === 0, 'honeypot filled -> nothing sent, nothing verified');

    r = await post({ ...GOOD, business: 'x'.repeat(2001) });
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
    check(typeof sent?.text === 'string' && sent.text.includes(GOOD.business) && sent.text.includes(GOOD.name), 'email body carries the lead');
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
  await checkContactFunction();
} finally {
  server.close();
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
