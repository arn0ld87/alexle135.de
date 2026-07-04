import { defineConfig } from 'astro/config';
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';
import rehypeTaskListLabels from './src/lib/rehypeTaskListLabels.mjs';
import { getSecurityHeaders } from './src/lib/security-headers.ts';

// --- Security headers (CSP / COEP / COOP) ---------------------------------
// Werte kommen aus src/lib/security-headers.ts (Single Source of Truth).
// Produktion spiegelt diese Werte zusätzlich in docker-compose.prod.yml
// (Traefik) — bei Änderungen alle drei synchron halten.
// getSecurityHeaders/isWebContainerRoute parsen die rohe _req.url selbst.

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
  site: 'https://alexle135.de',
  integrations: [
    mdx(),
    sitemap({
      // Exclude:
      //   /admin, /api         — protected/internal
      //   /design-system       — developer preview
      //   /kontakt/danke       — post-submit thank-you page
      //   /status              — ops status, thin content
      //   /blog/terminal-demo  — interne Demo, kein Produktiv-Content
      //   /projekte/(windows-)terminal-missionen/app — WebContainer-Entrypoints, kein Index-Content
      //   duplicate utility/app surfaces, handled via stronger parent page
      filter: (page) => {
        const blocked =
          /^\/(admin|api|design-system|kontakt\/danke|status)(\/|$)|^\/apps\/compose-builder\/?$|^\/projekte\/(windows-terminal-missionen|terminal-missionen)\/app\/?$|^\/blog\/terminal-demo\/?$/;
        return !blocked.test(new URL(page).pathname);
      },
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
      theme: 'github-dark',
      wrap: true,
    },
    rehypePlugins: [rehypeTaskListLabels],
  },

  output: 'server',

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
