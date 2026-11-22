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

function buildCustomFontsCss(fontsRoot: string): string {
  const rootFiles = scanFontFiles(fontsRoot, '.');
  const namedBody = rootFiles.filter((f) => /^\.\/body\./i.test(decodeURIComponent(f.url)));
  const namedDisplay = rootFiles.filter((f) => /^\.\/display\./i.test(decodeURIComponent(f.url)));
  const namedMono = rootFiles.filter((f) => /^\.\/mono\./i.test(decodeURIComponent(f.url)));
  const fallbackRootBody = rootFiles.filter(
    (f) => !/^\.\/(display|mono)\./i.test(decodeURIComponent(f.url)),
  );

  const bodyFonts = [
    ...scanFontFiles(path.join(fontsRoot, 'body'), './body'),
    ...(namedBody.length > 0 ? namedBody : fallbackRootBody),
  ];
  const displayFonts = [
    ...scanFontFiles(path.join(fontsRoot, 'display'), './display'),
    ...namedDisplay,
  ];
  const monoFonts = [
    ...scanFontFiles(path.join(fontsRoot, 'mono'), './mono'),
    ...namedMono,
  ];

  const blocks: string[] = ['/* Auto-generated from /public/fonts */'];
  const appendFace = (family: string, files: {url: string; format: string}[]) => {
    if (files.length === 0) return;
    const src = files.map((f) => `url('${f.url}') format('${f.format}')`).join(',\n    ');
    blocks.push(
      `@font-face {\n  font-family: '${family}';\n  src:\n    ${src};\n  font-weight: 100 900;\n  font-style: normal;\n  font-display: swap;\n}`,
    );
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
      // Auto-generates /fonts/custom-fonts.css from any uploaded fonts in /public/fonts.
      {
        name: 'auto-custom-fonts',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            const reqPath = (req.url || '').split('?')[0];
            if (reqPath.endsWith('/fonts/custom-fonts.css')) {
              const css = buildCustomFontsCss(path.resolve(__dirname, 'public/fonts'));
              res.statusCode = 200;
              res.setHeader('Content-Type', 'text/css; charset=utf-8');
              res.setHeader('Cache-Control', 'no-store');
              res.end(css);
              return;
            }
            next();
          });
        },
        closeBundle(error?: Error): void {
          if (error) return;
          const distFontsDir = path.resolve(__dirname, 'dist/fonts');
          fs.mkdirSync(distFontsDir, {recursive: true});
          const css = buildCustomFontsCss(path.resolve(__dirname, 'public/fonts'));
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
