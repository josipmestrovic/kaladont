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
  let pulsPusten = false;

  $effect(() => {
    const istek = new Date(istekIso).getTime();
    const interval = setInterval(() => {
      const preostaloMs = istek - Date.now();
      preostaliUdio = Math.max(0, Math.min(1, preostaloMs / TRAJANJE_MS));
    }, 200);
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
>
  <circle cx="50" cy="50" r={POLUMJER} fill="none" stroke="#e5ddc8" stroke-width="6" />
  <circle
    cx="50"
    cy="50"
    r={POLUMJER}
    fill="none"
    stroke="#e4572e"
    stroke-width="6"
    stroke-linecap="round"
    stroke-dasharray={OPSEG}
    stroke-dashoffset={OPSEG * (1 - preostaliUdio)}
    transform="rotate(-90 50 50)"
  />
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
