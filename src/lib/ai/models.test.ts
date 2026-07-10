import { describe, expect, it, vi } from 'vitest';
import { fetchOpenAiCompatibleModels, parseOpenAiCompatibleModels } from './models';

const lmStudioPayload = {
  data: [
    { id: 'dirty-muse-writer-v01-uncensored-erotica-nsfw-i1', object: 'model', owned_by: 'organization_owner' },
    { id: 'mistralai/ministral-3-3b', object: 'model', owned_by: 'organization_owner' },
    { id: 'qwen/qwen3.5-9b', object: 'model', owned_by: 'organization_owner' },
    { id: 'qwen3-30b-a3b-abliterated-erotic-i1', object: 'model', owned_by: 'organization_owner' },
    { id: 'text-embedding-nomic-embed-text-v1.5', object: 'model', owned_by: 'organization_owner' },
  ],
  object: 'list',
};

describe('fetchOpenAiCompatibleModels', () => {
  it('reads LM Studio model ids from response.data and filters embedding models', async () => {
    const result = parseOpenAiCompatibleModels(lmStudioPayload);
    expect(result.models.map((model) => model.id)).toEqual([
      'dirty-muse-writer-v01-uncensored-erotica-nsfw-i1',
      'mistralai/ministral-3-3b',
      'qwen/qwen3.5-9b',
      'qwen3-30b-a3b-abliterated-erotic-i1',
    ]);
  });

  it('uses the exact /v1/models endpoint for LM Studio', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(lmStudioPayload)));
    await fetchOpenAiCompatibleModels(undefined, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith('/api/ai/models');
    await fetchOpenAiCompatibleModels('http://localhost:1234/v1', fetchImpl, true);
    expect(fetchImpl).toHaveBeenLastCalledWith('http://localhost:1234/v1/models');
  });

  it('returns a readable error when LM Studio is unreachable', async () => {
    const fetchImpl = async () => { throw new Error('connection refused'); };
    const result = await fetchOpenAiCompatibleModels(undefined, fetchImpl as typeof fetch);
    expect(result.models).toEqual([]);
    expect(result.error).toContain('/api/ai/models');
  });

  it('reports unexpected response structures with the raw payload', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const payload = { models: [{ id: 'wrong-shape' }] };
    const result = parseOpenAiCompatibleModels(payload);
    expect(result.models).toEqual([]);
    expect(result.rawResponse).toBe(payload);
    expect(result.error).toContain('unerwartete Modelllisten-Antwort');
    expect(warn).toHaveBeenCalledWith('Unerwartete Modelllisten-Antwort von LM Studio:', payload);
    warn.mockRestore();
  });
});
