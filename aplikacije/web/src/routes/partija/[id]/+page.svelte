<script lang="ts">
  import { onMount, tick } from 'svelte';
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

  let unosNastavkaRijeci = $state('');
  let prijavaDijalog = $state(false);
  let prijavaPoruka = $state('');
  let prijavaPotezId: number | null = $state(null);
  let slanjeUTijeku = $state(false);
  let porukaPoteza = $state<string | null>(null);
  let brojGreskeUnosa = $state(0);
  let porukaPotezaTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let potezi = $state<Potez[]>([]);
  let prikazanaRijec = $state<Potez | null>(null);
  let prethodnaRijecStola = $state<string | null>(null);
  let prikaziRezultate = $state(false);
  let sekundeDoRezultata = $state(10);
  let odbrojavanjeIntervalId: ReturnType<typeof setInterval> | null = null;
  type VrstaReakcije = BrzaPoruka | 'tuzan';
  let reakcije = $state<{ id: number; igracId: string; poruka: VrstaReakcije }[]>([]);
  let sljedeciIdReakcije = 0;
  let jeOtvorenIzbornikReakcija = $state(false);
  let reakcijeOnemogucene = $state(false);
  let reakcijeCooldownTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let vlastitoSjedaloGumb: HTMLButtonElement | null = $state(null);
  let gumbiReakcija: HTMLButtonElement[] = $state([]);
  let izbornikReakcija: HTMLDivElement | null = $state(null);
  let odskociAvatara = $state<Record<string, number>>({});
  let avatarJeNemiran = $state(false);
  let porukaNaPotezu = $state('');
  let prethodnoJeNaPotezu = $state(false);

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
    { poruka: 'pozdrav' as const, tekst: '👋 Prijatno' },
    { poruka: 'sorry' as const, tekst: '😅 Nemoj zamjerit' },
    { poruka: 'dobro-odigrano' as const, tekst: '👏 Bravo!' },
    { poruka: 'najjaci' as const, tekst: '😎 Hvala' },
  ];

  function posaljiPotez() {
    const rijec = `${prefiksRijeci}${unosNastavkaRijeci}`.trim();
    if (rijec.length <= prefiksRijeci.length || slanjeUTijeku) return;
    slanjeUTijeku = true;
    dohvatiSocket().emit('potez:rijec', { rijec });
    unosNastavkaRijeci = '';
  }

  function prikaziGreskuPoteza(poruka: string) {
    porukaPoteza = poruka;
    brojGreskeUnosa += 1;
    void tick().then(() => {
      unosInput?.focus();
    });
    if (porukaPotezaTimeoutId !== null) clearTimeout(porukaPotezaTimeoutId);
    porukaPotezaTimeoutId = setTimeout(() => {
      porukaPoteza = null;
      porukaPotezaTimeoutId = null;
    }, 2000);
  }

  async function otvoriIzbornikReakcija(event: MouseEvent) {
    if (reakcijeOnemogucene) return;
    jeOtvorenIzbornikReakcija = !jeOtvorenIzbornikReakcija;
    if (jeOtvorenIzbornikReakcija) {
      await tick();
      gumbiReakcija[0]?.focus();
    }
  }

  function zatvoriIzbornikReakcija(vratiFokus = false) {
    jeOtvorenIzbornikReakcija = false;
    if (vratiFokus) vlastitoSjedaloGumb?.focus();
  }

  function posaljiReakciju(poruka: BrzaPoruka) {
    if (reakcijeOnemogucene) return;
    dohvatiSocket().emit('reakcija:posalji', { poruka });
    zatvoriIzbornikReakcija(true);
    reakcijeOnemogucene = true;
    if (reakcijeCooldownTimeoutId !== null) clearTimeout(reakcijeCooldownTimeoutId);
    reakcijeCooldownTimeoutId = setTimeout(() => {
      reakcijeOnemogucene = false;
      reakcijeCooldownTimeoutId = null;
    }, 2000);
  }

  function napustiPartiju() {
    zatvoriIzbornikReakcija();
    dohvatiSocket().emit('partija:izadji');
    void goto('/');
  }

  function zatvoriIzbornikKlikomIzvan(event: MouseEvent) {
    const cilj = event.target;
    if (!(cilj instanceof Node) || !jeOtvorenIzbornikReakcija) return;
    if (
      izbornikReakcija?.contains(cilj) ||
      vlastitoSjedaloGumb?.contains(cilj)
    ) return;
    zatvoriIzbornikReakcija();
  }

  function imeIgraca(igracId: string): string {
    if (igracId === stanje.mojIgracId) return 'Ti';
    return stanje.sjedala.find((s) => s.igracId === igracId)?.nadimak ?? igracId;
  }

  function eliminacijaIgraca(igracId: string): Eliminacija | undefined {
    return stanje.eliminacije.find((eliminacija) => eliminacija.igracId === igracId);
  }

  function opisEliminacijeZaNovuRundu(eliminacija: Eliminacija): {
    igrac: string;
    opis: string;
    bodIgrac: string | null;
  } {
    const igrac = `Igrač ${imeIgraca(eliminacija.igracId)}`;
    const bodIgrac = eliminacija.bodZa ? imeIgraca(eliminacija.bodZa) : null;

    if (eliminacija.razlog === 'mrtva_slova_baza') {
      const rijec = eliminacija.rijecUzrok ? ` nakon riječi „${eliminacija.rijecUzrok}”` : '';
      const slova = eliminacija.slova ? ` na „${eliminacija.slova.toUpperCase()}”` : '';
      return { igrac, opis: `ispada${rijec} jer u rječniku nema riječi${slova}.`, bodIgrac };
    }
    if (eliminacija.razlog === 'mrtva_slova_iskoristeno') {
      const slova = eliminacija.slova ? ` na „${eliminacija.slova.toUpperCase()}”` : '';
      return { igrac, opis: `ispada jer su sve riječi${slova} već iskorištene u ovoj partiji.`, bodIgrac };
    }
    if (eliminacija.razlog === 'istek') return { igrac, opis: 'ispada zbog isteka vremena.', bodIgrac };
    if (eliminacija.razlog === 'ne_znam') return { igrac, opis: 'predaje potez.', bodIgrac };
    if (eliminacija.razlog === 'prekid') return { igrac, opis: 'ispada zbog izgubljene veze.', bodIgrac };
    return { igrac, opis: 'ispada zbog Kaladonta.', bodIgrac };
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
    if (!prikazanaRijec?.igracId || prikazanaRijec.vrsta === 'sustav_rijec') return null;
    if (prikazanaRijec.igracId !== igracId || eliminacijaIgraca(igracId)) return null;
    return prikazanaRijec;
  }

  function pobjednikPartije() {
    return stanje.kraj?.plasmani.find((igrac) => igrac.plasman === 1) ?? null;
  }

  function zatvoriDijlog() {
    prijavaDijalog = false;
    prijavaPoruka = '';
  }

  const jeNaPotezu = $derived(stanje.naPotezuId === stanje.mojIgracId);
  const jeEliminiran = $derived(stanje.eliminacije.some((e) => e.igracId === stanje.mojIgracId));
  const brojPreostalihIgraca = $derived(stanje.sjedala.length - stanje.eliminacije.length);
  const prefiksRijeci = $derived(stanje.trazenaSlova?.normalize('NFC').trim() ?? '');
  const najviseZnakovaNastavka = $derived(Math.max(0, 31 - prefiksRijeci.length));

  $effect(() => {
    const sadaJeNaPotezu = jeNaPotezu && !stanje.sustavBiraRijec && !stanje.kraj;
    if (sadaJeNaPotezu && !prethodnoJeNaPotezu) porukaNaPotezu = 'Na tebi je red.';
    prethodnoJeNaPotezu = sadaJeNaPotezu;
  });

  $effect(() => {
    if (stanje.sustavBiraRijec || stanje.kraj) zatvoriIzbornikReakcija();
  });

  let unosInput: HTMLInputElement | null = $state(null);

  $effect(() => {
    if (!jeNaPotezu || !prefiksRijeci) return;
    unosNastavkaRijeci = '';
    queueMicrotask(() => unosInput?.focus());
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
    pozdrav: 'Prijatno',
    sorry: 'Nemoj zamjerit',
    'dobro-odigrano': 'Bravo!',
    najjaci: 'Hvala',
  };
  const REAKCIJE_TEKST_PROSIRENE: Record<VrstaReakcije, string> = { ...REAKCIJE_TEKST, tuzan: 'Ne znam' };

  onMount(() => {
    void ucitajPoteze();

    const socket = dohvatiSocket();

    const naReakciju = ({ igracId, poruka }: { igracId: string; poruka: BrzaPoruka }) => {
      const id = sljedeciIdReakcije++;
      reakcije = [...reakcije, { id, igracId, poruka }];
      odskociAvatara = { ...odskociAvatara, [igracId]: (odskociAvatara[igracId] ?? 0) + 1 };
      window.setTimeout(() => {
        reakcije = reakcije.filter((reakcija) => reakcija.id !== id);
      }, 3500);
    };

    const naEliminaciju = (eliminacija: Eliminacija) => {
      slanjeUTijeku = false;
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
      }, 3500);
    };

    // Jedini izvor istine za trenutnu riječ su socket događaji - REST lista služi samo za povijest
    // (fire-and-forget upis u bazu znači da refetch odmah nakon eventa može vratiti stariju listu).
    const naPrihvacenPotez = (potez: PrihvacenPotez) => {
      if (potez.igracId === stanje.mojIgracId) slanjeUTijeku = false;
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
      slanjeUTijeku = false;
      prikazanaRijec = null;
      prethodnaRijecStola = null;
    };

    const naRunduOtvorenu = (runda: RundaOtvorena) => {
      slanjeUTijeku = false;
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

    const naKraj = () => {
      slanjeUTijeku = false;
      void ucitajPoteze(false);
    };
    const naStanjePartije = () => {
      slanjeUTijeku = false;
    };
    const naOdbijenPotez = ({ poruka }: { poruka: string }) => {
      slanjeUTijeku = false;
      prikaziGreskuPoteza(poruka);
    };
    const naGresku = ({ poruka }: { poruka: string }) => {
      if (!slanjeUTijeku) return;
      slanjeUTijeku = false;
      prikaziGreskuPoteza(poruka);
    };

    socket.on('reakcija:nova', naReakciju);
    socket.on('partija:eliminacija', naEliminaciju);
    socket.on('potez:prihvacen', naPrihvacenPotez);
    socket.on('potez:odbijen', naOdbijenPotez);
    socket.on('partija:stanje', naStanjePartije);
    socket.on('partija:sustav-bira-rijec', naSustavBira);
    socket.on('partija:runda-otvorena', naRunduOtvorenu);
    socket.on('partija:kraj', naKraj);
    socket.on('greska', naGresku);

    return () => {
      if (porukaPotezaTimeoutId !== null) clearTimeout(porukaPotezaTimeoutId);
      if (reakcijeCooldownTimeoutId !== null) clearTimeout(reakcijeCooldownTimeoutId);
      socket.off('reakcija:nova', naReakciju);
      socket.off('partija:eliminacija', naEliminaciju);
      socket.off('potez:prihvacen', naPrihvacenPotez);
      socket.off('potez:odbijen', naOdbijenPotez);
      socket.off('partija:stanje', naStanjePartije);
      socket.off('partija:sustav-bira-rijec', naSustavBira);
      socket.off('partija:runda-otvorena', naRunduOtvorenu);
      socket.off('partija:kraj', naKraj);
      socket.off('greska', naGresku);
    };
  });
</script>

<svelte:window onclick={zatvoriIzbornikKlikomIzvan} />

<div class="sr-samo" aria-live="polite" aria-atomic="true">{porukaNaPotezu}</div>

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
  <div class="aktivna-partija-sadrzaj">
  <ul class="igraci-red">
    {#each stanje.sjedala as sjedalo (sjedalo.igracId)}
      {@const eliminacija = eliminacijaIgraca(sjedalo.igracId)}
      {@const aktivno = !stanje.sustavBiraRijec && sjedalo.igracId === stanje.naPotezuId}
      <li
        class:naPotezu={aktivno}
        class:eliminiran={Boolean(eliminacija)}
        class:izbornik-otvoren={sjedalo.igracId === stanje.mojIgracId && jeOtvorenIzbornikReakcija}
        aria-current={aktivno ? 'true' : undefined}
      >
        <span class="red-label" class:vidljiv={aktivno || Boolean(eliminacija)} class:ispao={Boolean(eliminacija)}>
          {#if eliminacija}Ispao :({:else}Na redu!{/if}
        </span>
        {#if sjedalo.igracId === stanje.mojIgracId}
          <button
            bind:this={vlastitoSjedaloGumb}
            type="button"
            class="vlastito-sjedalo"
            aria-label="Otvori brze poruke"
            aria-haspopup="menu"
            aria-expanded={jeOtvorenIzbornikReakcija}
            aria-controls="izbornik-brzih-poruka"
            onclick={otvoriIzbornikReakcija}
          >
            <span class="avatar-s-bubbleom">
              {#if zadnjiPotezIgraca(sjedalo.igracId)}
                <span
                  class="rijec-oblak"
                  class:rijec-oblak-duga={zadnjiPotezIgraca(sjedalo.igracId)!.rijec!.length > 10}
                >{@render trenutnaRijec(zadnjiPotezIgraca(sjedalo.igracId)!.rijec!)}</span>
              {/if}
              <span class="avatar-omot" class:avatar-nemiran={aktivno && avatarJeNemiran}>
                {#key odskociAvatara[sjedalo.igracId] ?? 0}
                  <span class="avatar-animacija"><Avatar avatarId={sjedalo.avatarId} rang={sjedalo.rang} velicina={72} /></span>
                {/key}
                {#if aktivno && stanje.istekPotezaIso && !stanje.kraj}
                  <TimerPrsten istekIso={stanje.istekPotezaIso} velicina={84} promijeniNemirAvatara={(nemiran) => (avatarJeNemiran = nemiran)} />
                {/if}
              </span>
            </span>
            <span class="ime-igraca" class:aktivno={aktivno}>
              {sjedalo.nadimak}
              <span class="oznaka-ti" aria-label="To si ti">TI</span>
            </span>
          </button>
          <div class="reakcije-overlay" aria-live="polite">
            {#each reakcije.filter((reakcija) => reakcija.igracId === sjedalo.igracId) as reakcija (reakcija.id)}
              <span class="reakcija-oblak" role="status">
                <span aria-hidden="true">{REAKCIJE_EMOJI_PROSIRENE[reakcija.poruka]}</span>
                {REAKCIJE_TEKST_PROSIRENE[reakcija.poruka]}
              </span>
            {/each}
          </div>
          {#if jeOtvorenIzbornikReakcija}
            <div
              bind:this={izbornikReakcija}
              id="izbornik-brzih-poruka"
              class="izbornik-brzih-poruka"
              role="menu"
              tabindex="-1"
              aria-label="Brze poruke"
              onkeydown={(event) => event.key === 'Escape' && zatvoriIzbornikReakcija(true)}
            >
              {#each BRZE_PORUKE as brzaPoruka, indeks (brzaPoruka.poruka)}
                <button
                  bind:this={gumbiReakcija[indeks]}
                  type="button"
                  role="menuitem"
                  aria-label={`Pošalji brzu poruku: ${REAKCIJE_TEKST[brzaPoruka.poruka]}`}
                  onclick={() => posaljiReakciju(brzaPoruka.poruka)}
                >
                  <span aria-hidden="true">{REAKCIJE_EMOJI[brzaPoruka.poruka]}</span>
                  {REAKCIJE_TEKST[brzaPoruka.poruka]}
                </button>
              {/each}
            </div>
          {/if}
        {:else}
          <span class="avatar-s-bubbleom">
            {#if zadnjiPotezIgraca(sjedalo.igracId)}
              <span
                class="rijec-oblak"
                class:rijec-oblak-duga={zadnjiPotezIgraca(sjedalo.igracId)!.rijec!.length > 10}
              >{@render trenutnaRijec(zadnjiPotezIgraca(sjedalo.igracId)!.rijec!)}</span>
            {/if}
            <span class="avatar-omot" class:avatar-nemiran={aktivno && avatarJeNemiran}>
              {#key odskociAvatara[sjedalo.igracId] ?? 0}
                <span class="avatar-animacija"><Avatar avatarId={sjedalo.avatarId} rang={sjedalo.rang} velicina={72} /></span>
              {/key}
              {#if aktivno && stanje.istekPotezaIso && !stanje.kraj}
                <TimerPrsten istekIso={stanje.istekPotezaIso} velicina={84} promijeniNemirAvatara={(nemiran) => (avatarJeNemiran = nemiran)} />
              {/if}
            </span>
          </span>
        {/if}
        {#if sjedalo.igracId !== stanje.mojIgracId}
          <span class="ime-igraca" class:aktivno={aktivno}>
            {sjedalo.nadimak}
            {#if sjedalo.igracId === stanje.mojIgracId}
              <span class="oznaka-ti" aria-label="To si ti">TI</span>
            {/if}
          </span>
          <div class="reakcije-overlay" aria-live="polite">
            {#each reakcije.filter((reakcija) => reakcija.igracId === sjedalo.igracId) as reakcija (reakcija.id)}
              <span class="reakcija-oblak" role="status">
                <span aria-hidden="true">{REAKCIJE_EMOJI_PROSIRENE[reakcija.poruka]}</span>
                {REAKCIJE_TEKST_PROSIRENE[reakcija.poruka]}
              </span>
            {/each}
          </div>
        {/if}
      </li>
    {/each}
  </ul>

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
          {@const opis = opisEliminacijeZaNovuRundu(stanje.zadnjaEliminacija)}
          <p class="sustav-bira-obrazlozenje">
            <strong class="igrac-ispao">{opis.igrac}</strong> {opis.opis}
            {#if opis.bodIgrac}
              <strong class="igrac-bod">{opis.bodIgrac} dobiva bod.</strong>
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
            </div>
          {/key}
        </div>
      {:else}
        <p class="priprema-partije">Partija počinje…</p>
      {/if}

    {#if jeNaPotezu}
      <form onsubmit={(e) => { e.preventDefault(); posaljiPotez(); }}>
        {#key brojGreskeUnosa}
          <div class="unos-rijeci" class:unos-ima-gresku={brojGreskeUnosa > 0 && porukaPoteza !== null}>
            <span class="prefiks-unosa" aria-hidden="true">{prefiksRijeci}</span>
            <input
              bind:this={unosInput}
              type="text"
              bind:value={unosNastavkaRijeci}
              autocomplete="off"
              maxlength={najviseZnakovaNastavka}
              aria-label={`Dovrši riječ na ${prefiksRijeci.toUpperCase()}`}
              aria-invalid={brojGreskeUnosa > 0 && porukaPoteza !== null}
              disabled={slanjeUTijeku}
            />
          </div>
        {/key}
        <div class="potez-gumbi">
          <button type="submit" disabled={slanjeUTijeku}>{slanjeUTijeku ? 'Provjera...' : 'Pošalji'}</button>
        </div>
      </form>
    {:else if jeEliminiran}
      <aside class="promatranje-traka" aria-live="polite">
        <span>Promatraš partiju.</span>
        <button type="button" onclick={napustiPartiju}>Napusti partiju</button>
      </aside>
    {/if}

    {#if prikazanaRijec?.rijec && prikazanaRijec.vrsta === 'sustav_rijec'}
      <p class="kontekst-rijeci obavijest-igre" aria-live="polite">
        {#if stanje.runda === 1}
          Igra počinje, sustav je dodijelio:
        {:else}
          Ostaje {brojPreostalihIgraca} igrača, započinje nova runda. Sustav je dodijelio riječ:
        {/if}
        {@render trenutnaRijec(prikazanaRijec.rijec)}
      </p>
    {/if}

    {#if porukaPoteza ?? stanje.poruka}
      <p class="poruka-poteza" role="alert">{porukaPoteza ?? stanje.poruka}</p>
    {/if}
    {/if}
  </section>
  </div>

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
      tabindex="-1"
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

<style>
  .sr-samo {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

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
    border-color: var(--boja-mint);
    border-radius: 16px;
    background: rgba(47, 169, 140, 0.1);
    animation: sjedalo-na-potezu 420ms ease-out;
  }
  .eliminiran {
    border-color: var(--boja-akcent);
    border-radius: 16px;
    background: rgba(228, 87, 46, 0.08);
    opacity: 0.5;
  }
  .igraci-red li.izbornik-otvoren {
    z-index: 20;
  }
  .igraci-red li.eliminiran.izbornik-otvoren {
    opacity: 1;
  }
  .igraci-red {
    list-style: none;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 8px;
    row-gap: 32px;
    margin: 0 -16px;
    padding: 36px 16px 14px;
    background: var(--boja-pozadina-podloga);
  }
  .aktivna-partija-sadrzaj {
    display: flex;
    flex-direction: column;
  }
  .aktivna-partija-sadrzaj .bijela-zona-igre {
    order: -1;
  }
  .igraci-red li {
    position: relative;
    box-sizing: border-box;
    min-width: 0;
    width: 100%;
    min-height: 148px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 6px 4px 8px;
    border: 4px solid transparent;
    font-size: var(--tekst-mali);
  }
  .red-label {
    min-height: 18px;
    margin-bottom: 8px;
    color: transparent;
    font-size: var(--tekst-mikro);
    font-weight: 700;
    line-height: 18px;
  }
  .red-label.vidljiv {
    color: var(--boja-mint-tamni);
  }
  .red-label.ispao {
    color: var(--boja-akcent);
  }
  .ime-igraca.aktivno {
    color: var(--boja-mint-tamni);
  }
  .oznaka-ti {
    display: inline-block;
    margin-left: 6px;
    padding: 2px 6px;
    border: 1px solid var(--boja-mint-tamni);
    border-radius: var(--radijus-pill);
    background: var(--boja-mint-tamni);
    color: #faf3e3;
    font-size: var(--tekst-mikro);
    font-weight: 700;
    line-height: 1;
    letter-spacing: 0.04em;
    text-decoration: none;
    vertical-align: middle;
  }
  .avatar-omot {
    margin-bottom: 0;
  }
  .avatar-s-bubbleom {
    position: relative;
    width: 84px;
    height: 84px;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: visible;
  }
  .reakcije-overlay {
    position: absolute;
    top: 124px;
    left: 50%;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    width: min(220px, calc(100vw - 24px));
    pointer-events: none;
    transform: translateX(-50%);
  }
  @keyframes sjedalo-na-potezu {
    0% { box-shadow: 0 0 0 0 rgba(47, 169, 140, 0.45); }
    100% { box-shadow: 0 0 0 8px rgba(47, 169, 140, 0); }
  }
  .igraci-red li.naPotezu .avatar-omot {
    border-radius: 50%;
    box-shadow: 0 0 0 4px rgba(47, 169, 140, 0.2);
  }
  .avatar-omot {
    position: relative;
    width: 84px;
    height: 84px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .avatar-animacija {
    display: inline-flex;
    animation: odskok-avatara 280ms ease-out;
  }
  .avatar-omot.avatar-nemiran .avatar-animacija {
    animation: nemir-avatara 360ms ease-in-out infinite;
  }
  @keyframes odskok-avatara {
    0% { transform: translateY(0); }
    45% { transform: translateY(-5px); }
    100% { transform: translateY(0); }
  }
  @keyframes nemir-avatara {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-1px); }
    75% { transform: translateX(1px); }
  }
  .vlastito-sjedalo {
    display: flex;
    width: 100%;
    min-height: 148px;
    flex-direction: column;
    align-items: center;
    gap: 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  .vlastito-sjedalo:focus-visible {
    outline: 3px solid var(--boja-mint-tamni);
    outline-offset: 4px;
  }
  .izbornik-brzih-poruka {
    position: absolute;
    z-index: 100;
    top: 124px;
    left: 50%;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--razmak-4);
    width: min(216px, calc(100vw - 24px));
    padding: var(--razmak-8);
    border: 1px solid rgba(122, 114, 100, 0.45);
    border-radius: 8px;
    background: white;
    box-shadow: var(--sjena-suptilna);
    transform: translateX(-50%);
    animation: otvaranje-izbornika-reakcija 160ms ease-out;
  }
  .izbornik-brzih-poruka button {
    min-width: 0;
    min-height: 44px;
    padding: 4px 6px;
    border: 1px solid rgba(122, 114, 100, 0.45);
    border-radius: var(--radijus-pill);
    background: var(--boja-pozadina-podloga);
    color: var(--boja-tekst-osnovni);
    font: inherit;
    font-size: var(--tekst-sitni);
    cursor: pointer;
  }
  .izbornik-brzih-poruka button:hover,
  .izbornik-brzih-poruka button:focus-visible {
    border-color: var(--boja-mint);
    background: rgba(47, 169, 140, 0.1);
  }
  @keyframes otvaranje-izbornika-reakcija {
    from { opacity: 0; transform: translateX(-50%) translateY(-4px) scale(0.96); }
    to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
  }
  .ime-igraca {
    font-family: var(--font-tijelo);
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
  .promatranje-traka {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--razmak-12);
    margin: 16px 0 0;
    padding: 10px 12px;
    border: 1px solid rgba(122, 114, 100, 0.45);
    border-radius: 8px;
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-mali);
  }
  .promatranje-traka button {
    flex-shrink: 0;
    padding: 8px 12px;
    border: 0;
    border-radius: var(--radijus-pill);
    background: var(--boja-akcent);
    color: white;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }
  .promatranje-traka button:hover,
  .promatranje-traka button:focus-visible {
    background: #c94321;
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
  .obavijest-igre {
    margin-top: 12px;
    text-align: center;
  }
  .trenutna-rijec {
    color: var(--boja-tekst-osnovni);
    font-size: var(--tekst-rijec-stola);
    font-weight: 700;
  }
  .trenutna-rijec-zavrsetak {
    color: var(--boja-akcent);
  }
  .sustav-bira-inline {
    position: fixed;
    z-index: 20;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: var(--razmak-24);
    background: var(--boja-pozadina-podloga);
    text-align: center;
  }
  .sustav-bira-obrazlozenje {
    max-width: 620px;
    margin: 0 auto;
    color: var(--boja-tekst-osnovni);
    font-size: clamp(1.35rem, 4vw, 2.2rem);
    font-weight: 600;
    line-height: 1.2;
  }
  .igrac-ispao {
    color: var(--boja-akcent);
  }
  .igrac-bod {
    display: block;
    margin-top: 8px;
    color: var(--boja-mint-tamni);
  }
  .sustav-bira-tekst {
    margin: 0;
    color: var(--boja-tekst-sekundarni);
    font-family: var(--font-naslov);
    font-size: var(--tekst-baza);
  }
  .sustav-bira-tekst strong {
    color: var(--boja-mint-tamni);
    display: block;
    margin-top: var(--razmak-8);
    font-size: var(--naslov-1);
    line-height: 1;
  }
  form {
    display: block;
  }
  .unos-rijeci {
    display: flex;
    align-items: center;
    width: 100%;
    height: 44px;
    padding: 0 16px;
    border: 1px solid var(--boja-tekst-sekundarni);
    border-radius: var(--radijus-pill);
    background: white;
    font-family: var(--font-naslov);
    font-size: var(--tekst-rijec-stola);
    letter-spacing: 0.08em;
  }
  .prefiks-unosa {
    flex: 0 0 auto;
    color: var(--boja-akcent);
    font-weight: 700;
  }
  .unos-rijeci input {
    min-width: 0;
    flex: 1;
    height: 100%;
    padding: 0;
    border: 0;
    outline: 0;
    background: transparent;
    color: #2fa98c;
    font: inherit;
    letter-spacing: inherit;
  }
  .unos-rijeci.unos-ima-gresku {
    border-color: var(--boja-akcent);
    background: rgba(228, 87, 46, 0.08);
    animation: podrhtavanje-unosa 220ms ease-in-out;
  }
  .poruka-poteza {
    margin: 8px 0;
    color: var(--boja-akcent);
    font-size: var(--tekst-mali);
    font-weight: 600;
    text-align: center;
  }
  @keyframes podrhtavanje-unosa {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-5px); }
    75% { transform: translateX(5px); }
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
    display: contents;
  }
  .potez-gumbi button {
    width: 100%;
    margin-top: 8px;
    font: inherit;
    font-size: var(--tekst-baza);
  }
  form button:disabled,
  .unos-rijeci:has(input:disabled) {
    cursor: wait;
    opacity: 0.65;
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
  @media (max-width: 499px) {
    form button,
    .unos-rijeci {
      width: 100%;
    }
  }
  @media (min-width: 500px) {
    form {
      display: grid;
      grid-template-columns: minmax(0, 7fr) minmax(0, 3fr);
      align-items: end;
      gap: var(--razmak-8);
    }
    form button,
    .unos-rijeci {
      width: 100%;
    }
    form button {
      margin-top: 0;
    }
  }
  .reakcija-oblak,
  .rijec-oblak {
    display: inline-block;
    width: max-content;
    max-width: min(180px, calc(50vw - 24px));
    padding: 5px 9px;
    border: 1px solid rgba(122, 114, 100, 0.45);
    border-radius: 12px;
    background: white;
    color: var(--boja-tekst-osnovni);
    font-size: var(--tekst-mikro);
    white-space: normal;
    overflow-wrap: anywhere;
  }
  .reakcija-oblak {
    position: relative;
    z-index: 1000;
    margin-top: 4px;
    animation: reakcija-dolazak 3.5s ease both;
  }
  .rijec-oblak {
    position: absolute;
    left: 50%;
    bottom: calc(100% + 4px);
    z-index: 1000;
    max-width: min(240px, calc(100vw - 24px));
    padding: 7px 12px;
    font-family: var(--font-naslov);
    font-size: var(--tekst-rijec-stola);
    font-weight: 700;
    line-height: 1.05;
    text-align: center;
    transform: translateX(-50%);
    animation: rijec-oblak-dolazak 220ms ease-out both;
  }
  .rijec-oblak-duga {
    font-size: var(--tekst-baza);
  }
  .reakcija-oblak::after {
    content: '';
    position: absolute;
    left: 50%;
    top: -5px;
    width: 8px;
    height: 8px;
    border-left: 1px solid rgba(122, 114, 100, 0.45);
    border-top: 1px solid rgba(122, 114, 100, 0.45);
    background: white;
    transform: translateX(-50%) rotate(45deg);
  }
  .rijec-oblak::after {
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
    8%, 88% { opacity: 1; transform: translateY(0) scale(1); }
    100% { opacity: 0; transform: translateY(-4px) scale(0.96); }
  }
  @keyframes rijec-oblak-dolazak {
    from { opacity: 0; transform: translateX(-50%) translateY(6px) scale(0.96); }
    to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
  }
  .gost-poruka {
    background: #f4c95d;
    color: #26221b;
    padding: 8px 12px;
    border-radius: 6px;
  }
  @media (min-width: 601px) {
    .igraci-red {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
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
  @media (prefers-reduced-motion: reduce) {
    .rijec-sadrzaj,
    .reakcija-oblak,
    .avatar-animacija,
    .avatar-omot.avatar-nemiran .avatar-animacija,
    .unos-rijeci.unos-ima-gresku {
      animation: none;
    }
    .igraci-red li.naPotezu {
      animation: none;
    }
  }
</style>
