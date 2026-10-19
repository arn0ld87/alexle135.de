import { defineConfig } from 'astro/config';
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import node from '@astrojs/node';
import { unified } from '@astrojs/markdown-remark';
import tailwindcss from '@tailwindcss/vite';
import rehypeTaskListLabels from './src/lib/rehypeTaskListLabels.mjs';
import { getSecurityHeaders } from './src/lib/security-headers.ts';
import { sitemapFilter } from './src/lib/sitemapFilter.ts';

// --- Security headers (CSP) -------------------------------------------------
// Werte kommen aus src/lib/security-headers.ts (Single Source of Truth).
// Produktion spiegelt diese Werte zusätzlich in docker-compose.prod.yml
// (Traefik) — bei Änderungen alle drei synchron halten.
// getSecurityHeaders/isMissionRoute parsen die rohe _req.url selbst.

// Build a pathname → ISO-lastmod lookup from content-collection frontmatter.
// Used by the sitemap serializer so <lastmod> reflects content freshness
// (updatedAt if set, otherwise publishedAt).
function buildLastmodMap() {
  const map = new Map();
  const collections = [
    { dir: 'src/content/blog', routePrefix: 'blog' },
    { dir: 'src/content/projects', routePrefix: 'projekte' },
  ];
  for (const { dir, routePrefix } of collections) {
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.md') && !file.endsWith('.mdx')) continue;
      const slug = file.replace(/\.(md|mdx)$/, '');
      try {
        const fm = matter.read(path.join(dir, file));
        const raw = fm.data.updatedAt ?? fm.data.publishedAt;
        if (raw) {
          map.set(`/${routePrefix}/${slug}/`, new Date(raw).toISOString());
        }
      } catch {
        // skip malformed frontmatter
      }
    }
  }
  return map;
}

const lastmodMap = buildLastmodMap();

// https://astro.build/config
// Force reload for React components
export default defineConfig({
  site: 'https://alex-schneider.dev',
  integrations: [
    mdx(),
    sitemap({
      // Ausschlussregel (inkl. Begründungen) und Regressionstest:
      // src/lib/sitemapFilter.ts, src/lib/__tests__/sitemapFilter.test.ts
      filter: sitemapFilter,
      serialize: (item) => {
        try {
          const { pathname } = new URL(item.url);
          const lastmod = lastmodMap.get(pathname);
          if (lastmod) item.lastmod = lastmod;
        } catch {
          // keep item untouched on parse failure
        }
        return item;
      },
    }),
    react(),
  ],

  markdown: {
    shikiConfig: {
      theme: 'css-variables',
      wrap: true,
    },
    processor: unified({ rehypePlugins: [rehypeTaskListLabels] }),
  },

  output: 'server',
  // Astro 7 komprimiert standardmäßig mit JSX-Semantik und entfernt Whitespace zwischen
  // Inline-Elementen. `true` behält das Astro-6-Verhalten, auf das die Templates gebaut sind.
  compressHTML: true,

  build: {
    assets: '_astro',
    inlineStylesheets: 'auto',
  },

  vite: {
    noExternal: [
      'react-markdown',
      'remark-gfm',
      'vfile',
      'vfile-message',
      'unified',
      'bail',
      'is-plain-obj',
      'trough',
      'remark-parse',
      'remark-rehype',
      'mdast-util-to-hast',
      'micromark',
      'unist-util-stringify-position',
      'micromark-util-combine-extensions',
      'micromark-util-chunked',
      'micromark-util-character',
      'micromark-util-sanitize-uri',
      'micromark-util-encode',
      'micromark-util-classify-character',
      'micromark-util-resolve-all',
      'micromark-util-subtokenize',
    ],
    define: {
      // Removed GEMINI_API_KEY define to prevent client-side exposure
      // Build-Datum für die Betriebszeile im Footer (JJJJ-MM-TT, UTC). Die Konfiguration
      // läuft zur Build-Zeit, das Datum ist also das des Builds und nicht das des Requests.
      'import.meta.env.PUBLIC_BUILD_DATE': JSON.stringify(new Date().toISOString().slice(0, 10)),
    },
    plugins: [
      tailwindcss(),
      {
        name: 'configure-response-headers',
        configureServer: (server) => {
          server.middlewares.use((_req, res, next) => {
            const headers = getSecurityHeaders(_req.url || '', 'dev');
            for (const [name, value] of Object.entries(headers)) {
              res.setHeader(name, value);
            }
            next();
          });
        },
      },
    ],
    build: {
      cssCodeSplit: true,
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
      },
    },
  },

  adapter: node({
    mode: 'standalone',
  }),
});
