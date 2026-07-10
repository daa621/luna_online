import { z } from 'zod';
import type { GameState, InventoryItem, Quest, QuestObjective, SkillCheckResult, StoryTurnEffect } from './types';
import { createId } from './defaults';

const attributesSchema: z.ZodType<Record<string, unknown>> = z.record(z.string(), z.unknown());
const gateSchema = z.object({ skillCheckId: z.string().min(1), outcome: z.enum(['success', 'failure']) });
const gated = <T extends z.ZodRawShape>(shape: T) => z.object({ ...shape, requiresSkillCheck: gateSchema.optional() });

export const itemAddedEventSchema = gated({ type: z.literal('item_added'), name: z.string().min(1), description: z.string().default(''), quantity: z.number().int().min(1).max(99).default(1), category: z.string().min(1).default('Sonstiges'), attributes: attributesSchema.optional() });
export const itemRemovedEventSchema = gated({ type: z.literal('item_removed'), itemId: z.string().optional(), name: z.string().min(1).optional(), quantity: z.number().int().min(1).max(99).default(1) }).refine((event) => event.itemId || event.name, 'itemId oder name ist erforderlich');
export const healthChangedEventSchema = gated({ type: z.literal('health_changed'), delta: z.number().int().min(-100).max(100), reason: z.string().optional() });
export const statusChangedEventSchema = gated({ type: z.literal('status_changed'), key: z.enum(['timeOfDay', 'weather', 'mood', 'dangerLevel']), value: z.union([z.string(), z.number(), z.boolean(), z.null()]), reason: z.string().optional() });
export const relationshipChangedEventSchema = gated({ type: z.literal('relationship_changed'), characterId: z.string().min(1), delta: z.number().int().min(-25).max(25), reason: z.string().optional() });
export const questObjectiveSchema = z.object({ id: z.string().min(1), title: z.string().min(1), target: z.number().int().min(1).max(100).default(1) });
export const questStartedEventSchema = gated({ type: z.literal('quest_started'), quest: z.object({ id: z.string().min(1).optional(), title: z.string().min(1), description: z.string().default(''), objectives: z.array(questObjectiveSchema).min(1).max(8), rewards: z.array(z.string()).optional() }) });
export const questProgressedEventSchema = gated({ type: z.literal('quest_progressed'), questId: z.string().min(1), objectiveId: z.string().min(1), amount: z.number().int().min(1).max(100).default(1) });
export const questCompletedEventSchema = gated({ type: z.literal('quest_completed'), questId: z.string().min(1) });
export const questFailedEventSchema = gated({ type: z.literal('quest_failed'), questId: z.string().min(1), reason: z.string().optional() });
export const locationChangedEventSchema = gated({ type: z.literal('location_changed'), location: z.string().min(1).max(120), reason: z.string().optional() });
export const skillCheckEventSchema = z.object({ type: z.literal('skill_check'), id: z.string().min(1).optional(), skill: z.string().min(1).max(80), difficulty: z.number().int().min(1).max(30), modifier: z.number().int().min(-10).max(20).default(0), reason: z.string().optional() });

export const gameEventSchema = z.discriminatedUnion('type', [itemAddedEventSchema, itemRemovedEventSchema, healthChangedEventSchema, statusChangedEventSchema, relationshipChangedEventSchema, questStartedEventSchema, questProgressedEventSchema, questCompletedEventSchema, questFailedEventSchema, locationChangedEventSchema, skillCheckEventSchema]);
export const gameEventsSchema = z.array(gameEventSchema).max(12).default([]);
export type GameEvent = z.infer<typeof gameEventSchema>;
type SkillCheckEvent = Extract<GameEvent, { type: 'skill_check' }>;
type StateEvent = Exclude<GameEvent, SkillCheckEvent>;

export interface EventApplicationResult { game: GameState; effects: StoryTurnEffect[]; invalidEvents: string[]; skillChecks: SkillCheckResult[]; }

function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)); }
export function rollD20(seed: string): number { let hash = 2166136261; for (const char of seed) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); } return (Math.abs(hash) % 20) + 1; }
function findItem(items: InventoryItem[], event: Extract<GameEvent, { type: 'item_removed' }>) { return items.find((item) => (event.itemId && item.id === event.itemId) || (event.name && item.name.toLowerCase() === event.name.toLowerCase())); }
function activeQuest(quests: Quest[], id: string) { return quests.find((quest) => quest.id === id && quest.status === 'active'); }
function eventLabel(index: number, error: z.ZodError) { return `events.${index}: ${error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`; }

export function validateGameEvents(rawEvents: unknown): { events: GameEvent[]; invalidEvents: string[] } {
  if (rawEvents == null) return { events: [], invalidEvents: [] };
  if (!Array.isArray(rawEvents)) return { events: [], invalidEvents: ['events: muss ein Array sein'] };
  const events: GameEvent[] = [];
  const invalidEvents: string[] = [];
  rawEvents.slice(0, 12).forEach((rawEvent, index) => {
    const parsed = gameEventSchema.safeParse(rawEvent);
    if (parsed.success) events.push(parsed.data);
    else invalidEvents.push(eventLabel(index, parsed.error));
  });
  if (rawEvents.length > 12) invalidEvents.push('events: maximal 12 Ereignisse pro Zug; zusätzliche Ereignisse wurden ignoriert');
  return { events, invalidEvents };
}

export function resolveSkillChecks(events: GameEvent[], turnSeed: string): SkillCheckResult[] {
  return events.filter((event): event is SkillCheckEvent => event.type === 'skill_check').map((event, index) => {
    const roll = rollD20(`${turnSeed}:${index}:${event.id ?? event.skill}:${event.difficulty}:${event.modifier}`);
    const total = roll + event.modifier;
    return { id: event.id ?? `skill_${index + 1}`, skill: event.skill, difficulty: event.difficulty, modifier: event.modifier, roll, total, success: total >= event.difficulty, reason: event.reason };
  });
}

function dependencyAllows(event: StateEvent, checks: SkillCheckResult[], invalidEvents: string[]): boolean {
  if (!event.requiresSkillCheck) return true;
  const check = checks.find((candidate) => candidate.id === event.requiresSkillCheck?.skillCheckId);
  if (!check) { invalidEvents.push(`${event.type} verworfen: unbekannter Skill Check ${event.requiresSkillCheck.skillCheckId}`); return false; }
  const expectedSuccess = event.requiresSkillCheck.outcome === 'success';
  if (check.success !== expectedSuccess) { invalidEvents.push(`${event.type} verworfen: Skill Check ${check.id} ergab ${check.success ? 'Erfolg' : 'Misserfolg'}`); return false; }
  return true;
}

export function applyGameEvents(game: GameState, events: GameEvent[], turnSeed: string, preResolvedSkillChecks?: SkillCheckResult[]): EventApplicationResult {
  const next: GameState = { ...game, inventory: [...game.inventory], quests: game.quests.map((q) => ({ ...q, objectives: q.objectives.map((o) => ({ ...o })) })), relationships: { ...game.relationships }, status: { ...game.status } };
  const effects: StoryTurnEffect[] = [];
  const invalidEvents: string[] = [];
  const skillChecks = preResolvedSkillChecks ?? resolveSkillChecks(events, turnSeed);
  skillChecks.forEach((result) => effects.push({ type: 'skill_check', message: `${result.skill}: W20 ${result.roll} ${result.modifier >= 0 ? '+' : ''}${result.modifier} = ${result.total} gegen ${result.difficulty} (${result.success ? 'Erfolg' : 'Misserfolg'})` }));

  events.filter((event): event is StateEvent => event.type !== 'skill_check').forEach((event) => {
    if (!dependencyAllows(event, skillChecks, invalidEvents)) return;
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
        if (!quest.objectives.every((objective) => objective.completed || objective.progress >= objective.target)) { invalidEvents.push(`quest_completed verworfen: Questziele sind noch nicht erfüllt ${event.questId}`); break; }
        next.quests = next.quests.map((candidate) => candidate.id === event.questId ? { ...candidate, status: 'completed' } : candidate);
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
    }
  });

  return { game: next, effects, invalidEvents, skillChecks };
}
