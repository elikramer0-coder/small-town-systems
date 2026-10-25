// Cloudflare Pages Function: POST /api/contact
// Takes the contact form, checks Cloudflare Turnstile and a honeypot field, then emails the lead with Resend.
//
// Environment variables (set in the Cloudflare Pages project, never in code):
//   LEAD_TO              where leads go. Defaults to eli@smalltownsystems.com
//   LEAD_FROM            the sender, on a domain verified in Resend, e.g. "Small Town Systems <leads@smalltownsystems.com>"
//   RESEND_API_KEY       Resend API key
//   TURNSTILE_SECRET_KEY Turnstile secret key (the site key is served by /api/config)

const DEFAULT_TO = 'eli@smalltownsystems.com';
const HONEYPOT_FIELD = 'website';
const TURNSTILE_FIELD = 'cf-turnstile-response';
const LIMITS = { name: 100, email: 200, phone: 40, business: 2000 };
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const RESEND_URL = 'https://api.resend.com/emails';

export async function onRequestPost(context) {
  const { request, env } = context;
  const wantsJson = /application\/json/i.test(request.headers.get('accept') || '');

  const reply = (status, body) => {
    if (wantsJson) {
      return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      });
    }
    // Plain HTML form post (no JavaScript): bounce back to the page with a message.
    const target = new URL(body.ok ? '/contact#sent' : '/contact#error', request.url);
    return Response.redirect(target.toString(), 303);
  };

  let fields;
  try {
    fields = await readFields(request);
  } catch {
    return reply(400, { ok: false, error: 'bad_request' });
  }

  // Honeypot: bots fill every field. Pretend it worked and send nothing.
  if (fields[HONEYPOT_FIELD]) {
    return reply(200, { ok: true });
  }

  const missing = ['name', 'email', 'business'].filter((key) => !fields[key]);
  if (missing.length) {
    return reply(400, { ok: false, error: 'missing', fields: missing });
  }
  if (!looksLikeEmail(fields.email)) {
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
  if (type.includes('application/json')) {
    raw = await request.json();
  } else {
    const form = await request.formData();
    for (const [key, value] of form.entries()) raw[key] = value;
  }
  const out = {};
  for (const key of ['name', 'email', 'phone', 'business', HONEYPOT_FIELD, TURNSTILE_FIELD]) {
    out[key] = typeof raw[key] === 'string' ? raw[key].trim() : '';
  }
  return out;
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
    `Email: ${fields.email}`,
    `Phone: ${fields.phone || '(not given)'}`,
    '',
    'Business:',
    fields.business,
    '',
    `Sent from the smalltownsystems.com contact form on ${new Date().toISOString()}`,
  ].join('\n');

  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: env.LEAD_FROM,
        to: [to],
        reply_to: fields.email,
        subject: `New lead: ${fields.name}`,
        text,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
