<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';

  interface Kolekcija {
    ukupnoOtkljucano: number;
    ukupnoDostupno: number;
    kolekcionarskaRazina: { naziv: string; sljedeciNaziv: string | null; sljedeciPrag: number | null; doSljedece: number | null };
    kategorije: { vrsta: string; otkljucano: number; ukupno: number }[];
  }

  interface Props { igracId?: string; igracNaziv?: string; javni?: boolean; }
  let { igracId = '', igracNaziv = '', javni = false }: Props = $props();
  let kolekcija = $state<Kolekcija | null>(null);
  let kategorija = $state<string | null>(null);
  let rijeci = $state<string[]>([]);
  let cursor = $state<string | null>(null);
  let prethodniCursori = $state<string[]>([]);
  let imaJos = $state(false);
  let ucitavanje = $state(false);
  let greska = $state<string | null>(null);

  const nazivi: Record<string, string> = {
    imenica: 'Imenice', glagol: 'Glagoli', pridjev_prilog: 'Pridjevi i prilozi',
    vlastita_imena: 'Vlastita imena', zamjenica: 'Zamjenice', broj: 'Brojevi',
    prijedlog: 'Prijedlozi', veznik: 'Veznici', cestica: 'Čestice', uzvik: 'Usklici',
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

  async function ucitaj() {
    try { kolekcija = await api<Kolekcija>(putanja); }
    catch (e) { greska = e instanceof Error ? e.message : 'Kolekciju nije moguće učitati.'; }
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

<section class="kolekcija" aria-labelledby="kolekcija-naslov">
  <h2 id="kolekcija-naslov">Kolekcija riječi</h2>
  {#if greska}
    <p class="greska" role="alert">{greska}</p>
  {:else if kolekcija}
    <div class="razina">
      <div class="razina-sazetak">
        <div class="razina-sljedeca">
          <span>Trenutna razina</span>
          <strong>{kolekcija.kolekcionarskaRazina.naziv}</strong>
        </div>
        <div class="ukupno-otkljucano">
          <span>Ukupno otključanih riječi</span>
          <b>{kolekcija.ukupnoOtkljucano} / {kolekcija.ukupnoDostupno}</b>
        </div>
      </div>
      {#if kolekcija.kolekcionarskaRazina.sljedeciPrag !== null}
        <div class="napredak-kolekcije">
          <small>
            Nakon dodavanja {kolekcija.kolekcionarskaRazina.doSljedece} riječi u kolekciju, otključat ćeš kolekcijsku razinu {kolekcija.kolekcionarskaRazina.sljedeciNaziv}.
          </small>
          <span class="brojac-napretka">{kolekcija.ukupnoOtkljucano} / {kolekcija.kolekcionarskaRazina.sljedeciPrag} riječi</span>
          <div class="traka-kolekcije" aria-label={`${kolekcija.ukupnoOtkljucano} od ${kolekcija.kolekcionarskaRazina.sljedeciPrag} riječi`}>
            <span style={`width: ${Math.min(100, kolekcija.ukupnoOtkljucano / kolekcija.kolekcionarskaRazina.sljedeciPrag * 100)}%`}></span>
          </div>
        </div>
      {:else}
        <small>Najviša razina dosegnuta</small>
      {/if}
    </div>

    <div class="kategorije">
      {#each kolekcija.kategorije as stavka}
        <button type="button" onclick={() => otvoriKategoriju(stavka.vrsta)}>
          <span>{nazivi[stavka.vrsta] ?? stavka.vrsta}</span>
          <strong>{stavka.otkljucano} / {stavka.ukupno}</strong>
          <span class="tercijarni-gumb">Vidi kolekciju</span>
        </button>
      {/each}
    </div>
  {:else}
    <p>Učitavanje kolekcije...</p>
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
  .kolekcija { margin-top: 20px; }
  .kolekcija h2 { margin-bottom: 6px; }
  .razina { display: grid; gap: 12px; margin: 18px 0; padding: 18px; border: 1px solid #e5ddc8; border-radius: 8px; background: #fffdf5; }
  .razina-sazetak { display: flex; align-items: end; justify-content: space-between; gap: 20px; }
  .razina-sljedeca, .ukupno-otkljucano { display: grid; gap: 5px; }
  .razina strong { font-family: var(--font-naslov); font-size: 1.6rem; color: var(--boja-pozadina-primarna); }
  .razina b { font-size: 1.2rem; }
  .razina small { color: var(--boja-tekst-sekundarni); }
  .napredak-kolekcije { display: grid; gap: 5px; }
  .brojac-napretka { color: var(--boja-tekst-sekundarni); font-size: .9rem; font-weight: 700; }
  .traka-kolekcije { width: 100%; height: 8px; overflow: hidden; border-radius: 999px; background: #e4eadf; }
  .traka-kolekcije span { display: block; height: 100%; border-radius: inherit; background: var(--boja-mint-tamni); transition: width .25s ease; }
  .kategorije { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-top: 18px; }
  .kategorije button { display: grid; gap: 5px; padding: 14px; border: 1px solid #e5ddc8; border-radius: 8px; background: white; text-align: left; cursor: pointer; font: inherit; }
  .kategorije strong { color: var(--boja-pozadina-primarna); }
  .tercijarni-gumb { width: fit-content; margin-top: 3px; color: var(--boja-pozadina-primarna); font-size: .82rem; font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }
  .kategorije button:hover .tercijarni-gumb, .kategorije button:focus-visible .tercijarni-gumb { color: var(--boja-mint-tamni); }
  .modal-pozadina { position: fixed; z-index: 30; inset: 0; display: grid; place-items: center; padding: 20px; background: rgb(0 0 0 / 35%); }
  .modal { position: relative; width: min(620px, 100%); max-height: min(680px, calc(100vh - 40px)); overflow: auto; padding: 24px; border: 0; border-radius: 10px; background: #fff; box-shadow: 0 18px 60px rgb(0 0 0 / 22%); }
  .zatvori { position: absolute; top: 12px; right: 14px; border: 0; background: transparent; font-size: 1.8rem; line-height: 1; cursor: pointer; }
  .modal h3 { margin: 0; padding-right: 36px; }
  .modal-opis { margin: 6px 0 18px; color: var(--boja-tekst-sekundarni); }
  .rijeci { display: flex; flex-wrap: wrap; gap: 8px; }
  .rijeci span { padding: 5px 9px; border-radius: 5px; background: #f2f2ec; }
  .paginacija { display: flex; align-items: center; justify-content: center; gap: 12px; margin-top: 22px; }
  .paginacija button { padding: 8px 12px; border: 1px solid #d5d5cc; border-radius: 6px; background: white; cursor: pointer; }
  .paginacija button:disabled { cursor: not-allowed; opacity: .45; }
  .greska { color: #a33d32; }
  @media (max-width: 520px) {
    .razina-sazetak { align-items: start; flex-direction: column; gap: 12px; }
  }
</style>
