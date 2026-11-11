<script lang="ts">
  import { bojaBordera, debljinaBorderaRanga, nazivAvatara, putanjaAvatara } from '$lib/avatari.js';
  import { ZADANI_AVATAR_CONFIG, type AvatarConfigV1, type RazinaVatre } from 'zajednicko';
  import AvatarKonfiguracijaPreview from './AvatarKonfiguracijaPreview.svelte';
  import AvatarVatra from './AvatarVatra.svelte';

  interface Props {
    avatarId: number;
    rang?: string | null;
    /** Gost bez spremljene konfiguracije prikazuje zadani avatar (bez „Gost” oznake). */
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
  const altTekst = $derived(opisSlike ?? nazivAvatara(avatarId));

  const border = $derived(!prikaziRangBorder || vanjskaSlika ? null : bojaBordera(rang));
  const debljina = $derived(border ? debljinaBorderaRanga(velicina) : 0);
  const konfiguracijaPrikaza = $derived(avatarConfig ?? (gost ? ZADANI_AVATAR_CONFIG : null));
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
        <img class="vanjska-slika" src={vanjskaSlika} alt={altTekst} />
      {:else if konfiguracijaPrikaza}
        <AvatarKonfiguracijaPreview konfiguracija={konfiguracijaPrikaza} velicina={velicina} />
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
</style>
