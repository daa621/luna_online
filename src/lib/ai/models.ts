export interface AiModelInfo { id: string; }
export interface AiModelListResult { models: AiModelInfo[]; error?: string; rawResponse?: unknown; }

function isLanguageModelId(id: string): boolean {
  const normalized = id.toLowerCase();
  return !normalized.includes('embedding') && !normalized.includes('embed-text');
}

export function parseOpenAiCompatibleModels(payload: unknown): AiModelListResult {
  if (!payload || typeof payload !== 'object' || !('data' in payload) || !Array.isArray((payload as { data?: unknown }).data)) {
    console.warn('Unerwartete Modelllisten-Antwort von LM Studio:', payload);
    return { models: [], rawResponse: payload, error: 'LM Studio hat eine unerwartete Modelllisten-Antwort geliefert. Erwartet wurde ein Objekt mit data: [{ id }].' };
  }

  const models = (payload as { data: Array<{ id?: unknown }> }).data
    .map((model) => ({ id: typeof model.id === 'string' ? model.id : '' }))
    .filter((model) => model.id.length > 0)
    .filter((model) => isLanguageModelId(model.id));

  if (models.length === 0) {
    console.warn('LM Studio Modellliste enthält keine nutzbaren Sprachmodelle:', payload);
    return { models: [], rawResponse: payload, error: 'LM Studio hat keine nutzbaren Sprachmodelle gemeldet. Embedding-Modelle werden ausgeblendet.' };
  }

  return { models, rawResponse: payload };
}

export async function fetchOpenAiCompatibleModels(baseUrl: string, fetchImpl: typeof fetch = fetch): Promise<AiModelListResult> {
  const modelsUrl = `${baseUrl.replace(/\/$/, '')}/models`;
  try {
    const response = await fetchImpl(modelsUrl);
    if (!response.ok) return { models: [], error: `Modellliste konnte nicht geladen werden (${response.status}) von ${modelsUrl}.` };
    return parseOpenAiCompatibleModels(await response.json());
  } catch (err) {
    return { models: [], error: err instanceof Error ? `LM Studio ist nicht erreichbar (${modelsUrl}): ${err.message}` : `LM Studio ist nicht erreichbar (${modelsUrl}).` };
  }
}
