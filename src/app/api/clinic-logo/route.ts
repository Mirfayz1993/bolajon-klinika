import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function GET() {
  try {
    const filePath = join(process.cwd(), 'public', 'photo_2026-03-24_20-39-19.jpg');
    const buffer = readFileSync(filePath);
    const base64 = buffer.toString('base64');
    return NextResponse.json({ dataUrl: `data:image/jpeg;base64,${base64}` });
  } catch {
    return NextResponse.json({ dataUrl: '' }, { status: 404 });
  }
}
