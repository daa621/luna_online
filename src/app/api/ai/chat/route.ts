import { NextResponse } from 'next/server';

const lmStudioBaseUrl = process.env.LM_STUDIO_BASE_URL ?? process.env.NEXT_PUBLIC_OPENAI_COMPAT_BASE_URL ?? 'http://localhost:1234/v1';

function logProxyDiagnostic(message: string, details: Record<string, unknown>) {
  if (process.env.NODE_ENV !== 'production') console.info(`[AI Story RPG] ${message}`, details);
}

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
    const content = (payload as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]?.message?.content;
    logProxyDiagnostic('LM-Studio-Chatantwort empfangen', { status: response.status, model: (body as { model: string }).model, contentType: Array.isArray(content) ? 'array' : typeof content, contentLength: typeof content === 'string' ? content.length : undefined, trimmedLength: typeof content === 'string' ? content.trim().length : undefined });
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? `LM Studio ist nicht erreichbar: ${err.message}. Prüfe: Läuft LM Studio? Ist der lokale Server aktiviert? Stimmt die URL? Ist ein Modell geladen?` : 'LM Studio ist nicht erreichbar. Prüfe: Läuft LM Studio? Ist der lokale Server aktiviert? Stimmt die URL? Ist ein Modell geladen?' }, { status: 502 });
  }
}
