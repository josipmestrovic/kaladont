<script lang="ts">
  /**
   * SVG prsten koji se prazni sinkrono s 30s odbrojavanjem (istekPotezaIso je izvor istine - server je sat).
   * Zadnjih 5s pulsira (ekrani.md §3).
   */
  import { pustiAudio } from '$lib/audio-manager.js';

  interface Props {
    istekIso: string;
    velicina?: number;
    promijeniNemirAvatara?: (nemiran: boolean) => void;
  }

  const { istekIso, velicina = 56, promijeniNemirAvatara = () => undefined }: Props = $props();
  const TRAJANJE_MS = 30_000;
  const POLUMJER = 46;
  const OPSEG = 2 * Math.PI * POLUMJER;

  let preostaliUdio = $state(1);
  let preostaleSekunde = $state(Math.ceil(TRAJANJE_MS / 1000));
  let pulsPusten = false;

  $effect(() => {
    const istek = new Date(istekIso).getTime();
    pulsPusten = false;
    const interval = setInterval(() => {
      const preostaloMs = istek - Date.now();
      preostaliUdio = Math.max(0, Math.min(1, preostaloMs / TRAJANJE_MS));
      preostaleSekunde = Math.max(0, Math.ceil(preostaloMs / 1000));
    }, 200);
    preostaleSekunde = Math.max(0, Math.ceil((istek - Date.now()) / 1000));
    return () => clearInterval(interval);
  });

  const pulsira = $derived(preostaliUdio > 0 && preostaliUdio < 5 / 30);
  const avatarJeNemiran = $derived(preostaliUdio > 0 && preostaliUdio < 3 / 30);

  $effect(() => {
    promijeniNemirAvatara(avatarJeNemiran);
    return () => promijeniNemirAvatara(false);
  });

  $effect(() => {
    if (pulsira && !pulsPusten) {
      pulsPusten = true;
      pustiAudio('pred-istek-vremena');
    }
  });
</script>

<svg
  class="timer-prsten ulazni-puls"
  class:pulsira
  viewBox="0 0 100 100"
  width={velicina}
  height={velicina}
  role="img"
  aria-label={`Preostalo vrijeme: ${preostaleSekunde} sekundi`}
>
  <circle cx="50" cy="50" r={POLUMJER} fill="none" stroke="#e5ddc8" stroke-width="6" />
  <circle
    cx="50"
    cy="50"
    r={POLUMJER}
    fill="none"
    stroke="#2fa98c"
    stroke-width="6"
    stroke-linecap="round"
    stroke-dasharray={OPSEG}
    stroke-dashoffset={OPSEG * (1 - preostaliUdio)}
    transform="rotate(-90 50 50)"
  />
  <circle class="timer-broj-podloga" cx="50" cy="50" r="17" />
  <text class="timer-broj" x="50" y="50" text-anchor="middle" dominant-baseline="central">
    {preostaleSekunde}
  </text>
</svg>

<style>
  .timer-prsten {
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
  }

  .timer-prsten circle:last-child {
    transition: stroke-dashoffset 0.2s linear;
  }

  .timer-broj-podloga {
    fill: #1d6f5c;
    stroke: #faf3e3;
    stroke-width: 2;
  }

  .timer-broj {
    fill: #faf3e3;
    font-family: var(--font-naslov);
    font-size: 19px;
    font-weight: 700;
  }

  .timer-prsten.pulsira {
    animation: timer-puls 0.6s ease-in-out infinite;
  }

  .timer-prsten.ulazni-puls {
    animation: timer-ulaz 0.7s ease-out both;
  }

  .timer-prsten.ulazni-puls.pulsira {
    animation: timer-puls 0.6s ease-in-out infinite;
  }

  @keyframes timer-puls {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  @keyframes timer-ulaz {
    0% { opacity: 0.2; transform: scale(0.82); }
    55% { opacity: 1; transform: scale(1.12); }
    100% { opacity: 1; transform: scale(1); }
  }

  @media (prefers-reduced-motion: reduce) {
    .timer-prsten.ulazni-puls,
    .timer-prsten.ulazni-puls.pulsira {
      animation: none;
    }
  }
</style>
