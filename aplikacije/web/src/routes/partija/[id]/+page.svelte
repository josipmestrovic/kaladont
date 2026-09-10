<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { api } from '$lib/api.js';
  import { dohvatiSocket } from '$lib/socket.js';
  import { jeRegistriranKorisnik } from '$lib/identitet.js';
  import { dohvatiStanjeIgre } from '$lib/stanje-igre.svelte.js';
  import RaniPristupBaner from '$lib/komponente/RaniPristupBaner.svelte';
  import Avatar from '$lib/komponente/Avatar.svelte';
  import TimerPrsten from '$lib/komponente/TimerPrsten.svelte';
  import { pustiAudio } from '$lib/audio-manager.js';
  import { zadnjaDva } from 'zajednicko';
  import type { BrzaPoruka, Eliminacija, PrihvacenPotez, RundaOtvorena } from 'zajednicko';

  const stanje = dohvatiStanjeIgre();
  const partijaId = $derived($page.params.id);

  let unosRijeci = $state('');
  let prijavaDijalog = $state(false);
  let prijavaPoruka = $state('');
  let prijavaPotezId: number | null = $state(null);
  let izlazakDijalog = $state(false);
  let potezi = $state<Potez[]>([]);
  let prikazanaRijec = $state<Potez | null>(null);
  let prethodnaRijecStola = $state<string | null>(null);
  let prikaziRezultate = $state(false);
  let sekundeDoRezultata = $state(10);
  let odbrojavanjeIntervalId: ReturnType<typeof setInterval> | null = null;
  type VrstaReakcije = BrzaPoruka | 'tuzan';
  let reakcije = $state<{ id: number; igracId: string; poruka: VrstaReakcije }[]>([]);
  let sljedeciIdReakcije = 0;

  interface Potez {
    id: number;
    redniBroj: number;
    igracId: string | null;
    vrsta: string;
    rijec: string | null;
    trazenaSlova: string | null;
    vrijeme: string;
  }

  const BRZE_PORUKE = [
    { poruka: 'pozdrav' as const, tekst: '👋 Pozdrav!' },
    { poruka: 'sorry' as const, tekst: '😅 Sorry!' },
    { poruka: 'dobro-odigrano' as const, tekst: '👏 Dobro odigrano!' },
    { poruka: 'najjaci' as const, tekst: '😎 Hvala' },
  ];

  function posaljiPotez() {
    if (!unosRijeci.trim()) return;
    dohvatiSocket().emit('potez:rijec', { rijec: unosRijeci.trim() });
    unosRijeci = '';
  }

  function neZnam() {
    dohvatiSocket().emit('potez:ne-znam');
  }

  function posaljiReakciju(poruka: 'pozdrav' | 'sorry' | 'dobro-odigrano' | 'najjaci') {
    dohvatiSocket().emit('reakcija:posalji', { poruka });
  }

  function imeIgraca(igracId: string): string {
    if (igracId === stanje.mojIgracId) return 'Ti';
    return stanje.sjedala.find((s) => s.igracId === igracId)?.nadimak ?? igracId;
  }

  async function otstvoriDijalogZaPrijavu(potezId?: number) {
    prijavaPoruka = '';
    prijavaPotezId = potezId ?? null;
    prijavaDijalog = true;
  }

  async function posaljiPrijavu() {
    if (!prijavaPoruka.trim()) return;
    try {
      await api('/prijave', {
        method: 'POST',
        body: JSON.stringify({
          partijaId,
          potezId: prijavaPotezId,
          poruka: prijavaPoruka.trim(),
        }),
      });
      prijavaDijalog = false;
      alert('Hvala! Pregledat ćemo prijavu.');
    } catch (err) {
      console.error('Greška pri slanju prijave:', err);
      alert('Greška pri slanju prijave.');
    }
  }

  function opisPoteza(potez: Potez): string {
    if (potez.vrsta === 'ne_znam') return 'Ne znam';
    if (potez.vrsta === 'sustav_rijec') return `Sustav: ${potez.rijec ?? 'automatska riječ'}`;
    return potez.rijec ?? potez.vrsta;
  }

  function zadnjiPotezIgraca(igracId: string): Potez | null {
    return prikazanaRijec?.igracId === igracId ? prikazanaRijec : null;
  }

  function pobjednikPartije() {
    return stanje.kraj?.plasmani.find((igrac) => igrac.plasman === 1) ?? null;
  }

  function zatvoriDijlog() {
    prijavaDijalog = false;
    prijavaPoruka = '';
  }

  function zatraziIzlazak() {
    if (jeEliminiran) {
      dohvatiSocket().emit('partija:izadji');
      goto('/');
      return;
    }
    izlazakDijalog = true;
  }

  function potvrdiIzlazak() {
    izlazakDijalog = false;
    dohvatiSocket().emit('partija:izadji');
    goto('/');
  }

  const jeNaPotezu = $derived(stanje.naPotezuId === stanje.mojIgracId);
  const jeEliminiran = $derived(stanje.eliminacije.some((e) => e.igracId === stanje.mojIgracId));
  const brojPreostalihIgraca = $derived(stanje.sjedala.length - stanje.eliminacije.length);

  let unosInput: HTMLInputElement | null = $state(null);

  function zadrziPrefiksRijeci(event: KeyboardEvent) {
    if (!jeNaPotezu || !stanje.trazenaSlova) return;

    const prefiks = stanje.trazenaSlova.normalize('NFC').trim().toLowerCase();
    const target = event.currentTarget as HTMLInputElement;
    const selectionStart = target.selectionStart ?? target.value.length;
    const selectionEnd = target.selectionEnd ?? selectionStart;
    const jeUPrefiksu = selectionStart <= prefiks.length && selectionEnd <= prefiks.length;

    if ((event.key === 'Backspace' || event.key === 'Delete') && jeUPrefiksu) {
      event.preventDefault();
      return;
    }

    if (event.key === 'ArrowLeft' && selectionStart <= prefiks.length) {
      event.preventDefault();
      target.setSelectionRange(prefiks.length, prefiks.length);
    }
  }

  $effect(() => {
    if (!jeNaPotezu || !stanje.trazenaSlova) return;

    const prefiks = stanje.trazenaSlova.normalize('NFC').trim();
    const trenutna = unosRijeci.normalize('NFC').trim();

    if (!trenutna.toLowerCase().startsWith(prefiks.toLowerCase())) {
      unosRijeci = prefiks;
      queueMicrotask(() => {
        unosInput?.focus();
        const kraj = prefiks.length;
        unosInput?.setSelectionRange(kraj, kraj);
      });
    }
  });

  let sustavBrojac = $state(5);
  let sustavBrojacIntervalId: ReturnType<typeof setInterval> | null = null;

  $effect(() => {
    if (!stanje.sustavBiraRijec || !stanje.istekIzboraIso) {
      if (sustavBrojacIntervalId !== null) {
        clearInterval(sustavBrojacIntervalId);
        sustavBrojacIntervalId = null;
      }
      return;
    }
    const istekMs = new Date(stanje.istekIzboraIso).getTime();
    const azurirajBrojac = () => {
      sustavBrojac = Math.max(0, Math.ceil((istekMs - Date.now()) / 1000));
    };
    azurirajBrojac();
    sustavBrojacIntervalId = setInterval(azurirajBrojac, 250);
    return () => {
      if (sustavBrojacIntervalId !== null) clearInterval(sustavBrojacIntervalId);
      sustavBrojacIntervalId = null;
    };
  });

  $effect(() => {
    if (!stanje.kraj || odbrojavanjeIntervalId !== null) return;
    prikaziRezultate = false;
    sekundeDoRezultata = 10;
    odbrojavanjeIntervalId = setInterval(() => {
      sekundeDoRezultata -= 1;
      if (sekundeDoRezultata <= 0) {
        if (odbrojavanjeIntervalId !== null) clearInterval(odbrojavanjeIntervalId);
        odbrojavanjeIntervalId = null;
        prikaziRezultate = true;
        pustiAudio('partija-kraj');
      }
    }, 1000);
  });

  async function ucitajPoteze(prikaziZadnjuRijec = true) {
    try {
      const odgovor = await api<{ potezi: Potez[] }>(`/partije/${partijaId}/potezi`);
      potezi = odgovor.potezi;
      if (prikaziZadnjuRijec) {
        const sRijeci = odgovor.potezi.filter((potez) => potez.rijec);
        prikazanaRijec = sRijeci.at(-1) ?? null;
        prethodnaRijecStola =
          prikazanaRijec && prikazanaRijec.vrsta !== 'sustav_rijec' ? (sRijeci.at(-2)?.rijec ?? null) : null;
      }
    } catch {
      // prolazna greška - zadrži postojeću povijest umjesto brisanja
    }
  }

  const REAKCIJE_EMOJI: Record<BrzaPoruka, string> = {
    pozdrav: '👋',
    sorry: '😅',
    'dobro-odigrano': '👏',
    najjaci: '😎',
  };
  const REAKCIJE_EMOJI_PROSIRENE: Record<VrstaReakcije, string> = { ...REAKCIJE_EMOJI, tuzan: '😢' };

  const REAKCIJE_TEKST: Record<BrzaPoruka, string> = {
    pozdrav: 'Pozdrav!',
    sorry: 'Sorry!',
    'dobro-odigrano': 'Dobro odigrano!',
    najjaci: 'Hvala',
  };
  const REAKCIJE_TEKST_PROSIRENE: Record<VrstaReakcije, string> = { ...REAKCIJE_TEKST, tuzan: 'Ne znam' };

  onMount(() => {
    void ucitajPoteze();

    const socket = dohvatiSocket();

    const naReakciju = ({ igracId, poruka }: { igracId: string; poruka: BrzaPoruka }) => {
      const id = sljedeciIdReakcije++;
      reakcije = [...reakcije, { id, igracId, poruka }];
      window.setTimeout(() => {
        reakcije = reakcije.filter((reakcija) => reakcija.id !== id);
      }, 2200);
    };

    const naEliminaciju = (eliminacija: Eliminacija) => {
      // Ubojita riječ (mrtva slova/kaladont) nikad ne stiže kroz potez:prihvacen - prikaži je iz eliminacije
      if (eliminacija.rijecUzrok && eliminacija.rijecUzrok !== prikazanaRijec?.rijec) {
        prethodnaRijecStola = prikazanaRijec?.rijec ?? null;
        prikazanaRijec = {
          id: -Date.now(),
          redniBroj: 0,
          igracId: eliminacija.bodZa,
          vrsta: 'rijec',
          rijec: eliminacija.rijecUzrok,
          trazenaSlova: null,
          vrijeme: new Date().toISOString(),
        };
      }
      if (eliminacija.razlog !== 'ne_znam') return;
      const id = sljedeciIdReakcije++;
      reakcije = [...reakcije, { id, igracId: eliminacija.igracId, poruka: 'tuzan' }];
      window.setTimeout(() => {
        reakcije = reakcije.filter((reakcija) => reakcija.id !== id);
      }, 2200);
    };

    // Jedini izvor istine za trenutnu riječ su socket događaji - REST lista služi samo za povijest
    // (fire-and-forget upis u bazu znači da refetch odmah nakon eventa može vratiti stariju listu).
    const naPrihvacenPotez = (potez: PrihvacenPotez) => {
      prethodnaRijecStola = prikazanaRijec?.rijec ?? null;
      prikazanaRijec = {
        id: -Date.now(),
        redniBroj: 0,
        igracId: potez.igracId,
        vrsta: 'rijec',
        rijec: potez.rijec,
        trazenaSlova: potez.trazenaSlova,
        vrijeme: new Date().toISOString(),
      };
    };

    const naSustavBira = () => {
      prikazanaRijec = null;
      prethodnaRijecStola = null;
    };

    const naRunduOtvorenu = (runda: RundaOtvorena) => {
      prethodnaRijecStola = null;
      prikazanaRijec = {
        id: -Date.now(),
        redniBroj: 0,
        igracId: null,
        vrsta: 'sustav_rijec',
        rijec: runda.rijec,
        trazenaSlova: runda.trazenaSlova,
        vrijeme: new Date().toISOString(),
      };
    };

    const naKraj = () => void ucitajPoteze(false);

    socket.on('reakcija:nova', naReakciju);
    socket.on('partija:eliminacija', naEliminaciju);
    socket.on('potez:prihvacen', naPrihvacenPotez);
    socket.on('partija:sustav-bira-rijec', naSustavBira);
    socket.on('partija:runda-otvorena', naRunduOtvorenu);
    socket.on('partija:kraj', naKraj);

    return () => {
      socket.off('reakcija:nova', naReakciju);
      socket.off('partija:eliminacija', naEliminaciju);
      socket.off('potez:prihvacen', naPrihvacenPotez);
      socket.off('partija:sustav-bira-rijec', naSustavBira);
      socket.off('partija:runda-otvorena', naRunduOtvorenu);
      socket.off('partija:kraj', naKraj);
    };
  });
</script>

{#snippet trenutnaRijec(rijec: string)}
  {@const zavrsetak = zadnjaDva(rijec)}
  <strong class="trenutna-rijec">{rijec.slice(0, rijec.length - zavrsetak.length)}<span class="trenutna-rijec-zavrsetak">{zavrsetak}</span></strong>
{/snippet}

{#if stanje.kraj && prikaziRezultate}
  <h2>Konačni rezultati</h2>
  <ol class="plasmani-lista">
    {#each [...stanje.kraj.plasmani].sort((a, b) => a.plasman - b.plasman) as igrac (igrac.igracId)}
      <li class:pobjednik={igrac.plasman === 1}>
        <span class="plasman-broj">{igrac.plasman}.</span>
        <span class="plasman-ime">{imeIgraca(igrac.igracId)}</span>
        <span class="plasman-bodovi">{igrac.bodovi} bodova ({igrac.eliminacije} elim.)</span>
      </li>
    {/each}
  </ol>
  {#if !jeRegistriranKorisnik()}
    <p class="gost-poruka">
      Ova statistika je spremljena lokalno u ovom pregledniku. Registriraj se da je zadržiš zauvijek!
    </p>
    <a href="/registracija">Registriraj se</a>
  {/if}
  <a href="/red" class="igraj-opet-gumb">Igraj opet</a>
  <section class="povijest-partije">
    <h3>Povijest partije</h3>
    {#if potezi.length === 0}
      <p>Potezi još nisu dostupni.</p>
    {:else}
      <ol>
        {#each potezi as potez (potez.id)}
          <li>
            <span><strong>{potez.igracId ? imeIgraca(potez.igracId) : 'Sustav'}</strong>: {opisPoteza(potez)}</span>
            <button type="button" class="prijavi-btn" onclick={() => otstvoriDijalogZaPrijavu(potez.id)}>Prijavi</button>
          </li>
        {/each}
      </ol>
    {/if}
  </section>
{:else}
  <div class="partija-header">
    {#if !stanje.kraj}
      <button type="button" class="izlaz-gumb" onclick={zatraziIzlazak}>Izađi</button>
    {/if}
  </div>
  <ul class="igraci-red">
    {#each stanje.sjedala as sjedalo (sjedalo.igracId)}
      <li class:naPotezu={sjedalo.igracId === stanje.naPotezuId} class:eliminiran={stanje.eliminacije.some((e) => e.igracId === sjedalo.igracId)}>
        {#each reakcije.filter((reakcija) => reakcija.igracId === sjedalo.igracId) as reakcija (reakcija.id)}
          <div class="reakcija-oblak" role="status">
            <span aria-hidden="true">{REAKCIJE_EMOJI_PROSIRENE[reakcija.poruka]}</span>
            {REAKCIJE_TEKST_PROSIRENE[reakcija.poruka]}
          </div>
        {/each}
        <div class="avatar-omot">
          <Avatar avatarId={sjedalo.avatarId} rang={sjedalo.rang} velicina={48} />
          {#if sjedalo.igracId === stanje.naPotezuId && stanje.istekPotezaIso && !stanje.kraj}
            <TimerPrsten istekIso={stanje.istekPotezaIso} velicina={56} />
          {/if}
        </div>
        <span class="ime-igraca">{sjedalo.nadimak}{sjedalo.igracId === stanje.mojIgracId ? ' (ti)' : ''}</span>
        {#if sjedalo.igracId === stanje.naPotezuId && !stanje.kraj}
          <span class="na-potezu-oznaka">Na redu!</span>
        {:else if zadnjiPotezIgraca(sjedalo.igracId)}
          <span class="zadnja-rijec">{zadnjiPotezIgraca(sjedalo.igracId)?.rijec}</span>
        {/if}
      </li>
    {/each}
  </ul>

  <div class="brze-poruke">
    {#each BRZE_PORUKE as brzaPoruka (brzaPoruka.poruka)}
      <button type="button" onclick={() => posaljiReakciju(brzaPoruka.poruka)}>
        <span aria-hidden="true">{REAKCIJE_EMOJI[brzaPoruka.poruka]}</span>
        {REAKCIJE_TEKST[brzaPoruka.poruka]}
      </button>
    {/each}
  </div>

  <section class="bijela-zona-igre">
    {#if stanje.kraj}
      <div class="zavrsni-sazetak">
        {#if prikazanaRijec?.rijec}
          <p class="kontekst-rijeci posljednji-potez">
            Posljednji potez:
            <strong>{prikazanaRijec.igracId ? imeIgraca(prikazanaRijec.igracId) : 'Sustav'}</strong>
            je napisao/la {@render trenutnaRijec(prikazanaRijec.rijec)}
            {#if prethodnaRijecStola} na prethodnu riječ {prethodnaRijecStola}{/if}
          </p>
        {/if}
        <p class="sazetak-uvod">Evo što se dogodilo:</p>
        {#if stanje.eliminacije.length > 0}
          <ol class="dogadaji-partije">
            {#each stanje.eliminacije as eliminacija, indeks (indeks)}
              <li>
                <strong>{imeIgraca(eliminacija.igracId)}</strong>
                {#if eliminacija.razlog.startsWith('mrtva_slova')}
                  ispao/ispala je jer nakon riječi
                  <strong>{eliminacija.rijecUzrok ?? 'prethodne riječi'}</strong> nije bilo riječi na
                  <strong>{eliminacija.slova?.toUpperCase() ?? 'tražena slova'}</strong>.
                {:else if eliminacija.razlog === 'ne_znam'}
                  predao/predala je potez.
                {:else if eliminacija.razlog === 'istek'}
                  ispao/ispala je zbog isteka vremena.
                {:else if eliminacija.razlog === 'kaladont'}
                  ispao/ispala je jer je omogućio/omogućila
                  <strong>{eliminacija.rijecUzrok ?? 'Kaladont'}</strong>
                  koji je izveo/izvela
                  <strong>{eliminacija.bodZa ? imeIgraca(eliminacija.bodZa) : 'drugi igrač'}</strong>.
                {:else}
                  napustio/napustila je partiju.
                {/if}
              </li>
            {/each}
          </ol>
        {/if}
        {#if pobjednikPartije()}
          <p class="pobjednik-sazetak"><strong>{imeIgraca(pobjednikPartije()!.igracId)}</strong> je pobjednik/pobjednica!</p>
        {/if}
        <p class="odbrojavanje-najava" aria-live="polite">
          Finalni prikaz rezultata i zaključivanje partije za <strong>{sekundeDoRezultata}</strong>
          {sekundeDoRezultata === 1 ? 'sekundu' : 'sekundi'}...
        </p>
      </div>
    {:else if stanje.sustavBiraRijec}
      <div class="sustav-bira-inline" aria-live="polite">
        {#if stanje.zadnjaEliminacija}
          <p class="sustav-bira-obrazlozenje">
            {#if stanje.zadnjaEliminacija.razlog.startsWith('mrtva_slova') && stanje.zadnjaEliminacija.rijecUzrok}
              <strong>{stanje.zadnjaEliminacija.bodZa ? imeIgraca(stanje.zadnjaEliminacija.bodZa) : 'Sustav'}</strong>
              je rekao/rekla riječ <strong>{stanje.zadnjaEliminacija.rijecUzrok}</strong>, pa je
              <strong>{imeIgraca(stanje.zadnjaEliminacija.igracId)}</strong> ispao/ispala jer nema riječi na
              <strong>{stanje.zadnjaEliminacija.slova?.toUpperCase() ?? 'tražena slova'}</strong>.
            {:else}
              <strong>{imeIgraca(stanje.zadnjaEliminacija.igracId)}</strong>
              {#if stanje.zadnjaEliminacija.razlog.startsWith('mrtva_slova')}
                je ispao/ispala jer nema riječi na
                <strong>{stanje.zadnjaEliminacija.slova?.toUpperCase() ?? 'tražena slova'}</strong>.
              {:else if stanje.zadnjaEliminacija.razlog === 'ne_znam'}
                je predao/predala potez.
              {:else if stanje.zadnjaEliminacija.razlog === 'kaladont'}
                je eliminiran/eliminirana jer je omogućio/omogućila Kaladont koji je izveo/izvela
                <strong>{stanje.zadnjaEliminacija.bodZa ? imeIgraca(stanje.zadnjaEliminacija.bodZa) : 'drugi igrač'}</strong>.
              {:else if stanje.zadnjaEliminacija.razlog === 'istek'}
                je ispao/ispala zbog isteka vremena.
              {:else if stanje.zadnjaEliminacija.razlog === 'prekid'}
                je napustio/napustila partiju.
              {:else}
                je ispao/ispala iz partije.
              {/if}
            {/if}
          </p>
        {/if}
        <p class="sustav-bira-tekst">Sustav bira novu riječ za <strong>{sustavBrojac}</strong>…</p>
      </div>
    {:else}
      {#if stanje.trazenaSlova}
        <div class="rijec-kartica">
          {#key prikazanaRijec?.rijec ?? stanje.trazenaSlova}
            <div class="rijec-sadrzaj">
              <p class="trazena-slova">Traži se riječ na: <strong>{stanje.trazenaSlova.toUpperCase()}</strong></p>
              {#if prikazanaRijec?.rijec}
                <p class="kontekst-rijeci">
                  {#if prikazanaRijec.vrsta === 'sustav_rijec'}
                    {#if stanje.runda === 1}
                      Igra počinje, sustav je dodijelio:
                    {:else}
                      Ostaje {brojPreostalihIgraca} igrača, započinje nova runda. Sustav je dodijelio riječ:
                    {/if}
                    {@render trenutnaRijec(prikazanaRijec.rijec)}
                  {:else}
                    <strong>{prikazanaRijec.igracId ? imeIgraca(prikazanaRijec.igracId) : 'Sustav'}</strong>
                    je napisao/la {@render trenutnaRijec(prikazanaRijec.rijec)}
                    {#if prethodnaRijecStola} na prethodnu riječ {prethodnaRijecStola}{/if}
                  {/if}
                </p>
              {/if}
            </div>
          {/key}
        </div>
      {:else}
        <p class="priprema-partije">Partija počinje…</p>
      {/if}

    {#if stanje.zadnjaEliminacija}
      <p class="status-eliminacije">
        {#if stanje.zadnjaEliminacija.razlog.startsWith('mrtva_slova') && stanje.zadnjaEliminacija.rijecUzrok}
          <strong>{stanje.zadnjaEliminacija.bodZa ? imeIgraca(stanje.zadnjaEliminacija.bodZa) : 'Prethodni igrač'}</strong>
          je rekao/rekla riječ <strong>{stanje.zadnjaEliminacija.rijecUzrok}</strong>, pa je
          <strong>{imeIgraca(stanje.zadnjaEliminacija.igracId)}</strong> ispao/ispala jer nema riječi na
          <strong>{stanje.zadnjaEliminacija.slova?.toUpperCase() ?? 'tražena slova'}</strong>.
        {:else}
          <strong>{imeIgraca(stanje.zadnjaEliminacija.igracId)}</strong>
          {#if stanje.zadnjaEliminacija.razlog.startsWith('mrtva_slova')}
            je ispao/ispala jer nema riječi na
            <strong>{stanje.zadnjaEliminacija.slova?.toUpperCase() ?? 'tražena slova'}</strong>.
          {:else if stanje.zadnjaEliminacija.razlog === 'ne_znam'}
            je predao/predala potez.
          {:else if stanje.zadnjaEliminacija.razlog === 'kaladont'}
            je eliminiran/eliminirana jer je omogućio/omogućila Kaladont koji je izveo/izvela
            <strong>{stanje.zadnjaEliminacija.bodZa ? imeIgraca(stanje.zadnjaEliminacija.bodZa) : 'drugi igrač'}</strong>.
          {:else if stanje.zadnjaEliminacija.razlog === 'istek'}
            je ispao/ispala zbog isteka vremena.
          {:else if stanje.zadnjaEliminacija.razlog === 'prekid'}
            je napustio/napustila partiju.
          {:else}
            je ispao/ispala iz partije.
          {/if}
        {/if}
        {#if stanje.naPotezuId}
          <strong>{imeIgraca(stanje.naPotezuId)}</strong> je sada na redu.
        {/if}
      </p>
    {/if}

    {#if stanje.poruka}
      <p role="alert">{stanje.poruka}</p>
    {/if}

    {#if jeNaPotezu}
      <form onsubmit={(e) => { e.preventDefault(); posaljiPotez(); }}>
        {#if stanje.trazenaSlova}
          <p class="prefiks-uvjet">Riječ mora početi sa: <strong>{stanje.trazenaSlova.toUpperCase()}</strong></p>
        {/if}
        <input
          bind:this={unosInput}
          type="text"
          bind:value={unosRijeci}
          onkeydown={zadrziPrefiksRijeci}
          placeholder="Upiši riječ..."
          autocomplete="off"
        />
        <div class="potez-gumbi">
          <button type="submit">Pošalji</button>
          <button type="button" class="ne-znam-gumb" onclick={neZnam}>Ne znam</button>
        </div>
      </form>
    {:else if !jeEliminiran}
      <p class="ceka-na-potez">Čekaš na potez...</p>
    {:else}
      <p>Ispao/ispala si iz partije - gledaš kao promatrač.</p>
    {/if}
    {/if}
  </section>

{/if}

{#if stanje.kraj}
  <RaniPristupBaner onclickPrijavi={() => otstvoriDijalogZaPrijavu()} />
{/if}

{#if prijavaDijalog}
  <div
    class="dijalog-overlay"
    role="button"
    tabindex="0"
    onclick={zatvoriDijlog}
    onkeydown={(e) => e.key === 'Escape' && zatvoriDijlog()}
  >
    <div
      class="dijalog"
      role="dialog"
      aria-label="Prijavi problem"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
    >
      <h3>Prijavi problem</h3>
      <textarea bind:value={prijavaPoruka} placeholder="Opiši greške ili probleme..." rows="5"></textarea>
      <div class="dijalog-gumbi">
        <button onclick={posaljiPrijavu}>Pošalji prijavu</button>
        <button onclick={zatvoriDijlog}>Odustani</button>
      </div>
    </div>
  </div>
{/if}

{#if izlazakDijalog}
  <div
    class="dijalog-overlay"
    role="button"
    tabindex="0"
    onclick={() => (izlazakDijalog = false)}
    onkeydown={(e) => e.key === 'Escape' && (izlazakDijalog = false)}
  >
    <div
      class="dijalog"
      role="dialog"
      aria-label="Potvrdi izlazak"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
    >
      <h3>Sigurno izlaziš?</h3>
      <p>Bit ćeš eliminiran/eliminirana iz ove partije.</p>
      <div class="dijalog-gumbi">
        <button onclick={potvrdiIzlazak}>Da, izađi</button>
        <button onclick={() => (izlazakDijalog = false)}>Odustani</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .zavrsni-sazetak {
    padding: 8px 0 4px;
    text-align: center;
  }
  .posljednji-potez {
    margin: 0 0 16px;
  }
  .sazetak-uvod {
    margin: 0 0 16px;
    color: var(--boja-tekst-sekundarni);
    font-size: inherit;
  }
  .dogadaji-partije {
    max-width: 520px;
    margin: 0 auto;
    padding: 0 0 0 22px;
    text-align: left;
  }
  .dogadaji-partije li {
    padding: 6px 0;
    color: var(--boja-tekst-osnovni);
    font-size: inherit;
  }
  .pobjednik-sazetak {
    margin: 20px 0 12px;
    color: var(--boja-mint-tamni);
    font-family: var(--font-naslov);
    font-size: 21px;
  }
  .odbrojavanje-najava {
    margin: 16px 0 0;
    color: var(--boja-tekst-sekundarni);
    font-size: inherit;
  }
  .odbrojavanje-najava strong {
    color: var(--boja-akcent);
  }
  .naPotezu {
    font-weight: bold;
  }
  .eliminiran {
    text-decoration: line-through;
    opacity: 0.5;
  }
  .igraci-red {
    list-style: none;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 8px;
    row-gap: 16px;
    margin: 0 -16px;
    padding: 72px 16px 28px;
    background: var(--boja-pozadina-podloga);
  }
  .igraci-red li {
    position: relative;
    min-width: 0;
    width: 100%;
    min-height: 96px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    font-size: var(--tekst-mali);
  }
  .partija-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 48px;
    margin: 0 -16px;
    padding: 0 0 0 24px;
    background: transparent;
    border-bottom: 0;
    color: var(--boja-tekst-osnovni);
  }
  .avatar-omot {
    position: relative;
    width: 56px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .ime-igraca {
    font-family: var(--font-tijelo);
  }
  .na-potezu-oznaka {
    color: var(--boja-akcent);
    font-weight: bold;
    font-size: var(--tekst-mikro);
  }
  .rijec-kartica {
    min-height: 0;
    background: transparent;
    border-radius: 0;
    padding: 8px 0 4px;
    box-shadow: none;
    text-align: center;
  }
  .rijec-sadrzaj {
    animation: rijec-fade 220ms ease;
  }
  @keyframes rijec-fade {
    from { opacity: 0; transform: translateY(3px); }
    to { opacity: 1; transform: none; }
  }
  .priprema-partije {
    padding: 16px 0;
    color: var(--boja-tekst-sekundarni);
    text-align: center;
  }
  .ceka-na-potez {
    margin: 16px 0;
    text-align: center;
  }
  .bijela-zona-igre {
    margin: 0 -16px;
    padding: 8px 24px 24px;
    background: transparent;
  }
  .trazena-slova {
    font-family: var(--font-naslov);
    font-size: var(--tekst-rijec-stola);
    font-weight: 700;
  }
  .trazena-slova strong {
    color: var(--boja-isticanje-slova);
    background: var(--boja-tekst);
    padding: 2px 8px;
    border-radius: 6px;
  }
  .kontekst-rijeci {
    margin: 6px 0 0;
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-mali);
    font-weight: 400;
  }
  .trenutna-rijec {
    color: var(--boja-tekst-osnovni);
    font-size: var(--tekst-rijec-stola);
    font-weight: 700;
  }
  .trenutna-rijec-zavrsetak {
    color: var(--boja-akcent);
  }
  .status-eliminacije {
    margin: 8px 0 12px;
    padding: 10px 12px;
    border-left: 3px solid var(--boja-akcent);
    background: rgba(228, 87, 46, 0.08);
    color: var(--boja-tekst-osnovni);
    font-size: var(--tekst-mali);
  }
  .sustav-bira-inline {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 16px 0 8px;
    text-align: center;
  }
  .sustav-bira-obrazlozenje {
    max-width: 420px;
    margin: 0 auto;
    color: var(--boja-tekst-osnovni);
    font-size: var(--tekst-baza);
  }
  .sustav-bira-tekst {
    margin: 0;
    color: var(--boja-tekst-sekundarni);
    font-family: var(--font-naslov);
    font-size: var(--tekst-baza);
  }
  .sustav-bira-tekst strong {
    color: var(--boja-mint-tamni);
    font-size: var(--tekst-rijec-stola);
  }
  .zadnja-rijec {
    max-width: 100%;
    overflow: hidden;
    color: var(--boja-tekst-sekundarni);
    font-family: var(--font-naslov);
    font-size: inherit;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .izlaz-gumb {
    background: none;
    border: 1px solid var(--boja-akcent);
    color: var(--boja-akcent);
    border-radius: 999px;
    padding: 4px 14px;
    font-size: var(--tekst-mali);
    cursor: pointer;
  }
  form {
    display: block;
  }
  form input {
    width: 100%;
    height: 44px;
    padding: 0 16px;
    border: 1px solid var(--boja-tekst-sekundarni);
    border-radius: var(--radijus-pill);
    background: white;
    color: #2fa98c;
    font-family: var(--font-naslov);
    font-size: var(--tekst-rijec-stola);
    letter-spacing: 0.08em;
  }
  form button {
    width: 100%;
    height: 44px;
    margin-top: 8px;
    border: 0;
    border-radius: var(--radijus-pill);
    background: var(--boja-pozadina-primarna);
    color: white;
    font-weight: 600;
    cursor: pointer;
  }
  .potez-gumbi {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .potez-gumbi button {
    width: 100%;
    margin-top: 8px;
    font: inherit;
    font-size: var(--tekst-baza);
  }
  .ne-znam-gumb {
    display: block;
    width: 100%;
    height: 40px;
    margin-top: 8px;
    border: 0;
    border-radius: var(--radijus-pill);
    background: var(--boja-akcent);
    color: white;
    font: inherit;
    cursor: pointer;
  }
  .povijest-partije {
    margin: 12px 0 20px;
    padding: 12px 16px;
    border: 1px solid rgba(122, 114, 100, 0.35);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.45);
  }
  .povijest-partije h3 {
    margin-bottom: 8px;
  }
  .povijest-partije ol {
    margin: 0;
    padding-left: 22px;
  }
  .povijest-partije li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 0;
    border-bottom: 1px solid rgba(122, 114, 100, 0.15);
    font-size: var(--tekst-mali);
  }
  .povijest-partije li span {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .igraci-red + .rijec-kartica + p {
    margin: 0;
    padding: 0 24px 24px;
    background: white;
    color: var(--boja-akcent);
    font-size: var(--tekst-mali);
    text-decoration: underline;
  }
  .brze-poruke {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    margin: 0 -16px;
    padding: 14px 24px;
    background: var(--boja-pozadina-podloga);
    gap: 8px;
  }
  .brze-poruke button {
    width: 100%;
    min-width: 0;
    min-height: 32px;
    padding: 5px 10px;
    border: 1px solid var(--boja-tekst-sekundarni);
    border-radius: var(--radijus-pill);
    background: transparent;
    color: var(--boja-tekst-osnovni);
    font-size: var(--tekst-mali);
    cursor: pointer;
  }
  .brze-poruke button:hover,
  .brze-poruke button:focus-visible {
    border-color: var(--boja-mint);
    background: rgba(47, 169, 140, 0.1);
  }
  @media (min-width: 601px) {
    .brze-poruke {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }
  @media (max-width: 499px) {
    form button,
    form input,
    .ne-znam-gumb {
      width: 100%;
    }
  }
  @media (min-width: 500px) {
    form {
      display: block;
    }
    form button {
      width: 100%;
    }
    .ne-znam-gumb {
      display: block;
      width: 100%;
    }
  }
  .reakcija-oblak {
    position: absolute;
    z-index: 2;
    bottom: calc(100% + 2px);
    width: max-content;
    max-width: 140px;
    padding: 5px 9px;
    border: 1px solid rgba(122, 114, 100, 0.45);
    border-radius: 12px;
    background: white;
    color: var(--boja-tekst-osnovni);
    font-size: var(--tekst-mikro);
    white-space: nowrap;
    animation: reakcija-dolazak 2.2s ease both;
  }
  .reakcija-oblak::after {
    content: '';
    position: absolute;
    left: 50%;
    bottom: -5px;
    width: 8px;
    height: 8px;
    border-right: 1px solid rgba(122, 114, 100, 0.45);
    border-bottom: 1px solid rgba(122, 114, 100, 0.45);
    background: white;
    transform: translateX(-50%) rotate(45deg);
  }
  @keyframes reakcija-dolazak {
    0% { opacity: 0; transform: translateY(6px) scale(0.92); }
    12%, 78% { opacity: 1; transform: translateY(0) scale(1); }
    100% { opacity: 0; transform: translateY(-4px) scale(0.96); }
  }
  .gost-poruka {
    background: #f4c95d;
    color: #26221b;
    padding: 8px 12px;
    border-radius: 6px;
  }
  .kaladont-banner {
    background: #e4572e;
    color: #faf3e3;
    padding: 12px 16px;
    border-radius: 8px;
    font-weight: bold;
    text-align: center;
    animation: kaladont-pulse 0.4s ease-in-out;
  }
  .kaladont-banner + .igraci-red {
    padding-top: 72px;
  }
  @media (min-width: 601px) {
    .igraci-red {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }
  @keyframes kaladont-pulse {
    0% { transform: scale(0.95); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
  }
  .plasmani-lista {
    list-style: none;
    padding: 0;
  }
  .plasmani-lista li {
    display: flex;
    align-items: center;
    gap: 12px;
    background: white;
    border-radius: var(--radijus-kartica);
    padding: 12px 16px;
    margin-bottom: 8px;
  }
  .plasmani-lista li.pobjednik {
    background: var(--boja-isticanje-slova);
    font-weight: bold;
  }
  .plasman-broj {
    font-family: var(--font-naslov);
    font-size: 18px;
    width: 24px;
  }
  .plasman-ime {
    flex: 1;
  }
  .plasman-bodovi {
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-mali);
  }
  .igraj-opet-gumb {
    display: inline-block;
    background: var(--boja-pozadina-primarna);
    color: white;
    text-decoration: none;
    padding: 10px 24px;
    border-radius: var(--radijus-pill);
    margin-top: 12px;
    font-weight: bold;
  }
  .prijavi-btn {
    margin-left: 8px;
    padding: 4px 8px;
    font-size: var(--tekst-sitni);
    background: #ff6b6b;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  .prijavi-btn:hover {
    background: #ff5252;
  }

  .dijalog-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .dijalog {
    background: white;
    border-radius: 8px;
    padding: 20px;
    max-width: 400px;
    width: 90%;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  }

  .dijalog h3 {
    margin-top: 0;
    margin-bottom: 16px;
  }

  .dijalog textarea {
    width: 100%;
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-family: inherit;
    font-size: var(--tekst-baza);
    resize: none;
    box-sizing: border-box;
  }

  .dijalog-gumbi {
    display: flex;
    gap: 8px;
    margin-top: 16px;
    justify-content: flex-end;
  }

  .dijalog button {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: var(--tekst-baza);
  }

  .dijalog button:first-child {
    background: #0066cc;
    color: white;
  }

  .dijalog button:first-child:hover {
    background: #0052a3;
  }

  .dijalog button:last-child {
    background: #f0f0f0;
    color: #333;
  }

  .dijalog button:last-child:hover {
    background: #e0e0e0;
  }
</style>
