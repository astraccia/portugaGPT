import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: './',
  server: {
    port: 3000,
    open: true
  },
  optimizeDeps: {
    include: ['three']
  },
  plugins: [
    {
      name: 'rewrite-css-public-urls',
      generateBundle(_, bundle) {
        for (const file of Object.values(bundle)) {
          if (file.type === 'asset' && file.fileName?.endsWith('.css') && typeof file.source === 'string') {
            file.source = file.source
              .replace(/url\(['"]?\/(fonts\/[^'")]+)['"]?\)/g, "url('../$1')")
              .replace(/url\(['"]?\/(images\/[^'")]+)['"]?\)/g, "url('../$1')");
          }
        }
      }
    }
  ]
});
