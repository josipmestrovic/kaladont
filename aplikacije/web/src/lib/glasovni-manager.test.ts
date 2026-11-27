import { afterEach, describe, expect, it, vi } from 'vitest';
import { get as getStore } from 'svelte/store';
import {
  __resetirajGlasZaTestove,
  glasUkljucen,
  govornoOkruzenje,
  inicijalizirajGlas,
  izgovoriRijec,
  osigurajGovornoOkruzenje,
  postaviGlas,
} from './glasovni-manager.js';

afterEach(() => {
  __resetirajGlasZaTestove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function stubSpeech() {
  const getVoices = vi.fn(() => [{ lang: 'hr-HR' }]);
  const speak = vi.fn();
  const cancel = vi.fn();
  const addEventListener = vi.fn();
  const localStorage = {
    getItem: vi.fn((): string | null => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  };
  class SpeechSynthesisUtterance {
    lang = '';
    rate = 1;
    voice: unknown = null;
    constructor(public text: string) {}
  }
  vi.stubGlobal('window', {
    speechSynthesis: { getVoices, speak, cancel, addEventListener },
    SpeechSynthesisUtterance,
    localStorage,
    navigator: { userAgent: 'Windows', platform: 'Win32', languages: ['hr-HR'], language: 'hr-HR' },
  });
  vi.stubGlobal('SpeechSynthesisUtterance', SpeechSynthesisUtterance);
  return { getVoices, speak, cancel, addEventListener, localStorage };
}

describe('glasovni-manager', () => {
  it('osigurajGovornoOkruzenje ne ponavlja osvježavanje kad je već provjereno', () => {
    const { getVoices } = stubSpeech();
    osigurajGovornoOkruzenje();
    expect(getVoices).toHaveBeenCalledTimes(1);
    expect(getStore(govornoOkruzenje).provjereno).toBe(true);
    osigurajGovornoOkruzenje();
    expect(getVoices).toHaveBeenCalledTimes(1);
  });

  it('izgovoriRijec ne mijenja store probe pri svakoj riječi', () => {
    const { speak } = stubSpeech();
    postaviGlas(true);
    expect(getStore(govornoOkruzenje).provjereno).toBe(true);

    let storePromjene = 0;
    const odjava = govornoOkruzenje.subscribe(() => {
      storePromjene += 1;
    });
    const bazno = storePromjene;

    izgovoriRijec('kaladont');
    izgovoriRijec('igra');
    izgovoriRijec('riječ');

    odjava();
    expect(speak).toHaveBeenCalledTimes(3);
    expect(storePromjene).toBe(bazno);
  });

  it('inicijalizirajGlas čita localStorage bez probea kad je glas isključen', () => {
    const { getVoices, localStorage } = stubSpeech();
    localStorage.getItem.mockReturnValue('false');
    inicijalizirajGlas();
    expect(getStore(glasUkljucen)).toBe(false);
    expect(getVoices).not.toHaveBeenCalled();
  });
});
