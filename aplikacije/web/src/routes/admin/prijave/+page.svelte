<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';
  import { pokaziUspjeh } from '$lib/uspjeh-obavijest.svelte.js';

  interface Prijava {
    id: number;
    tip: 'za_brisanje' | 'za_dodavanje';
    rijec: string;
    status: 'nova' | 'pregledana' | 'rijesena';
    vrijeme: string;
    partijaId: string;
  }

  interface PrijavaIgraca {
    id: number;
    partijaId: string;
    prijavljeniIgracId: string;
    nadimak: string;
    razlog: string;
    status: 'nova' | 'pregledana' | 'rijesena';
    vrijeme: string;
  }

  type AkcijaTip = 'obrisi' | 'dodaj' | 'dismiss' | 'obrisi-racun' | 'pusti';

  let prijave = $state<Prijava[]>([]);
  let prijaveIgraca = $state<PrijavaIgraca[]>([]);
  let greskaPristupa = $state<string | null>(null);
  let greskaAkcije = $state<string | null>(null);
  let akcijaUTijeku = $state<{ lista: 'rijeci' | 'igraci'; id: number; tip: AkcijaTip } | null>(null);

  const POLL_MS = 15_000;

  const prijaveZaBrisanje = $derived(prijave.filter((p) => p.tip === 'za_brisanje'));
  const prijaveZaDodavanje = $derived(prijave.filter((p) => p.tip === 'za_dodavanje'));

  function biloKojaAkcija(): boolean {
    return akcijaUTijeku !== null;
  }

  function oznakaGumba(lista: 'rijeci' | 'igraci', id: number, tip: AkcijaTip, mirna: string): string {
    if (akcijaUTijeku?.lista === lista && akcijaUTijeku.id === id && akcijaUTijeku.tip === tip) {
      return 'Radim…';
    }
    return mirna;
  }

  async function ucitaj() {
    try {
      const odgovori = await Promise.all([
        api<{ prijave: Prijava[] }>('/admin/prijave'),
        api<{ prijave: PrijavaIgraca[] }>('/admin/prijave-igraca'),
      ]);
      prijave = odgovori[0].prijave;
      prijaveIgraca = odgovori[1].prijave;
      greskaPristupa = null;
    } catch (e) {
      greskaPristupa = e instanceof Error ? e.message : 'Nemaš pristup admin stranici.';
    }
  }

  onMount(() => {
    void ucitaj();

    let interval: ReturnType<typeof setInterval> | null = null;

    function zaustaviPoll() {
      if (interval !== null) {
        clearInterval(interval);
        interval = null;
      }
    }

    function pokreniPoll() {
      zaustaviPoll();
      if (document.visibilityState !== 'visible') return;
      interval = setInterval(() => {
        if (document.visibilityState === 'visible' && akcijaUTijeku === null) {
          void ucitaj();
        }
      }, POLL_MS);
    }

    function naVidljivost() {
      if (document.visibilityState === 'visible') {
        void ucitaj();
        pokreniPoll();
      } else {
        zaustaviPoll();
      }
    }

    pokreniPoll();
    document.addEventListener('visibilitychange', naVidljivost);
    return () => {
      zaustaviPoll();
      document.removeEventListener('visibilitychange', naVidljivost);
    };
  });

  async function akcijaPrijaveRijeci(id: number, tip: AkcijaTip, putanja: string, uspjeh: string) {
    if (akcijaUTijeku !== null) return;
    const uklonjena = prijave.find((p) => p.id === id);
    if (!uklonjena) return;
    akcijaUTijeku = { lista: 'rijeci', id, tip };
    greskaAkcije = null;
    // Odmah makni red i pokaži uspjeh — ne čekaj sporiji backend.
    prijave = prijave.filter((p) => p.id !== id);
    pokaziUspjeh(uspjeh);
    try {
      await api(putanja, { method: 'POST', body: '{}' });
      void ucitaj();
    } catch (e) {
      prijave = [...prijave, uklonjena].sort((a, b) => b.id - a.id);
      greskaAkcije = e instanceof Error ? e.message : 'Akcija nije uspjela.';
    } finally {
      akcijaUTijeku = null;
    }
  }

  async function akcijaPrijaveIgraca(id: number, tip: AkcijaTip, putanja: string, uspjeh: string) {
    if (akcijaUTijeku !== null) return;
    const uklonjena = prijaveIgraca.find((p) => p.id === id);
    if (!uklonjena) return;
    akcijaUTijeku = { lista: 'igraci', id, tip };
    greskaAkcije = null;
    prijaveIgraca = prijaveIgraca.filter((p) => p.id !== id);
    pokaziUspjeh(uspjeh);
    try {
      await api(putanja, { method: 'POST', body: '{}' });
      void ucitaj();
    } catch (e) {
      prijaveIgraca = [...prijaveIgraca, uklonjena].sort((a, b) => b.id - a.id);
      greskaAkcije = e instanceof Error ? e.message : 'Akcija nije uspjela.';
    } finally {
      akcijaUTijeku = null;
    }
  }
</script>

<svelte:head>
  <title>Prijave | Admin | Kaladont</title>
</svelte:head>

<h1>Prijave</h1>

{#if greskaPristupa}
  <p class="greska" role="alert">{greskaPristupa}</p>
{:else}
  {#if greskaAkcije}
    <p class="greska" role="alert">{greskaAkcije}</p>
  {/if}
  <h2>Prijavljene riječi — za brisanje</h2>
  {#if prijaveZaBrisanje.length === 0}
    <p>Nema novih prijava za brisanje.</p>
  {:else}
    <ul class="lista-prijava">
      {#each prijaveZaBrisanje as prijava (prijava.id)}
        <li>
          <strong class="rijec-prijava">{prijava.rijec}</strong>
          <div class="gumbi-prijava">
            <button
              type="button"
              disabled={biloKojaAkcija()}
              onclick={() =>
                void akcijaPrijaveRijeci(
                  prijava.id,
                  'obrisi',
                  `/admin/prijave/${prijava.id}/obrisi-rijec`,
                  `Riječ „${prijava.rijec}” obrisana.`,
                )}
            >{oznakaGumba('rijeci', prijava.id, 'obrisi', 'Obriši')}</button>
            <button
              type="button"
              class="sporedni"
              disabled={biloKojaAkcija()}
              onclick={() =>
                void akcijaPrijaveRijeci(
                  prijava.id,
                  'dismiss',
                  `/admin/prijave/${prijava.id}/dismiss`,
                  'Prijava odbačena.',
                )}
            >{oznakaGumba('rijeci', prijava.id, 'dismiss', 'Dismiss')}</button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}

  <h2>Prijavljene riječi — za dodavanje</h2>
  {#if prijaveZaDodavanje.length === 0}
    <p>Nema novih prijava za dodavanje.</p>
  {:else}
    <ul class="lista-prijava">
      {#each prijaveZaDodavanje as prijava (prijava.id)}
        <li>
          <strong class="rijec-prijava">{prijava.rijec}</strong>
          <div class="gumbi-prijava">
            <button
              type="button"
              disabled={biloKojaAkcija()}
              onclick={() =>
                void akcijaPrijaveRijeci(
                  prijava.id,
                  'dodaj',
                  `/admin/prijave/${prijava.id}/dodaj-rijec`,
                  `Riječ „${prijava.rijec}” dodana.`,
                )}
            >{oznakaGumba('rijeci', prijava.id, 'dodaj', 'Dodaj')}</button>
            <button
              type="button"
              class="sporedni"
              disabled={biloKojaAkcija()}
              onclick={() =>
                void akcijaPrijaveRijeci(
                  prijava.id,
                  'dismiss',
                  `/admin/prijave/${prijava.id}/dismiss`,
                  'Prijava odbačena.',
                )}
            >{oznakaGumba('rijeci', prijava.id, 'dismiss', 'Dismiss')}</button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}

  <h2>Prijavljeni računi (pogrdan nadimak)</h2>
  {#if prijaveIgraca.length === 0}
    <p>Nema novih prijava igrača.</p>
  {:else}
    <ul class="lista-prijava">
      {#each prijaveIgraca as prijava (prijava.id)}
        <li>
          <div>
            <strong class="rijec-prijava">{prijava.nadimak}</strong>
            <small class="id-igraca">{prijava.prijavljeniIgracId}</small>
          </div>
          <div class="gumbi-prijava">
            <button
              type="button"
              disabled={biloKojaAkcija()}
              onclick={() =>
                void akcijaPrijaveIgraca(
                  prijava.id,
                  'obrisi-racun',
                  `/admin/prijave-igraca/${prijava.id}/obrisi-racun`,
                  `Račun „${prijava.nadimak}” obrisan.`,
                )}
            >{oznakaGumba('igraci', prijava.id, 'obrisi-racun', 'Obriši račun')}</button>
            <button
              type="button"
              class="sporedni"
              disabled={biloKojaAkcija()}
              onclick={() =>
                void akcijaPrijaveIgraca(
                  prijava.id,
                  'pusti',
                  `/admin/prijave-igraca/${prijava.id}/dismiss`,
                  'Prijava odbačena.',
                )}
            >{oznakaGumba('igraci', prijava.id, 'pusti', 'Pusti')}</button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
{/if}

<style>
  .greska {
    padding: 8px 12px;
    background: #f8d7da;
    color: #721c24;
    border-radius: 4px;
    margin: 12px 0;
  }

  .lista-prijava {
    list-style: none;
    margin: 0 0 24px;
    padding: 0;
  }

  .lista-prijava li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 14px 0;
    border-bottom: 1px solid #eee;
  }

  .rijec-prijava {
    display: block;
    font-size: 1.35rem;
    font-family: monospace;
    word-break: break-word;
  }

  .id-igraca {
    display: block;
    margin-top: 4px;
    color: #777;
    font-size: var(--tekst-mikro);
  }

  .gumbi-prijava {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .gumbi-prijava button.sporedni {
    background: #f5f5f5;
    color: #333;
  }
</style>
