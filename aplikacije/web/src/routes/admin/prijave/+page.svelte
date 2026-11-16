<script lang="ts">
  import { onMount } from 'svelte';
  import { MAKSIMALNA_DULJINA_NAPOMENE_PRIJAVE } from 'zajednicko';
  import { api, ApiGreska } from '$lib/api.js';
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

  interface PregledUklanjanja {
    izvornaRijec: string;
    izvorniKljucevi: string[];
    brojAktivnih: number;
    samoOvajOblik: boolean;
    otisak: string;
    poruka?: string;
    oblici: Array<{ rijec: string; frekvencija: number; grupe: string[] }>;
  }

  interface PregledDodavanja {
    izvornaRijec: string;
    kljucGrupe: string;
    brojOblici: number;
    imaPreklapanja: boolean;
    otisak: string;
    poruka?: string;
    oblici: Array<{ rijec: string; stanje: string; frekvencija: number }>;
  }

  interface RedDodavanja {
    id: number;
    rijec: string;
    tier: TierRijetkostiRucno | '';
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
  let pregledUklanjanja = $state<PregledUklanjanja | null>(null);
  let pregledDodavanja = $state<PregledDodavanja | null>(null);
  let lemaDodavanja = $state('');
  let vrstaDodavanja = $state('imenica');
  let dodatniOblici = $state<RedDodavanja[]>([]);
  let sljedeciIdReda = $state(1);
  let potvrdiPreklapanja = $state(false);
  let pregledUcitavanje = $state(false);
  let greskaDijaloga = $state<string | null>(null);
  let kljucOperacije = $state('');

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

  function tijeloPregledaDodavanja(izvornaRijec: string) {
    const dodatni = dodatniOblici
      .filter((red) => red.rijec.trim().length >= 2)
      .map((red) => ({
        rijec: red.rijec.trim(),
        ...(red.tier ? { tierRijetkosti: red.tier } : {}),
      }));
    return {
      izvornaRijec,
      vrsta: vrstaDodavanja,
      lema: lemaDodavanja.trim() || izvornaRijec,
      tierRijetkosti: tierRijetkosti,
      dodatniOblici: dodatni,
    };
  }

  async function ucitajPregledDodavanja(prijavaId: number, izvornaRijec: string) {
    pregledUcitavanje = true;
    greskaDijaloga = null;
    try {
      const odgovor = await api<{ pregled: PregledDodavanja }>(
        `/admin/prijave/${prijavaId}/pregled-dodavanja`,
        {
          method: 'POST',
          body: JSON.stringify(tijeloPregledaDodavanja(izvornaRijec)),
        },
      );
      pregledDodavanja = odgovor.pregled;
      kljucOperacije = crypto.randomUUID();
      potvrdiPreklapanja = false;
    } catch (e) {
      pregledDodavanja = null;
      greskaDijaloga = e instanceof Error ? e.message : 'Pregled nije uspio.';
    } finally {
      pregledUcitavanje = false;
    }
  }

  function dodajRedOblika() {
    dodatniOblici = [...dodatniOblici, { id: sljedeciIdReda, rijec: '', tier: '' }];
    sljedeciIdReda += 1;
  }

  function ukloniRedOblika(id: number) {
    dodatniOblici = dodatniOblici.filter((red) => red.id !== id);
  }

  async function ucitajPregledUklanjanja(prijavaId: number) {
    pregledUcitavanje = true;
    greskaDijaloga = null;
    try {
      const odgovor = await api<{ pregled: PregledUklanjanja }>(
        `/admin/prijave/${prijavaId}/pregled-uklanjanja`,
      );
      pregledUklanjanja = odgovor.pregled;
      kljucOperacije = crypto.randomUUID();
    } catch (e) {
      pregledUklanjanja = null;
      greskaDijaloga = e instanceof Error ? e.message : 'Pregled nije uspio.';
    } finally {
      pregledUcitavanje = false;
    }
  }

  function otvoriDijalog(sljedeci: DijalogPotvrde) {
    if (akcijaUTijeku !== null || dijalog !== null) return;
    tierRijetkosti = 'ucestala';
    napomena = '';
    pregledUklanjanja = null;
    pregledDodavanja = null;
    potvrdiPreklapanja = false;
    dodatniOblici = [];
    greskaDijaloga = null;
    kljucOperacije = '';
    dijalog = sljedeci;
    if (sljedeci.lista === 'rijeci' && sljedeci.tip === 'obrisi') {
      void ucitajPregledUklanjanja(sljedeci.id);
    }
    if (sljedeci.lista === 'rijeci' && sljedeci.tip === 'dodaj') {
      lemaDodavanja = sljedeci.oznaka;
      vrstaDodavanja = 'imenica';
      void ucitajPregledDodavanja(sljedeci.id, sljedeci.oznaka);
    }
  }

  function zatvoriDijalog() {
    if (akcijaUTijeku !== null) return;
    dijalog = null;
    napomena = '';
    pregledUklanjanja = null;
    pregledDodavanja = null;
    greskaDijaloga = null;
    kljucOperacije = '';
  }

  function naslovDijaloga(d: DijalogPotvrde): string {
    switch (d.tip) {
      case 'dodaj':
        return 'Dodati riječ?';
      case 'obrisi':
        return 'Deaktivirati oblike?';
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
        return `Pregled uklanjanja za prijavljenu riječ „${d.oznaka}”.`;
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
        return pregledDodavanja
          ? `Dodaj ${pregledDodavanja.brojOblici} oblika`
          : 'Dodaj u rječnik';
      case 'obrisi':
        return pregledUklanjanja
          ? `Deaktiviraj ${pregledUklanjanja.brojAktivnih} oblika`
          : 'Deaktiviraj';
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

    if (trenutni.lista === 'rijeci' && trenutni.tip === 'obrisi') {
      if (!pregledUklanjanja || pregledUcitavanje || !kljucOperacije) return;
      akcijaUTijeku = { lista: 'rijeci', id: trenutni.id, tip: 'obrisi' };
      greskaDijaloga = null;
      greskaAkcije = null;
      try {
        const odgovor = await api<{ brojPromjena?: number }>(`/admin/prijave/${trenutni.id}/obrisi-rijec`, {
          method: 'POST',
          body: JSON.stringify(
            tijeloSNapomenom({
              otisak: pregledUklanjanja.otisak,
              kljucOperacije,
            }),
          ),
        });
        const broj = odgovor.brojPromjena ?? pregledUklanjanja.brojAktivnih;
        pokaziUspjeh(
          broj === 0
            ? `Nema promjene za „${trenutni.oznaka}”.`
            : `Deaktivirano ${broj} oblika (izvor „${trenutni.oznaka}”).`,
        );
        dijalog = null;
        napomena = '';
        pregledUklanjanja = null;
        kljucOperacije = '';
        void ucitaj();
      } catch (e) {
        if (e instanceof ApiGreska && e.status === 409 && e.tijelo.pregled) {
          pregledUklanjanja = e.tijelo.pregled as PregledUklanjanja;
          kljucOperacije = crypto.randomUUID();
          greskaDijaloga = 'Pregled je zastario — potvrdi novi popis.';
        } else {
          greskaDijaloga = e instanceof Error ? e.message : 'Akcija nije uspjela.';
        }
      } finally {
        akcijaUTijeku = null;
      }
      return;
    }

    if (trenutni.lista === 'rijeci' && trenutni.tip === 'dodaj') {
      if (!pregledDodavanja || pregledUcitavanje || !kljucOperacije) return;
      akcijaUTijeku = { lista: 'rijeci', id: trenutni.id, tip: 'dodaj' };
      greskaDijaloga = null;
      greskaAkcije = null;
      try {
        const odgovor = await api<{ brojPromjena?: number }>(`/admin/prijave/${trenutni.id}/dodaj-rijec`, {
          method: 'POST',
          body: JSON.stringify({
            ...tijeloSNapomenom(tijeloPregledaDodavanja(trenutni.oznaka)),
            otisak: pregledDodavanja.otisak,
            kljucOperacije,
            potvrdiPreklapanja,
          }),
        });
        const broj = odgovor.brojPromjena ?? pregledDodavanja.brojOblici;
        pokaziUspjeh(
          broj === 0
            ? `Nema promjene za „${trenutni.oznaka}”.`
            : `Dodano/ažurirano ${broj} oblika (izvor „${trenutni.oznaka}”).`,
        );
        dijalog = null;
        napomena = '';
        pregledDodavanja = null;
        kljucOperacije = '';
        void ucitaj();
      } catch (e) {
        if (e instanceof ApiGreska && e.status === 409 && e.tijelo.pregled) {
          pregledDodavanja = e.tijelo.pregled as PregledDodavanja;
          kljucOperacije = crypto.randomUUID();
          greskaDijaloga = 'Pregled je zastario — potvrdi novi popis.';
        } else {
          greskaDijaloga = e instanceof Error ? e.message : 'Akcija nije uspjela.';
        }
      } finally {
        akcijaUTijeku = null;
      }
      return;
    }

    const tijelo = tijeloSNapomenom({});
    dijalog = null;
    napomena = '';

    if (trenutni.lista === 'rijeci') {
      const putanja = `/admin/prijave/${trenutni.id}/dismiss`;
      await akcijaPrijaveRijeci(trenutni.id, trenutni.tip, putanja, 'Prijava odbačena.', tijelo);
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
      {#if dijalog.tip === 'obrisi'}
        {#if pregledUcitavanje}
          <p>Učitavam obuhvat…</p>
        {:else if pregledUklanjanja}
          {#if pregledUklanjanja.poruka}
            <p class="info-pregled">{pregledUklanjanja.poruka}</p>
          {/if}
          <p class="info-pregled">
            Grupe: <strong>{pregledUklanjanja.izvorniKljucevi.join(', ') || '—'}</strong>
            · {pregledUklanjanja.brojAktivnih} aktivnih oblika
          </p>
          {#if pregledUklanjanja.oblici.length > 0}
            <ul class="lista-obuhvata">
              {#each pregledUklanjanja.oblici as oblik (oblik.rijec)}
                <li><code>{oblik.rijec}</code></li>
              {/each}
            </ul>
          {:else}
            <p class="info-pregled">Nema aktivnih oblika za deaktivaciju.</p>
          {/if}
        {/if}
      {/if}
      {#if dijalog.tip === 'dodaj'}
        <div class="editor-dodavanja">
          <label>
            Lema
            <input
              type="text"
              bind:value={lemaDodavanja}
              disabled={akcijaUTijeku !== null}
              onchange={() => dijalog && void ucitajPregledDodavanja(dijalog.id, dijalog.oznaka)}
            />
          </label>
          <label>
            Vrsta
            <select
              bind:value={vrstaDodavanja}
              disabled={akcijaUTijeku !== null}
              onchange={() => dijalog && void ucitajPregledDodavanja(dijalog.id, dijalog.oznaka)}
            >
              <option value="imenica">Imenica</option>
              <option value="glagol">Glagol</option>
              <option value="pridjev">Pridjev</option>
              <option value="prilog">Prilog</option>
            </select>
          </label>
          <label class="polje-rijetkost">
            Rijetkost izvora
            <select
              bind:value={tierRijetkosti}
              disabled={akcijaUTijeku !== null}
              onchange={() => dijalog && void ucitajPregledDodavanja(dijalog.id, dijalog.oznaka)}
            >
              {#each TIERI_RIJETKOSTI as tier (tier.vrijednost)}
                <option value={tier.vrijednost}>{tier.oznaka}</option>
              {/each}
            </select>
          </label>
          <div class="dodatni-oblici">
            <p>Dodatni oblici</p>
            {#each dodatniOblici as red (red.id)}
              <div class="red-oblik">
                <input type="text" bind:value={red.rijec} placeholder="oblik" disabled={akcijaUTijeku !== null} />
                <select bind:value={red.tier} disabled={akcijaUTijeku !== null}>
                  <option value="">Zadrži</option>
                  {#each TIERI_RIJETKOSTI as tier (tier.vrijednost)}
                    <option value={tier.vrijednost}>{tier.oznaka}</option>
                  {/each}
                </select>
                <button type="button" class="sporedni" onclick={() => ukloniRedOblika(red.id)}>×</button>
              </div>
            {/each}
            <button type="button" class="sporedni" disabled={akcijaUTijeku !== null} onclick={dodajRedOblika}
              >+ oblik</button
            >
          </div>
          <button
            type="button"
            class="sporedni"
            disabled={akcijaUTijeku !== null}
            onclick={() => dijalog && void ucitajPregledDodavanja(dijalog.id, dijalog.oznaka)}
            >Osvježi pregled</button
          >
          {#if pregledUcitavanje}
            <p>Učitavam pregled…</p>
          {:else if pregledDodavanja}
            {#if pregledDodavanja.poruka}
              <p class="info-pregled">{pregledDodavanja.poruka}</p>
            {/if}
            <p class="info-pregled">Grupa: <strong>{pregledDodavanja.kljucGrupe}</strong></p>
            <ul class="lista-obuhvata">
              {#each pregledDodavanja.oblici as oblik (oblik.rijec)}
                <li><code>{oblik.rijec}</code> — {oblik.stanje} (f={oblik.frekvencija})</li>
              {/each}
            </ul>
            {#if pregledDodavanja.imaPreklapanja}
              <label>
                <input type="checkbox" bind:checked={potvrdiPreklapanja} disabled={akcijaUTijeku !== null} />
                Potvrdi spajanje homografskih grupa
              </label>
            {/if}
          {/if}
        </div>
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
      {#if greskaDijaloga}
        <p class="greska" role="alert">{greskaDijaloga}</p>
      {/if}
      <div class="dijalog-gumbi">
        <button type="button" class="sporedni" disabled={akcijaUTijeku !== null} onclick={zatvoriDijalog}
          >Odustani</button
        >
        <button
          type="button"
          disabled={akcijaUTijeku !== null ||
            (dijalog.tip === 'obrisi' && (pregledUcitavanje || !pregledUklanjanja)) ||
            (dijalog.tip === 'dodaj' && (pregledUcitavanje || !pregledDodavanja))}
          onclick={() => void potvrdiDijalog()}
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
    width: min(100%, 480px);
    max-height: min(90vh, 720px);
    overflow: auto;
    padding: 20px 22px;
    border-radius: 8px;
    background: #fff;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
  }

  .info-pregled {
    margin: 0 0 10px;
    font-size: 0.95rem;
    line-height: 1.4;
  }

  .lista-obuhvata {
    max-height: 180px;
    overflow: auto;
    margin: 0 0 16px;
    padding: 8px 12px;
    list-style: none;
    border: 1px solid #e5e5e5;
    border-radius: 6px;
    background: #fafafa;
  }

  .lista-obuhvata li {
    padding: 2px 0;
    font-family: monospace;
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
