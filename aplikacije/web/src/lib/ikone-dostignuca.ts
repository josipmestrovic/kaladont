export const IKONE_DOSTIGNUCA: Readonly<Record<string, string>> = {
  iskusnjara: '/ikone/39-iskusnjara.png',
  rijetkolovac: '/ikone/40-rijetkolovac.png',
  dugometras: '/ikone/41-dugometras.png',
  jezik_u_plamenu: '/ikone/42-jezik-u-plamenu.png',
  vladar_niza: '/ikone/65-vladar-niza.webp',
  xp_prvak: '/ikone/66-xp-prvak.webp',
  kaladont: '/ikone/43-kaladont.png',
  ka_zna: '/ikone/44-ka-zna.png',
  lovac_na_glave: '/ikone/45-lovac-na-glave.png',
  slijepa_ulica: '/ikone/46-slijepa-ulica.png',
  zavrsna_rijec: '/ikone/47-zavrsna-rijec.png',
  glas_zajednice: '/ikone/48-glas-zajednice.png',
  zagrijan: '/ikone/64-zagrijan.webp',
  stalno_si_tu: '/ikone/63-stalno-si-tu.webp',
  covjek_na_misiji: '/ikone/62-misije.webp',
  tjedan_pod_kontrolom: '/ikone/62-misije.webp',
  privatnik: '/ikone/06-trofej.png',
  dvostruka_kruna: '/ikone/47-zavrsna-rijec.png',
  cista_petica: '/ikone/42-jezik-u-plamenu.png',
  sve_pohvale: '/ikone/65-vladar-niza.webp',
  rijetka_grdosija: '/ikone/40-rijetkolovac.png',
  dnevna_desetka: '/ikone/09-ljestvice.png',
  tjedna_elita: '/ikone/09-ljestvice.png',
  mjesecna_elita: '/ikone/09-ljestvice.png',
  na_dvije_fronte: '/ikone/06-trofej.png',
  jezicni_detektiv: '/ikone/48-glas-zajednice.png',
  cinkaros: '/ikone/45-lovac-na-glave.png',
};

export function ikonaDostignuca(id: string): string {
  return IKONE_DOSTIGNUCA[id] ?? '/ikone/06-trofej.png';
}