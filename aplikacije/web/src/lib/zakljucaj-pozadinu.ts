/** Ref-count scroll lock za mobilni fokus način (#158). */

let brojac = 0;
let spremljeniScrollY = 0;

const KLASA = 'mobilni-fokus-pozadina';

export function zakljucajPozadinu(): void {
  if (typeof document === 'undefined') return;
  if (brojac === 0) {
    spremljeniScrollY = window.scrollY;
    document.documentElement.classList.add(KLASA);
    document.body.classList.add(KLASA);
    document.body.style.top = `-${spremljeniScrollY}px`;
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
  }
  brojac += 1;
}

export function otkljucajPozadinu(): void {
  if (typeof document === 'undefined' || brojac === 0) return;
  brojac -= 1;
  if (brojac > 0) return;
  document.documentElement.classList.remove(KLASA);
  document.body.classList.remove(KLASA);
  document.body.style.removeProperty('top');
  document.body.style.removeProperty('position');
  document.body.style.removeProperty('width');
  window.scrollTo(0, spremljeniScrollY);
}

/** Samo za testove. */
export function resetirajZakljucajPozadinuZaTest(): void {
  brojac = 0;
  spremljeniScrollY = 0;
  if (typeof document === 'undefined') return;
  document.documentElement.classList.remove(KLASA);
  document.body.classList.remove(KLASA);
  document.body.style.removeProperty('top');
  document.body.style.removeProperty('position');
  document.body.style.removeProperty('width');
}
