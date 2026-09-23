import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * AD-1 / NFR-5: `domain/` must never import `ws/`, `socket.io`, or
 * `server.ts` -- it stays reachable only from tests (and, transitively,
 * from `shared/`) with zero transport dependency. This walks every source
 * file under `backend/src/domain` and inspects its `import`/`export ...
 * from` specifiers -- an import-graph purity check, per this story's I/O
 * matrix ("Domain purity holds" row: "Zero references to ws, socket.io,
 * server.ts"). Deliberately import-specifier-scoped rather than whole-file
 * text grep, so prose in comments (e.g. "Epic 2's WS adapter") mentioning
 * these names doesn't produce a false positive.
 */
const domainDir = join(dirname(fileURLToPath(import.meta.url)));

const IMPORT_SPECIFIER_RE = /\bfrom\s+['"]([^'"]+)['"]/g;
const FORBIDDEN_SPECIFIER_RE = /(^|\/)ws(\/|$)|socket\.io|server\.ts/i;

function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

function importSpecifiers(fileText: string): string[] {
  return [...fileText.matchAll(IMPORT_SPECIFIER_RE)].map((match) => match[1] ?? '');
}

describe('Domain purity (AD-1, NFR-5)', () => {
  it('zero import specifiers reference ws, socket.io, or server.ts across backend/src/domain', () => {
    const files = collectSourceFiles(domainDir);
    expect(files.length).toBeGreaterThan(0);

    const offenders: Array<{ file: string; specifier: string }> = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf-8');
      for (const specifier of importSpecifiers(text)) {
        if (FORBIDDEN_SPECIFIER_RE.test(specifier)) {
          offenders.push({ file, specifier });
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
