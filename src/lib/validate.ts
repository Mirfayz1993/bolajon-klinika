import { NextResponse } from 'next/server';
import { z, ZodError, ZodSchema } from 'zod';

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };

/**
 * Body'ni zod schema bo'yicha tekshiradi.
 *
 * Foydalanish:
 *   const parsed = await validateBody(req, vitalsCreateSchema);
 *   if (!parsed.ok) return parsed.response;
 *   const data = parsed.data;
 */
export async function validateBody<T>(
  req: Request,
  schema: ZodSchema<T>,
): Promise<ValidationResult<T>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "JSON formati noto'g'ri" }, { status: 400 }),
    };
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    return { ok: false, response: zodErrorResponse(result.error) };
  }
  return { ok: true, data: result.data };
}

/**
 * Query string parametrlarini schema bo'yicha tekshiradi.
 */
export function validateQuery<T>(
  url: URL | string,
  schema: ZodSchema<T>,
): ValidationResult<T> {
  const params = Object.fromEntries(new URL(url, 'http://localhost').searchParams);
  const result = schema.safeParse(params);
  if (!result.success) {
    return { ok: false, response: zodErrorResponse(result.error) };
  }
  return { ok: true, data: result.data };
}

function zodErrorResponse(error: ZodError): NextResponse {
  const issues = error.issues.map((i) => ({
    path: i.path.join('.'),
    message: i.message,
  }));
  return NextResponse.json(
    { error: "Ma'lumotlar noto'g'ri", issues },
    { status: 400 },
  );
}

// --- Umumiy yordamchi schema'lar ---------------------------------------------

export const cuidSchema = z.string().min(1).max(60);

export const optionalString = z
  .string()
  .trim()
  .min(1)
  .optional()
  .or(z.literal('').transform(() => undefined));

export const positiveNumber = z.number().positive();
export const nonNegativeNumber = z.number().nonnegative();
export const positiveInt = z.number().int().positive();
export const nonNegativeInt = z.number().int().nonnegative();
