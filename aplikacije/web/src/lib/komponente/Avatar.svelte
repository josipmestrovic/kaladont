<script lang="ts">
  import { bojaBordera, nazivAvatara, putanjaAvatara } from '$lib/avatari.js';

  interface Props {
    avatarId: number;
    rang?: string | null;
    gost?: boolean;
    velicina?: number;
  }

  const { avatarId, rang = null, gost = false, velicina = 48 }: Props = $props();

  const border = $derived(gost ? null : bojaBordera(rang));
</script>

<div
  class="avatar"
  style:width="{velicina}px"
  style:height="{velicina}px"
  style:border={border ? `3px solid ${border}` : '3px solid transparent'}
>
  <img src={putanjaAvatara(avatarId)} alt={nazivAvatara(avatarId)} />
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

  .avatar img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
    display: block;
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
