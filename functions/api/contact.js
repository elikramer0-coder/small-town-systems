// Cloudflare Pages Function: POST /api/contact
// Takes the "Get a price" form, checks Cloudflare Turnstile and a honeypot field, then emails the lead with Resend.
// Fields: needs (any of NEEDS), name, business (optional), email and/or phone (at least one), message (optional).
//
// Environment variables (set in the Cloudflare Pages project, never in code):
//   LEAD_TO              where leads go. Defaults to eli@smalltownsystems.com
//   LEAD_FROM            the sender, on a domain verified in Resend, e.g. "Small Town Systems <leads@smalltownsystems.com>"
//   RESEND_API_KEY       Resend API key
//   TURNSTILE_SECRET_KEY Turnstile secret key (the site key is served by /api/config)

const DEFAULT_TO = 'eli@smalltownsystems.com';
const HONEYPOT_FIELD = 'website';
const TURNSTILE_FIELD = 'cf-turnstile-response';
const LIMITS = { name: 100, email: 200, phone: 40, business: 200, message: 2000 };
// The four choices in step 1 of the form. Anything else is ignored.
const NEEDS = ['New website', 'Fix or replace my website', 'Google listing & reviews', 'Notion + AI'];
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
    const hash = page === '/contact' ? (body.ok ? '#sent' : '#error') : (body.ok ? '#sent' : '#not-sent');
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

  // A name, and a way to answer: an email or a phone (owners who don't use email can leave a phone).
  const missing = [];
  if (!fields.name) missing.push('name');
  if (!fields.email && !fields.phone) missing.push('email_or_phone');
  if (missing.length) {
    return reply(400, { ok: false, error: 'missing', fields: missing });
  }
  if (fields.email && !looksLikeEmail(fields.email)) {
    return reply(400, { ok: false, error: 'email' });
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
  for (const key of ['name', 'email', 'phone', 'business', 'message', '_return', HONEYPOT_FIELD, TURNSTILE_FIELD]) {
    out[key] = typeof raw[key] === 'string' ? raw[key].trim() : '';
  }
  out.needs = NEEDS.filter((n) => needs.includes(n));
  return out;
}

// Only a plain path on this site, like /concepts/a. Anything else (other sites, //host, odd characters) goes to /contact.
function safeReturnPath(value) {
  return typeof value === 'string' && /^\/[a-z0-9/_-]*$/i.test(value) && !value.startsWith('//') ? value : '/contact';
}

function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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

async function sendLead(fields, env) {
  const to = env.LEAD_TO || DEFAULT_TO;
  const text = [
    `Name: ${fields.name}`,
    `Business: ${fields.business || '(not given)'}`,
    `Email: ${fields.email || '(not given)'}`,
    `Phone: ${fields.phone || '(not given)'}`,
    '',
    `What they need: ${fields.needs.length ? fields.needs.join(', ') : '(nothing ticked)'}`,
    '',
    'Anything else:',
    fields.message || '(nothing)',
    '',
    `Sent from the smalltownsystems.com "Get a price" form on ${new Date().toISOString()}`,
  ].join('\n');
  const subject = `New lead: ${fields.name}${fields.business ? `, ${fields.business}` : ''}`;
  const message = {
    from: env.LEAD_FROM,
    to: [to],
    subject,
    text,
  };
  if (fields.email) message.reply_to = fields.email;

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
