const BASE62_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const MIDPOINT_CHARACTER = BASE62_ALPHABET[Math.floor(BASE62_ALPHABET.length / 2)];
export const MAX_FRACTIONAL_KEY_LENGTH = 32;
const NORMALIZED_KEY_WIDTH = 6;

export interface FractionalSibling {
  id: string;
  orderIndex: string;
}

export interface NormalizedKeyGeneration {
  key: string;
  siblings: FractionalSibling[];
  normalized: boolean;
}

function assertKey(key: string): void {
  if (key.length === 0 || [...key].some((character) => !BASE62_ALPHABET.includes(character))) {
    throw new RangeError(`Invalid base-62 fractional key: ${key}`);
  }
}

function keyCharacterIndex(character: string): number {
  const index = BASE62_ALPHABET.indexOf(character);
  if (index < 0) {
    throw new RangeError(`Invalid base-62 fractional key character: ${character}`);
  }
  return index;
}

function keyBefore(nextKey: string): string {
  const firstIndex = keyCharacterIndex(nextKey[0]);
  if (firstIndex > 0) {
    return BASE62_ALPHABET[Math.floor(firstIndex / 2)];
  }
  if (nextKey.length > 1) {
    return nextKey[0];
  }
  throw new RangeError('There is no base-62 key before the minimum key "0".');
}

function keyAfter(previousKey: string): string {
  for (let index = previousKey.length - 1; index >= 0; index -= 1) {
    const characterIndex = keyCharacterIndex(previousKey[index]);
    if (characterIndex < BASE62_ALPHABET.length - 1) {
      return `${previousKey.slice(0, index)}${BASE62_ALPHABET[characterIndex + 1]}`;
    }
  }
  return `${previousKey}${MIDPOINT_CHARACTER}`;
}

function keyBetween(previousKey: string, nextKey: string): string {
  let commonPrefixLength = 0;
  while (
    commonPrefixLength < previousKey.length &&
    commonPrefixLength < nextKey.length &&
    previousKey[commonPrefixLength] === nextKey[commonPrefixLength]
  ) {
    commonPrefixLength += 1;
  }

  const prefix = previousKey.slice(0, commonPrefixLength);
  const previousRemainder = previousKey.slice(commonPrefixLength);
  const nextRemainder = nextKey.slice(commonPrefixLength);

  if (previousRemainder.length === 0) {
    const nextCharacterIndex = keyCharacterIndex(nextRemainder[0]);
    if (nextCharacterIndex > 0) {
      return `${prefix}${BASE62_ALPHABET[Math.floor(nextCharacterIndex / 2)]}`;
    }
    if (nextRemainder.length > 1) {
      return `${prefix}${nextRemainder[0]}`;
    }
    throw new RangeError(`There is no base-62 key between "${previousKey}" and "${nextKey}".`);
  }

  const previousCharacterIndex = keyCharacterIndex(previousRemainder[0]);
  const nextCharacterIndex = keyCharacterIndex(nextRemainder[0]);
  const gap = nextCharacterIndex - previousCharacterIndex;

  if (gap > 1) {
    const midpointIndex = previousCharacterIndex + Math.floor(gap / 2);
    return `${prefix}${BASE62_ALPHABET[midpointIndex]}`;
  }

  return `${previousKey}${MIDPOINT_CHARACTER}`;
}

export function generateKeyBetween(prevKey: string | null, nextKey: string | null): string {
  if (prevKey !== null) {
    assertKey(prevKey);
  }
  if (nextKey !== null) {
    assertKey(nextKey);
  }
  if (prevKey !== null && nextKey !== null && prevKey >= nextKey) {
    throw new RangeError('The previous fractional key must sort before the next key.');
  }
  if (prevKey === null) {
    return nextKey === null ? 'a0' : keyBefore(nextKey);
  }
  if (nextKey === null) {
    return keyAfter(prevKey);
  }
  return keyBetween(prevKey, nextKey);
}

function encodeFixedWidth(value: number, width: number): string {
  let remaining = value;
  let result = '';
  for (let position = 0; position < width; position += 1) {
    result = `${BASE62_ALPHABET[remaining % BASE62_ALPHABET.length]}${result}`;
    remaining = Math.floor(remaining / BASE62_ALPHABET.length);
  }
  if (remaining > 0) {
    throw new RangeError('There are too many siblings to normalize fractional keys.');
  }
  return result;
}

export function normalizeSiblingOrder(siblings: readonly FractionalSibling[]): FractionalSibling[] {
  const ids = new Set<string>();
  const keys = new Set<string>();
  for (const sibling of siblings) {
    assertKey(sibling.orderIndex);
    if (ids.has(sibling.id)) {
      throw new RangeError(`Duplicate sibling id: ${sibling.id}`);
    }
    if (keys.has(sibling.orderIndex)) {
      throw new RangeError(`Duplicate sibling fractional key: ${sibling.orderIndex}`);
    }
    ids.add(sibling.id);
    keys.add(sibling.orderIndex);
  }

  const orderedSiblings = [...siblings].sort((left, right) =>
    left.orderIndex < right.orderIndex ? -1 : left.orderIndex > right.orderIndex ? 1 : 0,
  );
  const capacity = BASE62_ALPHABET.length ** NORMALIZED_KEY_WIDTH;
  const step = Math.floor(capacity / (orderedSiblings.length + 1));
  if (step < 1) {
    throw new RangeError('There are too many siblings to normalize fractional keys.');
  }
  return orderedSiblings.map((sibling, index) => ({
    ...sibling,
    orderIndex: encodeFixedWidth(step * (index + 1), NORMALIZED_KEY_WIDTH),
  }));
}

export function generateKeyBetweenWithNormalization(
  prevKey: string | null,
  nextKey: string | null,
  siblings: readonly FractionalSibling[],
): NormalizedKeyGeneration {
  const key = generateKeyBetween(prevKey, nextKey);
  if (key.length <= MAX_FRACTIONAL_KEY_LENGTH) {
    return { key, siblings: [...siblings], normalized: false };
  }

  const oldKeysById = new Map(siblings.map((sibling) => [sibling.id, sibling.orderIndex]));
  const normalizedSiblings = normalizeSiblingOrder(siblings);
  const keyByOldIndex = new Map(
    normalizedSiblings.map((sibling) => [oldKeysById.get(sibling.id), sibling.orderIndex]),
  );
  const normalizedPrevious = prevKey === null ? null : keyByOldIndex.get(prevKey);
  const normalizedNext = nextKey === null ? null : keyByOldIndex.get(nextKey);

  if ((prevKey !== null && normalizedPrevious === undefined) ||
      (nextKey !== null && normalizedNext === undefined)) {
    throw new RangeError('The neighboring keys must belong to the supplied sibling set.');
  }

  const normalizedKey = generateKeyBetween(normalizedPrevious ?? null, normalizedNext ?? null);
  if (normalizedKey.length > MAX_FRACTIONAL_KEY_LENGTH) {
    throw new RangeError('Sibling normalization did not produce a key within the length limit.');
  }
  return { key: normalizedKey, siblings: normalizedSiblings, normalized: true };
}
