import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const KEY = Buffer.from(process.env.PASSWORD_ENCRYPT_KEY ?? 'B0l4j0n-Kl1n1k4-S3cr3t-K3y-2026!!', 'utf8').slice(0, 32);
const IV_LENGTH = 16;

/** Parolni shifrlaydi → DB ga saqlanadi */
export function encryptPassword(plain: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

/** Shifrlangan parolni ochadi → faqat admin ko'radi */
export function decryptPassword(encrypted: string): string {
  const [ivHex, dataHex] = encrypted.split(':');
  if (!ivHex || !dataHex) return '';
  const iv = Buffer.from(ivHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
