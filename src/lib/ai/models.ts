export interface AiModelInfo { id: string; }
export interface AiModelListResult { models: AiModelInfo[]; error?: string; }

export async function fetchOpenAiCompatibleModels(baseUrl: string, fetchImpl: typeof fetch = fetch): Promise<AiModelListResult> {
  try {
    const response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/models`);
    if (!response.ok) return { models: [], error: `Modellliste konnte nicht geladen werden (${response.status}).` };
    const payload = await response.json() as { data?: Array<{ id?: unknown }> };
    return { models: (payload.data ?? []).map((model) => ({ id: String(model.id ?? '') })).filter((model) => model.id.length > 0) };
  } catch (err) {
    return { models: [], error: err instanceof Error ? `LM Studio ist nicht erreichbar: ${err.message}` : 'LM Studio ist nicht erreichbar.' };
  }
}
