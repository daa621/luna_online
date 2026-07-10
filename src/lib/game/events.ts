import { z } from 'zod';
import type { GameState, InventoryItem, Quest, QuestObjective, SkillCheckResult, StoryTurnEffect } from './types';
import { createId } from './defaults';

const attributesSchema: z.ZodType<Record<string, unknown>> = z.record(z.string(), z.unknown());

export const itemAddedEventSchema = z.object({ type: z.literal('item_added'), name: z.string().min(1), description: z.string().default(''), quantity: z.number().int().min(1).max(99).default(1), category: z.string().min(1).default('Sonstiges'), attributes: attributesSchema.optional() });
export const itemRemovedEventSchema = z.object({ type: z.literal('item_removed'), itemId: z.string().optional(), name: z.string().min(1).optional(), quantity: z.number().int().min(1).max(99).default(1) }).refine((event) => event.itemId || event.name, 'itemId oder name ist erforderlich');
export const healthChangedEventSchema = z.object({ type: z.literal('health_changed'), delta: z.number().int().min(-100).max(100), reason: z.string().optional() });
export const statusChangedEventSchema = z.object({ type: z.literal('status_changed'), key: z.enum(['timeOfDay', 'weather', 'mood', 'dangerLevel']), value: z.union([z.string(), z.number(), z.boolean(), z.null()]), reason: z.string().optional() });
export const relationshipChangedEventSchema = z.object({ type: z.literal('relationship_changed'), characterId: z.string().min(1), delta: z.number().int().min(-25).max(25), reason: z.string().optional() });
export const questObjectiveSchema = z.object({ id: z.string().min(1), title: z.string().min(1), target: z.number().int().min(1).max(100).default(1) });
export const questStartedEventSchema = z.object({ type: z.literal('quest_started'), quest: z.object({ id: z.string().min(1).optional(), title: z.string().min(1), description: z.string().default(''), objectives: z.array(questObjectiveSchema).min(1).max(8), rewards: z.array(z.string()).optional() }) });
export const questProgressedEventSchema = z.object({ type: z.literal('quest_progressed'), questId: z.string().min(1), objectiveId: z.string().min(1), amount: z.number().int().min(1).max(100).default(1) });
export const questCompletedEventSchema = z.object({ type: z.literal('quest_completed'), questId: z.string().min(1) });
export const questFailedEventSchema = z.object({ type: z.literal('quest_failed'), questId: z.string().min(1), reason: z.string().optional() });
export const locationChangedEventSchema = z.object({ type: z.literal('location_changed'), location: z.string().min(1).max(120), reason: z.string().optional() });
export const skillCheckEventSchema = z.object({ type: z.literal('skill_check'), skill: z.string().min(1).max(80), difficulty: z.number().int().min(1).max(30), modifier: z.number().int().min(-10).max(20).default(0), reason: z.string().optional() });

export const gameEventSchema = z.discriminatedUnion('type', [itemAddedEventSchema, itemRemovedEventSchema, healthChangedEventSchema, statusChangedEventSchema, relationshipChangedEventSchema, questStartedEventSchema, questProgressedEventSchema, questCompletedEventSchema, questFailedEventSchema, locationChangedEventSchema, skillCheckEventSchema]);
export const gameEventsSchema = z.array(gameEventSchema).max(12).default([]);
export type GameEvent = z.infer<typeof gameEventSchema>;

export interface EventApplicationResult { game: GameState; effects: StoryTurnEffect[]; invalidEvents: string[]; skillChecks: SkillCheckResult[]; }

function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)); }
function rollD20(seed: string): number { let hash = 2166136261; for (const char of seed) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); } return (Math.abs(hash) % 20) + 1; }
function findItem(items: InventoryItem[], event: Extract<GameEvent, { type: 'item_removed' }>) { return items.find((item) => (event.itemId && item.id === event.itemId) || (event.name && item.name.toLowerCase() === event.name.toLowerCase())); }
function activeQuest(quests: Quest[], id: string) { return quests.find((quest) => quest.id === id && quest.status === 'active'); }

export function validateGameEvents(rawEvents: unknown): { events: GameEvent[]; invalidEvents: string[] } {
  const parsed = gameEventsSchema.safeParse(rawEvents ?? []);
  if (parsed.success) return { events: parsed.data, invalidEvents: [] };
  return { events: [], invalidEvents: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`) };
}

export function applyGameEvents(game: GameState, events: GameEvent[], turnSeed: string): EventApplicationResult {
  const next: GameState = { ...game, inventory: [...game.inventory], quests: game.quests.map((q) => ({ ...q, objectives: q.objectives.map((o) => ({ ...o })) })), relationships: { ...game.relationships }, status: { ...game.status } };
  const effects: StoryTurnEffect[] = [];
  const invalidEvents: string[] = [];
  const skillChecks: SkillCheckResult[] = [];

  events.forEach((event, index) => {
    switch (event.type) {
      case 'item_added': {
        const existing = next.inventory.find((item) => item.name.toLowerCase() === event.name.toLowerCase());
        next.inventory = existing ? next.inventory.map((item) => item.id === existing.id ? { ...item, quantity: clamp(item.quantity + event.quantity, 0, 999) } : item) : [...next.inventory, { id: createId('item'), name: event.name, description: event.description, quantity: event.quantity, category: event.category, attributes: event.attributes }];
        effects.push({ type: 'inventory', message: `+${event.quantity} ${event.name}` });
        break;
      }
      case 'item_removed': {
        const item = findItem(next.inventory, event);
        if (!item) { invalidEvents.push(`item_removed verworfen: unbekanntes Item ${event.itemId ?? event.name}`); break; }
        const quantity = Math.min(item.quantity, event.quantity);
        next.inventory = next.inventory.map((candidate) => candidate.id === item.id ? { ...candidate, quantity: candidate.quantity - quantity } : candidate).filter((candidate) => candidate.quantity > 0);
        effects.push({ type: 'inventory', message: `-${quantity} ${item.name}` });
        break;
      }
      case 'health_changed': {
        const before = typeof next.status.health === 'number' ? next.status.health : 100;
        const after = clamp(before + event.delta, 0, 100);
        next.status = { ...next.status, health: after };
        effects.push({ type: 'status', message: `Lebenspunkte: ${before} → ${after}` });
        break;
      }
      case 'status_changed':
        next.status = { ...next.status, [event.key]: event.value };
        effects.push({ type: 'status', message: `${event.key}: ${String(event.value)}` });
        break;
      case 'relationship_changed': {
        const known = [next.setup.protagonist.id, ...next.setup.companions.map((c) => c.id)].includes(event.characterId);
        if (!known) { invalidEvents.push(`relationship_changed verworfen: unbekannter Charakter ${event.characterId}`); break; }
        const before = next.relationships[event.characterId] ?? 0;
        const after = clamp(before + event.delta, -100, 100);
        next.relationships = { ...next.relationships, [event.characterId]: after };
        effects.push({ type: 'relationship', message: `Beziehung ${event.characterId}: ${before} → ${after}` });
        break;
      }
      case 'quest_started': {
        const questId = event.quest.id ?? createId('quest');
        if (next.quests.some((quest) => quest.id === questId)) { invalidEvents.push(`quest_started verworfen: Quest-ID existiert bereits ${questId}`); break; }
        const objectives: QuestObjective[] = event.quest.objectives.map((objective) => ({ ...objective, progress: 0, completed: false }));
        next.quests = [...next.quests, { ...event.quest, id: questId, status: 'active', objectives }];
        effects.push({ type: 'quest', message: `Quest gestartet: ${event.quest.title}` });
        break;
      }
      case 'quest_progressed': {
        const quest = activeQuest(next.quests, event.questId);
        const objective = quest?.objectives.find((candidate) => candidate.id === event.objectiveId);
        if (!quest || !objective) { invalidEvents.push(`quest_progressed verworfen: unbekannte aktive Quest/Ziel ${event.questId}/${event.objectiveId}`); break; }
        next.quests = next.quests.map((candidate) => candidate.id !== quest.id ? candidate : { ...candidate, objectives: candidate.objectives.map((obj) => obj.id === objective.id ? { ...obj, progress: clamp(obj.progress + event.amount, 0, obj.target), completed: obj.progress + event.amount >= obj.target } : obj) });
        effects.push({ type: 'quest', message: `Questfortschritt: ${quest.title} / ${objective.title}` });
        break;
      }
      case 'quest_completed': {
        const quest = activeQuest(next.quests, event.questId);
        if (!quest) { invalidEvents.push(`quest_completed verworfen: unbekannte aktive Quest ${event.questId}`); break; }
        next.quests = next.quests.map((candidate) => candidate.id === event.questId ? { ...candidate, status: 'completed', objectives: candidate.objectives.map((objective) => ({ ...objective, progress: objective.target, completed: true })) } : candidate);
        effects.push({ type: 'quest', message: `Quest abgeschlossen: ${quest.title}` });
        break;
      }
      case 'quest_failed': {
        const quest = activeQuest(next.quests, event.questId);
        if (!quest) { invalidEvents.push(`quest_failed verworfen: unbekannte aktive Quest ${event.questId}`); break; }
        next.quests = next.quests.map((candidate) => candidate.id === event.questId ? { ...candidate, status: 'failed' } : candidate);
        effects.push({ type: 'quest', message: `Quest gescheitert: ${quest.title}` });
        break;
      }
      case 'location_changed':
        next.status = { ...next.status, location: event.location };
        effects.push({ type: 'status', message: `Ort: ${event.location}` });
        break;
      case 'skill_check': {
        const roll = rollD20(`${turnSeed}:${index}:${event.skill}:${event.difficulty}:${event.modifier}`);
        const total = roll + event.modifier;
        const result = { skill: event.skill, difficulty: event.difficulty, modifier: event.modifier, roll, total, success: total >= event.difficulty, reason: event.reason };
        skillChecks.push(result);
        effects.push({ type: 'skill_check', message: `${event.skill}: W20 ${roll} ${event.modifier >= 0 ? '+' : ''}${event.modifier} = ${total} gegen ${event.difficulty} (${result.success ? 'Erfolg' : 'Misserfolg'})` });
        break;
      }
    }
  });

  return { game: next, effects, invalidEvents, skillChecks };
}
