import { describe, expect, it } from 'vitest';
import { evaluateFormula, filterAndSortRows } from '@/lib/database/view-utils';
import type { ViewFilterRule, ViewSortRule } from '@/types/workspace';

describe('database view utilities', () => {
  const rows = [
    { id: 'one', title: 'One', orderIndex: 'a1', properties: { status: 'todo', score: 12 } },
    { id: 'two', title: 'Two', orderIndex: 'a2', properties: { status: 'done', score: 3 } },
    { id: 'three', title: 'Three', orderIndex: 'a3', properties: { status: 'done', score: 8 } },
  ];

  it('filters first, then sorts matching rows by their typed values', () => {
    const filters: ViewFilterRule[] = [
      { id: 'done', propertyId: 'status', operator: 'equals', value: 'done' },
      { id: 'min', propertyId: 'score', operator: 'gt', value: 3 },
    ];
    const sorts: ViewSortRule[] = [{ propertyId: 'score', direction: 'desc' }];

    expect(filterAndSortRows(rows, filters, sorts).map((row) => row.id)).toEqual(['three']);
  });

  it('evaluates safe arithmetic and returns null for unknown or invalid expressions', () => {
    expect(evaluateFormula('({score} + 2) * 3', { score: 4 })).toBe(18);
    expect(evaluateFormula('{missing} + 1', {})).toBeNull();
    expect(evaluateFormula('1 / 0', {})).toBeNull();
  });
});
