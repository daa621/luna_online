import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SidePanel } from './SidePanel';
import type { GameState } from '@/lib/game/types';
import { mockDefaults } from '@/lib/ai/settings';

const baseGame: GameState = { id: 'g', name: 'Testspiel', createdAt: '', updatedAt: '', setup: { protagonist: { id: 'hero', name: 'Hero', description: '', gender: 'unspecified', traits: [], referenceImages: [] }, companions: [], world: { setting: '', backstory: '', rules: '', mood: '', referenceImages: [] } }, story: [], inventory: [], status: { health: 64, location: 'Alter Hafen', dangerLevel: 'hoch' }, quests: [], relationships: {}, schemaVersion: 1 };
const noop = vi.fn();

describe('SidePanel', () => {
  it('shows empty states for inventory and quests', () => {
    render(<SidePanel game={baseGame} aiSettings={mockDefaults} onAiSettingsChange={noop} onSave={noop} onNew={noop} onDelete={noop} />);
    expect(screen.getByText('Noch keine Quests. Die erste Aufgabe wartet darauf, entdeckt zu werden.')).toBeInTheDocument();
    expect(screen.getByText('Dein Rucksack ist noch leer.')).toBeInTheDocument();
    expect(screen.getByText('Alter Hafen')).toBeInTheDocument();
  });

  it('shows quest progress, completion state and inventory quantities', () => {
    const game: GameState = { ...baseGame, inventory: [{ id: 'item', name: 'Sehr langer Name eines geheimnisvollen Schlüssels', description: '', quantity: 2, category: 'Quest' }], quests: [{ id: 'q', title: 'Das Tor öffnen', description: 'Finde den Weg hinein.', status: 'active', objectives: [{ id: 'o', title: 'Schlüssel finden', target: 3, progress: 2, completed: false }] }] };
    render(<SidePanel game={game} aiSettings={mockDefaults} onAiSettingsChange={noop} onSave={noop} onNew={noop} onDelete={noop} />);
    expect(screen.getByText('Das Tor öffnen')).toBeInTheDocument();
    expect(screen.getByText(/Schlüssel finden \(2\/3\)/)).toBeInTheDocument();
    expect(screen.getByText('× 2')).toBeInTheDocument();
  });
});
