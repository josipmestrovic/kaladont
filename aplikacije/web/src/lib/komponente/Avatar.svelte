<script lang="ts">
  import { dizajnAvatara, bojaBordera } from '$lib/avatari.js';

  interface Props {
    avatarId: number;
    rang?: string | null;
    gost?: boolean;
    velicina?: number;
  }

  const { avatarId, rang = null, gost = false, velicina = 48 }: Props = $props();

  const dizajn = $derived(dizajnAvatara(avatarId));
  const border = $derived(gost ? null : bojaBordera(rang));
</script>

<div
  class="avatar"
  style:width="{velicina}px"
  style:height="{velicina}px"
  style:border={border ? `3px solid ${border}` : '3px solid transparent'}
>
  <svg viewBox="0 0 96 96" width="100%" height="100%" role="img" aria-label="Avatar">
    <circle cx="48" cy="48" r="48" fill={dizajn.bg} />
    {#if dizajn.oblik === 'krug'}
      <circle cx="48" cy="48" r="20" fill={dizajn.simbol} />
    {:else if dizajn.oblik === 'kvadrat'}
      <rect x="28" y="28" width="40" height="40" rx="4" fill={dizajn.simbol} />
    {:else if dizajn.oblik === 'trokut'}
      <polygon points="48,26 70,66 26,66" fill={dizajn.simbol} />
    {:else if dizajn.oblik === 'zvijezda'}
      <polygon
        points="48,24 54,42 73,42 58,53 63,71 48,60 33,71 38,53 23,42 42,42"
        fill={dizajn.simbol}
      />
    {:else if dizajn.oblik === 'romb'}
      <polygon points="48,24 72,48 48,72 24,48" fill={dizajn.simbol} />
    {:else}
      <polygon points="48,22 71,36 71,60 48,74 25,60 25,36" fill={dizajn.simbol} />
    {/if}
  </svg>
  {#if gost}
    <span class="oznaka-gost">GOST</span>
  {/if}
</div>

<style>
  .avatar {
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    position: relative;
    box-sizing: border-box;
    flex-shrink: 0;
  }

  .oznaka-gost {
    position: absolute;
    bottom: -6px;
    left: 50%;
    transform: translateX(-50%);
    font-size: var(--tekst-oznaka);
    font-weight: bold;
    background: #26221b;
    color: #faf3e3;
    padding: 1px 4px;
    border-radius: 4px;
    white-space: nowrap;
  }
</style>
