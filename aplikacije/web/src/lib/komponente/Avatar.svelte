<script lang="ts">
  import { bojaBordera, debljinaBorderaRanga, nazivAvatara, putanjaAvatara } from '$lib/avatari.js';
  import { type AvatarConfigV1, type RazinaVatre } from 'zajednicko';
  import AvatarKonfiguracijaPreview from './AvatarKonfiguracijaPreview.svelte';
  import AvatarVatra from './AvatarVatra.svelte';

  interface Props {
    avatarId: number;
    rang?: string | null;
    /** Gost prikazuje zeleni krug s bijelim „G”, bez konfiguracijskog avatara. */
    gost?: boolean;
    velicina?: number;
    prikaziRangBorder?: boolean;
    avatarConfig?: AvatarConfigV1 | null;
    razinaVatre?: RazinaVatre;
    nizPobjeda?: number;
    /** Fiksna ilustracija (npr. bot za Zagrijavanje) umjesto konfiguracije / kataloga. */
    vanjskaSlika?: string | null;
    /** Pristupačni opis (npr. Bot: Nadimak). */
    opisSlike?: string | null;
  }

  const { avatarId, rang = null, gost = false, velicina = 48, prikaziRangBorder = true, avatarConfig = null, razinaVatre = 0, nizPobjeda = 0, vanjskaSlika = null, opisSlike = null }: Props = $props();
  const altTekst = $derived(opisSlike ?? (gost ? 'Gost' : nazivAvatara(avatarId)));
  const gostFontSize = $derived(Math.max(10, Math.round(velicina * 0.42)));

  const border = $derived(!prikaziRangBorder || vanjskaSlika || gost ? null : bojaBordera(rang));
  const debljina = $derived(border ? debljinaBorderaRanga(velicina) : 0);
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
    {#if !vanjskaSlika && !gost}
      <AvatarVatra razina={razinaVatre} niz={nizPobjeda} />
    {/if}
    <div class="avatar-sadrzaj">
      {#if vanjskaSlika}
        <img class="vanjska-slika" src={vanjskaSlika} alt={altTekst} />
      {:else if gost}
        <div class="gost-avatar" style:font-size="{gostFontSize}px" aria-label={altTekst}>G</div>
      {:else if avatarConfig}
        <AvatarKonfiguracijaPreview konfiguracija={avatarConfig} velicina={velicina} />
      {:else}
        <img src={putanjaAvatara(avatarId)} alt={altTekst} />
      {/if}
    </div>
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
    line-height: 1;
  }

  :global(html[data-tema='svijetla']) .gost-avatar {
    background: var(--boja-mint);
  }
</style>
