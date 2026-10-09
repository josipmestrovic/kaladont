<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { dohvatiSocket } from '$lib/socket.js';
  import { dohvatiSavjete } from '$lib/savjeti.js';
  import { dohvatiStanjeIgre, pokreniSlusateljeIgre } from '$lib/stanje-igre.svelte.js';
  import { aktivirajAudio, pustiAudio } from '$lib/audio-manager.js';
  import type { PocetakPartije, PotvrdaTreninga, RundaOtvorena, StanjePartije } from 'zajednicko';

  const igra = dohvatiStanjeIgre();
  const savjeti = dohvatiSavjete('dva_igraca');

  let poruka = $state<string | null>(null);
  let countdown = $state<number | null>(null);
  let pokretanjeUTijeku = $state(false);
  let savjet = $state('');
  let odbrojavanje: ReturnType<typeof setInterval> | null = null;
  let timeoutPotvrde: ReturnType<typeof setTimeout> | null = null;

  function pokreniOdbrojavanje(pocetakIso: string, partijaId: string) {
    if (odbrojavanje) clearInterval(odbrojavanje);
    const pocetakMs = new Date(pocetakIso).getTime();
    if (pocetakMs - Date.now() < -3000) return;
    let zadnjaOdsvirana = Number.POSITIVE_INFINITY;
    const azuriraj = () => {
      const preostalo = Math.max(0, Math.ceil((pocetakMs - Date.now()) / 1000));
      countdown = preostalo;
      if (preostalo > 0 && preostalo < zadnjaOdsvirana) {
        zadnjaOdsvirana = preostalo;
        pustiAudio('odbrojavanje-single-count-sound');
      }
      if (preostalo <= 0) {
        if (odbrojavanje) clearInterval(odbrojavanje);
        odbrojavanje = null;
        igra.pocetakPartijeIso = null;
        pustiAudio('pocetak-partije');
        void goto(`/partija/${partijaId}`);
      }
    };
    odbrojavanje = setInterval(azuriraj, 250);
    azuriraj();
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
    socket.emit('trening:zapocni', potvrda);
  }

  onMount(() => {
    pokreniSlusateljeIgre();
    savjet = savjeti[Math.floor(Math.random() * savjeti.length)] ?? '';
    const socket = dohvatiSocket();
    const naPocetak = (pocetak: PocetakPartije) => pokreniOdbrojavanje(pocetak.pocetakIso, pocetak.partijaId);
    const naStanje = (stanje: StanjePartije) => {
      if (!stanje.zavrsena) void goto(`/partija/${stanje.partijaId}`);
    };
    const naRundu = (_runda: RundaOtvorena) => {
      if (igra.partijaId) void goto(`/partija/${igra.partijaId}`);
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
    if (odbrojavanje) clearInterval(odbrojavanje);
    if (timeoutPotvrde) clearTimeout(timeoutPotvrde);
  });
</script>

<svelte:head>
  <title>Zagrijavanje | Kaladont</title>
</svelte:head>

<main class="zagrijavanje">
  {#if countdown !== null}
    <h1 aria-live="polite">Računalo je spremno! Trening kreće za {countdown}…</h1>
  {:else if poruka}
    <h1>Zagrijavanje</h1>
    <p role="alert">{poruka}</p>
    <div class="akcije">
      <button type="button" class="primarni-gumb" onclick={zapocni}>Pokušaj ponovno</button>
      <a href="/" class="sporedni-gumb">Povratak na odabir igre</a>
    </div>
  {:else}
    <h1 aria-live="polite">Pripremamo dvoboj protiv računala…</h1>
    <p class="napomena">Ovo je trening. Rezultat se ne bilježi i ne utječe na tvoju statistiku, dostignuća ni formu.</p>
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
