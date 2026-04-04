import { looksLikeCIDR } from '../../utils/cidr';

export interface ParsedEntry {
  prefix: string;
  comment: string;
  status: 'valid' | 'invalid' | 'duplicate';
  error: string | null;
}

/**
 * Parse CSV text into validated address list entries.
 * Each line should be: prefix,comment (comment is optional)
 *
 * @param text - CSV text to parse
 * @param existingPrefixes - prefixes already in the list (for duplicate detection)
 * @returns Array of parsed entries with validation status
 */
export function parseCSV(text: string, existingPrefixes: string[]): ParsedEntry[] {
  const results: ParsedEntry[] = [];
  const existingLower = new Set(existingPrefixes.map((p) => p.toLowerCase()));
  const seenInImport = new Set<string>();

  const lines = text.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === '') continue;

    const commaIndex = line.indexOf(',');
    let prefix: string;
    let comment: string;

    if (commaIndex === -1) {
      prefix = line.trim();
      comment = '';
    } else {
      prefix = line.slice(0, commaIndex).trim();
      comment = line.slice(commaIndex + 1).trim();
    }

    if (prefix === '') continue;

    const prefixLower = prefix.toLowerCase();

    if (!looksLikeCIDR(prefix)) {
      results.push({ prefix, comment, status: 'invalid', error: 'Invalid prefix format' });
    } else if (existingLower.has(prefixLower)) {
      results.push({ prefix, comment, status: 'duplicate', error: 'Already exists in list' });
    } else if (seenInImport.has(prefixLower)) {
      results.push({ prefix, comment, status: 'duplicate', error: 'Duplicate in import' });
    } else {
      seenInImport.add(prefixLower);
      results.push({ prefix, comment, status: 'valid', error: null });
    }
  }

  return results;
}
