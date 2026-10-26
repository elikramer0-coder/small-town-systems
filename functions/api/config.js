// Cloudflare Pages Function: GET /api/config
// Hands the browser the Turnstile *site* key (public by design) so it never has to be hard-coded in the HTML.
export function onRequestGet({ env }) {
  return new Response(JSON.stringify({ turnstileSiteKey: env.TURNSTILE_SITE_KEY || null }), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
