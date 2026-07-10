import { describe, expect, it, vi } from 'vitest';
import { createChatProvider } from './providers';
import type { GameState } from '@/lib/game/types';

const game: GameState = { id: 'g', name: 'g', createdAt: '', updatedAt: '', setup: { protagonist: { id: 'hero', name: 'Hero', description: '', gender: 'unspecified', traits: [], referenceImages: [] }, companions: [], world: { setting: '', backstory: '', rules: '', mood: '', referenceImages: [] } }, story: [], inventory: [], status: {}, quests: [], relationships: {}, schemaVersion: 1 };

function stubChatContent(content: string) {
  const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ choices: [{ message: { content } }] })));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('createChatProvider', () => {
  it('uses the selected LM Studio model and text response format without requiring an API key', async () => {
    const fetchMock = stubChatContent(JSON.stringify({ storyText: 'Draft', events: [] }));
    const provider = createChatProvider({ provider: 'openai-compatible', baseUrl: 'http://localhost:1234/v1', model: 'lm-test', apiKey: '' });
    await provider.continueStory({ playerText: 'Test', game });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(init.body)) as { model: string; response_format: { type: string } };
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/ai/chat');
    expect(body.model).toBe('lm-test');
    expect(body.response_format.type).toBe('text');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    vi.unstubAllGlobals();
  });

  it('uses text response format for LM Studio final story requests', async () => {
    const fetchMock = stubChatContent(JSON.stringify({ storyText: 'Final' }));
    const provider = createChatProvider({ provider: 'openai-compatible', baseUrl: 'http://localhost:1234/v1', model: 'lm-test', apiKey: '' });
    await provider.finalizeStory({ game, playerText: 'Test', draft: { storyText: 'Draft', events: [] }, skillChecks: [], effects: [], invalidEvents: [] });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(init.body)) as { response_format: { type: string } };
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/ai/chat');
    expect(body.response_format.type).toBe('text');
    vi.unstubAllGlobals();
  });

  it('can still request json_object for non-LM-Studio OpenAI-compatible providers', async () => {
    const fetchMock = stubChatContent(JSON.stringify({ storyText: 'Draft', events: [] }));
    const provider = createChatProvider({ provider: 'openai-compatible', baseUrl: 'https://api.openai.com/v1', model: 'gpt-test', apiKey: 'test-key' });
    await provider.continueStory({ playerText: 'Test', game });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(init.body)) as { response_format: { type: string } };
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.openai.com/v1/chat/completions');
    expect(body.response_format.type).toBe('json_object');
    vi.unstubAllGlobals();
  });

  it.each([
    ['pure JSON', '{"storyText":"Draft","events":[]}'],
    ['json fence', '```json\n{"storyText":"Draft","events":[]}\n```'],
    ['plain fence', '```\n{"storyText":"Draft","events":[]}\n```'],
    ['surrounding text', 'Here is the result:\n{"storyText":"Draft","events":[]}\nThanks.'],
  ])('parses %s responses from LM Studio', async (_label, content) => {
    stubChatContent(content);
    const provider = createChatProvider({ provider: 'openai-compatible', baseUrl: 'http://localhost:1234/v1', model: 'lm-test', apiKey: '' });
    await expect(provider.continueStory({ playerText: 'Test', game })).resolves.toMatchObject({ storyText: 'Draft', events: [] });
    vi.unstubAllGlobals();
  });

  it('reports the cleaned response preview for invalid JSON', async () => {
    stubChatContent('```json\n{"storyText":\n```');
    const provider = createChatProvider({ provider: 'openai-compatible', baseUrl: 'http://localhost:1234/v1', model: 'lm-test', apiKey: '' });
    await expect(provider.continueStory({ playerText: 'Test', game })).rejects.toThrow(/Bereinigter Inhalt/);
    vi.unstubAllGlobals();
  });
});
