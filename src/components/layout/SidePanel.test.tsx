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

  it('places status and gameplay information before AI settings and actions', () => {
    const { container } = render(<SidePanel game={baseGame} aiSettings={{ ...mockDefaults, model: 'mistralai/ministral-3-3b-mit-einem-sehr-langen-namen' }} onAiSettingsChange={noop} onSave={noop} onNew={noop} onDelete={noop} />);
    const status = screen.getByText('Spielstatus');
    const inventory = screen.getByText('Inventar');
    const quests = screen.getByText('Quests');
    const aiProvider = screen.getByText('KI-Provider');
    const saveButton = screen.getByRole('button', { name: 'Spiel speichern' });
    expect(status.compareDocumentPosition(inventory) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(inventory.compareDocumentPosition(quests) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(quests.compareDocumentPosition(aiProvider) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(aiProvider.compareDocumentPosition(saveButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelector('.side-panel')).toBeInTheDocument();
  });

});
