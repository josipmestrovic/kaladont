export const MINIMALNA_DULJINA_NADIMKA = 3;
export const MAKSIMALNA_DULJINA_NADIMKA = 12;
export const UZORAK_NADIMKA = /^[A-Za-zČĆĐŠŽčćđšž0-9_-]+$/u;
export const PORUKA_NEVALJANOG_NADIMKA = 'Nadimak mora imati 3–12 znakova i smije sadržavati samo slova, brojeve, - ili _.';

export function jeValjanNadimak(nadimak: string): boolean {
  return nadimak.length >= MINIMALNA_DULJINA_NADIMKA
    && nadimak.length <= MAKSIMALNA_DULJINA_NADIMKA
    && UZORAK_NADIMKA.test(nadimak);
}
