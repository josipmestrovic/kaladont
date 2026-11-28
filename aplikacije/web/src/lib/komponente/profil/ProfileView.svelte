<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { api } from '$lib/api.js';
  import AktivnostPartije from '$lib/komponente/AktivnostPartije.svelte';
  import KolekcijaRijeci from '$lib/komponente/KolekcijaRijeci.svelte';
  import PostavkeProfila from '$lib/komponente/PostavkeProfila.svelte';
  import ProfileHeader from './ProfileHeader.svelte';
  import ProfileTabs from './ProfileTabs.svelte';
  import ProfileOverview from './ProfileOverview.svelte';
  import ProfileAchievements from './ProfileAchievements.svelte';
  import {
    hashZaPogled,
    pogledIzHasha,
    type JavniProfil,
    type PogledProfila,
    type VlastitiProfil,
  } from './tipovi.js';
  import { zabiljeziUmamiDogadjaj } from '$lib/umami.js';

  let {
    nacin,
    igracId = null,
    prikazujePostavke = false,
  }: {
    nacin: 'vlastiti' | 'javni';
    igracId?: string | null;
    prikazujePostavke?: boolean;
  } = $props();

  let profil = $state<VlastitiProfil | JavniProfil | null>(null);
  let greska = $state<string | null>(null);
  let aktivniPogled = $state<PogledProfila>('pregled');
  let ucitaniPogledi = $state<Set<PogledProfila>>(new Set(['pregled']));
  let zahtjevId = 0;

  const vlasnik = $derived(nacin === 'vlastiti');
  const prikaziAktivnost = $derived(
    nacin === 'vlastiti'
      ? (profil as VlastitiProfil | null)?.vrsta === 'admin'
      : Boolean((profil as JavniProfil | null)?.mozeVidjetiAktivnost),
  );

  function promijeniPogled(pogled: PogledProfila, azurirajHash = true) {
    if (pogled === 'povijest' && !prikaziAktivnost) return;
    aktivniPogled = pogled;
    ucitaniPogledi = new Set([...ucitaniPogledi, pogled]);
    if (azurirajHash && typeof window !== 'undefined') {
      const cilj = hashZaPogled(pogled);
      if (window.location.hash !== cilj) {
        // Zadrži SvelteKit router state — null bi razbio Back / klijentsku navigaciju.
        history.replaceState(history.state, '', `${window.location.pathname}${window.location.search}${cilj}`);
      }
    }
  }

  async function primijeniHashPogled() {
    if (!profil) return;
    const izHasha = pogledIzHasha(window.location.hash);
    const cilj = izHasha ?? 'pregled';
    if (cilj === 'povijest' && !prikaziAktivnost) {
      promijeniPogled('pregled', true);
      return;
    }
    promijeniPogled(cilj, !izHasha);
    // Pregled je vrh stranice; smooth scroll tu zatvara tooltipe tijekom učitavanja.
    if (!izHasha || cilj === 'pregled') return;
    await tick();
    document.getElementById(cilj)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function ucitaj() {
    const id = ++zahtjevId;
    greska = null;
    profil = null;
    try {
      const putanja = nacin === 'vlastiti'
        ? '/profil'
        : `/profil/javni/${igracId}`;
      const odgovor = await api<VlastitiProfil | JavniProfil>(putanja);
      if (id !== zahtjevId) return;
      profil = odgovor;
      await primijeniHashPogled();
    } catch (e) {
      if (id !== zahtjevId) return;
      greska = e instanceof Error ? e.message : 'Neuspjelo dohvaćanje profila.';
    }
  }

  onMount(() => {
    const naPromjenuHasha = () => { void primijeniHashPogled(); };
    window.addEventListener('hashchange', naPromjenuHasha);
    return () => {
      window.removeEventListener('hashchange', naPromjenuHasha);
      zahtjevId += 1;
    };
  });

  $effect(() => {
    void nacin;
    void igracId;
    void ucitaj();
  });
</script>

<main class="profil-stranica">
  {#if greska}
    <p role="alert" class="greska">{greska}</p>
  {:else if profil}
    <ProfileHeader {profil} {vlasnik} stilId={vlasnik ? 'stil-igre-vlastiti' : 'stil-igre-javni'} />

    {#if prikazujePostavke && vlasnik}
      <PostavkeProfila />
    {:else}
      {#if vlasnik && (profil as VlastitiProfil).vrsta === 'gost'}
        <div class="gost-upozorenje">
          <div class="upozorenje-sadrzaj">
            <p>
              <strong>Igraš kao gost.</strong> Ovi podaci su privremeno spremljeni u ovom pregledniku i mogu biti izgubljeni brisanjem kolačića.
            </p>
            <a
              href="/registracija"
              class="cta-gumb"
              onclick={() => zabiljeziUmamiDogadjaj('registracija-klik', { izvor: 'profil' })}
            >Sačuvaj statistiku — Registriraj se</a>
          </div>
        </div>
      {/if}

      <ProfileTabs
        {aktivniPogled}
        {prikaziAktivnost}
        onPromjena={promijeniPogled}
      />

      {#if aktivniPogled === 'pregled'}
        <ProfileOverview {profil} />
      {/if}

      {#if aktivniPogled === 'dostignuca'}
        <ProfileAchievements {profil} {vlasnik} />
      {/if}

      {#if ucitaniPogledi.has('rijeci')}
        <div id="rijeci" hidden={aktivniPogled !== 'rijeci'}>
          <KolekcijaRijeci
            igracId={profil.igracId}
            igracNaziv={profil.nadimak}
            javni={nacin === 'javni'}
          />
        </div>
      {/if}

      {#if prikaziAktivnost && ucitaniPogledi.has('povijest')}
        <div hidden={aktivniPogled !== 'povijest'}>
          <AktivnostPartije igracId={profil.igracId} />
        </div>
      {/if}
    {/if}
  {:else}
    <section class="profil-ucitavanje" role="status" aria-label="Učitavanje profila" aria-busy="true">
      <div class="profil-ucitavanje-zaglavlje">
        <div class="profil-kostur profil-kostur-avatar"></div>
        <div class="profil-kostur-identitet">
          <div class="profil-kostur profil-kostur-ime"></div>
          <div class="profil-kostur profil-kostur-rang"></div>
          <div class="profil-kostur profil-kostur-xp"></div>
        </div>
      </div>
      <div class="profil-ucitavanje-tabovi">
        <div class="profil-kostur"></div>
        <div class="profil-kostur"></div>
        <div class="profil-kostur"></div>
      </div>
    </section>
  {/if}
</main>

<style>
  .profil-stranica {
    padding: 24px 0;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  .greska { color: var(--boja-akcent); }
  .gost-upozorenje {
    background: var(--boja-zlato-pozadina);
    border: 2px solid var(--boja-zlato-obrub);
    border-radius: var(--radijus-kartica);
    padding: 16px 20px;
  }
  .upozorenje-sadrzaj {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  .upozorenje-sadrzaj p { margin: 0; color: var(--boja-zlato-tekst); }
  .cta-gumb {
    display: inline-block;
    background: var(--boja-cta-pozadina);
    color: var(--boja-cta-tekst);
    font-weight: 700;
    text-decoration: none;
    padding: 10px 20px;
    border-radius: var(--radijus-kontrola);
    font-size: var(--tekst-sitni);
  }
  .profil-ucitavanje { display: grid; gap: 24px; min-height: 420px; }
  .profil-ucitavanje-zaglavlje {
    display: grid;
    grid-template-columns: 120px minmax(0, 1fr);
    gap: 16px;
  }
  .profil-kostur {
    border-radius: 8px;
    background: linear-gradient(90deg, var(--boja-obrub), var(--boja-povrsina-2), var(--boja-obrub));
    background-size: 200% 100%;
    animation: sjaj 1.2s linear infinite;
  }
  .profil-kostur-avatar { width: 120px; height: 120px; border-radius: 50%; }
  .profil-kostur-identitet { display: grid; gap: 10px; align-content: start; }
  .profil-kostur-ime { height: 36px; width: min(280px, 70%); }
  .profil-kostur-rang { height: 22px; width: 120px; }
  .profil-kostur-xp { height: 16px; width: 200px; }
  .profil-ucitavanje-tabovi {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }
  .profil-ucitavanje-tabovi .profil-kostur { height: 40px; }

  @keyframes sjaj {
    0% { background-position: 100% 0; }
    100% { background-position: -100% 0; }
  }
</style>
