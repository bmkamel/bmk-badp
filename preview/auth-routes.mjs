import {configured} from './auth.mjs';
import {beginOAuth, exchangeIdentity} from './oauth.mjs';
import {authStore, oauthLifetimeMs} from './auth-state.mjs';

const origin = 'https://badp-r1-preview.bmkamel.workers.dev';
const sessionCookie = '__Host-badp-session';
const headers = {'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff'};
const cookie = (name, value, age) => name+'='+value+'; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age='+age;
const transactionCookie = state => '__Host-badp-oauth-'+state;

function read(request, name) {
  const matches = (request.headers.get('Cookie') ?? '').split(';').map(value => value.trim())
    .filter(value => value.startsWith(name+'='));
  return matches.length === 1 ? matches[0].slice(name.length+1) : null;
}

function redirect(location, cookies = []) {
  const responseHeaders = new Headers({...headers, Location: location});
  for (const value of cookies) responseHeaders.append('Set-Cookie', value);
  return new Response(null, {status: 303, headers: responseHeaders});
}

const failures = Object.freeze({
  invalid_oauth_transaction: 'Start again from the BADP homepage and complete sign-in in the same browser.',
  oauth_code: 'GitHub could not accept this sign-in request. Start again from the BADP homepage.',
  oauth_email: 'Verify your primary email on GitHub and try again.',
  account_not_authorized: 'Sign in using the GitHub account authorized for BADP.',
  oauth_credentials: 'BADP could not authenticate its GitHub application.',
  oauth_redirect: 'GitHub rejected the BADP callback address.',
  oauth_exchange_failed: 'BADP could not complete the GitHub sign-in.',
  identity_failed: 'BADP could not verify your GitHub account.',
});

export const authReady = env => configured(env) && Boolean(env.AUTH_DB?.prepare);

export async function authenticated(request, env) {
  try {
    return authReady(env) && await authStore(env.AUTH_DB).verify(read(request, sessionCookie), env.GITHUB_ALLOWED_ID);
  } catch {
    return false;
  }
}

export async function authRoute(request, env, fetcher = (...args) => globalThis.fetch(...args)) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/auth/')) return null;
  if (url.origin !== origin || !authReady(env)) return new Response('Authentication unavailable', {status: 503, headers});
  try {
    const store = authStore(env.AUTH_DB);
    if (url.pathname === '/auth/github' && request.method === 'GET') {
      const transaction = await beginOAuth(env);
      const browser = await store.start(transaction);
      return redirect(transaction.url, [cookie(transactionCookie(transaction.state), browser, oauthLifetimeMs / 1000)]);
    }
    if (url.pathname === '/auth/github/callback' && request.method === 'GET') {
      const state = url.searchParams.get('state');
      if (!/^[-_a-zA-Z0-9]{43}$/.test(state ?? '')) throw Error('invalid_oauth_transaction');
      const key = transactionCookie(state);
      const transaction = await store.consume(state, read(request, key) ?? read(request, '__Host-badp-oauth'));
      const account = await exchangeIdentity({code: url.searchParams.get('code'), state, transaction, env, fetcher});
      const session = await store.createSession(account);
      return redirect('/dashboard', [cookie(key, '', 0), cookie(sessionCookie, session, 3600)]);
    }
    if (url.pathname === '/auth/logout' && request.method === 'POST' && request.headers.get('Origin') === origin) {
      await store.revoke(read(request, sessionCookie));
      return redirect('/', [cookie(sessionCookie, '', 0)]);
    }
    return new Response('Not allowed', {status: 405, headers});
  } catch (error) {
    const reason = Object.hasOwn(failures, error?.message) ? error.message : 'oauth_unavailable';
    const message = failures[reason] ?? 'BADP could not complete sign-in. Try again from the BADP homepage.';
    return new Response(`Authentication failed [${reason}]. ${message}`, {status: 403, headers});
  }
}
