/**
 * Entry za esbuild IIFE → static/umami-before-send.js
 */
import { IME_UMAMI_BEFORE_SEND, umamiBeforeSend } from './umami-sanitizacija.js';

declare global {
  interface Window {
    [IME_UMAMI_BEFORE_SEND]?: typeof umamiBeforeSend;
  }
}

(window as unknown as Record<string, unknown>)[IME_UMAMI_BEFORE_SEND] = umamiBeforeSend;
