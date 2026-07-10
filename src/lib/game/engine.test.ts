import { describe, expect, it } from 'vitest';
import { createInitialGame } from './defaults';
import { playTurn } from './engine';
import type { ChatProvider, FinalizeStoryRequest } from '@/lib/ai/types';
import type { ImageProvider } from '@/lib/images/types';

const setup = { protagonist: { id: 'hero', name: 'Luna', description: 'Mutig', gender: 'female' as const, traits: ['klug'], referenceImages: [] }, companions: [], world: { setting: 'Mondstadt', backstory: '', rules: '', mood: 'mystisch', referenceImages: [] } };
const images: ImageProvider = { id: 'img', label: 'Img', generate: async () => { throw new Error('not expected'); } };

function provider(events: unknown[], finalize?: (request: FinalizeStoryRequest) => string): ChatProvider {
  return { id: 'test', label: 'Test', continueStory: async () => ({ storyText: 'Entwurf vor dem Wurf.', events }), finalizeStory: async (request) => ({ storyText: finalize?.(request) ?? `Final: ${request.skillChecks.map((check) => check.success ? 'Erfolg' : 'Misserfolg').join(',')}` }) };
}

describe('playTurn', () => {
  it('runs a complete example turn through finalized skill results', async () => {
    const chat = provider([{ type: 'item_added', name: 'Goldmünze', category: 'Währung', quantity: 5, description: 'Glänzend' }, { type: 'location_changed', location: 'Marktplatz' }, { type: 'skill_check', id: 'look', skill: 'Wahrnehmung', difficulty: 1, modifier: 0 }], (request) => `Die finale Szene nutzt ${request.skillChecks[0]?.success ? 'den Erfolg' : 'den Misserfolg'}.`);
    const next = await playTurn(createInitialGame(setup), 'Suche den Markt', chat, images);
    expect(next.inventory[0]).toMatchObject({ name: 'Goldmünze', quantity: 5 });
    expect(next.status.location).toBe('Marktplatz');
    expect(next.story.at(-1)?.text).toContain('den Erfolg');
  });

  it('does not apply success-gated events after failed skill checks', async () => {
    const chat = provider([{ type: 'skill_check', id: 'lock', skill: 'Schlösser knacken', difficulty: 30, modifier: -10 }, { type: 'item_added', name: 'Schatz', description: 'Belohnung', quantity: 1, category: 'Beute', requiresSkillCheck: { skillCheckId: 'lock', outcome: 'success' } }]);
    const next = await playTurn(createInitialGame(setup), 'Öffne die Truhe', chat, images);
    const aiEntry = next.story.at(-1);
    expect(next.inventory).toEqual([]);
    expect(aiEntry?.kind === 'ai' ? aiEntry.invalidEvents?.some((event) => event.includes('Skill Check lock')) : false).toBe(true);
  });
});
