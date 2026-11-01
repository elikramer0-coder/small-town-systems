// Stamps prices and "what's included" lists from pricing.json into every HTML page in public/.
//
//   npm run prices          rewrite the pages from pricing.json
//   npm run release-check   fail while anything in pricing.json is still a draft ("confirmed": false)
//
// In the HTML, mark where a value goes and leave the content to this script:
//   <span data-price="standard.setup"></span>    -> $500
//   <span data-price="standard.monthly"></span>  -> $200
//   <span data-price="standard.pages"></span>    -> 5
//   <span data-price="standard.name"></span>     -> Standard
//   <span data-price="custom.price"></span>      -> Priced per job
//   <ul data-list="monthly"></ul>                -> one <li> per item
// Drafts get a data-draft attribute, which the CSS marks with a dotted amber underline.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PUBLIC = path.join(ROOT, 'public');

export async function loadPricing() {
  return JSON.parse(await fs.readFile(path.join(ROOT, 'pricing.json'), 'utf8'));
}

const money = (n) => '$' + Number(n).toLocaleString('en-US');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function lookup(pricing, key) {
  const [group, field] = key.split('.');
  if (pricing.plans[group]) {
    const plan = pricing.plans[group];
    if (!(field in plan)) throw new Error(`pricing.json: plan "${group}" has no "${field}"`);
    const value = field === 'setup' || field === 'monthly' ? money(plan[field]) : String(plan[field]);
    return { value, confirmed: plan.confirmed === true };
  }
  const item = pricing[group];
  if (!item || !(field in item)) throw new Error(`pricing.json has no "${key}"`);
  return { value: String(item[field]), confirmed: item.confirmed === true };
}

function setDraft(attrs, isDraft) {
  const clean = attrs.replace(/\sdata-draft(="[^"]*")?/g, '');
  return isDraft ? `${clean} data-draft` : clean;
}

// Returns the page with every marked spot filled in from pricing.json.
export function stamp(html, pricing) {
  let out = html.replace(/<(\w+)(\s[^>]*?\bdata-price="([^"]+)"[^>]*)>([\s\S]*?)<\/\1>/g, (_m, tag, attrs, key) => {
    const { value, confirmed } = lookup(pricing, key);
    return `<${tag}${setDraft(attrs, !confirmed)}>${esc(value)}</${tag}>`;
  });
  out = out.replace(/<(ul|ol)(\s[^>]*?\bdata-list="([^"]+)"[^>]*)>([\s\S]*?)<\/\1>/g, (_m, tag, attrs, key, inner) => {
    const list = pricing.lists[key];
    if (!list) throw new Error(`pricing.json has no list "${key}"`);
    const indent = (inner.match(/\n([ \t]*)<li/) || [, ''])[1];
    const close = (inner.match(/\n([ \t]*)$/) || [, ''])[1];
    const items = list.items.map((t) => `\n${indent || close + '  '}<li>${esc(t)}</li>`).join('');
    return `<${tag}${setDraft(attrs, list.confirmed !== true)}>${items}\n${close}</${tag}>`;
  });
  return out;
}

export async function htmlFiles(dir = PUBLIC) {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await htmlFiles(full));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

export function drafts(pricing) {
  const list = [];
  for (const [id, plan] of Object.entries(pricing.plans)) if (plan.confirmed !== true) list.push(`plan "${id}" (${plan.name})`);
  for (const id of ['custom', 'systems']) if (pricing[id] && pricing[id].confirmed !== true) list.push(`"${id}" price`);
  for (const [id, l] of Object.entries(pricing.lists)) if (l.confirmed !== true) list.push(`list "${id}"`);
  return list;
}

async function main() {
  const pricing = await loadPricing();
  if (process.argv.includes('--gate')) {
    const open = drafts(pricing);
    if (open.length) {
      console.log('Release gate: these prices or lists are still drafts in pricing.json:');
      for (const d of open) console.log(`  - ${d}`);
      console.log('Set "confirmed": true once Eli has confirmed them.');
      process.exit(1);
    }
    console.log('Release gate: every price and list in pricing.json is confirmed.');
    return;
  }
  let changed = 0;
  for (const file of await htmlFiles()) {
    const html = await fs.readFile(file, 'utf8');
    const next = stamp(html, pricing);
    if (next !== html) { await fs.writeFile(file, next); changed += 1; console.log(`stamped ${path.relative(ROOT, file)}`); }
  }
  console.log(changed ? `${changed} page(s) updated from pricing.json` : 'all pages already match pricing.json');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await main();
