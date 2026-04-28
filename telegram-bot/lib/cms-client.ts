/**
 * CMS API'ga `x-bot-api-key` bilan so'rov yuborish uchun yagona wrapper.
 */
const CMS_URL = process.env.CMS_API_URL!;
const API_KEY = process.env.BOT_API_KEY!;

export async function cmsRequest<T = unknown>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; data: T | { error?: string } }> {
  const res = await fetch(`${CMS_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-bot-api-key': API_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as T | { error?: string };
  return { ok: res.ok, status: res.status, data };
}
