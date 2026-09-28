import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes, createHash } from 'node:crypto';
import path from 'node:path';
import { fail, ServiceError } from './store.mjs';
const exec = promisify(execFile);

/** Output is consumed only by this server process, never logged or returned over HTTP. */
export async function resolveAnonKey() {
  const { stdout } = await exec(path.join(process.env.SystemRoot||'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe'), ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', ". 'D:\\Dex\\AI\\DexCodeSupabase\\scripts\\SecretStore.ps1'; [Console]::Out.Write([DexCode.WinCred]::ReadUtf8('DEXCODE_SUPABASE_ANON_KEY'))"], { windowsHide: true, timeout: 15000, maxBuffer: 16000 });
  return stdout.trim();
}

export function createIdentity({ relayOrigin = 'https://relay.dex.place', providerOrigin = 'https://auth.dex.place', anonKey, fetchImpl = fetch } = {}) {
  let keyPromise;
  const key = () => keyPromise ||= Promise.resolve(anonKey || resolveAnonKey()).catch(() => { keyPromise = null; fail(503, 'account-configuration', 'Account service configuration is unavailable.'); });
  async function request(url, body, token, direct = false, method = 'POST') {
    const headers = { accept: 'application/json' };
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (token) headers.authorization = `Bearer ${token}`;
    if (direct) headers.apikey = await key();
    let response;
    try { response = await fetchImpl(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(12000), redirect: 'error' }); }
    catch { fail(503, 'account-unavailable', 'The dex account service could not be reached. Try again.'); }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 429) fail(429, 'account-rate-limit', 'Please wait before trying again.');
      if (response.status >= 500) fail(503, 'account-unavailable', 'The dex account service is temporarily unavailable.');
      if (result.error_code === 'signup_disabled' || result.code === 'signup_disabled') fail(503, 'signup-unavailable', 'Account registration is not available yet.');
      throw new ServiceError(response.status === 401 || response.status === 400 ? 401 : 400, 'account-denied', 'The account request could not be completed. Check the supplied details.');
    }
    return result;
  }
  const relay = (action, body = {}, token) => request(`${relayOrigin}/api/auth/${action}`, body, token);
  const direct = (path, body, token, method) => request(`${providerOrigin}/auth/v1/${path}`, body, token, true, method);
  let cachedCapabilities, capabilityAt = 0;
  return {
    async capabilities() {
      if (cachedCapabilities && Date.now() - capabilityAt < 30000) return cachedCapabilities;
      try {
        const settings = await direct('settings', undefined, undefined, 'GET');
        cachedCapabilities = { password: !!settings.external?.email, signup: !settings.disable_signup && !!settings.external?.email, google: !!settings.external?.google, recovery: false, confirmation: false, providerReady: true };
        // Mail readiness is an operator-verified fact, never inferred from external.email alone.
        cachedCapabilities.recovery = process.env.DEX_SITE_EMAIL_READY === '1' && cachedCapabilities.password;
        cachedCapabilities.confirmation = process.env.DEX_SITE_EMAIL_READY === '1' && cachedCapabilities.signup;
        cachedCapabilities.google = cachedCapabilities.google && process.env.DEX_SITE_OAUTH_READY === '1';
        capabilityAt = Date.now(); return cachedCapabilities;
      } catch { return { password: true, signup: false, google: false, recovery: false, confirmation: false, providerReady: false }; }
    },
    async signIn(email, password) { return (await relay('sign-in', { email, password })).session; },
    async signUp(email, password, name, challenge, redirectTo) {
      return direct(`signup?redirect_to=${encodeURIComponent(redirectTo)}`, { email, password, data: { name }, code_challenge: challenge, code_challenge_method: 's256' });
    },
    async verify(token) { return (await relay('me', {}, token)).user; },
    async refresh(token) { return (await relay('refresh', { refresh_token: token })).session; },
    async recover(email, challenge, redirectTo) { return direct(`recover?redirect_to=${encodeURIComponent(redirectTo)}`, { email, code_challenge: challenge, code_challenge_method: 's256' }); },
    async resend(email, redirectTo, challenge) { return direct(`resend?redirect_to=${encodeURIComponent(redirectTo)}`, { email, type: 'signup', code_challenge: challenge, code_challenge_method: 's256' }); },
    async exchange(code, verifier) { return direct('token?grant_type=pkce', { auth_code: code, code_verifier: verifier }); },
    async changePassword(token, password) { return direct('user', { password }, token, 'PUT'); },
    oauthUrl(challenge, redirectTo) { return `${providerOrigin}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}&code_challenge=${encodeURIComponent(challenge)}&code_challenge_method=s256`; },
  };
}
export function pkce() { const verifier = randomBytes(48).toString('base64url'); return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') }; }
