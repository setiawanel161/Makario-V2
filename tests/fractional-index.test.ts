import { describe, expect, it } from 'vitest';
import {
  generateKeyBetween,
  generateKeyBetweenWithNormalization,
  MAX_FRACTIONAL_KEY_LENGTH,
  normalizeSiblingOrder,
  type FractionalSibling,
} from '../src/lib/fractional-index';

describe('fractional indexing', () => {
  it('creates initial, prepend, append, and midpoint keys in lexicographical order', () => {
    const first = generateKeyBetween(null, null);
    const before = generateKeyBetween(null, first);
    const after = generateKeyBetween(first, null);
    const middle = generateKeyBetween(first, after);

    expect(first).toBe('a0');
    expect(before < first).toBe(true);
    expect(after).toBe('a1');
    expect(first < middle && middle < after).toBe(true);
  });

  it('generates keys between prefix-related neighbors', () => {
    const middle = generateKeyBetween('a0', 'a0V');
    expect('a0' < middle && middle < 'a0V').toBe(true);
  });

  it('normalizes siblings automatically when the next key exceeds the length limit', () => {
    const prefix = 'a'.repeat(MAX_FRACTIONAL_KEY_LENGTH + 1);
    const siblings: FractionalSibling[] = [
      { id: 'later', orderIndex: `${prefix}1` },
      { id: 'earlier', orderIndex: `${prefix}0` },
    ];

    const generated = generateKeyBetweenWithNormalization(
      `${prefix}0`,
      `${prefix}1`,
      siblings,
    );

    expect(generated.normalized).toBe(true);
    expect(generated.siblings.map((sibling) => sibling.id)).toEqual(['earlier', 'later']);
    expect(generated.siblings.every((sibling) => sibling.orderIndex.length <= 6)).toBe(true);
    const earlierKey = generated.siblings.find((sibling) => sibling.id === 'earlier')?.orderIndex;
    const laterKey = generated.siblings.find((sibling) => sibling.id === 'later')?.orderIndex;
    expect(earlierKey).toBeDefined();
    expect(laterKey).toBeDefined();
    expect(earlierKey).toBeDefined();
    expect(laterKey).toBeDefined();
    if (earlierKey === undefined || laterKey === undefined) {
      throw new Error('Normalization must retain both sibling keys.');
    }
    expect(earlierKey < generated.key && generated.key < laterKey).toBe(true);
  });

  it('normalizes to a stable order and rejects impossible or invalid intervals', () => {
    const siblings: FractionalSibling[] = [
      { id: 'c', orderIndex: 'a2' },
      { id: 'a', orderIndex: 'a0' },
      { id: 'b', orderIndex: 'a1' },
    ];
    expect(normalizeSiblingOrder(siblings).map((sibling) => sibling.id)).toEqual(['a', 'b', 'c']);
    expect(() => generateKeyBetween('a1', 'a0')).toThrow(RangeError);
    expect(() => generateKeyBetween(null, '0')).toThrow(RangeError);
    expect(() => generateKeyBetween('a', 'a0')).toThrow(RangeError);
  });
});
