export type CharacterGender = 'female' | 'male' | 'nonbinary' | 'unspecified' | 'custom';

export interface ReferenceImage {
  id: string;
  name: string;
  dataUrl: string;
  mediaType: string;
  createdAt: string;
}

export interface CharacterProfile {
  id: string;
  name: string;
  description: string;
  gender: CharacterGender;
  traits: string[];
  referenceImages: ReferenceImage[];
}

export interface WorldProfile {
  setting: string;
  backstory: string;
  rules: string;
  mood: string;
  referenceImages: ReferenceImage[];
}

export interface GameSetup {
  protagonist: CharacterProfile;
  companions: CharacterProfile[];
  world: WorldProfile;
}

export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  quantity: number;
  category: string;
  attributes?: Record<string, unknown>;
}

export type GameStatusValue = string | number | boolean | null | GameStatusValue[] | { [key: string]: GameStatusValue };
export type GameStatus = Record<string, GameStatusValue>;

export interface InventoryChange {
  operation: 'add' | 'remove' | 'setQuantity' | 'update';
  item: Partial<InventoryItem> & { id?: string; name: string };
  quantityDelta?: number;
}

export interface ImageRequest {
  shouldGenerate: boolean;
  prompt?: string;
  involvedCharacterIds?: string[];
}

export interface StructuredAiResponse {
  storyText: string;
  inventoryChanges?: InventoryChange[];
  statusChanges?: GameStatus;
  questChanges?: GameStatus;
  location?: string;
  involvedCharacterIds?: string[];
  imageRequest?: ImageRequest;
}

export interface StoryEntryBase { id: string; createdAt: string; }
export interface PlayerStoryEntry extends StoryEntryBase { kind: 'player'; text: string; }
export interface AiStoryEntry extends StoryEntryBase { kind: 'ai'; text: string; structured?: StructuredAiResponse; image?: GeneratedStoryImage; }
export interface SystemStoryEntry extends StoryEntryBase { kind: 'system'; text: string; }
export type StoryEntry = PlayerStoryEntry | AiStoryEntry | SystemStoryEntry;

export interface GeneratedStoryImage { id: string; prompt: string; url: string; provider: string; createdAt: string; }

export interface GameState {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  setup: GameSetup;
  story: StoryEntry[];
  inventory: InventoryItem[];
  status: GameStatus;
  schemaVersion: 1;
}
