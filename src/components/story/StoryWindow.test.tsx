import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StoryWindow } from './StoryWindow';
import type { StoryEntry } from '@/lib/game/types';

describe('StoryWindow', () => {
  it('shows atmospheric turn evaluation with successful and failed skill checks', () => {
    const entries: StoryEntry[] = [{ id: '1', kind: 'ai', createdAt: new Date().toISOString(), text: 'Der Schatten weicht zurück.', effects: [{ type: 'inventory', message: '+1 Alter Schlüssel' }], invalidEvents: ['item_removed verworfen: unbekanntes Item'], skillChecks: [{ id: 'check-1', skill: 'Schlösser knacken', difficulty: 12, modifier: 2, roll: 15, total: 17, success: true }, { id: 'check-2', skill: 'Schleichen', difficulty: 18, modifier: 0, roll: 3, total: 3, success: false }] }];
    render(<StoryWindow entries={entries} />);
    expect(screen.getByLabelText('Spielzug-Auswertung')).toBeInTheDocument();
    expect(screen.getByText('Schlösser knacken')).toBeInTheDocument();
    expect(screen.getByText('17')).toBeInTheDocument();
    expect(screen.getByText('Misserfolg')).toBeInTheDocument();
    expect(screen.getByText('+1 Alter Schlüssel')).toBeInTheDocument();
    expect(screen.getByText('item_removed verworfen: unbekanntes Item')).toBeInTheDocument();
  });
});
