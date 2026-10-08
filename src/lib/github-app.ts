import { createPrivateKey, createSign } from 'node:crypto';

const API = 'https://api.github.com';
const apiHeaders = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'RepoScope-GitHub-App' };
const tokenCache = new Map<number, { token: string; expiresAt: number }>();

function appConfig() {
  const id = process.env.GITHUB_APP_ID?.trim();
  const raw = process.env.GITHUB_APP_PRIVATE_KEY?.trim();
  if (!id || !/^\d+$/.test(id) || !raw) throw new Error('GITHUB_APP_NOT_CONFIGURED: Configure GITHUB_APP_ID e GITHUB_APP_PRIVATE_KEY.');
  const privateKey = raw.replace(/\\n/g, '\n');
  return { id, privateKey };
}
function base64url(value: string | Buffer) {
  return Buffer.from(value).toString('base64url');
}
function appJwt() {
  const { id, privateKey } = appConfig();
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({ iat: now - 60, exp: now + 540, iss: id }));
  const input = `${header}.${payload}`;
  const sign = createSign('RSA-SHA256');
  sign.update(input);
  sign.end();
  const signature = sign.sign(createPrivateKey(privateKey));
  return `${input}.${base64url(signature)}`;
}
async function appRequest(path: string, init: RequestInit = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init, headers: { ...apiHeaders, Authorization: `Bearer ${appJwt()}`, ...init.headers },
    cache: 'no-store', signal: AbortSignal.timeout(15000),
  });
  if (response.status === 401) throw new Error('GITHUB_APP_AUTH_INVALID: ID ou chave privada rejeitados pelo GitHub.');
  return response;
}
export async function installationForRepository(owner: string, repo: string) {
  const response = await appRequest(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/installation`);
  if (response.status === 404) throw new Error('GITHUB_APP_NOT_INSTALLED: Instale o RepoScope GitHub App neste repositório.');
  if (!response.ok) throw new Error(`GITHUB_APP_INSTALLATION_LOOKUP: HTTP ${response.status}`);
  const installation = await response.json() as { id: number };
  if (!Number.isSafeInteger(installation.id)) throw new Error('GITHUB_APP_INSTALLATION_INVALID');
  return installation.id;
}
async function installationToken(id: number) {
  const cached = tokenCache.get(id);
  if (cached && Date.now() < cached.expiresAt - 5 * 60_000) return cached.token;
  const response = await appRequest(`/app/installations/${id}/access_tokens`, { method: 'POST' });
  if (!response.ok) throw new Error(`GITHUB_APP_TOKEN_ERROR: HTTP ${response.status}`);
  const payload = await response.json() as { token: string; expires_at: string };
  if (!payload.token) throw new Error('GITHUB_APP_TOKEN_MISSING');
  tokenCache.set(id, { token: payload.token, expiresAt: Date.parse(payload.expires_at) });
  return payload.token;
}
export async function githubInstallationHeaders(owner: string, repo: string): Promise<HeadersInit> {
  const id = await installationForRepository(owner, repo);
  const token = await installationToken(id);
  // A análise privada requer vínculo explícito entre a instalação e o usuário,
  // que não está habilitado nesta migração. Falha fechada até essa autorização existir.
  const headers = { ...apiHeaders, Authorization: `Bearer ${token}` };
  const metadata = await fetch(`${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, {
    headers, next: { revalidate: 120 }, signal: AbortSignal.timeout(15000),
  });
  if (!metadata.ok) throw new Error(`GITHUB_APP_REPOSITORY_ACCESS: HTTP ${metadata.status}`);
  const details = await metadata.json() as { private: boolean };
  if (details.private) throw new Error('GITHUB_PRIVATE_REPO_UNAUTHORIZED: Repositórios privados exigem autorização de acesso vinculada ao usuário.');
  return headers;
}
export function githubAppIsConfigured() {
  return Boolean(process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY);
}
