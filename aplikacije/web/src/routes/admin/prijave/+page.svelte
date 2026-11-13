<script lang="ts">
  import { onMount } from 'svelte';
  import { MAKSIMALNA_DULJINA_NAPOMENE_PRIJAVE } from 'zajednicko';
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
  type TierRijetkostiRucno = 'ucestala' | 'rijetka' | 'srednje_rijetka' | 'jako_rijetka';

  type DijalogPotvrde =
    | { lista: 'rijeci'; tip: 'obrisi' | 'dodaj' | 'dismiss'; id: number; oznaka: string }
    | { lista: 'igraci'; tip: 'obrisi-racun' | 'pusti'; id: number; oznaka: string };

  const TIERI_RIJETKOSTI: { vrijednost: TierRijetkostiRucno; oznaka: string }[] = [
    { vrijednost: 'ucestala', oznaka: 'Učestala / obična (0 EXP)' },
    { vrijednost: 'rijetka', oznaka: 'Rijetka (15 EXP)' },
    { vrijednost: 'srednje_rijetka', oznaka: 'Srednje rijetka (30 EXP)' },
    { vrijednost: 'jako_rijetka', oznaka: 'Jako rijetka (50 EXP)' },
  ];

  let prijave = $state<Prijava[]>([]);
  let prijaveIgraca = $state<PrijavaIgraca[]>([]);
  let greskaPristupa = $state<string | null>(null);
  let greskaAkcije = $state<string | null>(null);
  let akcijaUTijeku = $state<{ lista: 'rijeci' | 'igraci'; id: number; tip: AkcijaTip } | null>(null);
  let dijalog = $state<DijalogPotvrde | null>(null);
  let tierRijetkosti = $state<TierRijetkostiRucno>('ucestala');
  let napomena = $state('');

  const POLL_MS = 15_000;
  const MAX_NAPOMENE = MAKSIMALNA_DULJINA_NAPOMENE_PRIJAVE;

  const prijaveZaBrisanje = $derived(prijave.filter((p) => p.tip === 'za_brisanje'));
  const prijaveZaDodavanje = $derived(prijave.filter((p) => p.tip === 'za_dodavanje'));
  const brojNapomene = $derived(napomena.length);

  function biloKojaAkcija(): boolean {
    return akcijaUTijeku !== null || dijalog !== null;
  }

  function oznakaGumba(lista: 'rijeci' | 'igraci', id: number, tip: AkcijaTip, mirna: string): string {
    if (akcijaUTijeku?.lista === lista && akcijaUTijeku.id === id && akcijaUTijeku.tip === tip) {
      return 'Radim…';
    }
    return mirna;
  }

  function otvoriDijalog(sljedeci: DijalogPotvrde) {
    if (akcijaUTijeku !== null || dijalog !== null) return;
    tierRijetkosti = 'ucestala';
    napomena = '';
    dijalog = sljedeci;
  }

  function zatvoriDijalog() {
    if (akcijaUTijeku !== null) return;
    dijalog = null;
    napomena = '';
  }

  function naslovDijaloga(d: DijalogPotvrde): string {
    switch (d.tip) {
      case 'dodaj':
        return 'Dodati riječ?';
      case 'obrisi':
        return 'Obrisati riječ?';
      case 'dismiss':
        return 'Odbaciti prijavu?';
      case 'obrisi-racun':
        return 'Obrisati račun?';
      case 'pusti':
        return 'Odbaciti prijavu?';
    }
  }

  function tekstDijaloga(d: DijalogPotvrde): string {
    switch (d.tip) {
      case 'dodaj':
        return `Jesi li siguran da želiš ubaciti riječ „${d.oznaka}” u rječnik?`;
      case 'obrisi':
        return `Jesi li siguran da želiš ukloniti riječ „${d.oznaka}” iz rječnika?`;
      case 'dismiss':
        return `Jesi li siguran da želiš odbaciti prijavu za riječ „${d.oznaka}”?`;
      case 'obrisi-racun':
        return `Jesi li siguran da želiš obrisati račun „${d.oznaka}”?`;
      case 'pusti':
        return `Jesi li siguran da želiš odbaciti prijavu za nadimak „${d.oznaka}”?`;
    }
  }

  function oznakaPotvrde(d: DijalogPotvrde): string {
    switch (d.tip) {
      case 'dodaj':
        return 'Dodaj u rječnik';
      case 'obrisi':
        return 'Obriši';
      case 'dismiss':
        return 'Dismiss';
      case 'obrisi-racun':
        return 'Obriši račun';
      case 'pusti':
        return 'Pusti';
    }
  }

  function tijeloSNapomenom(osnova: Record<string, unknown> = {}): Record<string, unknown> {
    const trimano = napomena.trim();
    if (!trimano) return osnova;
    return { ...osnova, napomena: trimano.slice(0, MAX_NAPOMENE) };
  }

  async function potvrdiDijalog() {
    if (!dijalog) return;
    const trenutni = dijalog;
    const tier = tierRijetkosti;
    const tijelo = tijeloSNapomenom(trenutni.tip === 'dodaj' ? { tierRijetkosti: tier } : {});
    dijalog = null;
    napomena = '';

    if (trenutni.lista === 'rijeci') {
      const putanja =
        trenutni.tip === 'dodaj'
          ? `/admin/prijave/${trenutni.id}/dodaj-rijec`
          : trenutni.tip === 'obrisi'
            ? `/admin/prijave/${trenutni.id}/obrisi-rijec`
            : `/admin/prijave/${trenutni.id}/dismiss`;
      const uspjeh =
        trenutni.tip === 'dodaj'
          ? `Riječ „${trenutni.oznaka}” dodana.`
          : trenutni.tip === 'obrisi'
            ? `Riječ „${trenutni.oznaka}” obrisana.`
            : 'Prijava odbačena.';
      await akcijaPrijaveRijeci(trenutni.id, trenutni.tip, putanja, uspjeh, tijelo);
      return;
    }

    const putanja =
      trenutni.tip === 'obrisi-racun'
        ? `/admin/prijave-igraca/${trenutni.id}/obrisi-racun`
        : `/admin/prijave-igraca/${trenutni.id}/dismiss`;
    const uspjeh =
      trenutni.tip === 'obrisi-racun' ? `Račun „${trenutni.oznaka}” obrisan.` : 'Prijava odbačena.';
    await akcijaPrijaveIgraca(trenutni.id, trenutni.tip, putanja, uspjeh, tijelo);
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
        if (document.visibilityState === 'visible' && akcijaUTijeku === null && dijalog === null) {
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

  async function akcijaPrijaveRijeci(
    id: number,
    tip: AkcijaTip,
    putanja: string,
    uspjeh: string,
    tijelo: Record<string, unknown> = {},
  ) {
    if (akcijaUTijeku !== null) return;
    const uklonjena = prijave.find((p) => p.id === id);
    if (!uklonjena) return;
    akcijaUTijeku = { lista: 'rijeci', id, tip };
    greskaAkcije = null;
    // Odmah makni red i pokaži uspjeh — ne čekaj sporiji backend.
    prijave = prijave.filter((p) => p.id !== id);
    pokaziUspjeh(uspjeh);
    try {
      await api(putanja, { method: 'POST', body: JSON.stringify(tijelo) });
      void ucitaj();
    } catch (e) {
      prijave = [...prijave, uklonjena].sort((a, b) => b.id - a.id);
      greskaAkcije = e instanceof Error ? e.message : 'Akcija nije uspjela.';
    } finally {
      akcijaUTijeku = null;
    }
  }

  async function akcijaPrijaveIgraca(
    id: number,
    tip: AkcijaTip,
    putanja: string,
    uspjeh: string,
    tijelo: Record<string, unknown> = {},
  ) {
    if (akcijaUTijeku !== null) return;
    const uklonjena = prijaveIgraca.find((p) => p.id === id);
    if (!uklonjena) return;
    akcijaUTijeku = { lista: 'igraci', id, tip };
    greskaAkcije = null;
    prijaveIgraca = prijaveIgraca.filter((p) => p.id !== id);
    pokaziUspjeh(uspjeh);
    try {
      await api(putanja, { method: 'POST', body: JSON.stringify(tijelo) });
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
                otvoriDijalog({
                  lista: 'rijeci',
                  tip: 'obrisi',
                  id: prijava.id,
                  oznaka: prijava.rijec,
                })}
            >{oznakaGumba('rijeci', prijava.id, 'obrisi', 'Obriši')}</button>
            <button
              type="button"
              class="sporedni"
              disabled={biloKojaAkcija()}
              onclick={() =>
                otvoriDijalog({
                  lista: 'rijeci',
                  tip: 'dismiss',
                  id: prijava.id,
                  oznaka: prijava.rijec,
                })}
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
                otvoriDijalog({
                  lista: 'rijeci',
                  tip: 'dodaj',
                  id: prijava.id,
                  oznaka: prijava.rijec,
                })}
            >{oznakaGumba('rijeci', prijava.id, 'dodaj', 'Dodaj')}</button>
            <button
              type="button"
              class="sporedni"
              disabled={biloKojaAkcija()}
              onclick={() =>
                otvoriDijalog({
                  lista: 'rijeci',
                  tip: 'dismiss',
                  id: prijava.id,
                  oznaka: prijava.rijec,
                })}
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
                otvoriDijalog({
                  lista: 'igraci',
                  tip: 'obrisi-racun',
                  id: prijava.id,
                  oznaka: prijava.nadimak,
                })}
            >{oznakaGumba('igraci', prijava.id, 'obrisi-racun', 'Obriši račun')}</button>
            <button
              type="button"
              class="sporedni"
              disabled={biloKojaAkcija()}
              onclick={() =>
                otvoriDijalog({
                  lista: 'igraci',
                  tip: 'pusti',
                  id: prijava.id,
                  oznaka: prijava.nadimak,
                })}
            >{oznakaGumba('igraci', prijava.id, 'pusti', 'Pusti')}</button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
{/if}

{#if dijalog}
  <div
    class="dijalog-overlay"
    role="presentation"
    onclick={zatvoriDijalog}
    onkeydown={(e) => e.key === 'Escape' && zatvoriDijalog()}
  >
    <div
      class="dijalog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dijalog-potvrda-naslov"
      onclick={(e) => e.stopPropagation()}
    >
      <h2 id="dijalog-potvrda-naslov">{naslovDijaloga(dijalog)}</h2>
      <p>{tekstDijaloga(dijalog)}</p>
      {#if dijalog.tip === 'dodaj'}
        <label class="polje-rijetkost">
          Rijetkost
          <select bind:value={tierRijetkosti} disabled={akcijaUTijeku !== null}>
            {#each TIERI_RIJETKOSTI as tier (tier.vrijednost)}
              <option value={tier.vrijednost}>{tier.oznaka}</option>
            {/each}
          </select>
        </label>
      {/if}
      <label class="polje-napomena">
        Napomena (neobavezno)
        <textarea
          bind:value={napomena}
          maxlength={MAX_NAPOMENE}
          rows="3"
          disabled={akcijaUTijeku !== null}
          placeholder="Pošalji prijavitelju dodatnu napomenu uz odluku…"
        ></textarea>
        <span class="brojac-napomene">{brojNapomene}/{MAX_NAPOMENE}</span>
      </label>
      <div class="dijalog-gumbi">
        <button type="button" class="sporedni" disabled={akcijaUTijeku !== null} onclick={zatvoriDijalog}
          >Odustani</button
        >
        <button type="button" disabled={akcijaUTijeku !== null} onclick={() => void potvrdiDijalog()}
          >{oznakaPotvrde(dijalog)}</button
        >
      </div>
    </div>
  </div>
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

  .dijalog-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: rgba(0, 0, 0, 0.45);
  }

  .dijalog {
    width: min(100%, 420px);
    padding: 20px 22px;
    border-radius: 8px;
    background: #fff;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
  }

  .dijalog h2 {
    margin: 0 0 10px;
    font-size: 1.25rem;
  }

  .dijalog p {
    margin: 0 0 16px;
    line-height: 1.45;
  }

  .polje-rijetkost,
  .polje-napomena {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 18px;
    font-weight: 600;
  }

  .polje-rijetkost select,
  .polje-napomena textarea {
    font: inherit;
    font-weight: 400;
    padding: 8px 10px;
  }

  .polje-napomena textarea {
    resize: vertical;
    min-height: 72px;
  }

  .brojac-napomene {
    align-self: flex-end;
    font-size: 0.85rem;
    font-weight: 400;
    color: #666;
  }

  .dijalog-gumbi {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px;
  }

  .dijalog-gumbi button.sporedni {
    background: #f5f5f5;
    color: #333;
  }
</style>
