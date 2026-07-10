import { describe, expect, it } from 'vitest';
import { applyGameEvents, resolveSkillChecks, validateGameEvents } from './events';
import { createInitialGame } from './defaults';
import type { Quest } from './types';

const setup = { protagonist: { id: 'hero', name: 'Luna', description: 'Mutig', gender: 'female' as const, traits: ['klug'], referenceImages: [] }, companions: [{ id: 'npc', name: 'Mira', description: 'Freundin', gender: 'female' as const, traits: [], referenceImages: [] }], world: { setting: 'Mondstadt', backstory: '', rules: '', mood: 'mystisch', referenceImages: [] } };
const game = () => createInitialGame(setup);
const activeQuest = (progress = 0): Quest => ({ id: 'q1', title: 'Finde das Tor', description: 'Suche.', status: 'active', objectives: [{ id: 'o1', title: 'Spuren finden', target: 2, progress, completed: progress >= 2 }] });

describe('game events', () => {
  it('keeps valid events from mixed valid and invalid payloads', () => {
    const result = validateGameEvents([{ type: 'health_changed', delta: -5 }, { type: 'health_changed', delta: -500 }, { type: 'location_changed', location: 'Markt' }]);
    expect(result.events).toHaveLength(2);
    expect(result.invalidEvents).toHaveLength(1);
  });

  it('clamps health and relationship boundaries', () => {
    const result = applyGameEvents(game(), [{ type: 'health_changed', delta: -100 }, { type: 'relationship_changed', characterId: 'npc', delta: 25 }], 'seed');
    expect(result.game.status.health).toBe(0);
    expect(result.game.relationships.npc).toBe(25);
  });

  it('does not remove unknown items or progress unknown quests', () => {
    const result = applyGameEvents(game(), [{ type: 'item_removed', name: 'Nichts', quantity: 1 }, { type: 'quest_progressed', questId: 'missing', objectiveId: 'x', amount: 1 }], 'seed');
    expect(result.invalidEvents).toHaveLength(2);
    expect(result.game.inventory).toEqual([]);
  });

  it('rejects premature quest completion until every objective is complete', () => {
    const incomplete = { ...game(), quests: [activeQuest(1)] };
    const rejected = applyGameEvents(incomplete, [{ type: 'quest_completed', questId: 'q1' }], 'seed');
    expect(rejected.game.quests[0]?.status).toBe('active');
    expect(rejected.invalidEvents[0]).toContain('Questziele');
    const progressed = applyGameEvents(incomplete, [{ type: 'quest_progressed', questId: 'q1', objectiveId: 'o1', amount: 1 }, { type: 'quest_completed', questId: 'q1' }], 'seed');
    expect(progressed.game.quests[0]?.status).toBe('completed');
  });

  it('does not grant quest rewards implicitly on completion', () => {
    const complete = { ...game(), quests: [activeQuest(2)] };
    const result = applyGameEvents(complete, [{ type: 'quest_completed', questId: 'q1' }], 'seed');
    expect(result.game.quests[0]?.status).toBe('completed');
    expect(result.game.inventory).toEqual([]);
  });

  it('rolls deterministic success and failure skill checks', () => {
    const success = resolveSkillChecks([{ type: 'skill_check', id: 'easy', skill: 'Klettern', difficulty: 1, modifier: 0 }], 'seed')[0];
    const failure = resolveSkillChecks([{ type: 'skill_check', id: 'hard', skill: 'Klettern', difficulty: 30, modifier: -10 }], 'seed')[0];
    expect(success?.success).toBe(true);
    expect(failure?.success).toBe(false);
  });

  it('applies events only when their required skill-check outcome matches', () => {
    const events = [{ type: 'skill_check', id: 'lock', skill: 'Schlösser knacken', difficulty: 30, modifier: -10 }, { type: 'item_added', name: 'Schatz', description: 'Belohnung', quantity: 1, category: 'Beute', requiresSkillCheck: { skillCheckId: 'lock', outcome: 'success' } }] as const;
    const checks = resolveSkillChecks([...events], 'seed');
    const result = applyGameEvents(game(), [...events], 'seed', checks);
    expect(result.skillChecks[0]?.success).toBe(false);
    expect(result.game.inventory).toEqual([]);
    expect(result.invalidEvents[0]).toContain('Misserfolg');
  });
});
