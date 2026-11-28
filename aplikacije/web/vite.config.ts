import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin } from 'vite';
import { generirajUmamiBeforeSend } from './skripte/generiraj-umami-before-send.mjs';

function umamiBeforeSendPlugin(): Plugin {
  let generiranje: Promise<string> | null = null;

  const osiguraj = () => {
    if (!generiranje) {
      generiranje = generirajUmamiBeforeSend().finally(() => {
        // dopusti ponovni build nakon promjene datoteka
        setTimeout(() => {
          generiranje = null;
        }, 0);
      });
    }
    return generiranje;
  };

  return {
    name: 'kaladont-umami-before-send',
    async buildStart() {
      await osiguraj();
    },
    async configureServer() {
      await osiguraj();
    },
  };
}

export default defineConfig({
  plugins: [umamiBeforeSendPlugin(), sveltekit()],
});
