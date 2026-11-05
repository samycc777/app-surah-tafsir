import { defineConfig } from 'astro/config';

// Static PWA: every surah is a page, the DB/app shell is pre-cached by the service worker.
export default defineConfig({
  site: 'https://surah-tafsir.pages.dev',
  build: { format: 'directory' },
});
