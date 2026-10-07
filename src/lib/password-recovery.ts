import { createHmac, timingSafeEqual } from 'node:crypto';

export const PASSWORD_RECOVERY_COOKIE = 'reposcope_password_recovery';
export const PASSWORD_RECOVERY_TTL_SECONDS = 15 * 60;

function recoverySecret() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error('Segredo de recuperação não configurado.');
  return secret;
}

function sign(payload: string) {
  return createHmac('sha256', recoverySecret()).update(payload).digest('base64url');
}

export function createPasswordRecoveryProof(userId: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + PASSWORD_RECOVERY_TTL_SECONDS;
  const payload = `${userId}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyPasswordRecoveryProof(proof: string | undefined, userId: string) {
  if (!proof) return false;

  const parts = proof.split('.');
  if (parts.length !== 3) return false;

  const [proofUserId, rawExpiresAt, providedSignature] = parts;
  if (proofUserId !== userId) return false;

  const expiresAt = Number(rawExpiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) return false;

  const payload = `${proofUserId}.${rawExpiresAt}`;
  const expectedSignature = sign(payload);

  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length) return false;

  return timingSafeEqual(provided, expected);
}
