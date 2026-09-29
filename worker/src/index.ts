interface Env {
  DB: D1Database;
  GITHUB_OAUTH_ID: string;
  GITHUB_OAUTH_SECRET: string;
  OAUTH_STATE_SECRET: string;
  VIEW_HASH_SECRET: string;
  SITE_ORIGIN: string;
  ALLOWED_GITHUB_LOGIN: string;
  ALLOWED_GITHUB_ID?: string;
}

interface GitHubTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GitHubUser {
  id: number;
  login: string;
}

const encoder = new TextEncoder();
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function base64Url(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return base64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value))));
}

async function createState(secret: string) {
  const nonce = crypto.getRandomValues(new Uint8Array(18));
  const payload = `${base64Url(nonce)}.${Date.now()}`;
  return `${payload}.${await hmac(payload, secret)}`;
}

async function validState(state: string, cookieState: string | undefined, secret: string) {
  if (!cookieState || state !== cookieState) return false;
  const parts = state.split('.');
  if (parts.length !== 3) return false;
  const payload = `${parts[0]}.${parts[1]}`;
  const age = Date.now() - Number(parts[1]);
  if (!Number.isFinite(age) || age < 0 || age > 10 * 60 * 1000) return false;
  return (await hmac(payload, secret)) === parts[2];
}

function readCookie(request: Request, name: string) {
  const header = request.headers.get('Cookie') ?? '';
  return header.split(';').map((value) => value.trim()).find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1);
}

function callbackPage(status: 'success' | 'error', payload: { token?: string; message?: string }, origin: string) {
  const message = JSON.stringify(payload).replace(/</g, '\\u003c');
  const script = `
    const receiveMessage = () => {
      window.opener?.postMessage('authorization:github:${status}:${message}', ${JSON.stringify(origin)});
      window.removeEventListener('message', receiveMessage);
    };
    window.addEventListener('message', receiveMessage);
    window.opener?.postMessage('authorizing:github', ${JSON.stringify(origin)});
  `;
  return new Response(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>深度思考 · 登录</title></head><body><p>${status === 'success' ? '登录成功，正在返回后台…' : '登录失败，请关闭此窗口。'}</p><script>${script}<\/script></body></html>`, {
    status: status === 'success' ? 200 : 403,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'`,
      'Referrer-Policy': 'no-referrer',
    },
  });
}

async function handleAuth(request: Request, env: Env) {
  const url = new URL(request.url);
  if ((url.searchParams.get('provider') ?? 'github') !== 'github') {
    return new Response('Invalid provider', { status: 400 });
  }
  const state = await createState(env.OAUTH_STATE_SECRET);
  const callback = `${url.origin}/callback?provider=github`;
  const authorize = new URL('https://github.com/login/oauth/authorize');
  authorize.searchParams.set('client_id', env.GITHUB_OAUTH_ID);
  authorize.searchParams.set('redirect_uri', callback);
  authorize.searchParams.set('scope', 'public_repo');
  authorize.searchParams.set('state', state);
  return new Response(null, {
    status: 302,
    headers: {
      Location: authorize.toString(),
      'Set-Cookie': `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
      'Cache-Control': 'no-store',
    },
  });
}

async function handleCallback(request: Request, env: Env) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state || !(await validState(state, readCookie(request, 'oauth_state'), env.OAUTH_STATE_SECRET))) {
    return callbackPage('error', { message: 'OAuth state validation failed' }, env.SITE_ORIGIN);
  }

  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.GITHUB_OAUTH_ID,
      client_secret: env.GITHUB_OAUTH_SECRET,
      code,
      redirect_uri: `${url.origin}/callback?provider=github`,
    }),
  });
  const tokenData = await tokenResponse.json<GitHubTokenResponse>();
  if (!tokenData.access_token) {
    return callbackPage('error', { message: tokenData.error_description ?? tokenData.error ?? 'Token exchange failed' }, env.SITE_ORIGIN);
  }

  const userResponse = await fetch('https://api.github.com/user', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${tokenData.access_token}`,
      'User-Agent': 'deep-thought-cms',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  const user = await userResponse.json<GitHubUser>();
  if (!userResponse.ok || !Number.isFinite(user.id) || typeof user.login !== 'string') {
    return callbackPage('error', { message: 'Unable to verify the GitHub account' }, env.SITE_ORIGIN);
  }
  const expectedId = env.ALLOWED_GITHUB_ID ? Number(env.ALLOWED_GITHUB_ID) : undefined;
  const allowed = expectedId ? user.id === expectedId : user.login.toLowerCase() === env.ALLOWED_GITHUB_LOGIN.toLowerCase();
  if (!allowed) {
    return callbackPage('error', { message: 'This GitHub account is not allowed' }, env.SITE_ORIGIN);
  }

  return callbackPage('success', { token: tokenData.access_token }, env.SITE_ORIGIN);
}

function corsHeaders(request: Request, env: Env) {
  const origin = request.headers.get('Origin');
  const allowed = origin === env.SITE_ORIGIN || origin === 'http://localhost:4321';
  return {
    'Access-Control-Allow-Origin': allowed && origin ? origin : env.SITE_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(data: unknown, request: Request, env: Env, status = 200) {
  return Response.json(data, { status, headers: { ...corsHeaders(request, env), 'Cache-Control': 'no-store' } });
}

async function visitorHash(request: Request, slug: string, day: string, secret: string) {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'local';
  const agent = request.headers.get('User-Agent') ?? 'unknown';
  return hmac(`${ip}|${agent}|${slug}|${day}`, secret);
}

async function handleViews(request: Request, env: Env, context: ExecutionContext, slug: string) {
  if (!slugPattern.test(slug)) return json({ error: 'Invalid slug' }, request, env, 400);
  if (request.method === 'GET') {
    const row = await env.DB.prepare('SELECT total FROM page_views WHERE slug = ?').bind(slug).first<{ total: number }>();
    return json({ slug, total: row?.total ?? 0 }, request, env);
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, request, env, 405);

  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const hash = await visitorHash(request, slug, day, env.VIEW_HASH_SECRET);
  const inserted = await env.DB.prepare(
    'INSERT OR IGNORE INTO daily_visitors (slug, visitor_hash, view_date) VALUES (?, ?, ?)',
  ).bind(slug, hash, day).run();

  if ((inserted.meta.changes ?? 0) > 0) {
    await env.DB.prepare(`
      INSERT INTO page_views (slug, total, updated_at) VALUES (?, 1, ?)
      ON CONFLICT(slug) DO UPDATE SET total = total + 1, updated_at = excluded.updated_at
    `).bind(slug, now.toISOString()).run();
  }
  const row = await env.DB.prepare('SELECT total FROM page_views WHERE slug = ?').bind(slug).first<{ total: number }>();

  if (now.getUTCHours() === 3 && now.getUTCMinutes() < 5) {
    const cutoff = new Date(now.valueOf() - 35 * 86400_000).toISOString().slice(0, 10);
    context.waitUntil(env.DB.prepare('DELETE FROM daily_visitors WHERE view_date < ?').bind(cutoff).run());
  }
  return json({ slug, total: row?.total ?? 0, counted: (inserted.meta.changes ?? 0) > 0 }, request, env);
}

export default {
  async fetch(request: Request, env: Env, context: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    if (url.pathname === '/auth') return handleAuth(request, env);
    if (url.pathname === '/callback') return handleCallback(request, env);
    if (url.pathname === '/health') return json({ ok: true }, request, env);
    const match = url.pathname.match(/^\/api\/views\/([^/]+)$/);
    if (match) {
      try {
        return handleViews(request, env, context, decodeURIComponent(match[1]));
      } catch {
        return json({ error: 'Invalid slug' }, request, env, 400);
      }
    }
    return new Response('Not found', { status: 404 });
  },
};
