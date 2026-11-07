<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';
  import { osvjeziGostSesijuNakon401 } from '$lib/identitet.js';
  import { vratiVeciRang, type AvatarConfigV1 } from 'zajednicko';
  import Avatar from './Avatar.svelte';
  import SanducicIkona from './SanducicIkona.svelte';

  interface Profil {
    nadimak: string;
    avatarId: number;
    rang: string | null;
    rang1v1: string | null;
    email: string | null;
    avatarConfig: AvatarConfigV1 | null;
  }

  let profil = $state<Profil | null>(null);
  let jeGost = $state(true);
  let ucitavanjeProfila = false;
  let zakazanoUcitavanje = false;

  async function ucitajProfil(pokusaji = 3) {
    // Vanjski identitet event usred loada — jedan follow-up, bez do/while petlje.
    if (ucitavanjeProfila) {
      zakazanoUcitavanje = true;
      return;
    }
    ucitavanjeProfila = true;
    try {
      let oporavakOdrađen = false;
      let pokusaj = 0;
      while (pokusaj < pokusaji) {
        try {
          const odgovor = await api<Profil>('/profil');
          profil = odgovor;
          jeGost = !odgovor.email;
          return;
        } catch {
          if (!oporavakOdrađen) {
            oporavakOdrađen = true;
            // Bez identitet eventa — inače bismo opet ušli u ovaj loader i mintali goste u petlji.
            await osvjeziGostSesijuNakon401({ emitirajIdentitet: false }).catch(() => {});
            continue; // isti pokusaj brojač: jedan free retry nakon zamjene tokena
          }
          pokusaj += 1;
          if (pokusaj < pokusaji) await new Promise((r) => setTimeout(r, 250 * pokusaj));
        }
      }
      profil = null;
      jeGost = true;
    } finally {
      ucitavanjeProfila = false;
      if (zakazanoUcitavanje) {
        zakazanoUcitavanje = false;
        void ucitajProfil();
      }
    }
  }

  onMount(() => {
    const azurirajAvatar = (dogadaj: Event) => {
      const detalji = (dogadaj as CustomEvent<{ avatarConfig: AvatarConfigV1 }>).detail;
      profil = profil ? { ...profil, avatarConfig: detalji.avatarConfig } : profil;
    };
    const azurirajIdentitet = () => void ucitajProfil();
    window.addEventListener('kaladont:avatar-promijenjen', azurirajAvatar);
    window.addEventListener('kaladont:identitet-promijenjen', azurirajIdentitet);
    void ucitajProfil();
    return () => {
      window.removeEventListener('kaladont:avatar-promijenjen', azurirajAvatar);
      window.removeEventListener('kaladont:identitet-promijenjen', azurirajIdentitet);
    };
  });
</script>

{#if profil}
  <div class="sanducic-profil-traka">
    <div class="sanducic-profil-zona" aria-label="Profil i obavijesti">
      <SanducicIkona velicina={44} />
      <a href="/profil" class="profil-link" aria-label="Profil: {profil.nadimak}">
        <Avatar
          avatarId={profil.avatarId}
          avatarConfig={profil.avatarConfig}
          rang={vratiVeciRang(profil.rang, profil.rang1v1)}
          gost={jeGost}
          velicina={44}
        />
      </a>
    </div>
  </div>
{/if}

<style>
  /* Ista širina/padding kao Header .header-sadrzaj — avatar na istom mjestu kao na /profil. */
  .sanducic-profil-traka {
    position: absolute;
    top: 6px;
    left: 0;
    right: 0;
    z-index: 5;
    width: 100%;
    pointer-events: none;
  }

  .sanducic-profil-zona {
    width: 100%;
    max-width: 100%;
    margin: 0 auto;
    padding: 8px 16px;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 16px;
    pointer-events: auto;
  }

  @media (min-width: 1000px) {
    .sanducic-profil-zona {
      max-width: 980px;
    }
  }

  .profil-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 44px;
    min-height: 44px;
    color: var(--boja-tekst-osnovni);
    text-decoration: none;
  }
</style>
