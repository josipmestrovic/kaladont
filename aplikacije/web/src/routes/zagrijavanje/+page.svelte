<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { dohvatiSocket } from '$lib/socket.js';
  import { dohvatiSavjete } from '$lib/savjeti.js';
  import { dohvatiStanjeIgre, pokreniSlusateljeIgre } from '$lib/stanje-igre.svelte.js';
  import { aktivirajAudio, zagrijGameplayZvukove } from '$lib/audio-manager.js';
  import {
    jePoznatiPravilnik,
    NAZIVI_PROFILA_BOTA,
    type PocetakPartije,
    type PotvrdaTreninga,
    type PravilnikPartije,
    type ProfilBotaIzazova,
    type RundaOtvorena,
    type StanjePartije,
  } from 'zajednicko';
  import { parsajProfilIzQuery, TEKSTOVI_PRAVILNIKA } from '$lib/igraj-rute.js';
  import TreningMeta from '$lib/komponente/TreningMeta.svelte';

  const igra = dohvatiStanjeIgre();
  const savjeti = dohvatiSavjete('dva_igraca');

  /** Glavni UI: ?botovi=1|2|3&profil=. Misije / stari linkovi: ?pravila=. */
  const trazeniBotovi = $derived(((): 1 | 2 | 3 | null => {
    const sirovo = $page.url.searchParams.get('botovi');
    if (sirovo === '1' || sirovo === '2' || sirovo === '3') return Number(sirovo) as 1 | 2 | 3;
    return null;
  })());
  const trazenaPravila = $derived(((): PravilnikPartije | null => {
    const pravila = $page.url.searchParams.get('pravila');
    return jePoznatiPravilnik(pravila) ? pravila : null;
  })());
  const trazeniProfil = $derived(parsajProfilIzQuery($page.url.searchParams.get('profil')));
  const nazivProfila = $derived(NAZIVI_PROFILA_BOTA[trazeniProfil]);
  const nazivPravila = $derived(
    trazenaPravila ? TEKSTOVI_PRAVILNIKA[trazenaPravila].naziv : null,
  );
  const tekstPripreme = $derived(
    nazivPravila
      ? `Pripremamo trening · ${nazivPravila} · ${nazivProfila}…`
      : `Pripremamo trening · ${nazivProfila}…`,
  );

  let poruka = $state<string | null>(null);
  let pokretanjeUTijeku = $state(false);
  let savjet = $state('');
  let timeoutPotvrde: ReturnType<typeof setTimeout> | null = null;
  let navigiranPartijaId: string | null = null;

  function idiNaStol(partijaId: string) {
    if (!partijaId || navigiranPartijaId === partijaId) return;
    navigiranPartijaId = partijaId;
    void goto(`/partija/${partijaId}`);
  }

  function zapocni() {
    if (pokretanjeUTijeku) return;
    pokretanjeUTijeku = true;
    poruka = null;
    const socket = dohvatiSocket();
    if (timeoutPotvrde) clearTimeout(timeoutPotvrde);
    timeoutPotvrde = setTimeout(() => {
      pokretanjeUTijeku = false;
      poruka = 'Poslužitelj ne odgovara. Pokušaj ponovno.';
    }, 8000);
    const potvrda: PotvrdaTreninga = (ishod) => {
      if (timeoutPotvrde) clearTimeout(timeoutPotvrde);
      timeoutPotvrde = null;
      if (ishod.pokrenut) return;
      pokretanjeUTijeku = false;
      if (ishod.kod === 'VEC_U_PARTIJI' && igra.partijaId) {
        void goto(`/partija/${igra.partijaId}`);
        return;
      }
      poruka = ishod.poruka;
    };
    const profileId: ProfilBotaIzazova = trazeniProfil;
    if (trazeniBotovi && trazenaPravila) {
      socket.emit('trening:zapocni', { pravila: trazenaPravila, brojRacunala: trazeniBotovi, profileId }, potvrda);
    } else if (trazeniBotovi) {
      socket.emit('trening:zapocni', { brojRacunala: trazeniBotovi, profileId }, potvrda);
    } else if (trazenaPravila) {
      socket.emit('trening:zapocni', { pravila: trazenaPravila, profileId }, potvrda);
    } else {
      // Stari klijent / prazan URL — server defaulta na Iskusni.
      socket.emit('trening:zapocni', potvrda);
    }
  }

  onMount(() => {
    zagrijGameplayZvukove();
    pokreniSlusateljeIgre();
    savjet = savjeti[Math.floor(Math.random() * savjeti.length)] ?? '';
    const socket = dohvatiSocket();
    const naPocetak = (pocetak: PocetakPartije) => idiNaStol(pocetak.partijaId);
    const naStanje = (stanje: StanjePartije) => {
      if (!stanje.zavrsena) idiNaStol(stanje.partijaId);
    };
    const naRundu = (_runda: RundaOtvorena) => {
      if (igra.partijaId) idiNaStol(igra.partijaId);
    };
    socket.on('partija:pocetak', naPocetak);
    socket.on('partija:stanje', naStanje);
    socket.on('partija:runda-otvorena', naRundu);
    aktivirajAudio();
    if (socket.connected) zapocni();
    else socket.once('connect', zapocni);
    return () => {
      socket.off('partija:pocetak', naPocetak);
      socket.off('partija:stanje', naStanje);
      socket.off('partija:runda-otvorena', naRundu);
      socket.off('connect', zapocni);
    };
  });

  onDestroy(() => {
    if (timeoutPotvrde) clearTimeout(timeoutPotvrde);
  });
</script>

<svelte:head>
  <title>Zagrijavanje | Kaladont</title>
</svelte:head>

<main class="zagrijavanje">
  {#if poruka}
    <h1>Zagrijavanje</h1>
    <p role="alert">{poruka}</p>
    <div class="akcije">
      <button type="button" class="primarni-gumb" onclick={zapocni}>Pokušaj ponovno</button>
      <a href="/" class="sporedni-gumb">Povratak na odabir igre</a>
    </div>
  {:else}
    <h1 aria-live="polite">{tekstPripreme}</h1>
    <TreningMeta pravila={trazenaPravila} profileId={trazeniProfil} />
    <p class="napomena">Ovo je trening. XP, kolekcija i dostignuća riječi se bilježe, ali bez bodova, ranga, forme i ljestvice. Registriranim igračima pobjeda broji dostignuće Zagrijan.</p>
    <a href="/" class="sporedni-gumb">Odustani</a>
  {/if}

  <section class="korisne-informacije" aria-label="Korisne informacije">
    <h2 class="hint-naslov"><span aria-hidden="true">💡</span> Korisne informacije</h2>
    <p class="hint">{savjet}</p>
  </section>
</main>

<style>
  .zagrijavanje {
    max-width: 480px;
    margin: 0 auto;
    padding-top: 16px;
  }
  h1 {
    margin: 0 0 8px;
    font-size: var(--naslov-3);
    color: var(--boja-tekst-osnovni);
  }
  .napomena {
    margin: 0 0 20px;
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-mali);
  }
  .akcije {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin: 12px 0 0;
  }
  .primarni-gumb,
  .sporedni-gumb {
    display: inline-flex;
    align-items: center;
    border-radius: var(--radijus-pill);
    padding: 10px 24px;
    font-size: var(--tekst-baza);
    font-weight: 700;
    cursor: pointer;
    text-decoration: none;
  }
  .primarni-gumb {
    background: var(--boja-akcent);
    border: 1px solid var(--boja-akcent);
    color: #1a1815;
  }
  .sporedni-gumb {
    background: none;
    border: 1px solid var(--boja-akcent);
    color: var(--boja-akcent);
  }
  .korisne-informacije { margin: 28px 0 0; }
  .hint-naslov {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0 0 4px;
    color: var(--boja-tekst-naslov);
    font-family: var(--font-tijelo);
    font-size: var(--tekst-mali);
    font-weight: 600;
  }
  .hint {
    min-height: 48px;
    display: flex;
    align-items: center;
    margin: 0;
    padding: 0 12px;
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-mali);
  }
</style>
