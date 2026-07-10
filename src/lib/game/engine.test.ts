import { describe, expect, it } from 'vitest';
import { createInitialGame } from './defaults';
import { playTurn } from './engine';
import type { ChatProvider } from '@/lib/ai/types';
import type { ImageProvider } from '@/lib/images/types';

const setup = { protagonist: { id: 'hero', name: 'Luna', description: 'Mutig', gender: 'female' as const, traits: ['klug'], referenceImages: [] }, companions: [], world: { setting: 'Mondstadt', backstory: '', rules: '', mood: 'mystisch', referenceImages: [] } };

describe('playTurn', () => {
  it('runs a complete example turn through validated events', async () => {
    const chat: ChatProvider = { id: 'test', label: 'Test', continueStory: async () => ({ storyText: 'Du findest Gold und prüfst die alte Tür.', events: [{ type: 'item_added', name: 'Goldmünze', category: 'Währung', quantity: 5, description: 'Glänzend' }, { type: 'location_changed', location: 'Marktplatz' }, { type: 'skill_check', skill: 'Wahrnehmung', difficulty: 10, modifier: 1 }] }) };
    const images: ImageProvider = { id: 'img', label: 'Img', generate: async () => { throw new Error('not expected'); } };
    const next = await playTurn(createInitialGame(setup), 'Suche den Markt', chat, images);
    expect(next.inventory[0]).toMatchObject({ name: 'Goldmünze', quantity: 5 });
    expect(next.status.location).toBe('Marktplatz');
    expect(next.story.at(-1)?.kind).toBe('ai');
    const aiEntry = next.story.at(-1);
    expect(aiEntry?.kind === 'ai' ? aiEntry.skillChecks?.[0]?.skill : undefined).toBe('Wahrnehmung');
  });

  it('records invalid event attempts without changing unknown entities', async () => {
    const chat: ChatProvider = { id: 'test', label: 'Test', continueStory: async () => ({ storyText: 'Ein Geist versucht etwas Unmögliches.', events: [{ type: 'item_removed', name: 'Unbekannter Schlüssel', quantity: 1 }, { type: 'quest_completed', questId: 'missing' }] }) };
    const images: ImageProvider = { id: 'img', label: 'Img', generate: async () => { throw new Error('not expected'); } };
    const next = await playTurn(createInitialGame(setup), 'Öffne die Tür', chat, images);
    const aiEntry = next.story.at(-1);
    expect(aiEntry?.kind === 'ai' ? aiEntry.invalidEvents : []).toHaveLength(2);
    expect(next.inventory).toEqual([]);
  });
});
