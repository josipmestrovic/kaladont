<script lang="ts">
  /**
   * Horizontalna progress crta + sekunde za mobilni fokus unos.
   * Ista vremenska logika kao TimerPrsten (#142 F).
   */
  import { dohvatiPomakSataMs, imaUzorakSata } from '$lib/sinkronizacija-partije.js';
  import { preostaloMsPoteza } from '$lib/timer-poteza.js';

  interface Props {
    istekIso: string;
    serverVrijemeIso: string;
    trajanjeSek: number;
    /** `zaglavlje`: sekunde gore desno + tanka crta ispod (mobilni fokus). */
    raspored?: 'obicni' | 'zaglavlje';
  }

  const { istekIso, serverVrijemeIso, trajanjeSek, raspored = 'obicni' }: Props = $props();

  let preostaliUdio = $state(1);
  let preostaleSekunde = $state(0);

  $effect(() => {
    const trajanjeMs = Math.max(1, trajanjeSek * 1000);
    const bazaMonotonicMs = performance.now();
    const bazaWallMs = Date.now();
    const pomakSataMs = imaUzorakSata()
      ? dohvatiPomakSataMs()
      : new Date(serverVrijemeIso).getTime() - bazaWallMs;

    const osvjezi = () => {
      const preostaloMs = preostaloMsPoteza({
        istekIso,
        pomakSataMs,
        sadaMonotonicMs: performance.now(),
        bazaMonotonicMs,
        bazaWallMs,
      });
      preostaliUdio = Math.max(0, Math.min(1, preostaloMs / trajanjeMs));
      preostaleSekunde = Math.max(0, Math.ceil(preostaloMs / 1000));
    };

    osvjezi();
    const interval = setInterval(osvjezi, 200);
    return () => clearInterval(interval);
  });

  const pulsira = $derived(preostaliUdio > 0 && preostaliUdio * Math.max(1, trajanjeSek) < 5);
</script>

<div
  class="timer-crta"
  class:timer-crta--zaglavlje={raspored === 'zaglavlje'}
  class:pulsira
  role="timer"
  aria-label={`Preostalo vrijeme: ${preostaleSekunde} sekundi`}
>
  <div class="timer-crta-staza" aria-hidden="true">
    <div class="timer-crta-napredak" style={`transform: scaleX(${preostaliUdio})`}></div>
  </div>
  <strong class="timer-crta-sekunde"
    >{preostaleSekunde}{raspored === 'zaglavlje' ? ' s' : ''}</strong
  >
</div>

<style>
  .timer-crta {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
  }
  .timer-crta--zaglavlje {
    display: block;
    position: relative;
    width: 100%;
  }
  .timer-crta--zaglavlje .timer-crta-sekunde {
    position: absolute;
    right: 0;
    bottom: calc(100% + 8px);
    min-width: 3.2ch;
    font-size: 16px;
  }
  .timer-crta--zaglavlje .timer-crta-staza {
    width: 100%;
    height: 3px;
  }
  .timer-crta-staza {
    flex: 1;
    min-width: 0;
    height: 4px;
    overflow: hidden;
    border-radius: 999px;
    background: color-mix(in srgb, var(--boja-obrub-jaci) 70%, transparent);
  }
  .timer-crta-napredak {
    width: 100%;
    height: 100%;
    transform-origin: left center;
    border-radius: inherit;
    background: var(--boja-isticanje-slova);
    transition: transform 0.2s linear, background-color 180ms ease;
  }
  .timer-crta-sekunde {
    flex: none;
    min-width: 1.5ch;
    color: var(--boja-isticanje-slova);
    font-family: var(--font-naslov);
    font-size: 18px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    line-height: 1;
    text-align: right;
    transition: color 180ms ease;
  }
  .timer-crta.pulsira .timer-crta-napredak {
    background: var(--boja-crvena);
  }
  .timer-crta.pulsira .timer-crta-sekunde {
    color: var(--boja-crvena);
  }
  .timer-crta.pulsira .timer-crta-napredak,
  .timer-crta.pulsira .timer-crta-sekunde {
    animation: timer-crta-puls 0.6s ease-in-out infinite;
  }
  @keyframes timer-crta-puls {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.55;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .timer-crta.pulsira .timer-crta-napredak,
    .timer-crta.pulsira .timer-crta-sekunde {
      animation: none;
    }
  }
</style>
