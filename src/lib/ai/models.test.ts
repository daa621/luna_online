import { describe, expect, it } from 'vitest';
import { fetchOpenAiCompatibleModels } from './models';

describe('fetchOpenAiCompatibleModels', () => {
  it('reads model ids from OpenAI-compatible responses', async () => {
    const fetchImpl = async () => new Response(JSON.stringify({ data: [{ id: 'local-model' }] }));
    const result = await fetchOpenAiCompatibleModels('http://localhost:1234/v1', fetchImpl as typeof fetch);
    expect(result.models).toEqual([{ id: 'local-model' }]);
  });

  it('returns a readable error when LM Studio is unreachable', async () => {
    const fetchImpl = async () => { throw new Error('connection refused'); };
    const result = await fetchOpenAiCompatibleModels('http://localhost:1234/v1', fetchImpl as typeof fetch);
    expect(result.models).toEqual([]);
    expect(result.error).toContain('LM Studio');
  });
});
