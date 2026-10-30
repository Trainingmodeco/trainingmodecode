// The app is bundled by Metro, which resolves `./foo` to `./foo.js`. Plain node
// ESM does not, so a test that imports a module with sibling imports fails to
// resolve them. This hook adds the extension the bundler would have added, so
// the standalone tests can exercise the real files rather than copies.
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (err) {
    if (!specifier.startsWith('.')) throw err;
    const base = context.parentURL ? new URL(specifier, context.parentURL) : null;
    if (!base) throw err;
    for (const ext of ['.js', '.jsx', '.mjs', '.ts', '/index.js', '/index.ts']) {
      const candidate = fileURLToPath(base) + ext;
      if (existsSync(candidate)) return next(pathToFileURL(candidate).href, context);
    }
    throw err;
  }
}

// Metro imports JSON without an import attribute; node wants `with { type: 'json' }`.
// (TypeScript files load through node's built-in type stripping.)
export async function load(url, context, next) {
  if (url.endsWith('.json')) return next(url, { ...context, importAttributes: { ...(context.importAttributes || {}), type: 'json' } });
  return next(url, context);
}
