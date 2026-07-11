import { describe, expect, it } from 'vitest';
import { createInitialGame } from './defaults';
import { playTurn } from './engine';
import type { ChatProvider } from '@/lib/ai/types';
import type { ImageProvider } from '@/lib/images/types';

const setup = { protagonist: { id: 'hero', name: 'Luna', description: 'Mutig', gender: 'female' as const, traits: ['klug'], referenceImages: [] }, companions: [], world: { setting: 'Mondstadt', backstory: '', rules: '', mood: 'mystisch', referenceImages: [] } };
const images: ImageProvider = { id: 'img', label: 'Img', generate: async () => { throw new Error('not expected'); } };

function provider(events: unknown[], story = 'Die finale Szene bleibt reine Erzählung.'): ChatProvider {
  return {
    id: 'test', label: 'Test',
    continueNarrative: async () => story,
    analyzeRules: async () => ({ storyText: '', events }),
    continueStory: async () => ({ storyText: story, events }),
    finalizeStory: async () => ({ storyText: story }),
  };
}

describe('playTurn', () => {
  it('runs narrative first, then applies valid rule events', async () => {
    const chat = provider([{ type: 'item_added', name: 'Goldmünze', category: 'Währung', quantity: 5, description: 'Glänzend' }, { type: 'location_changed', location: 'Marktplatz' }, { type: 'skill_check', id: 'look', skill: 'Wahrnehmung', difficulty: 1, modifier: 0 }]);
    const next = await playTurn(createInitialGame(setup), 'Suche den Markt', chat, images);
    expect(next.inventory[0]).toMatchObject({ name: 'Goldmünze', quantity: 5 });
    expect(next.status.location).toBe('Marktplatz');
    expect(next.story.at(-1)?.text).toContain('Die finale Szene bleibt reine Erzählung.');
  });

  it('keeps story visible and avoids state changes when rule analysis fails', async () => {
    const chat: ChatProvider = { ...provider([]), analyzeRules: async () => { throw new Error('bad rules'); } };
    const initial = createInitialGame(setup);
    const next = await playTurn(initial, 'Öffne die Truhe', chat, images);
    const aiEntry = next.story.at(-1);
    expect(aiEntry?.text).toContain('Die finale Szene bleibt reine Erzählung.');
    expect(aiEntry?.kind === 'ai' ? aiEntry.invalidEvents?.[0] : '').toContain('Regelanalyse fehlgeschlagen');
    expect(next.inventory).toEqual(initial.inventory);
    expect(next.status).toEqual(initial.status);
  });

  it('does not apply success-gated events after failed engine-rolled skill checks', async () => {
    const chat = provider([{ type: 'skill_check', id: 'lock', skill: 'Schlösser knacken', difficulty: 30, modifier: -10 }, { type: 'item_added', name: 'Schatz', description: 'Belohnung', quantity: 1, category: 'Beute', requiresSkillCheck: { skillCheckId: 'lock', outcome: 'success' } }]);
    const next = await playTurn(createInitialGame(setup), 'Öffne die Truhe', chat, images);
    const aiEntry = next.story.at(-1);
    expect(next.inventory).toEqual([]);
    expect(aiEntry?.kind === 'ai' ? aiEntry.invalidEvents?.some((event) => event.includes('Skill Check lock')) : false).toBe(true);
  });

  it('stops the turn before applying rules when the narrative is empty', async () => {
    const chat = provider([{ type: 'location_changed', location: 'Innenstadt' }], '   ');
    await expect(playTurn(createInitialGame(setup), 'Gehe los', chat, images)).rejects.toThrow(/keinen Erzählertext/);
  });

});
