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
  covjek_na_misiji: '/ikone/68-covjek-na-misiji.webp',
  privatnik: '/ikone/69-privatnik.webp',
  tjedan_pod_kontrolom: '/ikone/70-tjedan-pod-kontrolom.webp',
  dvostruka_kruna: '/ikone/71-dvostruka-kruna.webp',
  cista_petica: '/ikone/72-cista-petica.webp',
  sve_pohvale: '/ikone/73-sve-pohvale.webp',
  rijetka_grdosija: '/ikone/74-rijetka-grdosija.webp',
  dnevna_desetka: '/ikone/75-dnevna-desetka.webp',
  tjedna_elita: '/ikone/76-tjedna-elita.webp',
  mjesecna_elita: '/ikone/77-mjesecna-elita.webp',
  na_dvije_fronte: '/ikone/78-na-dvije-fronte.webp',
  jezicni_detektiv: '/ikone/79-jezicni-detektiv.webp',
  cinkaros: '/ikone/80-cinkaros.webp',
};

export function ikonaDostignuca(id: string): string {
  return IKONE_DOSTIGNUCA[id] ?? '/ikone/06-trofej.png';
}