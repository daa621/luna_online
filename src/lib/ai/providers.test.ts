import { describe, expect, it, vi } from 'vitest';
import { createChatProvider } from './providers';

describe('createChatProvider', () => {
  it('uses the selected LM Studio model and does not require an API key', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ storyText: 'Draft', events: [] }) } }] })));
    vi.stubGlobal('fetch', fetchMock);
    const provider = createChatProvider({ provider: 'openai-compatible', baseUrl: 'http://localhost:1234/v1', model: 'lm-test', apiKey: '' });
    await provider.continueStory({ playerText: 'Test', game: { id: 'g', name: 'g', createdAt: '', updatedAt: '', setup: { protagonist: { id: 'hero', name: 'Hero', description: '', gender: 'unspecified', traits: [], referenceImages: [] }, companions: [], world: { setting: '', backstory: '', rules: '', mood: '', referenceImages: [] } }, story: [], inventory: [], status: {}, quests: [], relationships: {}, schemaVersion: 1 } });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://localhost:1234/v1/chat/completions');
    expect(JSON.parse(String(init.body)).model).toBe('lm-test');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    vi.unstubAllGlobals();
  });
});
