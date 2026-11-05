import { defineConfig } from 'astro/config';

// Static PWA: every surah is a page, the DB/app shell is pre-cached by the service worker.
export default defineConfig({
  site: 'https://surah-tafsir.pages.dev',
  build: { format: 'directory', assets: 'assets' }, // not _astro: Android's packager drops folders starting with _
});
