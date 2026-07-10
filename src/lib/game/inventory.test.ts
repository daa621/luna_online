import { describe, expect, it } from 'vitest';
import { applyInventoryChanges } from './inventory';
import type { InventoryItem } from './types';

const sword: InventoryItem = { id: 'sword', name: 'Schwert', description: 'Alt', quantity: 1, category: 'Waffe' };

describe('applyInventoryChanges', () => {
  it('adds new items and stacks existing items by name', () => {
    const result = applyInventoryChanges([sword], [{ operation: 'add', item: { name: 'Schwert' }, quantityDelta: 2 }, { operation: 'add', item: { name: 'Trank', description: 'Heilt', category: 'Verbrauchbar', quantity: 3 } }]);
    expect(result).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'Schwert', quantity: 3 }), expect.objectContaining({ name: 'Trank', quantity: 3 })]));
  });

  it('removes items and filters zero quantities', () => {
    expect(applyInventoryChanges([sword], [{ operation: 'setQuantity', item: { name: 'Schwert', quantity: 0 } }])).toEqual([]);
  });
});
