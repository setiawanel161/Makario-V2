import type { JsonValue, ViewFilterRule, ViewSortRule } from '@/types/workspace';

export interface DatabaseViewRow {
  id: string;
  title: string;
  orderIndex: string;
  properties: Record<string, JsonValue>;
}

function isEmpty(value: JsonValue | undefined): boolean {
  return value === undefined || value === null || value === '' ||
    (Array.isArray(value) && value.length === 0);
}

function normalize(value: JsonValue | undefined): string | number | boolean {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.toLocaleLowerCase();
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  return JSON.stringify(value).toLocaleLowerCase();
}

function compare(left: JsonValue | undefined, right: JsonValue | undefined): number {
  const leftValue = normalize(left);
  const rightValue = normalize(right);
  if (typeof leftValue === 'number' && typeof rightValue === 'number') {
    return leftValue - rightValue;
  }
  if (typeof leftValue === 'boolean' && typeof rightValue === 'boolean') {
    return Number(leftValue) - Number(rightValue);
  }
  return String(leftValue).localeCompare(String(rightValue), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

function matchesFilter(row: DatabaseViewRow, filter: ViewFilterRule): boolean {
  const value = row.properties[filter.propertyId];
  const expected = filter.value;
  switch (filter.operator) {
    case 'equals':
      return compare(value, expected ?? null) === 0;
    case 'not_equals':
      return compare(value, expected ?? null) !== 0;
    case 'contains': {
      const actual = Array.isArray(value) ? value : [value];
      const targets = Array.isArray(expected) ? expected : [expected ?? ''];
      return actual.some((entry) =>
        targets.some((target) =>
          String(entry ?? '').toLocaleLowerCase().includes(String(target).toLocaleLowerCase()),
        ),
      );
    }
    case 'not_contains':
      return !matchesFilter(row, { ...filter, operator: 'contains' });
    case 'is_empty':
      return isEmpty(value);
    case 'is_not_empty':
      return !isEmpty(value);
    case 'gt':
      return compare(value, expected ?? null) > 0;
    case 'lt':
      return compare(value, expected ?? null) < 0;
  }
}

export function filterAndSortRows(
  rows: readonly DatabaseViewRow[],
  filters: readonly ViewFilterRule[],
  sorts: readonly ViewSortRule[],
): DatabaseViewRow[] {
  return rows
    .filter((row) => filters.every((filter) => matchesFilter(row, filter)))
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      for (const sort of sorts) {
        const order = compare(
          left.row.properties[sort.propertyId],
          right.row.properties[sort.propertyId],
        );
        if (order !== 0) return sort.direction === 'asc' ? order : -order;
      }
      const orderIndexOrder = left.row.orderIndex.localeCompare(right.row.orderIndex);
      return orderIndexOrder === 0 ? left.index - right.index : orderIndexOrder;
    })
    .map(({ row }) => row);
}

export function evaluateFormula(
  expression: string,
  properties: Record<string, JsonValue>,
): number | null {
  const tokens: Array<number | string> = [];
  const tokenPattern = /\s*(\{[A-Za-z0-9_-]+\}|(?:\d+\.?\d*|\.\d+)|[()+*/-])/gy;
  let offset = 0;
  while (offset < expression.length) {
    tokenPattern.lastIndex = offset;
    const match = tokenPattern.exec(expression);
    if (!match) return null;
    const token = match[1];
    tokens.push(token.startsWith('{') ? token.slice(1, -1) : Number.isNaN(Number(token)) ? token : Number(token));
    offset = tokenPattern.lastIndex;
  }

  let index = 0;
  function parsePrimary(): number | null {
    const token = tokens[index++];
    if (typeof token === 'number') return token;
    if (token === '-') {
      const value = parsePrimary();
      return value === null ? null : -value;
    }
    if (token === '(') {
      const value = parseExpression();
      if (tokens[index++] !== ')') return null;
      return value;
    }
    if (typeof token === 'string') {
      const value = properties[token];
      if (typeof value === 'number') return value;
      if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
        return Number(value);
      }
    }
    return null;
  }

  function parseTerm(): number | null {
    let value = parsePrimary();
    while (value !== null && (tokens[index] === '*' || tokens[index] === '/')) {
      const operator = tokens[index++];
      const right = parsePrimary();
      if (right === null || (operator === '/' && right === 0)) return null;
      value = operator === '*' ? value * right : value / right;
    }
    return value;
  }

  function parseExpression(): number | null {
    let value = parseTerm();
    while (value !== null && (tokens[index] === '+' || tokens[index] === '-')) {
      const operator = tokens[index++];
      const right = parseTerm();
      if (right === null) return null;
      value = operator === '+' ? value + right : value - right;
    }
    return value;
  }

  if (tokens.length === 0) return null;
  const result = parseExpression();
  return result !== null && index === tokens.length && Number.isFinite(result) ? result : null;
}

export function calculateRollup(
  row: DatabaseViewRow,
  relationPropertyId: string,
  targetPropertyId: string,
  aggregation: 'COUNT' | 'SUM' | 'AVG' | 'PERCENT_CHECKED',
  rows: readonly DatabaseViewRow[],
): number {
  const relationValue = row.properties[relationPropertyId];
  const ids = Array.isArray(relationValue)
    ? relationValue.filter((value): value is string => typeof value === 'string')
    : typeof relationValue === 'string'
      ? [relationValue]
      : [];
  const relatedValues = rows
    .filter((candidate) => ids.includes(candidate.id))
    .map((candidate) => candidate.properties[targetPropertyId]);
  if (aggregation === 'COUNT') return relatedValues.length;
  if (aggregation === 'PERCENT_CHECKED') {
    if (relatedValues.length === 0) return 0;
    return (relatedValues.filter((value) => value === true).length / relatedValues.length) * 100;
  }
  const numbers = relatedValues
    .map((value) => (typeof value === 'number' ? value : Number(value)))
    .filter(Number.isFinite);
  if (numbers.length === 0) return 0;
  const total = numbers.reduce((sum, value) => sum + value, 0);
  return aggregation === 'AVG' ? total / numbers.length : total;
}
