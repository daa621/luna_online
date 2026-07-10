import type { CharacterProfile, GameSetup, GameState, WorldProfile } from './types';

export const nowIso = () => new Date().toISOString();
export const createId = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;

export function emptyCharacter(): CharacterProfile {
  return { id: createId('char'), name: '', description: '', gender: 'unspecified', traits: [], referenceImages: [] };
}

export function emptyWorld(): WorldProfile {
  return { setting: '', backstory: '', rules: '', mood: '', referenceImages: [] };
}

export function createInitialGame(setup: GameSetup): GameState {
  const timestamp = nowIso();
  return {
    id: createId('game'),
    name: `${setup.protagonist.name || 'Unbenannter Held'}s Abenteuer`,
    createdAt: timestamp,
    updatedAt: timestamp,
    setup,
    story: [{ id: createId('system'), kind: 'system', createdAt: timestamp, text: 'Das Abenteuer beginnt. Beschreibe deine erste Handlung.' }],
    inventory: [],
    status: { location: 'Unbekannt', timeOfDay: 'Unbestimmt', health: 100, gold: 0, experience: 0 },
    quests: [],
    relationships: Object.fromEntries(setup.companions.map((companion) => [companion.id, 0])),
    schemaVersion: 1,
  };
}
