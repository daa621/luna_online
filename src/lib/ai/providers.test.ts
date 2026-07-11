import { describe, expect, it, vi } from 'vitest';
import { createChatProvider, MockChatProvider } from './providers';
import type { GameState } from '@/lib/game/types';

const game: GameState = { id: 'g', name: 'g', createdAt: '', updatedAt: '', setup: { protagonist: { id: 'hero', name: 'Hero', description: '', gender: 'unspecified', traits: [], referenceImages: [] }, companions: [], world: { setting: '', backstory: '', rules: '', mood: '', referenceImages: [] } }, story: [], inventory: [], status: {}, quests: [], relationships: {}, schemaVersion: 1 };

function stubChatContent(content: string) {
  const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ choices: [{ message: { content } }] })));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('createChatProvider', () => {
  it('MockProvider supports narrative and rule analysis separately', async () => {
    const provider = new MockChatProvider();
    await expect(provider.continueNarrative({ playerText: 'Suche den Markt', game })).resolves.toContain('Suche den Markt');
    await expect(provider.analyzeRules({ playerText: 'Suche den Markt', storyText: 'Story', game })).resolves.toMatchObject({ events: expect.any(Array) });
  });

  it('uses the selected LM Studio model and text response format for narrative calls', async () => {
    const fetchMock = stubChatContent('Nur Erzähltext.');
    const provider = createChatProvider({ provider: 'openai-compatible', baseUrl: 'http://localhost:1234/v1', model: 'lm-test', apiKey: '' });
    await provider.continueNarrative({ playerText: 'Test', game });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(init.body)) as { model: string; response_format: { type: string } };
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/ai/chat');
    expect(body.model).toBe('lm-test');
    expect(body.response_format.type).toBe('text');
    expect(body).toMatchObject({ temperature: 0.65, top_p: 0.9, max_tokens: 250, frequency_penalty: 0.2, presence_penalty: 0.1 });
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    vi.unstubAllGlobals();
  });

  it('uses text response format for LM Studio rule analysis calls', async () => {
    const fetchMock = stubChatContent(JSON.stringify({ events: [] }));
    const provider = createChatProvider({ provider: 'openai-compatible', baseUrl: 'http://localhost:1234/v1', model: 'lm-test', apiKey: '' });
    await provider.analyzeRules({ game, playerText: 'Test', storyText: 'Story' });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(init.body)) as { response_format: { type: string } };
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/ai/chat');
    expect(body.response_format.type).toBe('text');
    vi.unstubAllGlobals();
  });

  it('can still request json_object for non-LM-Studio rule-analysis providers', async () => {
    const fetchMock = stubChatContent(JSON.stringify({ events: [] }));
    const provider = createChatProvider({ provider: 'openai-compatible', baseUrl: 'https://api.openai.com/v1', model: 'gpt-test', apiKey: 'test-key' });
    await provider.analyzeRules({ playerText: 'Test', storyText: 'Story', game });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(init.body)) as { response_format: { type: string } };
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.openai.com/v1/chat/completions');
    expect(body.response_format.type).toBe('json_object');
    vi.unstubAllGlobals();
  });



  it('keeps rule-analysis inference parameters independently configurable', async () => {
    const fetchMock = stubChatContent(JSON.stringify({ events: [] }));
    const provider = createChatProvider({ provider: 'openai-compatible', baseUrl: 'http://localhost:1234/v1', model: 'lm-test', apiKey: '', narrativeInference: { temperature: 0.65 }, ruleInference: { temperature: 0.2, top_p: 0.7, max_tokens: 120 } });
    await provider.analyzeRules({ playerText: 'Test', storyText: 'Story', game });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(init.body)) as { temperature: number; top_p: number; max_tokens: number };
    expect(body).toMatchObject({ temperature: 0.2, top_p: 0.7, max_tokens: 120 });
    vi.unstubAllGlobals();
  });

  it.each([
    ['pure JSON', '{"events":[]}'],
    ['json fence', '```json\n{"events":[]}\n```'],
    ['plain fence', '```\n{"events":[]}\n```'],
    ['surrounding text', 'Here is the result:\n{"events":[]}\nThanks.'],
  ])('parses rule-analysis %s responses from LM Studio', async (_label, content) => {
    stubChatContent(content);
    const provider = createChatProvider({ provider: 'openai-compatible', baseUrl: 'http://localhost:1234/v1', model: 'lm-test', apiKey: '' });
    await expect(provider.analyzeRules({ playerText: 'Test', storyText: 'Story', game })).resolves.toMatchObject({ events: [] });
    vi.unstubAllGlobals();
  });

  it('reports the cleaned response preview for invalid rule JSON', async () => {
    stubChatContent('```json\n{"events":\n```');
    const provider = createChatProvider({ provider: 'openai-compatible', baseUrl: 'http://localhost:1234/v1', model: 'lm-test', apiKey: '' });
    await expect(provider.analyzeRules({ playerText: 'Test', storyText: 'Story', game })).rejects.toThrow(/Bereinigter Inhalt/);
    vi.unstubAllGlobals();
  });
});
