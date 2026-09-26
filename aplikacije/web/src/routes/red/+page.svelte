<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { dohvatiSocket } from '$lib/socket.js';
  import { dohvatiSavjete } from '$lib/savjeti.js';
  import { dohvatiStanjeIgre, pokreniSlusateljeIgre } from '$lib/stanje-igre.svelte.js';
  import { aktivirajAudio, pustiAudio } from '$lib/audio-manager.js';
  import Avatar from '$lib/komponente/Avatar.svelte';
  import type { PayloadGreska, PocetakPartije, RundaOtvorena, StanjePartije, StanjeReda } from 'zajednicko';

  const igra = dohvatiStanjeIgre();

  const trazeneMod = $derived(
    $page.url.searchParams.get('mod') === 'dva_igraca' ? 'dva_igraca' : 'cetiri_igraca'
  );
  const ukupnoMjesta = $derived(trazeneMod === 'dva_igraca' ? 2 : 4);
  const savjeti = $derived(dohvatiSavjete(trazeneMod));

  let stanje = $state<StanjeReda>({
    mojIgracId: '',
    mod: 'cetiri_igraca',
    mjesta: [null, null, null, null],
    prosjekCekanjaSek: 0,
  });
  let poruka = $state<string | null>(null);
  let savjet = $state('');
  let countdown = $state<number | null>(null);
  let odbrojavanjePartije: ReturnType<typeof setInterval> | null = null;
  let cekanjeStanjaTimeout: ReturnType<typeof setTimeout> | null = null;
  let ulazakPoslan = false;
  let brojPokusajaUlaska = 0;
  let prethodniIgraci: Set<string> | null = null;
  const brojIgraca = $derived(stanje.mjesta.filter((mjesto) => mjesto !== null).length);
  const preostaloIgraca = $derived(Math.max(0, ukupnoMjesta - brojIgraca));

  function pokreniOdbrojavanje(pocetakIso: string, partijaId: string) {
    if (odbrojavanjePartije) clearInterval(odbrojavanjePartije);
    const pocetakMs = new Date(pocetakIso).getTime();
    // Ustajala najava (npr. povratak u red nakon napuštene partije) ne smije katapultirati igrača
    if (pocetakMs - Date.now() < -3000) {
      return;
    }
    let zadnjaOdsviranaSek = Number.POSITIVE_INFINITY;
    const azuriraj = () => {
      const preostalo = Math.max(0, Math.ceil((pocetakMs - Date.now()) / 1000));
      countdown = preostalo;
      if (preostalo > 0 && preostalo < zadnjaOdsviranaSek) {
        zadnjaOdsviranaSek = preostalo;
        pustiAudio('odbrojavanje-single-count-sound');
      }
      if (preostalo <= 0) {
        if (odbrojavanjePartije) clearInterval(odbrojavanjePartije);
        odbrojavanjePartije = null;
        igra.pocetakPartijeIso = null; // najava je potrošena - točno jedna navigacija po najavi
        pustiAudio('pocetak-partije');
        void goto(`/partija/${partijaId}`);
      }
    };
    odbrojavanjePartije = setInterval(azuriraj, 250);
    azuriraj();
  }

  onMount(() => {
    pokreniSlusateljeIgre();
    savjet = savjeti[Math.floor(Math.random() * savjeti.length)] ?? '';
    const socket = dohvatiSocket();

    const naStanjeReda = (novoStanje: StanjeReda) => {
      if (!novoStanje.mjesta.some((mjesto) => mjesto?.igracId === novoStanje.mojIgracId)) return;
      if (cekanjeStanjaTimeout) clearTimeout(cekanjeStanjaTimeout);
      cekanjeStanjaTimeout = null;
      brojPokusajaUlaska = 0;
      const noviIgraci = new Set(
        novoStanje.mjesta.filter(Boolean).map((mjesto) => `${mjesto!.nadimak}:${mjesto!.avatarId}`),
      );
      if (prethodniIgraci) {
        if ([...noviIgraci].some((igracId) => !prethodniIgraci!.has(igracId))) pustiAudio('ulazak-u-sobu');
        if ([...prethodniIgraci].some((igracId) => !noviIgraci.has(igracId))) pustiAudio('izlazak-iz-sobe');
      }
      prethodniIgraci = noviIgraci;
      stanje = novoStanje;
    };
    const naGresku = (greska: PayloadGreska) => {
      if (greska.kod === 'EMAIL_NIJE_POTVRDEN') {
        if (cekanjeStanjaTimeout) clearTimeout(cekanjeStanjaTimeout);
        cekanjeStanjaTimeout = null;
        ulazakPoslan = false;
        void goto('/potvrdi-email');
        return;
      }
      poruka = greska.poruka;
    };
    const naGreskuVeze = () => {
      ulazakPoslan = false;
      poruka = 'Dogodila se pogreška prilikom stavljanja u red čekanja. Pokušaj osvježiti stranicu.';
    };
    const naPrekidVeze = () => {
      ulazakPoslan = false;
    };
    const naStanjePartije = (stanjePartije: StanjePartije) => {
      if (!stanjePartije.zavrsena) void goto(`/partija/${stanjePartije.partijaId}`);
    };
    const naRunduOtvorenu = (_runda: RundaOtvorena) => {
      if (igra.partijaId) void goto(`/partija/${igra.partijaId}`);
    };
    const naPocetakPartije = (pocetak: PocetakPartije) => {
      pokreniOdbrojavanje(pocetak.pocetakIso, pocetak.partijaId);
    };
    socket.on('red:stanje', naStanjeReda);
    socket.on('partija:pocetak', naPocetakPartije);
    socket.on('partija:stanje', naStanjePartije);
    socket.on('partija:runda-otvorena', naRunduOtvorenu);
    socket.on('greska', naGresku);
    socket.on('connect_error', naGreskuVeze);
    socket.on('disconnect', naPrekidVeze);
    const udjiURed = () => {
      if (ulazakPoslan) return;
      ulazakPoslan = true;
      socket.emit('partija:stanje');
      if (cekanjeStanjaTimeout) clearTimeout(cekanjeStanjaTimeout);
      cekanjeStanjaTimeout = setTimeout(() => {
        if (brojPokusajaUlaska === 0) {
          ulazakPoslan = false;
          brojPokusajaUlaska = 1;
          poruka = null;
          udjiURed();
          return;
        }
        ulazakPoslan = false;
        poruka = 'Dogodila se pogreška prilikom stavljanja u red čekanja. Pokušaj osvježiti stranicu.';
        cekanjeStanjaTimeout = null;
      }, 5000);
      socket.emit('red:udji', { mod: trazeneMod }, (potvrdenoStanje) => {
        if (potvrdenoStanje) {
          naStanjeReda(potvrdenoStanje);
        } else {
          naGreskuVeze();
        }
      });
    };
    socket.on('connect', udjiURed);
    if (socket.connected) udjiURed();
    aktivirajAudio();
    pustiAudio('ulazak-u-sobu');

    return () => {
      if (cekanjeStanjaTimeout) clearTimeout(cekanjeStanjaTimeout);
      socket.off('connect', udjiURed);
      socket.off('red:stanje', naStanjeReda);
      socket.off('partija:pocetak', naPocetakPartije);
      socket.off('partija:stanje', naStanjePartije);
      socket.off('partija:runda-otvorena', naRunduOtvorenu);
      socket.off('greska', naGresku);
      socket.off('connect_error', naGreskuVeze);
      socket.off('disconnect', naPrekidVeze);
    };
  });

  onDestroy(() => {
    if (odbrojavanjePartije) clearInterval(odbrojavanjePartije);
    dohvatiSocket().emit('red:izadji');
  });

  function odustani() {
    goto('/');
  }
</script>

<svelte:head>
  <title>Čekaonica | Kaladont</title>
</svelte:head>

<main class="red-sadrzaj">
{#if countdown !== null}
  <h1 aria-live="polite">Svi igrači su tu! Igra kreće za {countdown}…</h1>
{:else}
  <h1>Čekamo još {preostaloIgraca} {preostaloIgraca === 1 ? (trazeneMod === 'dva_igraca' ? 'igrača' : 'igrač') : 'igrača'}...</h1>
{/if}

{#if poruka}
  <p role="alert">{poruka}</p>
{/if}

<p class="prosjek-cekanja">Prosječno čekanje: ~{stanje.prosjekCekanjaSek} s</p>

<ul class="mjesta">
  {#each stanje.mjesta as mjesto, indeks (indeks)}
    <li
      class:zauzeto={mjesto !== null}
      class:prazno-mjesto={mjesto === null}
      class:moje-sjedalo={mjesto?.igracId === stanje.mojIgracId}
    >
      {#if mjesto}
        <Avatar avatarId={mjesto.avatarId} avatarConfig={mjesto.avatarConfig} rang={mjesto.rang} velicina={84} razinaVatre={mjesto.razinaVatre} nizPobjeda={mjesto.trenutniNiz} />
        <div class="podaci">
          <strong>
            {mjesto.nadimak}
            {#if mjesto.igracId === stanje.mojIgracId}<span class="oznaka-ti">TI</span>{/if}
          </strong>
          <span class="rang-i-razina">{mjesto.rang ?? 'Piskaralo'}</span>
          <span class="statistika-lobbyja"><span>Prosjek bodova: {mjesto.prosjekBodova.toFixed(2)}</span><span>Pobjede: {mjesto.postotakPobjeda.toFixed(0)}%</span><span>Odigrane igre: {mjesto.odigrane}</span></span>
          <span class="razina-oznaka">LVL {mjesto.razina}</span>
        </div>
      {:else}
        <span class="prazno">Prazno mjesto</span>
      {/if}
    </li>
  {/each}
</ul>

{#if countdown === null}
  <button type="button" class="odustani-gumb" onclick={odustani}>Odustani</button>
{/if}

<section class="korisne-informacije" aria-label="Korisne informacije">
  <h2 class="hint-naslov"><span aria-hidden="true">💡</span> Korisne informacije</h2>
  <p class="hint">{savjet}</p>
</section>
</main>

<style>
  .mjesta {
    list-style: none;
    padding: 0;
    display: grid;
    gap: 12px;
  }

  .mjesta li {
    position: relative;
    min-height: 108px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-radius: var(--radijus-kartica);
  }

  .mjesta li.zauzeto {
    background: white;
  }

  .mjesta li.moje-sjedalo {
    border: 2px solid var(--boja-mint-tamni);
    background: rgba(47, 169, 140, 0.08);
  }

  .oznaka-ti {
    display: inline-block;
    margin-left: 6px;
    padding: 2px 6px;
    border-radius: var(--radijus-pill);
    background: var(--boja-mint-tamni);
    color: #faf3e3;
    font-size: var(--tekst-mikro);
    line-height: 1;
    letter-spacing: 0.04em;
    vertical-align: middle;
  }

  .mjesta li.prazno-mjesto {
    min-height: 108px;
    justify-content: center;
    border: 1px dashed var(--boja-tekst-sekundarni);
    background: transparent;
  }

  .podaci {
    display: flex;
    flex-direction: column;
    font-size: var(--tekst-mali);
  }

  .rang-i-razina { color: var(--boja-tekst-sekundarni); }
  .statistika-lobbyja { display: flex; gap: 8px; color: var(--boja-tekst-sekundarni); }
  .razina-oznaka { position: absolute; right: 14px; bottom: 12px; color: var(--boja-mint); font-size: var(--tekst-mikro); font-weight: 700; }

  @media (max-width: 767px) {
    .statistika-lobbyja { flex-direction: column; gap: 1px; margin-top: 3px; }
  }

  .prazno {
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-mali);
  }

  .red-sadrzaj {
    max-width: 327px;
    margin: 0 auto;
    padding-top: 16px;
  }

  @media (min-width: 768px) {
    .red-sadrzaj {
      max-width: 100%;
    }
  }

  h1 {
    margin: 0 0 8px;
    font-size: var(--naslov-3);
    color: var(--boja-tekst-osnovni);
  }

  .prosjek-cekanja {
    margin: 0 0 24px;
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-mali);
  }

  .korisne-informacije {
    margin: 28px 0 0;
  }

  .hint-naslov {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 6px;
    margin: 0 0 4px;
    color: var(--boja-tekst-naslov);
    font-family: var(--font-tijelo);
    font-size: var(--tekst-mali);
    font-weight: 600;
  }

  .hint {
    width: 100%;
    min-height: 48px;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    margin: 0;
    padding: 0 12px;
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-mali);
    text-align: left;
  }

  .odustani-gumb {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 12px;
    background: none;
    border: 1px solid var(--boja-akcent);
    color: var(--boja-akcent);
    border-radius: var(--radijus-pill);
    padding: 10px 24px;
    font-size: var(--tekst-baza);
    font-weight: 700;
    cursor: pointer;
  }
</style>
