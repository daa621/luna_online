import { describe, expect, it } from 'vitest';
import { createInitialGame } from './defaults';
import { playTurn } from './engine';
import type { ChatProvider } from '@/lib/ai/types';
import type { ImageProvider } from '@/lib/images/types';

const setup = { protagonist: { id: 'hero', name: 'Luna', description: 'Mutig', gender: 'female' as const, traits: ['klug'], referenceImages: [] }, companions: [], world: { setting: 'Mondstadt', backstory: '', rules: '', mood: 'mystisch', referenceImages: [] } };

describe('playTurn', () => {
  it('persists structured AI changes without parsing story prose', async () => {
    const chat: ChatProvider = { id: 'test', label: 'Test', continueStory: async () => ({ storyText: 'Du findest Gold.', inventoryChanges: [{ operation: 'add', item: { name: 'Goldmünze', category: 'Währung', quantity: 5, description: 'Glänzend' } }], statusChanges: { location: 'Marktplatz' } }) };
    const images: ImageProvider = { id: 'img', label: 'Img', generate: async () => { throw new Error('not expected'); } };
    const next = await playTurn(createInitialGame(setup), 'Suche den Markt', chat, images);
    expect(next.inventory[0]).toMatchObject({ name: 'Goldmünze', quantity: 5 });
    expect(next.status.location).toBe('Marktplatz');
    expect(next.story.at(-1)?.kind).toBe('ai');
  });
});
