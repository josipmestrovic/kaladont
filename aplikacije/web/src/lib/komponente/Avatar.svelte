<script lang="ts">
  import { bojaBordera, debljinaBorderaRanga, nazivAvatara, putanjaAvatara } from '$lib/avatari.js';
  import type { AvatarConfigV1, RazinaVatre } from 'zajednicko';
  import AvatarKonfiguracijaPreview from './AvatarKonfiguracijaPreview.svelte';
  import AvatarVatra from './AvatarVatra.svelte';

  interface Props {
    avatarId: number;
    rang?: string | null;
    gost?: boolean;
    velicina?: number;
    prikaziRangBorder?: boolean;
    avatarConfig?: AvatarConfigV1 | null;
    razinaVatre?: RazinaVatre;
    nizPobjeda?: number;
    /** Fiksna ilustracija (npr. bot za Zagrijavanje) umjesto konfiguracije / kataloga. */
    vanjskaSlika?: string | null;
  }

  const { avatarId, rang = null, gost = false, velicina = 48, prikaziRangBorder = true, avatarConfig = null, razinaVatre = 0, nizPobjeda = 0, vanjskaSlika = null }: Props = $props();

  const border = $derived(!prikaziRangBorder || vanjskaSlika ? null : bojaBordera(rang));
  const debljina = $derived(border ? debljinaBorderaRanga(velicina) : 0);
  const gostFontSize = $derived(Math.max(8, Math.round(velicina * 0.21)));
  const oznakaFontSize = $derived(Math.max(7, Math.round(velicina * 0.15)));
</script>

<div
  class="avatar"
  class:ima-rang-border={border !== null}
  class:vanjska={Boolean(vanjskaSlika)}
  style:width="{velicina}px"
  style:height="{velicina}px"
  style:--boja-rang={border ?? 'transparent'}
  style:--debljina-rang="{debljina}px"
>
    {#if !vanjskaSlika}
      <AvatarVatra razina={razinaVatre} niz={nizPobjeda} />
    {/if}
    <div class="avatar-sadrzaj">
      {#if vanjskaSlika}
        <img class="vanjska-slika" src={vanjskaSlika} alt={nazivAvatara(avatarId)} />
      {:else if avatarConfig}
        <AvatarKonfiguracijaPreview konfiguracija={avatarConfig} velicina={velicina} />
      {:else if gost}
        <div class="gost-avatar" style:font-size="{gostFontSize}px">Gost</div>
      {:else}
        <img src={putanjaAvatara(avatarId)} alt={nazivAvatara(avatarId)} />
      {/if}
    </div>
    {#if gost && avatarConfig && !vanjskaSlika}
      <span class="gost-oznaka" style:font-size="{oznakaFontSize}px">Gost</span>
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
    overflow: visible;
  }

  .avatar.ima-rang-border {
    box-shadow: 0 0 0 var(--debljina-rang, 3px) var(--boja-rang, transparent);
  }

  .avatar-sadrzaj {
    position: relative;
    z-index: 1;
    display: inline-flex;
    width: 100%;
    height: 100%;
    overflow: hidden;
    border-radius: inherit;
  }

  .avatar img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
    display: block;
  }

  .avatar.vanjska .avatar-sadrzaj {
    background: var(--boja-povrsina-2);
  }

  .avatar .vanjska-slika {
    object-fit: contain;
    padding: 6%;
    box-sizing: border-box;
  }

  .gost-avatar {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: var(--boja-povrsina-3);
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

  :global(html[data-tema='svijetla']) .gost-avatar {
    background: var(--boja-mint);
  }

  .gost-oznaka {
    position: absolute;
    z-index: 2;
    right: 0;
    bottom: 4%;
    left: 0;
    margin: 0 auto;
    width: fit-content;
    max-width: 86%;
    padding: 1px 6px;
    border-radius: var(--radijus-pill);
    background: rgb(26 24 21 / 72%);
    color: #ffffff;
    font-weight: 800;
    letter-spacing: 0.4px;
    line-height: 1.3;
    text-transform: uppercase;
    user-select: none;
    pointer-events: none;
  }
</style>
