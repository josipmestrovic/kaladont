<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { dohvatiSocket } from '$lib/socket.js';
  import { SAVJETI } from '$lib/savjeti.js';
  import { dohvatiStanjeIgre, pokreniSlusateljeIgre } from '$lib/stanje-igre.svelte.js';
  import { aktivirajAudio, pustiAudio } from '$lib/audio-manager.js';
  import Avatar from '$lib/komponente/Avatar.svelte';
  import type { PayloadGreska, StanjeReda } from 'zajednicko';

  const igra = dohvatiStanjeIgre();

  let stanje = $state<StanjeReda>({ mojIgracId: '', mjesta: [null, null, null, null], prosjekCekanjaSek: 0 });
  let poruka = $state<string | null>(null);
  let countdown = $state<number | null>(null);
  let aktivniSavjet = $state(0);
  let sliderInterval: ReturnType<typeof setInterval> | undefined;
  let prethodniIgraci: Set<string> | null = null;
  const brojIgraca = $derived(stanje.mjesta.filter((mjesto) => mjesto !== null).length);
  const preostaloIgraca = $derived(Math.max(0, 4 - brojIgraca));

  // Odbrojavanje se izvodi iz globalnog stanja (partija:pocetak hvata se jednom, u stanje-igre),
  // pa radi neovisno o redoslijedu mountanja i ne curi listenere po posjetu čekaonici.
  $effect(() => {
    const pocetakIso = igra.pocetakPartijeIso;
    const partijaId = igra.partijaId;
    if (!pocetakIso || !partijaId) {
      countdown = null;
      return;
    }
    const pocetakMs = new Date(pocetakIso).getTime();
    // Ustajala najava (npr. povratak u red nakon napuštene partije) ne smije katapultirati igrača
    if (pocetakMs - Date.now() < -3000) {
      countdown = null;
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
        clearInterval(interval);
        igra.pocetakPartijeIso = null; // najava je potrošena - točno jedna navigacija po najavi
        pustiAudio('pocetak-partije');
        void goto(`/partija/${partijaId}`);
      }
    };
    const interval = setInterval(azuriraj, 250);
    azuriraj();
    return () => clearInterval(interval);
  });

  onMount(() => {
    pokreniSlusateljeIgre();
    sliderInterval = setInterval(() => {
      aktivniSavjet = (aktivniSavjet + 1) % SAVJETI.length;
    }, 8000);
    const socket = dohvatiSocket();

    const naStanjeReda = (novoStanje: StanjeReda) => {
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
      poruka = greska.poruka;
    };
    socket.on('red:stanje', naStanjeReda);
    socket.on('greska', naGresku);
    socket.emit('red:udji');
    aktivirajAudio();
    pustiAudio('ulazak-u-sobu');

    return () => {
      socket.off('red:stanje', naStanjeReda);
      socket.off('greska', naGresku);
    };
  });

  onDestroy(() => {
    if (sliderInterval) clearInterval(sliderInterval);
    dohvatiSocket().emit('red:izadji');
  });

  function odustani() {
    goto('/');
  }
</script>

<main class="red-sadrzaj">
{#if countdown !== null}
  <h1 aria-live="polite">Svi igrači su tu! Partija kreće za {countdown}…</h1>
{:else}
  <h1>Čekamo još {preostaloIgraca} {preostaloIgraca === 1 ? 'igrač' : 'igrača'}...</h1>
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
        <Avatar avatarId={mjesto.avatarId} rang={mjesto.rang} velicina={84} />
        <div class="podaci">
          <strong>
            {mjesto.nadimak}
            {#if mjesto.igracId === stanje.mojIgracId}<span class="oznaka-ti">TI</span>{/if}
          </strong>
          <span>{mjesto.rang ?? 'Piskaralo'}</span>
          <span>Prosjek: {mjesto.prosjekBodova.toFixed(2)} • Pobjede: {mjesto.postotakPobjeda.toFixed(0)}%</span>
        </div>
      {:else}
        <span class="prazno">Prazno mjesto</span>
      {/if}
    </li>
  {/each}
</ul>

{#if countdown === null}
  <button type="button" class="odustani-gumb" onclick={odustani}>
    Odustani
  </button>
{/if}

<section class="hint-slider" aria-label="Savjeti za igru">
  <h2 class="hint-naslov"><span aria-hidden="true">💡</span> Korisne informacije</h2>
  <div class="hint-okvir">
    <div class="hint-traka" style={`transform: translateX(-${aktivniSavjet * 100}%);`}>
      {#each SAVJETI as savjet}
        <p class="hint">{savjet}</p>
      {/each}
    </div>
  </div>
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
    min-height: 72px;
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
    min-height: 76px;
    justify-content: center;
    border: 1px dashed var(--boja-tekst-sekundarni);
    background: transparent;
  }

  .podaci {
    display: flex;
    flex-direction: column;
    font-size: var(--tekst-mali);
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

  .hint-slider {
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

  .hint-okvir {
    overflow: hidden;
  }

  .hint-traka {
    display: flex;
    transition: transform 300ms ease;
  }

  .hint {
    flex: 0 0 100%;
    width: 100%;
    min-height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
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
    padding: 6px 16px;
    font-size: inherit;
    cursor: pointer;
  }
</style>
