import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

// Reuse existing local font artifacts; browser fixtures never fetch Google Fonts.
export async function localTypographyFonts(root) {
  const directory = process.env.TEST_FONTS_DIR
    ? path.resolve(process.env.TEST_FONTS_DIR)
    : path.resolve(root, '../artifacts');
  const files = new Map();
  try {
    for (let i = 0; i < 6; i++) {
      const name = `font-restore-poppins-${i}.ttf`;
      files.set('/' + name, await readFile(path.join(directory, name)));
    }
  } catch {
    files.clear();
  }
  if (process.env.TEST_FONTS_DIR) assert.equal(files.size, 6, 'Explicit font fixture directory must contain all six Poppins files');
  return {
    loaded: files.size === 6,
    css: [...files.keys()].map((url, i) => `@font-face{font-family:Poppins;font-style:normal;font-weight:${400 + i * 100};src:url('${url}') format('truetype');font-display:block}`).join('\n'),
    serve(url, res) {
      const bytes = files.get(url.pathname);
      if (!bytes) return false;
      res.setHeader('Content-Type', 'font/ttf');
      res.end(bytes);
      return true;
    },
  };
}
