import { NextResponse } from 'next/server';

const lmStudioBaseUrl = process.env.LM_STUDIO_BASE_URL ?? process.env.NEXT_PUBLIC_OPENAI_COMPAT_BASE_URL ?? 'http://localhost:1234/v1';

export async function GET() {
  const url = `${lmStudioBaseUrl.replace(/\/$/, '')}/models`;
  try {
    const response = await fetch(url, { cache: 'no-store' });
    const text = await response.text();
    let payload: unknown;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      return NextResponse.json({ error: 'LM Studio hat ungültiges JSON für /models geliefert.', raw: text }, { status: 502 });
    }
    if (!response.ok) return NextResponse.json({ error: `LM Studio /models antwortete mit HTTP ${response.status}.`, details: payload }, { status: response.status });
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? `LM Studio ist nicht erreichbar: ${err.message}` : 'LM Studio ist nicht erreichbar.' }, { status: 502 });
  }
}
