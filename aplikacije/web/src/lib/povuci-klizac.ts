/** Mišem povlači horizontalni overflow (dodir ostaje na native scrollu). */
export function povuciScroll(element: HTMLElement) {
  let aktivanId: number | null = null;
  let pocetniX = 0;
  let pocetniScroll = 0;
  let pomaknuto = false;

  const zavrsi = (dogadaj: PointerEvent) => {
    if (aktivanId !== dogadaj.pointerId) return;
    aktivanId = null;
    element.classList.remove('povlace');
    if (element.hasPointerCapture(dogadaj.pointerId)) element.releasePointerCapture(dogadaj.pointerId);
    const sirina = element.clientWidth;
    if (sirina > 0) {
      const cilj = Math.round(element.scrollLeft / sirina) * sirina;
      element.scrollTo({
        left: cilj,
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      });
    }
  };

  const naPritisak = (dogadaj: PointerEvent) => {
    if (dogadaj.pointerType !== 'mouse' || dogadaj.button !== 0) return;
    if ((dogadaj.target as Element | null)?.closest?.('button, a, input, textarea, select, [role="button"]')) return;
    aktivanId = dogadaj.pointerId;
    pocetniX = dogadaj.clientX;
    pocetniScroll = element.scrollLeft;
    pomaknuto = false;
    element.classList.add('povlace');
    element.setPointerCapture(dogadaj.pointerId);
  };

  const naPomak = (dogadaj: PointerEvent) => {
    if (aktivanId !== dogadaj.pointerId) return;
    const dx = dogadaj.clientX - pocetniX;
    if (Math.abs(dx) > 3) pomaknuto = true;
    element.scrollLeft = pocetniScroll - dx;
  };

  const naKlik = (dogadaj: MouseEvent) => {
    if (!pomaknuto) return;
    dogadaj.preventDefault();
    dogadaj.stopPropagation();
    pomaknuto = false;
  };

  element.addEventListener('pointerdown', naPritisak);
  element.addEventListener('pointermove', naPomak);
  element.addEventListener('pointerup', zavrsi);
  element.addEventListener('pointercancel', zavrsi);
  element.addEventListener('click', naKlik, true);

  return {
    destroy() {
      element.classList.remove('povlace');
      element.removeEventListener('pointerdown', naPritisak);
      element.removeEventListener('pointermove', naPomak);
      element.removeEventListener('pointerup', zavrsi);
      element.removeEventListener('pointercancel', zavrsi);
      element.removeEventListener('click', naKlik, true);
    },
  };
}

export type OpcijeListanja = {
  prethodni: () => void;
  sljedeci: () => void;
  prag?: number;
};

/** Horizontalni swipe/drag (prst i miš) za listanje stavki bez native scrolla. */
export function povuciListanje(element: HTMLElement, opcije: OpcijeListanja) {
  let trenutne = opcije;
  let pracenje = false;
  let pocetniX = 0;
  let pocetniY = 0;
  let aktivanId: number | null = null;

  const naPritisak = (dogadaj: PointerEvent) => {
    if (dogadaj.pointerType === 'mouse' && dogadaj.button !== 0) return;
    if ((dogadaj.target as Element | null)?.closest?.('button, a, input, textarea, select, [role="button"]')) return;
    pracenje = true;
    aktivanId = dogadaj.pointerId;
    pocetniX = dogadaj.clientX;
    pocetniY = dogadaj.clientY;
  };

  const zavrsi = (dogadaj: PointerEvent) => {
    if (!pracenje || aktivanId !== dogadaj.pointerId) return;
    pracenje = false;
    aktivanId = null;
    const dx = dogadaj.clientX - pocetniX;
    const dy = dogadaj.clientY - pocetniY;
    const prag = trenutne.prag ?? 48;
    if (Math.abs(dx) < prag || Math.abs(dx) <= Math.abs(dy)) return;
    if (dx > 0) trenutne.prethodni();
    else trenutne.sljedeci();
  };

  const otkazi = (dogadaj: PointerEvent) => {
    if (aktivanId !== dogadaj.pointerId) return;
    pracenje = false;
    aktivanId = null;
  };

  element.addEventListener('pointerdown', naPritisak);
  element.addEventListener('pointerup', zavrsi);
  element.addEventListener('pointercancel', otkazi);

  return {
    update(nove: OpcijeListanja) {
      trenutne = nove;
    },
    destroy() {
      element.removeEventListener('pointerdown', naPritisak);
      element.removeEventListener('pointerup', zavrsi);
      element.removeEventListener('pointercancel', otkazi);
    },
  };
}
