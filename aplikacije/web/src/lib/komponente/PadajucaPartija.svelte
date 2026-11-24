<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import {
    generirajPocetnePoteze,
    odigrajSljedeciPotez,
    stvoriStanjePartije,
    type PotezPozadine,
    type StanjePozadinskePartije,
  } from '$lib/pozadinski-kaladont/simulator.js';

  interface PadajucaRijec {
    id: number;
    idPartije: number;
    rijec: string;
    pocetak: string;
    nastavak: string;
    velicinaFonta: number;
    debljinaFonta: number;
    rotacija: number;
    pomak: number;
    opacity: number;
    posebnaRijec: boolean;
    aktivna: boolean;
    odgodaSekundi: number;
    trajanjeSekundi: number;
  }

  let {
    strana,
    brzinaPxPoSekundi,
    intervalMs,
    pauzirano = false,
    uskaZona = false,
  }: {
    strana: 'lijevo' | 'desno';
    brzinaPxPoSekundi: number;
    intervalMs: number;
    pauzirano?: boolean;
    uskaZona?: boolean;
  } = $props();

  const MAKS_VIDLJIVIH = 14;
  const POCETNIH_POTEZA = 7;

  const pocetniIdPartije = strana === 'lijevo' ? 1 : 2;
  const pocetniIntervalMs = intervalMs;

  let rijeci = $state<PadajucaRijec[]>([]);
  let zonaEl: HTMLDivElement | null = null;
  let stanje: StanjePozadinskePartije = stvoriStanjePartije(pocetniIdPartije);
  let idPartije = pocetniIdPartije;
  let idElementa = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let preostaloDoPotezaMs = pocetniIntervalMs;
  let zadnjiTick = 0;
  let aktivan = false;
  let putanjaPx = $state(1100);

  function slucajni(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  function izracunajPutanju(): number {
    if (!zonaEl) return Math.max(window.innerHeight, 800) + 120;
    return zonaEl.clientHeight + 120;
  }

  function opacityZaIndeks(indeksOdKraja: number, aktivna: boolean, posebna: boolean): number {
    if (posebna) return 0.72;
    if (aktivna) return slucajni(0.45, 0.55);
    if (indeksOdKraja <= 2) return slucajni(0.25, 0.35);
    return slucajni(0.15, 0.25);
  }

  function vizualIzPoteza(
    potez: PotezPozadine,
    odgodaSekundi: number,
    indeksOdKraja: number,
    aktivna: boolean,
  ): PadajucaRijec {
    const baza = uskaZona ? slucajni(14, 20) : slucajni(15, 24);
    const velicina = potez.posebnaRijec ? Math.min(baza * 1.1, 24) : baza;
    return {
      id: ++idElementa,
      idPartije: potez.idPartije,
      rijec: potez.rijec,
      pocetak: potez.pocetak,
      nastavak: potez.nastavak,
      velicinaFonta: velicina,
      debljinaFonta: Math.round(slucajni(400, 600) / 100) * 100,
      rotacija: slucajni(-3, 3),
      pomak: slucajni(uskaZona ? -4 : -8, uskaZona ? 4 : 8),
      opacity: opacityZaIndeks(indeksOdKraja, aktivna, potez.posebnaRijec),
      posebnaRijec: potez.posebnaRijec,
      aktivna,
      odgodaSekundi,
      trajanjeSekundi: putanjaPx / brzinaPxPoSekundi,
    };
  }

  function osvjeziOpacity(lista: PadajucaRijec[]): PadajucaRijec[] {
    const n = lista.length;
    return lista.map((rijec, i) => {
      const indeksOdKraja = n - 1 - i;
      const aktivna = indeksOdKraja === 0;
      return {
        ...rijec,
        aktivna,
        opacity: opacityZaIndeks(indeksOdKraja, aktivna, rijec.posebnaRijec),
      };
    });
  }

  function ukloniRijec(id: number) {
    rijeci = osvjeziOpacity(rijeci.filter((r) => r.id !== id));
  }

  function zakaziSljedeci(odgodaMs: number) {
    if (!aktivan) return;
    if (timer) clearTimeout(timer);
    preostaloDoPotezaMs = odgodaMs;
    zadnjiTick = performance.now();
    timer = setTimeout(() => {
      timer = null;
      if (!aktivan || pauzirano) return;
      dodajPotez();
    }, odgodaMs);
  }

  function zapocniNovuPartiju(sPauzom: boolean) {
    idPartije += 2;
    stanje = stvoriStanjePartije(idPartije);
    zakaziSljedeci(sPauzom ? intervalMs * (1.5 + Math.random() * 0.5) : intervalMs);
  }

  function dodajPotez() {
    if (!aktivan) return;

    if (stanje.zavrsena) {
      zapocniNovuPartiju(true);
      return;
    }

    const potez = odigrajSljedeciPotez(stanje);
    if (!potez) {
      zapocniNovuPartiju(false);
      return;
    }

    putanjaPx = izracunajPutanju();
    const vizual = vizualIzPoteza(potez, 0, 0, true);
    rijeci = osvjeziOpacity([...rijeci, vizual].slice(-MAKS_VIDLJIVIH));

    if (potez.posebnaRijec && potez.zavrsavaPartiju) {
      zapocniNovuPartiju(true);
      return;
    }

    if (stanje.zavrsena) {
      zapocniNovuPartiju(false);
      return;
    }

    zakaziSljedeci(intervalMs);
  }

  function inicijaliziraj() {
    putanjaPx = izracunajPutanju();
    idPartije = pocetniIdPartije;
    const { stanje: novoStanje, potezi } = generirajPocetnePoteze(POCETNIH_POTEZA, {}, idPartije);
    stanje = novoStanje;
    idPartije = novoStanje.idPartije;

    const trajanje = putanjaPx / brzinaPxPoSekundi;
    const razmakSekundi = intervalMs / 1000;
    const vizuali: PadajucaRijec[] = [];
    for (let i = 0; i < potezi.length; i += 1) {
      const starost = potezi.length - 1 - i;
      const odgoda = -starost * razmakSekundi;
      if (Math.abs(odgoda) >= trajanje) continue;
      vizuali.push(vizualIzPoteza(potezi[i]!, odgoda, starost, starost === 0));
    }
    rijeci = osvjeziOpacity(vizuali);

    if (stanje.zavrsena) {
      zapocniNovuPartiju(true);
    } else {
      zakaziSljedeci(intervalMs);
    }
  }

  function pauzirajTimere() {
    if (timer) {
      const proteklo = performance.now() - zadnjiTick;
      preostaloDoPotezaMs = Math.max(0, preostaloDoPotezaMs - proteklo);
      clearTimeout(timer);
      timer = null;
    }
  }

  function nastaviTimere() {
    if (!aktivan || pauzirano) return;
    zakaziSljedeci(preostaloDoPotezaMs > 0 ? preostaloDoPotezaMs : intervalMs);
  }

  let prethodnoPauzirano = false;
  $effect(() => {
    const p = pauzirano;
    if (!aktivan) {
      prethodnoPauzirano = p;
      return;
    }
    if (p && !prethodnoPauzirano) pauzirajTimere();
    else if (!p && prethodnoPauzirano) nastaviTimere();
    prethodnoPauzirano = p;
  });

  onMount(() => {
    aktivan = true;
    inicijaliziraj();
    return () => {
      aktivan = false;
      if (timer) clearTimeout(timer);
      timer = null;
    };
  });

  onDestroy(() => {
    aktivan = false;
    if (timer) clearTimeout(timer);
  });
</script>

<div
  class="zona"
  class:zona--lijevo={strana === 'lijevo'}
  class:zona--desno={strana === 'desno'}
  class:zona--pauza={pauzirano}
  bind:this={zonaEl}
  data-testid={`padajuca-partija-${strana}`}
>
  {#each rijeci as rijec, indeks (rijec.id)}
    {@const prethodna = indeks > 0 ? rijeci[indeks - 1] : null}
    <span
      class="rijec"
      class:rijec--kaladont={rijec.posebnaRijec}
      class:rijec--aktivna={rijec.aktivna}
      style={`--velicina:${rijec.velicinaFonta}px;--debljina:${rijec.debljinaFonta};--rotacija:${rijec.rotacija}deg;--pomak:${rijec.pomak}px;--odgoda:${rijec.odgodaSekundi}s;--trajanje:${rijec.trajanjeSekundi}s;--putanja:${putanjaPx}px;--njihanje:${2.8 + (rijec.id % 5) * 0.35}s;--neprozirnost:${rijec.opacity};`}
      onanimationend={(e) => {
        if (e.animationName.includes('dizanje-partije')) ukloniRijec(rijec.id);
      }}
    >
      <span class="rijec-njihanje">
        {#if rijec.posebnaRijec}
          {rijec.rijec}
        {:else}
          <span
            class="grafem grafem--pocetak"
            class:grafem--povezan={prethodna !== null && prethodna.nastavak === rijec.pocetak}
            >{rijec.pocetak}</span
          ><span class="grafem grafem--sredina">{rijec.rijec.slice(rijec.pocetak.length)}</span>
        {/if}
      </span>
    </span>
  {/each}
</div>

<style>
  .zona {
    position: absolute;
    top: 0;
    bottom: 0;
    /* Sigurnosni razmak od središnjeg sadržaja (24–32px). */
    width: max(0px, calc((100% - var(--sirina-grida, 980px)) / 2 - 28px));
    overflow: hidden;
    pointer-events: none;
    z-index: 0;
    mask-image: linear-gradient(to bottom, transparent 0%, #000 6%, #000 94%, transparent 100%);
  }

  .zona--lijevo {
    left: 0;
  }

  .zona--desno {
    right: 0;
  }

  .zona--pauza .rijec,
  .zona--pauza .rijec-njihanje {
    animation-play-state: paused;
  }

  .rijec {
    position: absolute;
    top: 0;
    left: 50%;
    font-family: var(--font-naslov);
    font-size: var(--velicina);
    font-weight: var(--debljina);
    white-space: nowrap;
    will-change: transform, opacity;
    opacity: var(--neprozirnost);
    color: var(--boja-tekst-sekundarni);
    animation: dizanje-partije var(--trajanje) linear var(--odgoda) forwards;
    transform: translate3d(calc(-50% + var(--pomak)), var(--putanja), 0) rotate(var(--rotacija));
  }

  .rijec-njihanje {
    display: inline-block;
    transform-origin: center center;
    animation: njihanje-rijeci var(--njihanje) ease-in-out infinite alternate;
  }

  .grafem--povezan {
    color: color-mix(in srgb, var(--boja-isticanje-tekst) 70%, var(--boja-mint) 30%);
  }

  .rijec--kaladont {
    color: var(--boja-zuta-krema);
    opacity: 0.72;
  }

  :global(html[data-tema='svijetla']) .rijec {
    color: color-mix(in srgb, var(--boja-tekst-sekundarni) 88%, transparent);
  }

  :global(html[data-tema='svijetla']) .grafem--povezan {
    color: color-mix(in srgb, var(--boja-isticanje-tekst) 75%, var(--boja-mint) 25%);
  }

  :global(html[data-tema='svijetla']) .rijec--kaladont {
    color: color-mix(in srgb, var(--boja-zuta-krema) 70%, #8a6400);
  }

  @keyframes dizanje-partije {
    0% {
      transform: translate3d(calc(-50% + var(--pomak)), var(--putanja), 0) rotate(var(--rotacija));
    }
    100% {
      transform: translate3d(calc(-50% + var(--pomak)), -40px, 0)
        rotate(calc(var(--rotacija) * -1));
    }
  }

  @keyframes njihanje-rijeci {
    0% {
      transform: translateX(-3px) rotate(-2deg);
    }
    100% {
      transform: translateX(3px) rotate(2deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .rijec,
    .rijec-njihanje {
      animation: none !important;
    }
  }
</style>
