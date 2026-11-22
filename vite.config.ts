import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

const FONT_FORMAT_MAP: Record<string, string> = {
  '.woff2': 'woff2',
  '.woff': 'woff',
  '.ttf': 'truetype',
  '.otf': 'opentype',
};

function scanFontFiles(dir: string, urlPrefix: string): {url: string; format: string}[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, {withFileTypes: true});
  const priority = ['.woff2', '.woff', '.ttf', '.otf'];
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const ext = path.extname(entry.name).toLowerCase();
      return {name: entry.name, ext, format: FONT_FORMAT_MAP[ext]};
    })
    .filter((item): item is {name: string; ext: string; format: string} => Boolean(item.format))
    .sort((a, b) => priority.indexOf(a.ext) - priority.indexOf(b.ext) || a.name.localeCompare(b.name))
    .map((item) => ({
      url: `${urlPrefix}/${encodeURIComponent(item.name)}`,
      format: item.format,
    }));
}

function collectCustomFonts(fontsRoot: string, basePrefix: string) {
  const rootFiles = scanFontFiles(fontsRoot, basePrefix);
  const escapePrefix = basePrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const namedBody = rootFiles.filter((f) =>
    new RegExp(`^${escapePrefix}/body\\.`, 'i').test(decodeURIComponent(f.url)),
  );
  const namedDisplay = rootFiles.filter((f) =>
    new RegExp(`^${escapePrefix}/display\\.`, 'i').test(decodeURIComponent(f.url)),
  );
  const namedMono = rootFiles.filter((f) =>
    new RegExp(`^${escapePrefix}/mono\\.`, 'i').test(decodeURIComponent(f.url)),
  );
  const fallbackRootBody = rootFiles.filter(
    (f) => !new RegExp(`^${escapePrefix}/(display|mono)\\.`, 'i').test(decodeURIComponent(f.url)),
  );

  return {
    bodyFonts: [
      ...scanFontFiles(path.join(fontsRoot, 'body'), `${basePrefix}/body`),
      ...(namedBody.length > 0 ? namedBody : fallbackRootBody),
    ],
    displayFonts: [
      ...scanFontFiles(path.join(fontsRoot, 'display'), `${basePrefix}/display`),
      ...namedDisplay,
    ],
    monoFonts: [
      ...scanFontFiles(path.join(fontsRoot, 'mono'), `${basePrefix}/mono`),
      ...namedMono,
    ],
  };
}

function buildCustomFontsCss(fontsRoot: string, basePrefix = '.'): string {
  const {bodyFonts, displayFonts, monoFonts} = collectCustomFonts(fontsRoot, basePrefix);

  const blocks: string[] = ['/* Auto-generated from /public/fonts */'];
  const appendFace = (family: string, files: {url: string; format: string}[]) => {
    if (files.length === 0) return;
    const src = files.map((f) => `url('${f.url}') format('${f.format}')`).join(',\n    ');
    // Emit explicit weights (400/500/600/700) pointing to the same cached font URL
    // for 100% Safari / iOS / Android WebView compatibility with static fonts.
    for (const weight of [400, 500, 600, 700]) {
      blocks.push(
        `@font-face {\n  font-family: '${family}';\n  src:\n    ${src};\n  font-weight: ${weight};\n  font-style: normal;\n  font-display: swap;\n}`,
      );
    }
  };

  appendFace('PlanetBody', bodyFonts);
  appendFace('PlanetDisplay', displayFonts);
  appendFace('PlanetMono', monoFonts);
  return blocks.join('\n\n') + '\n';
}

export default defineConfig(() => {
  return {
    base: './',
    plugins: [
      react(),
      tailwindcss(),
      // Auto-generates /fonts/custom-fonts.css and inlines @font-face + preload into index.html on build.
      {
        name: 'auto-custom-fonts',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            const reqPath = (req.url || '').split('?')[0];
            if (reqPath.endsWith('/fonts/custom-fonts.css')) {
              const css = buildCustomFontsCss(path.resolve(__dirname, 'public/fonts'), '.');
              res.statusCode = 200;
              res.setHeader('Content-Type', 'text/css; charset=utf-8');
              res.setHeader('Cache-Control', 'no-store');
              res.end(css);
              return;
            }
            next();
          });
        },
        transformIndexHtml: {
          order: 'post',
          handler(_html, ctx) {
            // In production builds, inline @font-face with document-relative ./fonts/... URLs
            // and preload the primary body font so GitHub Pages loads it immediately without extra CSS round-trips.
            if (ctx.server) return [];
            const fontsRoot = path.resolve(__dirname, 'public/fonts');
            const css = buildCustomFontsCss(fontsRoot, './fonts');
            const {bodyFonts} = collectCustomFonts(fontsRoot, './fonts');
            const tags: {tag: string; attrs?: Record<string, string | boolean>; children?: string; injectTo: 'head'}[] = [];
            const primaryBody = bodyFonts[0];
            if (primaryBody) {
              const mimeMap: Record<string, string> = {
                woff2: 'font/woff2',
                woff: 'font/woff',
                truetype: 'font/ttf',
                opentype: 'font/otf',
              };
              tags.push({
                tag: 'link',
                attrs: {
                  rel: 'preload',
                  as: 'font',
                  href: primaryBody.url,
                  type: mimeMap[primaryBody.format] || 'font/woff2',
                  crossorigin: 'anonymous',
                },
                injectTo: 'head',
              });
            }
            tags.push({
              tag: 'style',
              attrs: {id: 'planet-custom-fonts'},
              children: css,
              injectTo: 'head',
            });
            return tags;
          },
        },
        closeBundle(error?: Error): void {
          if (error) return;
          const distFontsDir = path.resolve(__dirname, 'dist/fonts');
          fs.mkdirSync(distFontsDir, {recursive: true});
          const css = buildCustomFontsCss(path.resolve(__dirname, 'public/fonts'), '.');
          fs.writeFileSync(path.join(distFontsDir, 'custom-fonts.css'), css, 'utf-8');
        },
      },
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Allow proxied Cloud Run preview host headers in Vite 8.
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
