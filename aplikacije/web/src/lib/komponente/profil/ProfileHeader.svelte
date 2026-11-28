<script lang="ts">
  import { onMount } from 'svelte';
  import { Pencil } from 'lucide-svelte';
  import Avatar from '$lib/komponente/Avatar.svelte';
  import DostignucaIstaknuta from '$lib/komponente/DostignucaIstaknuta.svelte';
  import StilIgrePojasnjenje from '$lib/komponente/StilIgrePojasnjenje.svelte';
  import { formaTroboja, type JavniDioProfila } from './tipovi.js';
  import { zabiljeziUmamiDogadjaj } from '$lib/umami.js';

  let {
    profil,
    vlasnik = false,
    stilId = 'stil-igre-profil',
  }: {
    profil: JavniDioProfila;
    vlasnik?: boolean;
    stilId?: string;
  } = $props();

  let velicinaAvatara = $state(120);
  const forma = $derived(formaTroboja(profil));
  const jeGost = $derived(!('email' in profil) ? false : !(profil as { email?: string | null }).email);

  onMount(() => {
    const prilagodi = () => {
      const sirina = window.innerWidth;
      if (sirina >= 1000) velicinaAvatara = 120;
      else if (sirina < 380) velicinaAvatara = 72;
      else velicinaAvatara = 88;
    };
    prilagodi();
    window.addEventListener('resize', prilagodi);
    return () => window.removeEventListener('resize', prilagodi);
  });
</script>

<div class="profil-zaglavlje-red">
  <div class="zaglavlje-profila">
    {#if vlasnik}
      <a
        class="avatar-uredivanje"
        href="/profil/avatar"
        aria-label="Uredi avatar"
        onclick={() =>
          zabiljeziUmamiDogadjaj('avatar-uredjivanje-otvoreno', { izvor: 'profil' })}
      >
        <Avatar
          avatarId={profil.avatarId}
          avatarConfig={profil.avatarConfig}
          avatarSlikaHash={profil.avatarSlikaHash}
          rang={profil.rang === 'Piskaralo' ? null : profil.rang}
          gost={jeGost}
          velicina={velicinaAvatara}
          razinaVatre={forma?.razinaVatre ?? 0}
          nizPobjeda={forma?.trenutniNiz ?? 0}
        />
        <span class="ikona-uredi" aria-hidden="true">
          <Pencil size={20} strokeWidth={2.2} />
        </span>
      </a>
    {:else}
      <div class="avatar-omotac">
        <Avatar
          avatarId={profil.avatarId}
          avatarConfig={profil.avatarConfig}
          avatarSlikaHash={profil.avatarSlikaHash}
          rang={profil.rang === 'Piskaralo' ? null : profil.rang}
          gost={false}
          velicina={velicinaAvatara}
          razinaVatre={forma?.razinaVatre ?? 0}
          nizPobjeda={forma?.trenutniNiz ?? 0}
        />
      </div>
    {/if}

    <div class="profil-identitet">
      <h1>{profil.nadimak}</h1>
      <span class="rang-oznaka">{profil.rang ?? 'Piskaralo'}</span>
      <div class="iskustvo-profila">
        <strong>LVL {profil.iskustvo.razina}</strong>
        {#if profil.iskustvo.doIduce === null}
          <span>MAX</span>
        {:else}
          <span>{profil.iskustvo.uRazini} / {profil.iskustvo.doIduce} XP</span>
          <div
            class="traka-iskustva"
            aria-label={`Napredak do sljedeće razine: ${profil.iskustvo.uRazini} od ${profil.iskustvo.doIduce} XP`}
          >
            <span style={`width: ${(profil.iskustvo.uRazini / profil.iskustvo.doIduce) * 100}%`}></span>
          </div>
          <small>Još {profil.iskustvo.doIduce - profil.iskustvo.uRazini} XP do sljedeće razine</small>
        {/if}
      </div>
      <StilIgrePojasnjenje stilIgre={profil.stilIgre} id={stilId} />
    </div>

    <div class="profil-sazetak">
      <DostignucaIstaknuta dostignuca={profil.dostignuca.dostignuca} />
    </div>
  </div>
</div>

<style>
  .profil-zaglavlje-red { min-width: 0; }
  .zaglavlje-profila {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) minmax(220px, 0.9fr);
    align-items: start;
    gap: 16px;
    min-width: 0;
  }
  .avatar-uredivanje, .avatar-omotac {
    position: relative;
    display: block;
    flex: 0 0 auto;
    margin: 0;
    padding: 0;
    color: inherit;
    text-decoration: none;
  }
  .ikona-uredi {
    position: absolute;
    z-index: 555;
    right: 4px;
    bottom: 4px;
    display: inline-grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 1px solid var(--boja-obrub);
    background: var(--boja-povrsina);
    color: var(--boja-tekst-osnovni);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18);
  }
  .profil-identitet { min-width: 0; display: grid; gap: 4px; }
  .profil-identitet h1 {
    margin: 0;
    font-family: var(--font-naslov);
    font-size: clamp(1.8rem, 4vw, 2.8rem);
    line-height: 1.1;
    overflow-wrap: anywhere;
  }
  .rang-oznaka {
    color: var(--boja-akcent);
    font-family: var(--font-naslov);
    font-size: 1.35rem;
    font-weight: 800;
    line-height: 1.1;
  }
  .iskustvo-profila {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 6px;
    font-size: var(--tekst-mali);
  }
  .iskustvo-profila strong { color: var(--boja-isticanje-tekst); font-size: 1.25rem; }
  .iskustvo-profila small {
    width: 100%;
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-sitni);
  }
  .traka-iskustva {
    width: min(220px, 100%);
    max-width: 100%;
    height: 8px;
    overflow: hidden;
    border-radius: 4px;
    background: var(--boja-obrub);
  }
  .traka-iskustva span {
    display: block;
    height: 100%;
    background: var(--boja-isticanje-slova);
  }
  .profil-sazetak {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
    min-width: 0;
    padding-top: 2px;
  }

  @media (max-width: 999px) {
    .zaglavlje-profila {
      grid-template-columns: auto minmax(0, 1fr);
      grid-template-rows: auto auto;
      column-gap: 12px;
      row-gap: 12px;
    }
    .avatar-uredivanje, .avatar-omotac { grid-column: 1; grid-row: 1; }
    .profil-identitet { grid-column: 2; grid-row: 1; }
    .profil-sazetak {
      grid-column: 1 / -1;
      grid-row: 2;
      align-items: stretch;
    }
    .profil-sazetak :global(.dostignuca-istaknuta) {
      width: 100%;
      margin-left: 0;
    }
    .profil-sazetak :global(.popis) {
      justify-content: start;
      max-width: none;
    }
  }
</style>
