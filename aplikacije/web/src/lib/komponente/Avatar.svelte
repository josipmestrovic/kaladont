<script lang="ts">
  import { bojaBordera, nazivAvatara, putanjaAvatara } from '$lib/avatari.js';

  interface Props {
    avatarId: number;
    rang?: string | null;
    gost?: boolean;
    velicina?: number;
    prikaziRangBorder?: boolean;
  }

  const { avatarId, rang = null, gost = false, velicina = 48, prikaziRangBorder = true }: Props = $props();

  const border = $derived(gost || !prikaziRangBorder ? null : bojaBordera(rang));
  const gostFontSize = $derived(Math.max(8, Math.round(velicina * 0.21)));
</script>

<div
  class="avatar"
  style:width="{velicina}px"
  style:height="{velicina}px"
  style:border={border ? `4px solid ${border}` : '4px solid transparent'}
  style:--boja-rang={border ?? 'transparent'}
>
  {#if gost}
    <div class="gost-avatar" style:font-size="{gostFontSize}px">Gost</div>
  {:else}
    <img src={putanjaAvatara(avatarId)} alt={nazivAvatara(avatarId)} />
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
    overflow: hidden;
    box-shadow: 0 0 0 3px var(--boja-rang, transparent);
  }

  .avatar img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
    display: block;
  }

  .gost-avatar {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: #1d6f5c;
    color: #ffffff;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    text-transform: uppercase;
    letter-spacing: 0.2px;
    user-select: none;
    padding: 0 2px;
  }
</style>
