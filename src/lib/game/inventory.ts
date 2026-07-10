import type { InventoryChange, InventoryItem } from './types';
import { createId } from './defaults';

export function applyInventoryChanges(items: InventoryItem[], changes: InventoryChange[] = []): InventoryItem[] {
  return changes.reduce((current, change) => {
    const index = current.findIndex((item) => item.id === change.item.id || item.name.toLowerCase() === change.item.name.toLowerCase());
    if (change.operation === 'remove') return index >= 0 ? current.filter((_, i) => i !== index) : current;
    if (index < 0) {
      if (change.operation === 'add' || change.operation === 'update' || change.operation === 'setQuantity') {
        return [...current, { id: change.item.id ?? createId('item'), name: change.item.name, description: change.item.description ?? '', quantity: Math.max(0, change.item.quantity ?? change.quantityDelta ?? 1), category: change.item.category ?? 'Sonstiges', attributes: change.item.attributes }];
      }
      return current;
    }
    return current.map((item, i) => {
      if (i !== index) return item;
      if (change.operation === 'setQuantity') return { ...item, quantity: Math.max(0, change.item.quantity ?? item.quantity) };
      if (change.operation === 'add') return { ...item, quantity: Math.max(0, item.quantity + (change.quantityDelta ?? change.item.quantity ?? 1)) };
      return { ...item, ...change.item, id: item.id, quantity: Math.max(0, change.item.quantity ?? item.quantity) };
    }).filter((item) => item.quantity > 0);
  }, items);
}
