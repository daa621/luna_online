import { describe, expect, it } from 'vitest';
import { applyGameEvents, validateGameEvents } from './events';
import { createInitialGame } from './defaults';

const setup = { protagonist: { id: 'hero', name: 'Luna', description: 'Mutig', gender: 'female' as const, traits: ['klug'], referenceImages: [] }, companions: [{ id: 'npc', name: 'Mira', description: 'Freundin', gender: 'female' as const, traits: [], referenceImages: [] }], world: { setting: 'Mondstadt', backstory: '', rules: '', mood: 'mystisch', referenceImages: [] } };
const game = () => createInitialGame(setup);

describe('game events', () => {
  it('validates known events and rejects malformed payloads', () => {
    expect(validateGameEvents([{ type: 'health_changed', delta: -5 }]).events).toHaveLength(1);
    expect(validateGameEvents([{ type: 'health_changed', delta: -500 }]).invalidEvents.length).toBeGreaterThan(0);
  });

  it('clamps health and relationship boundaries', () => {
    const result = applyGameEvents(game(), [{ type: 'health_changed', delta: -150 }, { type: 'relationship_changed', characterId: 'npc', delta: 25 }], 'seed');
    expect(result.game.status.health).toBe(0);
    expect(result.game.relationships.npc).toBe(25);
  });

  it('does not remove unknown items or progress unknown quests', () => {
    const result = applyGameEvents(game(), [{ type: 'item_removed', name: 'Nichts', quantity: 1 }, { type: 'quest_progressed', questId: 'missing', objectiveId: 'x', amount: 1 }], 'seed');
    expect(result.invalidEvents).toHaveLength(2);
    expect(result.game.inventory).toEqual([]);
  });

  it('starts, progresses and completes quests', () => {
    const started = applyGameEvents(game(), [{ type: 'quest_started', quest: { id: 'q1', title: 'Finde das Tor', description: 'Suche.', objectives: [{ id: 'o1', title: 'Spuren finden', target: 2 }] } }], 'seed').game;
    const progressed = applyGameEvents(started, [{ type: 'quest_progressed', questId: 'q1', objectiveId: 'o1', amount: 2 }], 'seed').game;
    const completed = applyGameEvents(progressed, [{ type: 'quest_completed', questId: 'q1' }], 'seed').game;
    expect(progressed.quests[0]?.objectives[0]?.completed).toBe(true);
    expect(completed.quests[0]?.status).toBe('completed');
  });

  it('rolls reproducible skill checks', () => {
    const first = applyGameEvents(game(), [{ type: 'skill_check', skill: 'Klettern', difficulty: 12, modifier: 2 }], 'same');
    const second = applyGameEvents(game(), [{ type: 'skill_check', skill: 'Klettern', difficulty: 12, modifier: 2 }], 'same');
    expect(first.skillChecks[0]).toEqual(second.skillChecks[0]);
    expect(first.skillChecks[0]?.roll).toBeGreaterThanOrEqual(1);
    expect(first.skillChecks[0]?.roll).toBeLessThanOrEqual(20);
  });
});
