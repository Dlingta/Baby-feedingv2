import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

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

interface FontChunkEntry {
  file: string;
  format: string;
  preload?: boolean;
  unicodeRange?: string;
}

interface FontChunkManifest {
  family?: string;
  chunks?: FontChunkEntry[];
}

function readChunkManifest(dir: string, urlPrefix: string): {
  url: string;
  format: string;
  preload: boolean;
  unicodeRange?: string;
}[] | null {
  const manifestPath = path.join(dir, 'chunks.json');
  if (!fs.existsSync(manifestPath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as FontChunkManifest;
    if (!Array.isArray(parsed.chunks) || parsed.chunks.length === 0) return null;
    const valid = parsed.chunks
      .filter((c) => typeof c.file === 'string' && fs.existsSync(path.join(dir, c.file)))
      .map((c) => ({
        url: `${urlPrefix}/${encodeURIComponent(c.file)}`,
        format: c.format || 'woff2',
        preload: Boolean(c.preload),
        unicodeRange: c.unicodeRange,
      }));
    return valid.length > 0 ? valid : null;
  } catch {
    return null;
  }
}

function buildCustomFontsCss(fontsRoot: string, basePrefix = '.'): {
  css: string;
  preloadFonts: {url: string; format: string}[];
} {
  const bodyChunks = readChunkManifest(path.join(fontsRoot, 'body'), `${basePrefix}/body`);
  const {bodyFonts, displayFonts, monoFonts} = collectCustomFonts(fontsRoot, basePrefix);

  const blocks: string[] = ['/* Auto-generated from /public/fonts */'];
  const preloadFonts: {url: string; format: string}[] = [];

  const appendFace = (
    family: string,
    files: {url: string; format: string}[],
    unicodeRange?: string,
  ) => {
    if (files.length === 0) return;
    const src = files.map((f) => `url('${f.url}') format('${f.format}')`).join(',\n    ');
    const rangeLine = unicodeRange ? `\n  unicode-range: ${unicodeRange};` : '';
    // Standard CSS Fonts Level 3 single regular face (400): matches all weights (400/500/600/700)
    // across every iOS Safari, Android Chrome, and WeChat WebView while keeping head CSS compact.
    blocks.push(
      `@font-face {\n  font-family: '${family}';\n  src:\n    ${src};\n  font-weight: 400;\n  font-style: normal;\n  font-display: swap;${rangeLine}\n}`,
    );
  };

  if (bodyChunks && bodyChunks.length > 0) {
    for (const chunk of bodyChunks) {
      appendFace('PlanetBody', [{url: chunk.url, format: chunk.format}], chunk.unicodeRange);
      if (chunk.preload) {
        preloadFonts.push({url: chunk.url, format: chunk.format});
      }
    }
  } else {
    appendFace('PlanetBody', bodyFonts);
    if (bodyFonts[0]) {
      preloadFonts.push(bodyFonts[0]);
    }
  }

  appendFace('PlanetDisplay', displayFonts);
  appendFace('PlanetMono', monoFonts);
  return {css: blocks.join('\n\n') + '\n', preloadFonts};
}

export default defineConfig(() => {
  return {
    base: './',
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: false,
        injectRegister: false,
        includeAssets: [
          'apple-touch-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
          'manifest.json',
        ],
        workbox: {
          globPatterns: ['**/*.{js,css,html,woff2}'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              urlPattern: /\/assets\/.*\.(?:png|jpg|jpeg|svg|webp)$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'planet-assets-cache',
                expiration: {
                  maxEntries: 120,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
      // Auto-generates /fonts/custom-fonts.css and inlines @font-face + preload into index.html in both dev and build.
      {
        name: 'auto-custom-fonts',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            const reqPath = (req.url || '').split('?')[0];
            if (reqPath.endsWith('/fonts/custom-fonts.css')) {
              const {css} = buildCustomFontsCss(path.resolve(__dirname, 'public/fonts'), '.');
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
            const fontsRoot = path.resolve(__dirname, 'public/fonts');
            const prefix = ctx.server ? '/fonts' : './fonts';
            const {css, preloadFonts} = buildCustomFontsCss(fontsRoot, prefix);
            const tags: {tag: string; attrs?: Record<string, string | boolean>; children?: string; injectTo: 'head' | 'head-prepend'}[] = [];
            const mimeMap: Record<string, string> = {
              woff2: 'font/woff2',
              woff: 'font/woff',
              truetype: 'font/ttf',
              opentype: 'font/otf',
            };
            for (const pf of preloadFonts) {
              tags.push({
                tag: 'link',
                attrs: {
                  rel: 'preload',
                  as: 'font',
                  href: pf.url,
                  type: mimeMap[pf.format] || 'font/woff2',
                  crossorigin: 'anonymous',
                },
                injectTo: 'head-prepend',
              });
            }
            tags.push({
              tag: 'style',
              attrs: {id: 'planet-custom-fonts'},
              children: css,
              injectTo: 'head-prepend',
            });
            return tags;
          },
        },
        closeBundle(error?: Error): void {
          if (error) return;
          const distFontsDir = path.resolve(__dirname, 'dist/fonts');
          fs.mkdirSync(distFontsDir, {recursive: true});
          const {css} = buildCustomFontsCss(path.resolve(__dirname, 'public/fonts'), '.');
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
