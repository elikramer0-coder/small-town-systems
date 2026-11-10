// Cloudflare Pages Function: POST /api/contact
// Takes the "Get a price" form, checks Cloudflare Turnstile and a honeypot field, then emails the lead with Resend.
//
// Fields (step 1): needs (any of NEEDS), needs_other (write-in for "Something else"),
//   business (business name and town, required), current_site (optional), plan (optional).
// Fields (step 2): name (required), contact (phone or email, required), reach_by (Call / Text / Email, optional),
//   message (optional).
//
// Environment variables (set in the Cloudflare Pages project, never in code):
//   LEAD_TO              where leads go. Defaults to the address in DEFAULT_TO
//   LEAD_FROM            the sender, on a domain verified in Resend, e.g. "Small Town Systems <leads@smalltownsystems.com>"
//   RESEND_API_KEY       Resend API key
//   TURNSTILE_SECRET_KEY Turnstile secret key (the site key is served by /api/config)

const DEFAULT_TO = 'eli@smalltownsystems.com';
const HONEYPOT_FIELD = 'hp_extra';
const TURNSTILE_FIELD = 'cf-turnstile-response';
const NEEDS = ['New website', 'Fix or replace my website', 'Google listing & reviews', 'Notion + AI setup', 'Something else'];
const REACH = ['Call', 'Text', 'Email'];
const LIMITS = { business: 200, current_site: 300, needs_other: 200, plan: 40, name: 100, contact: 200, message: 2000 };
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const RESEND_URL = 'https://api.resend.com/emails';

export async function onRequestPost(context) {
  const { request, env } = context;
  let returnTo = '';
  const wantsJson = /application\/json/i.test(request.headers.get('accept') || '');

  const reply = (status, body) => {
    if (wantsJson) {
      return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      });
    }
    // Plain HTML form post (no JavaScript): send the visitor back to the page they came from.
    const page = safeReturnPath(returnTo);
    const hash = page === '/contact' ? (body.ok ? '#sent' : '#not-sent') : (body.ok ? '#sent' : '#not-sent');
    return Response.redirect(new URL(page + hash, request.url).toString(), 303);
  };

  let fields;
  try {
    fields = await readFields(request);
    returnTo = fields._return;
  } catch {
    return reply(400, { ok: false, error: 'bad_request' });
  }

  // Honeypot: bots fill every field. Pretend it worked and send nothing.
  if (fields[HONEYPOT_FIELD]) {
    return reply(200, { ok: true });
  }

  const missing = ['business', 'name', 'contact'].filter((key) => !fields[key]);
  if (missing.length) {
    return reply(400, { ok: false, error: 'missing', fields: missing });
  }
  if (!looksLikeContact(fields.contact)) {
    return reply(400, { ok: false, error: 'contact' });
  }
  const tooLong = Object.keys(LIMITS).filter((key) => (fields[key] || '').length > LIMITS[key]);
  if (tooLong.length) {
    return reply(400, { ok: false, error: 'too_long', fields: tooLong });
  }

  if (!env.TURNSTILE_SECRET_KEY || !env.RESEND_API_KEY || !env.LEAD_FROM) {
    return reply(500, { ok: false, error: 'not_configured' });
  }

  const human = await verifyTurnstile(fields[TURNSTILE_FIELD], env.TURNSTILE_SECRET_KEY, request.headers.get('cf-connecting-ip'));
  if (!human) {
    return reply(400, { ok: false, error: 'turnstile' });
  }

  const sent = await sendLead(fields, env);
  if (!sent) {
    return reply(502, { ok: false, error: 'send_failed' });
  }

  return reply(200, { ok: true });
}

async function readFields(request) {
  const type = (request.headers.get('content-type') || '').toLowerCase();
  let raw = {};
  let needs = [];
  if (type.includes('application/json')) {
    raw = await request.json();
    needs = Array.isArray(raw.needs) ? raw.needs : raw.needs ? [raw.needs] : [];
  } else {
    const form = await request.formData();
    for (const [key, value] of form.entries()) if (key !== 'needs') raw[key] = value;
    needs = form.getAll('needs');
  }
  const out = {};
  for (const key of ['business', 'current_site', 'needs_other', 'plan', 'name', 'contact', 'reach_by', 'message', '_return', HONEYPOT_FIELD, TURNSTILE_FIELD]) {
    out[key] = typeof raw[key] === 'string' ? raw[key].trim() : '';
  }
  out.needs = NEEDS.filter((n) => needs.includes(n));
  out.reach_by = REACH.includes(out.reach_by) ? out.reach_by : '';
  return out;
}

// A phone (at least 7 digits) or an email (something@domain.tld).
function looksLikeContact(value) {
  if (value.includes('@')) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  return (value.match(/\d/g) || []).length >= 7;
}

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

// Only a plain path on this site, like /prices. Anything else (other sites, //host, odd characters) goes to /contact.
function safeReturnPath(value) {
  return typeof value === 'string' && /^\/[a-z0-9/_-]*$/i.test(value) && !value.startsWith('//') ? value : '/contact';
}

async function verifyTurnstile(token, secret, ip) {
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set('remoteip', ip);
  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, { method: 'POST', body });
    if (!res.ok) return false;
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}

// Every answer from the form, in the order the visitor gave them.
function leadText(f) {
  const needs = f.needs.length ? f.needs.join(', ') : '(nothing ticked)';
  return [
    'STEP 1',
    `What they need: ${needs}`,
    `Something else: ${f.needs_other || '(not given)'}`,
    `Business and town: ${f.business}`,
    `Website now: ${f.current_site || '(not given)'}`,
    `Plan that looks right: ${f.plan || '(not picked)'}`,
    '',
    'STEP 2',
    `Name: ${f.name}`,
    `Phone or email: ${f.contact}`,
    `Best way to reach them: ${f.reach_by || '(not picked)'}`,
    'Anything else:',
    f.message || '(nothing)',
    '',
    `Sent from the smalltownsystems.com "Get a price" form on ${new Date().toISOString()}`,
  ].join('\n');
}

async function sendLead(fields, env) {
  const message = {
    from: env.LEAD_FROM,
    to: [env.LEAD_TO || DEFAULT_TO],
    subject: `New lead: ${fields.name}, ${fields.business}`,
    text: leadText(fields),
  };
  if (isEmail(fields.contact)) message.reply_to = fields.contact;
  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(message),
    });
    return res.ok;
  } catch {
    return false;
  }
}
