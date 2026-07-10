import { NextResponse } from 'next/server';

const lmStudioBaseUrl = process.env.LM_STUDIO_BASE_URL ?? process.env.NEXT_PUBLIC_OPENAI_COMPAT_BASE_URL ?? 'http://localhost:1234/v1';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Chat-Proxy erwartet gültiges JSON.' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || !('model' in body) || typeof (body as { model?: unknown }).model !== 'string' || !(body as { model: string }).model.trim()) {
    return NextResponse.json({ error: 'Chat-Proxy benötigt ein nichtleeres model-Feld.' }, { status: 400 });
  }

  const url = `${lmStudioBaseUrl.replace(/\/$/, '')}/chat/completions`;
  try {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' });
    const text = await response.text();
    let payload: unknown;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      return NextResponse.json({ error: 'LM Studio hat ungültiges JSON für /chat/completions geliefert.', raw: text }, { status: 502 });
    }
    if (!response.ok) return NextResponse.json({ error: `LM Studio /chat/completions antwortete mit HTTP ${response.status}.`, details: payload }, { status: response.status });
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? `LM Studio ist nicht erreichbar: ${err.message}` : 'LM Studio ist nicht erreichbar.' }, { status: 502 });
  }
}
