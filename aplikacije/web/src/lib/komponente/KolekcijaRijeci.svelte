<script lang="ts">
  import { onMount } from 'svelte';
  import { BookOpen, CheckCircle2, ChevronRight } from 'lucide-svelte';
  import { api } from '$lib/api.js';

  interface Kolekcija {
    ukupnoOtkljucano: number;
    ukupnoDostupno: number;
    kolekcionarskaRazina: { naziv: string; sljedeciNaziv: string | null; sljedeciPrag: number | null; doSljedece: number | null };
    kategorije: { vrsta: string; otkljucano: number; ukupno: number }[];
  }

  interface NedavnaRijec {
    rijec: string;
    vrsta: string;
    otkljucano: string;
  }

  interface Props { igracId?: string; igracNaziv?: string; javni?: boolean; }
  let { igracId = '', igracNaziv = '', javni = false }: Props = $props();
  let kolekcija = $state<Kolekcija | null>(null);
  let nedavno = $state<NedavnaRijec[]>([]);
  let kategorija = $state<string | null>(null);
  let rijeci = $state<string[]>([]);
  let cursor = $state<string | null>(null);
  let prethodniCursori = $state<string[]>([]);
  let imaJos = $state(false);
  let ucitavanjeKolekcije = $state(true);
  let ucitavanje = $state(false);
  let greska = $state<string | null>(null);

  const nazivi: Record<string, string> = {
    imenica: 'Imenice', glagol: 'Glagoli', pridjev_prilog: 'Pridjevi i prilozi',
    vlastita_imena: 'Vlastita imena', zamjenica: 'Zamjenice', broj: 'Brojevi',
    prijedlog: 'Prijedlozi', veznik: 'Veznici', cestica: 'Čestice', uzvik: 'Usklici',
    pridjev: 'Pridjev', prilog: 'Prilog', vlastito_ime: 'Vlastito ime',
  };
  const naziviZaNaslov: Record<string, string> = {
    imenica: 'imenica', glagol: 'glagola', pridjev_prilog: 'pridjeva i priloga',
    vlastita_imena: 'vlastitih imena', zamjenica: 'zamjenica', broj: 'brojeva',
    prijedlog: 'prijedloga', veznik: 'veznika', cestica: 'čestica', uzvik: 'usklica',
  };

  function nemaOtkljucanih(kategorijaZaProvjeru: string): boolean {
    return kolekcija?.kategorije.find((stavka) => stavka.vrsta === kategorijaZaProvjeru)?.otkljucano === 0;
  }

  const putanja = $derived(javni ? `/profil/javni/${igracId}/kolekcija` : '/profil/kolekcija');
  const putanjaRijeci = $derived(javni ? `/profil/javni/${igracId}/kolekcija/rijeci` : '/profil/kolekcija/rijeci');
  const putanjaNedavno = $derived(javni ? `/profil/javni/${igracId}/kolekcija/nedavno` : '/profil/kolekcija/nedavno');

  async function ucitaj() {
    try {
      const [sazetak, nedavne] = await Promise.all([
        api<Kolekcija>(putanja),
        api<{ rijeci: NedavnaRijec[] }>(putanjaNedavno).catch(() => ({ rijeci: [] as NedavnaRijec[] })),
      ]);
      kolekcija = sazetak;
      nedavno = nedavne.rijeci ?? [];
    } catch (e) {
      greska = e instanceof Error ? e.message : 'Kolekciju nije moguće učitati.';
    } finally {
      ucitavanjeKolekcije = false;
    }
  }

  async function ucitajRijeci() {
    if (!kategorija) return;
    ucitavanje = true;
    const parametri = new URLSearchParams({ kategorija, limit: '20' });
    if (cursor) parametri.set('cursor', cursor);
    try {
      const odgovor = await api<{ rijeci: string[]; imaJos: boolean; sljedeciCursor: string | null }>(`${putanjaRijeci}?${parametri}`);
      rijeci = odgovor.rijeci;
      imaJos = odgovor.imaJos;
      cursor = odgovor.sljedeciCursor;
    } catch (e) { greska = e instanceof Error ? e.message : 'Riječi nije moguće učitati.'; }
    finally { ucitavanje = false; }
  }

  function otvoriKategoriju(nova: string) {
    kategorija = nova;
    cursor = null;
    prethodniCursori = [];
    void ucitajRijeci();
  }

  function zatvoriKategoriju() { kategorija = null; }

  function sljedecaStranica() {
    if (!cursor || !kategorija || ucitavanje) return;
    prethodniCursori = [...prethodniCursori, cursor];
    void ucitajRijeci();
  }

  function prethodnaStranica() {
    if (!kategorija || ucitavanje || prethodniCursori.length === 0) return;
    cursor = prethodniCursori.at(-2) ?? null;
    prethodniCursori = prethodniCursori.slice(0, -1);
    void ucitajRijeci();
  }

  onMount(() => { void ucitaj(); });
</script>

<section class="kolekcija" aria-label="Kolekcija riječi">
  {#if greska}
    <p class="greska" role="alert">{greska}</p>
  {:else if kolekcija}
    <div class="razina">
      <div class="razina-sazetak">
        <div class="razina-sljedeca">
          <span>Kolekcijska razina</span>
          <strong>{kolekcija.kolekcionarskaRazina.naziv}</strong>
        </div>
        <div class="ukupno-otkljucano">
          <b>{kolekcija.ukupnoOtkljucano.toLocaleString('hr-HR')} / {kolekcija.ukupnoDostupno.toLocaleString('hr-HR')} riječi</b>
          <span>Ukupno otključanih riječi</span>
        </div>
      </div>
      {#if kolekcija.kolekcionarskaRazina.sljedeciPrag !== null}
        <div class="napredak-kolekcije">
          <div class="napredak-zaglavlje">
            <small>Sljedeća razina: {kolekcija.kolekcionarskaRazina.sljedeciNaziv}</small>
            <span class="brojac-napretka">{kolekcija.ukupnoOtkljucano} / {kolekcija.kolekcionarskaRazina.sljedeciPrag}</span>
          </div>
          <div class="traka-kolekcije" aria-label={`${kolekcija.ukupnoOtkljucano} od ${kolekcija.kolekcionarskaRazina.sljedeciPrag} riječi`}>
            <span style={`width: ${Math.min(100, kolekcija.ukupnoOtkljucano / kolekcija.kolekcionarskaRazina.sljedeciPrag * 100)}%`}></span>
          </div>
          <small>Još {kolekcija.kolekcionarskaRazina.doSljedece} novih riječi do sljedeće razine.</small>
        </div>
      {:else}
        <small>Najviša razina dosegnuta</small>
      {/if}
    </div>

    <div class="kategorije-zaglavlje">
      <h3>{javni ? (igracNaziv ? `Zbirka — ${igracNaziv}` : 'Zbirka') : 'Tvoja zbirka'}</h3>
      <span>{kolekcija.kategorije.length} kategorija</span>
    </div>
    <div class="kategorije">
      {#each kolekcija.kategorije as stavka}
        <button type="button" onclick={() => otvoriKategoriju(stavka.vrsta)} aria-label={`${nazivi[stavka.vrsta] ?? stavka.vrsta}, ${stavka.otkljucano} od ${stavka.ukupno}`}>
          <span class="kat-glavno">
            <span>{nazivi[stavka.vrsta] ?? stavka.vrsta}</span>
            <strong>{stavka.otkljucano.toLocaleString('hr-HR')} / {stavka.ukupno.toLocaleString('hr-HR')}</strong>
          </span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      {/each}
    </div>

    <section class="nedavno" aria-labelledby="nedavno-naslov">
      <h3 id="nedavno-naslov">Nedavno otključano</h3>
      {#if nedavno.length === 0}
        <p class="prazno">Još nema otključanih riječi.</p>
      {:else}
        <ul>
          {#each nedavno as stavka}
            <li>
              <span class="ikona" aria-hidden="true"><BookOpen size={16} /></span>
              <span class="tekst">
                <strong>{stavka.rijec}</strong>
                <small>{nazivi[stavka.vrsta] ?? stavka.vrsta}</small>
              </span>
              <span class="ok" aria-hidden="true"><CheckCircle2 size={16} /></span>
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  {:else if ucitavanjeKolekcije}
    <div class="kolekcija-kostur" role="status" aria-label="Učitavanje kolekcije" aria-busy="true">
      <div class="kolekcija-kostur-sažetak">
        <div class="kolekcija-kostur-polje"></div>
        <div class="kolekcija-kostur-polje"></div>
      </div>
      <div class="kolekcija-kostur-kategorije">
        <div class="kolekcija-kostur-polje"></div><div class="kolekcija-kostur-polje"></div>
        <div class="kolekcija-kostur-polje"></div><div class="kolekcija-kostur-polje"></div>
      </div>
    </div>
  {:else}
    <p>Kolekciju nije moguće učitati.</p>
  {/if}
</section>

{#if kategorija}
  <div class="modal-pozadina" role="presentation" onclick={zatvoriKategoriju}>
    <dialog open class="modal" aria-labelledby="kolekcija-modal-naslov" onclick={(event) => event.stopPropagation()} onkeydown={(event) => event.key === 'Escape' && zatvoriKategoriju()}>
      <button type="button" class="zatvori" aria-label="Zatvori kolekciju" onclick={zatvoriKategoriju}>×</button>
      <h3 id="kolekcija-modal-naslov">Kolekcija {naziviZaNaslov[kategorija] ?? kategorija}</h3>
      {#if nemaOtkljucanih(kategorija)}
        <p class="modal-opis">U kolekciji igrača {igracNaziv} još nema otključanih {naziviZaNaslov[kategorija] ?? kategorija}.</p>
      {:else}
        <p class="modal-opis">{nazivi[kategorija] ?? kategorija} iz kolekcije igrača {igracNaziv}</p>
      {/if}
      {#if ucitavanje}<p>Učitavanje...</p>{:else}<div class="rijeci">{#each rijeci as rijec}<span>{rijec}</span>{/each}</div>{/if}
      {#if imaJos || prethodniCursori.length > 0}
        <nav class="paginacija" aria-label="Kolekcija riječi">
          <button type="button" disabled={prethodniCursori.length === 0 || ucitavanje} onclick={prethodnaStranica}>Prethodna</button>
          <span>Stranica {prethodniCursori.length + 1}</span>
          <button type="button" disabled={!imaJos || ucitavanje} onclick={sljedecaStranica}>Sljedeća</button>
        </nav>
      {/if}
    </dialog>
  </div>
{/if}

<style>
  .razina { display: grid; gap: 12px; margin: 0 0 18px; padding: 18px; border: 1px solid var(--boja-obrub); border-radius: 8px; background: var(--boja-povrsina-2); }
  .kolekcija-kostur { display: grid; gap: 12px; }
  .kolekcija-kostur-sažetak { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; min-height: 112px; margin: 18px 0; padding: 18px; border: 1px solid var(--boja-obrub); border-radius: 8px; background: var(--boja-povrsina-2); }
  .kolekcija-kostur-kategorije { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
  .kolekcija-kostur-polje { min-height: 92px; border: 1px solid var(--boja-obrub); border-radius: 8px; background: var(--boja-povrsina-2); }
  .razina-sazetak { display: flex; align-items: end; justify-content: space-between; gap: 20px; }
  .razina-sljedeca, .ukupno-otkljucano { display: grid; gap: 5px; }
  .razina strong { font-family: var(--font-naslov); font-size: 1.6rem; color: var(--boja-isticanje-tekst); }
  .razina b { font-size: 1.2rem; }
  .razina small { color: var(--boja-tekst-sekundarni); }
  .napredak-kolekcije { display: grid; gap: 5px; }
  .napredak-zaglavlje { display: flex; justify-content: space-between; gap: 12px; }
  .brojac-napretka { color: var(--boja-tekst-sekundarni); font-size: .9rem; font-weight: 700; }
  .traka-kolekcije { width: 100%; height: 8px; overflow: hidden; border-radius: 999px; background: var(--boja-obrub); }
  .traka-kolekcije span { display: block; height: 100%; border-radius: inherit; background: var(--boja-isticanje-slova); transition: width .25s ease; }
  .kategorije-zaglavlje { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-top: 8px; }
  .kategorije-zaglavlje h3 { margin: 0; font-family: var(--font-naslov); font-size: 1.2rem; }
  .kategorije-zaglavlje span { color: var(--boja-tekst-sekundarni); font-size: var(--tekst-sitni); }
  .kategorije { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 12px; }
  .kategorije button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 14px;
    border: 1px solid var(--boja-obrub);
    border-radius: 8px;
    background: var(--boja-povrsina);
    color: var(--boja-tekst-osnovni);
    text-align: left;
    cursor: pointer;
    font: inherit;
  }
  .kat-glavno { display: grid; gap: 5px; min-width: 0; }
  .kategorije strong { color: var(--boja-isticanje-tekst); }
  .nedavno { margin-top: 22px; display: grid; gap: 10px; }
  .nedavno h3 { margin: 0; font-family: var(--font-naslov); font-size: 1.2rem; }
  .nedavno ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 8px; }
  .nedavno li {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border: 1px solid var(--boja-obrub);
    border-radius: 8px;
    background: var(--boja-povrsina-2);
  }
  .nedavno .ikona, .nedavno .ok { color: var(--boja-isticanje-tekst); display: inline-flex; }
  .nedavno .tekst { display: grid; gap: 2px; min-width: 0; }
  .nedavno small { color: var(--boja-tekst-sekundarni); }
  .prazno { margin: 0; color: var(--boja-tekst-sekundarni); }
  .modal-pozadina { position: fixed; z-index: 30; inset: 0; display: grid; place-items: center; padding: 20px; background: var(--boja-zastor); }
  .modal { position: relative; width: min(620px, 100%); max-height: min(680px, calc(100vh - 40px)); overflow: auto; padding: 24px; border: 0; border-radius: 10px; background: var(--boja-povrsina); box-shadow: var(--sjena-modal); }
  .zatvori { position: absolute; top: 12px; right: 14px; border: 0; background: transparent; color: var(--boja-tekst-osnovni); font-size: 1.8rem; line-height: 1; cursor: pointer; }
  .modal h3 { margin: 0; padding-right: 36px; }
  .modal-opis { margin: 6px 0 18px; color: var(--boja-tekst-sekundarni); }
  .rijeci { display: flex; flex-wrap: wrap; gap: 8px; }
  .rijeci span { padding: 5px 9px; border-radius: 5px; background: var(--boja-povrsina-3); }
  .paginacija { display: flex; align-items: center; justify-content: center; gap: 12px; margin-top: 22px; }
  .paginacija button { padding: 8px 12px; border: 1px solid var(--boja-obrub-jaci); border-radius: 6px; background: var(--boja-povrsina); color: var(--boja-tekst-osnovni); cursor: pointer; }
  .paginacija button:disabled { cursor: not-allowed; opacity: .45; }
  .greska { color: var(--boja-poraz-tekst); }
  @media (max-width: 999px) {
    .razina-sazetak { align-items: start; flex-direction: column; gap: 12px; }
    .kolekcija-kostur-sažetak { grid-template-columns: 1fr; }
  }
  @media (max-width: 520px) {
    .kategorije { grid-template-columns: 1fr; }
  }
</style>
