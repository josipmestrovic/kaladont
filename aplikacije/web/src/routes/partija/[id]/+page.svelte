<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { api } from '$lib/api.js';
  import { dohvatiSocket } from '$lib/socket.js';
  import { jeRegistriranKorisnik } from '$lib/identitet.js';
  import { dohvatiStanjeIgre } from '$lib/stanje-igre.svelte.js';
  import Avatar from '$lib/komponente/Avatar.svelte';
  import TimerPrsten from '$lib/komponente/TimerPrsten.svelte';
  import Konfeti from '$lib/komponente/Konfeti.svelte';
  import IskustvoPartije from '$lib/komponente/IskustvoPartije.svelte';
  import KaladontDnkPromjena from '$lib/komponente/KaladontDnkPromjena.svelte';
  import Header from '$lib/komponente/Header.svelte';
  import { pustiAudio } from '$lib/audio-manager.js';
  import { dohvatiDefinicijuDostignuca, zadnjaDva } from 'zajednicko';
  import type { BrzaPoruka, Eliminacija, KrajPartije, PrihvacenPotez, RundaOtvorena, StanjePartije } from 'zajednicko';

  const stanje = dohvatiStanjeIgre();
  const partijaId = $derived($page.params.id);

  let unosNastavkaRijeci = $state('');
  let prijavaDijalog = $state(false);
  let neZnamDijalog = $state(false);
  let prijavaPoruka = $state('');
  let prijavaPotezId: number | null = $state(null);
  let slanjeUTijeku = $state(false);
  let slanjeTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let porukaPoteza = $state<string | null>(null);
  let brojGreskeUnosa = $state(0);
  let porukaPotezaTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let potezi = $state<Potez[]>([]);
  let povijestOtvorena = $state(false);
  let ucitavanjePovijesti = $state(false);
  let greskaPovijesti = $state<string | null>(null);
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
    if (slanjeTimeoutId !== null) clearTimeout(slanjeTimeoutId);
    slanjeTimeoutId = setTimeout(() => {
      slanjeUTijeku = false;
      slanjeTimeoutId = null;
      prikaziGreskuPoteza('Poslužitelj nije potvrdio potez. Pokušaj ponovno.');
    }, 5000);
    dohvatiSocket().emit('potez:rijec', { rijec });
    unosNastavkaRijeci = '';
  }

  function posaljiNeZnam() {
    if (slanjeUTijeku) return;
    neZnamDijalog = true;
  }

  function potvrdiNeZnam() {
    neZnamDijalog = false;
    slanjeUTijeku = true;
    dohvatiSocket().emit('potez:ne-znam');
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

  function jeAktualnaPartija(): boolean {
    return stanje.partijaId === partijaId;
  }

  function opisDostignuca(id: string): { naziv: string; opis: string } {
    const definicija = dohvatiDefinicijuDostignuca(id);
    return definicija ? { naziv: definicija.naziv, opis: definicija.opis } : { naziv: id, opis: 'Novo dostignuće.' };
  }

  function eliminacijaIgraca(igracId: string): Eliminacija | undefined {
    return stanje.eliminacije.find((eliminacija) => eliminacija.igracId === igracId);
  }

  function opisEliminacijeZaNovuRundu(eliminacija: Eliminacija): {
    igrac: string;
    opis: string;
    bodIgrac: string | null;
    rijec: string | null;
    slova: string | null;
  } {
    const igrac = `Igrač ${imeIgraca(eliminacija.igracId)}`;
    const bodIgrac = eliminacija.bodZa ? imeIgraca(eliminacija.bodZa) : null;

    if (eliminacija.razlog === 'mrtva_slova_baza') {
      return { igrac, opis: 'ispada jer u rječniku nema riječi', bodIgrac, rijec: eliminacija.rijecUzrok, slova: eliminacija.slova };
    }
    if (eliminacija.razlog === 'mrtva_slova_iskoristeno') {
      return { igrac, opis: 'ispada jer su sve riječi već iskorištene u ovoj igri na', bodIgrac, rijec: eliminacija.rijecUzrok, slova: eliminacija.slova };
    }
    if (eliminacija.razlog === 'istek') return { igrac, opis: 'ispada zbog isteka vremena.', bodIgrac, rijec: null, slova: null };
    if (eliminacija.razlog === 'ne_znam') return { igrac, opis: 'predaje potez.', bodIgrac, rijec: null, slova: null };
    if (eliminacija.razlog === 'prekid') return { igrac, opis: 'ispada zbog izgubljene veze.', bodIgrac, rijec: null, slova: null };
    return { igrac, opis: 'je omogućio/omogućila Kaladont igraču', bodIgrac, rijec: null, slova: null };
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
  const brojVatri = $derived(
    stanje.trenutniStreak > 100
      ? 100
      : stanje.trenutniStreak >= 50
        ? 5
        : stanje.trenutniStreak >= 20
          ? 4
          : stanje.trenutniStreak >= 10
            ? 3
            : stanje.trenutniStreak >= 5
              ? 2
              : stanje.trenutniStreak > 0
                ? 1
                : 0,
  );

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

  // Globalni game-state listener je izvor istine i nakon reconnecta. Ako aktivni
  // ekran propusti jedan Socket.IO event, promjena reda ipak mora otključati
  // ili zaključati unos bez čekanja na refresh.
  $effect(() => {
    if (stanje.partijaId !== partijaId) return;
    const trebaBitiZakljucano = stanje.kraj || stanje.sustavBiraRijec || !jeNaPotezu;
    if (!trebaBitiZakljucano) return;
    slanjeUTijeku = false;
    if (slanjeTimeoutId !== null) {
      clearTimeout(slanjeTimeoutId);
      slanjeTimeoutId = null;
    }
  });

  $effect(() => {
    const rijec = stanje.zadnjaRijec;
    const vrsta = stanje.zadnjaRijecVrsta;
    if (stanje.partijaId !== partijaId || !rijec || !vrsta || stanje.sustavBiraRijec) return;
    if (
      prikazanaRijec?.rijec === rijec &&
      prikazanaRijec.vrsta === vrsta &&
      prikazanaRijec.igracId === stanje.zadnjaRijecIgracId
    ) return;
    prethodnaRijecStola = prikazanaRijec?.rijec ?? null;
    prikazanaRijec = {
      id: -Date.now(),
      redniBroj: 0,
      igracId: stanje.zadnjaRijecIgracId,
      vrsta,
      rijec,
      trazenaSlova: stanje.trazenaSlova,
      vrijeme: new Date().toISOString(),
    };
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
    if (stanje.jePrivatna || ucitavanjePovijesti) return;
    ucitavanjePovijesti = true;
    greskaPovijesti = null;
    try {
      const odgovor = await api<{ potezi: Potez[] }>(`/partije/${partijaId}/potezi`);
      potezi = odgovor.potezi;
      if (prikaziZadnjuRijec) {
        if (stanje.partijaId === partijaId && stanje.zadnjaRijec && stanje.zadnjaRijecVrsta) return;
        const sRijeci = odgovor.potezi.filter((potez) => potez.rijec);
        prikazanaRijec = sRijeci.at(-1) ?? null;
        prethodnaRijecStola =
          prikazanaRijec && prikazanaRijec.vrsta !== 'sustav_rijec' ? (sRijeci.at(-2)?.rijec ?? null) : null;
      }
    } catch {
      greskaPovijesti = 'Povijest se trenutno ne može učitati.';
    } finally {
      ucitavanjePovijesti = false;
    }
  }

  function otvoriPovijest() {
    povijestOtvorena = !povijestOtvorena;
    if (povijestOtvorena && potezi.length === 0 && !stanje.jePrivatna) void ucitajPoteze(false);
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
    const socket = dohvatiSocket();

    const naReakciju = ({ igracId, poruka }: { igracId: string; poruka: BrzaPoruka }) => {
      if (!jeAktualnaPartija()) return;
      const id = sljedeciIdReakcije++;
      reakcije = [...reakcije, { id, igracId, poruka }];
      odskociAvatara = { ...odskociAvatara, [igracId]: (odskociAvatara[igracId] ?? 0) + 1 };
      window.setTimeout(() => {
        reakcije = reakcije.filter((reakcija) => reakcija.id !== id);
      }, 3500);
    };

    const naEliminaciju = (eliminacija: Eliminacija) => {
      if (!jeAktualnaPartija()) return;
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
      if (!jeAktualnaPartija()) return;
      // Potvrda je dovoljna za otključavanje unosa. To vrijedi i kada riječ
      // odmah uzrokuje mrtva slova i ekran nove runde.
      slanjeUTijeku = false;
      if (slanjeTimeoutId !== null) {
        clearTimeout(slanjeTimeoutId);
        slanjeTimeoutId = null;
      }
      // Globalni listener također obrađuje događaj, ali aktivni ekran odmah primjenjuje
      // prijelaz reda kako render ne bi čekao drugi lifecycle ili ručno osvježavanje.
      stanje.naPotezuId = potez.sljedeciId;
      stanje.trazenaSlova = potez.trazenaSlova;
      stanje.istekPotezaIso = potez.istekPotezaIso;
      stanje.brojIskoristenih = potez.brojIskoristenih;
      if (potez.igracId === stanje.mojIgracId) stanje.trenutniStreak = potez.streak;
      stanje.zadnjaNagrada = potez.igracId === stanje.mojIgracId ? potez.nagrada : null;
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
      if (!jeAktualnaPartija()) return;
      slanjeUTijeku = false;
      prikazanaRijec = null;
      prethodnaRijecStola = null;
    };

    const naRunduOtvorenu = (runda: RundaOtvorena) => {
      if (!jeAktualnaPartija()) return;
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

    const naKraj = (kraj: KrajPartije) => {
      if (kraj.partijaId !== partijaId) return;
      slanjeUTijeku = false;
    };
    const naStanjePartije = (novoStanje: StanjePartije) => {
      if (novoStanje.partijaId !== partijaId) return;
      slanjeUTijeku = false;
    };
    const naOdbijenPotez = ({ poruka }: { poruka: string }) => {
      if (!jeAktualnaPartija()) return;
      slanjeUTijeku = false;
      if (slanjeTimeoutId !== null) {
        clearTimeout(slanjeTimeoutId);
        slanjeTimeoutId = null;
      }
      prikaziGreskuPoteza(poruka);
    };
    const naGresku = ({ poruka }: { poruka: string }) => {
      if (!jeAktualnaPartija() || !slanjeUTijeku) return;
      slanjeUTijeku = false;
      if (slanjeTimeoutId !== null) {
        clearTimeout(slanjeTimeoutId);
        slanjeTimeoutId = null;
      }
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
      if (slanjeTimeoutId !== null) clearTimeout(slanjeTimeoutId);
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

<svelte:head>
  <title>Partija | Kaladont</title>
</svelte:head>

<svelte:window onclick={zatvoriIzbornikKlikomIzvan} />

<div class="sr-samo" aria-live="polite" aria-atomic="true">{porukaNaPotezu}</div>

{#snippet trenutnaRijec(rijec: string)}
  {@const zavrsetak = zadnjaDva(rijec)}
  <strong class="trenutna-rijec">{rijec.slice(0, rijec.length - zavrsetak.length)}<span class="trenutna-rijec-zavrsetak">{zavrsetak}</span></strong>
{/snippet}

{#if !stanje.jePrivatna}
  {#if stanje.intenzitetKonfetaIskustva}
    {#key stanje.oznakaKonfetaIskustva}
      <Konfeti intenzitet={stanje.intenzitetKonfetaIskustva} />
    {/key}
  {/if}
  <header class="status-iskustva" class:vidljiv={stanje.stavkeIskustva.length > 0} aria-live="polite">
    {#if stanje.stavkeIskustva.length > 0}
      {#key stanje.oznakaStavkiIskustva}
        <div class="dobitak-iskustva">
          {#each stanje.stavkeIskustva as stavka (`${stavka.vrsta}-${stavka.naziv}`)}
            <span class="dobitak-iskustva-tekst">{stavka.naziv} <strong>+{stavka.iskustvo} XP</strong></span>
          {/each}
        </div>
      {/key}
    {/if}
  </header>
{/if}

{#if stanje.kraj && prikaziRezultate}
  <div class="zavrsni-header"><Header /></div>
  {#if pobjednikPartije()?.igracId === stanje.mojIgracId}
    <Konfeti intenzitet="veliki" />
  {/if}
  <h2>Završni poredak</h2>
  {#if stanje.kraj.jePrivatna || stanje.jePrivatna}
    <p class="privatna-obavijest">
      🔒 Prijateljska privatna igra (bodovi nisu dodijeljeni i ne utječu na ljestvicu).
    </p>
  {/if}
  <ol class="plasmani-lista">
    {#each [...stanje.kraj.plasmani].sort((a, b) => a.plasman - b.plasman) as igrac (igrac.igracId)}
      <li class:pobjednik={igrac.plasman === 1}>
        <span class="plasman-broj">{igrac.plasman}.</span>
        <span class="plasman-ime">{imeIgraca(igrac.igracId)}</span>
        <span class="plasman-bodovi">{igrac.bodovi} bodova ({igrac.eliminacije} elim.)</span>
      </li>
    {/each}
  </ol>
  {#if stanje.kraj.jePrivatna || stanje.jePrivatna}
    {@const kodSobe = stanje.kraj.kodSobe ?? stanje.kodSobe}
    <div class="kraj-akcije">
      <a href={kodSobe ? `/soba/${kodSobe}` : '/soba/kreiraj'} class="igraj-opet-gumb">Igraj ponovno</a>
      <a href="/" class="sporedni-gumb">Povratak na naslovnu</a>
    </div>
  {:else}
    {@const modPartije = stanje.kraj.mod ?? stanje.mod}
    <div class="kraj-akcije">
      <a href={modPartije === 'dva_igraca' ? '/red?mod=dva_igraca' : '/red?mod=cetiri_igraca'} class="igraj-opet-gumb">Igraj opet</a>
      <a href="/" class="sporedni-gumb">Povratak na naslovnu</a>
    </div>
  {/if}
  <h3 class="osobni-rezultati-naslov">Tvoja ocjena</h3>
  <section class="ocjena-igre-zavrsna" aria-label="Ocjena igre">
    {#if stanje.kraj.mojaOcjenaIgre === null || stanje.kraj.mojaOcjenaIgre === undefined}
      <span>Za ocjenu igre potrebna su najmanje 3 prihvaćena poteza.</span>
    {:else}
      <span>Ocjena igre</span>
      <strong>{stanje.kraj.mojaOcjenaIgre} / 5</strong>
      <span class="ocjena-zvjezdice" aria-hidden="true">{'★'.repeat(stanje.kraj.mojaOcjenaIgre)}{'☆'.repeat(5 - stanje.kraj.mojaOcjenaIgre)}</span>
      <a href="/pravila-kaladonta?tema=napredak#ocjena-partije">Kako se računa?</a>
    {/if}
  </section>
  {#if stanje.kraj.mojeIskustvo}
    <IskustvoPartije obracun={stanje.kraj.mojeIskustvo} />
  {/if}
  {#if stanje.kraj.mojDnk}
    <KaladontDnkPromjena
      prije={stanje.kraj.mojDnk.prije}
      poslije={stanje.kraj.mojDnk.poslije}
      odigrano={stanje.kraj.mojDnk.odigrano}
      otkljucan={stanje.kraj.mojDnk.otkljucan}
      upravoOtkljucan={stanje.kraj.mojDnk.upravoOtkljucan}
      preostaloDoOtkljucavanja={stanje.kraj.mojDnk.preostaloDoOtkljucavanja}
      mod={stanje.kraj.mod ?? stanje.mod ?? 'cetiri_igraca'}
    />
  {/if}
  {#if stanje.kraj.novaDostignuca.length > 0}
    <section class="zavrsna-dostignuca" aria-labelledby="zavrsna-dostignuca-naslov">
      <h3 id="zavrsna-dostignuca-naslov">Dostignuća otključana u ovoj partiji</h3>
      <div class="zavrsna-dostignuca-mrezica">
        {#each stanje.kraj.novaDostignuca as dostignuce (dostignuce.id)}
          {@const detalji = opisDostignuca(dostignuce.id)}
          <article class="zavrsno-dostignuce">
            <span class="zavrsno-dostignuce-ikona" aria-hidden="true">★</span>
            <div>
              <strong>{detalji.naziv}</strong>
              <p>{detalji.opis}</p>
              <small>Razina {dostignuce.novaRazina} / {dostignuce.maksimalnaRazina}</small>
            </div>
          </article>
        {/each}
      </div>
    </section>
  {/if}
  {#if !jeRegistriranKorisnik() && !stanje.kraj.jePrivatna && !stanje.jePrivatna}
    <p class="gost-poruka">
      Ova statistika je spremljena lokalno u ovom pregledniku. Registriraj se da je zadržiš zauvijek!
    </p>
    <a href="/registracija">Registriraj se</a>
  {/if}
  <section class="povijest-partije">
    <button type="button" class="povijest-naslov" aria-expanded={povijestOtvorena} onclick={otvoriPovijest}>
      <span>Povijest partije</span><span aria-hidden="true">{povijestOtvorena ? '−' : '+'}</span>
    </button>
    {#if povijestOtvorena}
      {#if stanje.jePrivatna}
        <p>Povijest privatne partije nije dostupna.</p>
      {:else if ucitavanjePovijesti}
        <p aria-live="polite">Učitavanje povijesti...</p>
      {:else if greskaPovijesti}
        <p role="alert">{greskaPovijesti}</p>
      {:else if potezi.length === 0}
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
    {/if}
  </section>
  <div class="kraj-donje-praznine" aria-hidden="true"></div>
{:else}
  <div class="aktivna-partija-sadrzaj">
  {#if stanje.obracunIskustva}
    <aside class="obracun-promatraca">
      <p>Rezultat je izračunat i trajno će se spremiti kada igra završi. Možeš napustiti igru.</p>
      <IskustvoPartije obracun={stanje.obracunIskustva.mojeIskustvo} />
      <a href="/" class="sporedni-gumb">Napusti partiju</a>
    </aside>
  {/if}
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
                  <span class="avatar-animacija"><Avatar avatarId={sjedalo.avatarId} avatarConfig={sjedalo.avatarConfig} rang={sjedalo.rang} velicina={72} /></span>
                {/key}
                {#if aktivno && stanje.istekPotezaIso && !stanje.kraj}
                  <TimerPrsten istekIso={stanje.istekPotezaIso} velicina={84} promijeniNemirAvatara={(nemiran) => (avatarJeNemiran = nemiran)} />
                {/if}
              </span>
            </span>
            <span class="ime-igraca" class:aktivno={aktivno}>
              {sjedalo.nadimak}
              <span class="rang-razina">{sjedalo.rang ?? 'Piskaralo'} <span aria-hidden="true">|</span> LVL {sjedalo.razina}</span>
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
                <span class="avatar-animacija"><Avatar avatarId={sjedalo.avatarId} avatarConfig={sjedalo.avatarConfig} rang={sjedalo.rang} velicina={72} /></span>
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
            <span class="rang-razina">{sjedalo.rang ?? 'Piskaralo'} <span aria-hidden="true">|</span> LVL {sjedalo.razina}</span>
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
                {#if eliminacija.razlog.startsWith('mrtva_slova')}
                  <strong>{eliminacija.bodZa ? imeIgraca(eliminacija.bodZa) : 'Prethodni igrač'}</strong> je rekao riječ
                  {#if eliminacija.rijecUzrok}{@render trenutnaRijec(eliminacija.rijecUzrok)}{:else}<strong>prethodnu riječ</strong>{/if}, a
                  <strong>{imeIgraca(eliminacija.igracId)}</strong> ispada jer nema riječi na
                  <strong class="trazena-slova-istaknuta">{eliminacija.slova?.toUpperCase() ?? 'TRAŽENA SLOVA'}</strong>.
                {:else if eliminacija.razlog === 'kaladont'}
                  <strong>{eliminacija.bodZa ? imeIgraca(eliminacija.bodZa) : 'Igrač'}</strong> je napisao/napisala Kaladont, a
                  <strong>{imeIgraca(eliminacija.igracId)}</strong>, koji mu/joj je omogućio Kaladont, ispao/ispala je.
                  {#if eliminacija.bodZa}<strong>{imeIgraca(eliminacija.bodZa)}</strong> dobiva bod.{/if}
                {:else}
                  <strong>{imeIgraca(eliminacija.igracId)}</strong>
                {/if}
                {#if !eliminacija.razlog.startsWith('mrtva_slova') && eliminacija.razlog !== 'kaladont' && eliminacija.razlog === 'ne_znam'}
                  predao/predala je potez.
                {:else if eliminacija.razlog === 'istek'}
                  ispao/ispala je zbog isteka vremena.
                {:else if eliminacija.razlog === 'prekid'}
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
          Konačni rezultati stižu za <strong>{sekundeDoRezultata}</strong>
          {sekundeDoRezultata === 1 ? 'sekundu' : 'sekundi'}...
        </p>
      </div>
    {:else if stanje.sustavBiraRijec}
      <div class="sustav-bira-inline" aria-live="polite">
        {#if stanje.zadnjaEliminacija}
          {@const opis = opisEliminacijeZaNovuRundu(stanje.zadnjaEliminacija)}
          <p class="sustav-bira-obrazlozenje">
            {#if stanje.zadnjaEliminacija.razlog.startsWith('mrtva_slova')}
              <strong class="igrac-bod">{opis.bodIgrac ?? 'Prethodni igrač'}</strong> je rekao riječ
              {#if opis.rijec}{@render trenutnaRijec(opis.rijec)}{:else}<strong>prethodnu riječ</strong>{/if}, a
              <strong class="igrac-ispao">{opis.igrac.replace('Igrač ', '')}</strong> {opis.opis}
              {#if opis.slova}<strong class="trazena-slova-istaknuta">{opis.slova.toUpperCase()}</strong>.{/if}
            {:else if stanje.zadnjaEliminacija.razlog === 'kaladont'}
              <strong class="igrac-bod">{opis.bodIgrac ?? 'Igrač'}</strong> je napisao/napisala Kaladont, a
              <strong class="igrac-ispao">{imeIgraca(stanje.zadnjaEliminacija.igracId)}</strong>, koji mu/joj je omogućio Kaladont, ispao/ispala je.
              {#if opis.bodIgrac}<strong class="igrac-bod">{opis.bodIgrac} dobiva bod.</strong>{/if}
            {:else}
              <strong class="igrac-ispao">{opis.igrac}</strong> {opis.opis}
            {/if}
            {#if opis.bodIgrac}
              {#if !stanje.zadnjaEliminacija.razlog.startsWith('mrtva_slova') && stanje.zadnjaEliminacija.razlog !== 'kaladont'}<strong class="igrac-bod">{opis.bodIgrac} dobiva bod.</strong>{/if}
            {/if}
          </p>
        {/if}
        <p class="sustav-bira-tekst">Sustav bira novu riječ za <strong>{sustavBrojac}</strong>…</p>
      </div>
    {:else}
      {#if stanje.zadnjaNagrada}
        {#key `${stanje.zadnjaNagrada.tekst}-${stanje.trenutniStreak}`}
          <p class="nagrada-za-rijec nagrada-{stanje.zadnjaNagrada.intenzitet}" role="status" aria-live="polite">
            <span class="nagrada-ukras" aria-hidden="true">
              {stanje.zadnjaNagrada.intenzitet === 'veliki' ? '🎊 👏 🎉 ✨ 👏 🎊' : stanje.zadnjaNagrada.intenzitet === 'srednji' ? '🎉 👏 ✨' : '🎉 👏'}
            </span>
            <strong>{stanje.zadnjaNagrada.tekst}</strong>
            {#if stanje.zadnjaNagrada.otkljucano !== null}
              <span class="nagrada-napredak">{stanje.zadnjaNagrada.kategorija === 'rijetke' ? 'Rijetke riječi' : 'Duge riječi'}: {stanje.zadnjaNagrada.otkljucano} / {stanje.zadnjaNagrada.ukupno ?? '—'} otključano</span>
            {/if}
            <span class="nagrada-ukras" aria-hidden="true">
              {stanje.zadnjaNagrada.intenzitet === 'veliki' ? '🎊 👏 🎉 ✨ 👏 🎊' : stanje.zadnjaNagrada.intenzitet === 'srednji' ? '🎉 👏 ✨' : '🎉 👏'}
            </span>
          </p>
        {/key}
      {/if}
      <p class="trenutni-streak" role="status" aria-live="polite">
        {#if brojVatri > 0}
          <span class="streak-vatre" aria-hidden="true">
            {#if brojVatri === 100}
              {#each Array(100) as _}<span>🔥</span>{/each}
            {:else}
              {#each Array(brojVatri) as _}<span>🔥</span>{/each}
            {/if}
          </span>
        {/if}
        Tvoj streak: <strong>{stanje.trenutniStreak}</strong> {stanje.trenutniStreak === 1 ? 'riječ' : 'riječi'}
        {#if brojVatri === 100}<span class="streak-vatre" aria-hidden="true">{#each Array(100) as _}<span>🔥</span>{/each}</span>{/if}
      </p>
      {#if stanje.trazenaSlova}
        <div class="rijec-kartica">
          {#key prikazanaRijec?.rijec ?? stanje.trazenaSlova}
            <div class="rijec-sadrzaj">
              <p class="trazena-slova">Traži se riječ na: <strong>{stanje.trazenaSlova.toUpperCase()}</strong></p>
            </div>
          {/key}
        </div>
      {:else}
        <p class="priprema-partije">Igra počinje…</p>
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
          {#if !stanje.jePrivatna || stanje.trajanjePotezaSek === 0 || !stanje.istekPotezaIso || stanje.istekPotezaIso === ''}
            <button type="button" class="ne-znam-gumb" disabled={slanjeUTijeku} onclick={posaljiNeZnam}>Ne znam</button>
          {/if}
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

{#if neZnamDijalog}
  <div
    class="dijalog-overlay"
    role="presentation"
    onclick={() => (neZnamDijalog = false)}
    onkeydown={(e) => e.key === 'Escape' && (neZnamDijalog = false)}
  >
    <div
      class="dijalog potvrda-ne-znam"
      role="dialog"
      aria-modal="true"
      aria-labelledby="potvrda-ne-znam-naslov"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
    >
      <h3 id="potvrda-ne-znam-naslov">Predati potez?</h3>
      <p>Jesi li siguran/na da želiš predati potez? Nakon potvrde ispadaš iz partije.</p>
      <div class="dijalog-gumbi">
        <button type="button" class="sporedni-dijalog-gumb" onclick={() => (neZnamDijalog = false)}>Odustani</button>
        <button type="button" class="potvrdi-dijalog-gumb" onclick={potvrdiNeZnam}>Potvrdi</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .zavrsni-header {
    width: 100vw;
    margin-left: calc(50% - 50vw);
  }

  .zavrsni-header + h2 {
    margin-top: 48px;
  }

  .status-iskustva { display: none; position: fixed; z-index: 40; top: 0; right: 0; left: 0; width: auto; background: white; border-block: 1px solid #e5ddc8; box-shadow: 0 2px 8px rgb(26 24 21 / 8%); }
  .status-iskustva.vidljiv { display: block; }
  .dobitak-iskustva { display: flex; width: min(960px, calc(100% - 32px)); align-items: center; justify-content: center; flex-wrap: wrap; gap: 8px 20px; min-height: 42px; margin: 0 auto; padding: 8px 0; font-size: var(--tekst-sitni); animation: ulaz-dobitka 380ms cubic-bezier(.2, .8, .2, 1); }
  .dobitak-iskustva strong { color: var(--boja-mint); font-size: var(--tekst-baza); }
  .dobitak-iskustva-tekst { color: var(--boja-tekst-sekundarni); }
  @keyframes ulaz-dobitka { 0% { opacity: 0; transform: translateY(-28px) scale(.94); } 65% { opacity: 1; transform: translateY(2px) scale(1.04); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
  @media (prefers-reduced-motion: reduce) { .dobitak-iskustva { animation: none; } }
  @media (max-width: 500px) { .dobitak-iskustva { width: calc(100% - 24px); justify-content: flex-start; gap: 5px 14px; } }
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
  .rang-razina { display: block; margin-top: 2px; color: var(--boja-tekst-sekundarni); font-size: var(--tekst-mikro); font-weight: 600; }

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
  .zavrsni-dnk,
  .zavrsna-dostignuca {
    max-width: none;
    margin: 24px auto 0;
    padding: 18px;
    border: 1px solid #e5ddc8;
    border-radius: 8px;
    background: #fff;
    text-align: left;
  }
  .ocjena-igre-zavrsna {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 12px;
    max-width: none;
    margin: 24px auto 0;
    padding: 14px 18px;
    border: 1px solid #e5ddc8;
    border-radius: 8px;
    background: #fffdf5;
    color: var(--boja-tekst-sekundarni);
    text-align: left;
  }
  .ocjena-igre-zavrsna strong { color: var(--boja-tekst-naslov); font-size: 1.2rem; }
  .ocjena-igre-zavrsna a { color: var(--boja-pozadina-primarna); font-size: var(--tekst-sitni); font-weight: 700; }
  .ocjena-zvjezdice { color: var(--boja-zuta-krema); letter-spacing: 0.1em; font-size: 1.2rem; }
  .zavrsni-dnk-zaglavlje {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .zavrsni-dnk-natpis {
    margin: 0 0 2px;
    color: var(--boja-akcent);
    font-size: var(--tekst-mikro);
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .zavrsna-dostignuca h3 {
    margin: 0;
    color: var(--boja-tekst-naslov);
    font-family: var(--font-naslov);
    font-size: 1.35rem;
  }
  .osobni-rezultati-naslov {
    max-width: none;
    margin: 24px auto 0;
    color: var(--boja-tekst-naslov);
    font-family: var(--font-naslov);
    font-size: 1.35rem;
    text-align: left;
  }
  .zavrsni-dnk-zaglavlje > strong {
    color: var(--boja-akcent);
    font-size: 1.35rem;
    white-space: nowrap;
  }
  .dnk-otkljucan-poruka,
  .dnk-napredak-poruka {
    margin: 14px 0 10px;
    color: var(--boja-tekst-sekundarni);
  }
  .dnk-otkljucan-poruka strong {
    color: var(--boja-mint-tamni);
  }
  .dnk-napredak-traka {
    height: 10px;
    overflow: hidden;
    border-radius: var(--radijus-pill);
    background: #eee8dc;
  }
  .dnk-napredak-traka span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--boja-mint);
  }
  .zavrsna-dostignuca h3 {
    margin-bottom: 12px;
  }
  .zavrsna-dostignuca-mrezica {
    display: grid;
    gap: 10px;
  }
  .zavrsna-dostignuca,
  .ocjena-igre-zavrsna,
  .osobni-rezultati-naslov,
  .iskustvo-partije,
  .dnk-promjena {
    width: 100%;
    max-width: none;
  }
  .zavrsno-dostignuce {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px;
    border: 1px solid #eee8dc;
    background: #faf7ef;
  }
  .zavrsno-dostignuce-ikona {
    color: var(--boja-zuta-krema);
    font-size: 1.5rem;
    line-height: 1;
  }
  .zavrsno-dostignuce strong {
    color: var(--boja-tekst-naslov);
  }
  .zavrsno-dostignuce p {
    margin: 2px 0;
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-sitni);
  }
  .zavrsno-dostignuce small {
    color: var(--boja-mint-tamni);
    font-weight: 700;
  }
  @media (max-width: 520px) {
    .zavrsni-dnk,
    .zavrsna-dostignuca { padding: 14px; }
    .zavrsni-dnk-zaglavlje { align-items: flex-start; flex-direction: column; }
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
  .nagrada-za-rijec {
    margin: 8px 0 12px;
    padding: 8px 12px;
    border: 1px solid var(--boja-isticanje-slova);
    border-radius: 8px;
    background: color-mix(in srgb, var(--boja-isticanje-slova) 35%, white);
    color: var(--boja-tekst-osnovni);
    text-align: center;
    font-weight: 700;
  }
  .nagrada-srednji {
    border-color: var(--boja-mint);
  }
  .nagrada-veliki {
    border-color: var(--boja-crvena);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--boja-crvena) 18%, transparent);
  }
  .nagrada-streak {
    display: block;
    margin-top: 2px;
    font-size: var(--tekst-mikro);
    font-weight: 600;
  }

  .nagrada-ukras {
    display: block;
    margin: 2px 0;
    font-size: 1.1em;
    letter-spacing: 0.08em;
  }

  .nagrada-napredak {
    display: block;
    margin-top: 4px;
    font-size: var(--tekst-mali);
    font-weight: 600;
  }

  .trenutni-streak {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 4px;
    margin: 8px 0 12px;
    color: var(--boja-tekst-sekundarni);
    text-align: center;
    font-size: var(--tekst-mali);
  }

  .streak-vatre {
    display: inline-flex;
    max-width: min(42vw, 360px);
    flex-wrap: wrap;
    justify-content: center;
    gap: 0;
    line-height: 1;
    font-size: 1rem;
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
  .trazena-slova-istaknuta {
    display: inline-block;
    margin-left: 4px;
    color: var(--boja-isticanje-slova);
    background: var(--boja-tekst);
    padding: 2px 8px;
    border-radius: 6px;
    font-family: var(--font-naslov);
    font-size: var(--tekst-rijec-stola);
    line-height: 1.1;
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
    font-size: inherit;
    font-weight: 700;
    line-height: 1.2;
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
    display: flex;
    gap: 8px;
    width: 100%;
  }
  .potez-gumbi button {
    flex: 1;
    width: 100%;
    margin-top: 8px;
    font: inherit;
    font-size: var(--tekst-baza);
  }
  .potez-gumbi button.ne-znam-gumb {
    background: transparent;
    border: 1px solid var(--boja-akcent);
    color: var(--boja-akcent);
    font-size: var(--tekst-sitni);
    font-weight: 600;
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
  .povijest-naslov {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: space-between;
    padding: 0;
    border: 0;
    background: none;
    color: var(--boja-tekst-naslov);
    font: inherit;
    font-weight: 700;
    text-align: left;
    cursor: pointer;
  }
  .povijest-naslov span:last-child {
    color: var(--boja-akcent);
    font-size: 1.35rem;
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
  .privatna-obavijest {
    background: #fdf6e2;
    border: 1px solid #f4c95d;
    color: #5c554a;
    padding: 10px 14px;
    border-radius: 8px;
    font-weight: 600;
  }
  @media (min-width: 601px) {
    .igraci-red {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }
  .plasmani-lista {
    list-style: none;
    margin: 24px 0 0;
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
  .kraj-akcije {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    margin-top: 24px;
    margin-bottom: 0;
  }
  .kraj-donje-praznine { height: 100px; }
  .igraj-opet-gumb {
    display: inline-block;
    background: var(--boja-pozadina-primarna);
    color: white;
    text-decoration: none;
    padding: 10px 24px;
    border-radius: var(--radijus-pill);
    font-weight: bold;
  }
  .sporedni-gumb {
    display: inline-block;
    background: white;
    border: 2px solid var(--boja-tekst-sekundarni);
    color: var(--boja-tekst-osnovni);
    text-decoration: none;
    padding: 10px 24px;
    border-radius: var(--radijus-pill);
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
  .potvrda-ne-znam p {
    margin: 0;
    color: var(--boja-tekst-sekundarni);
  }
  .potvrda-ne-znam .sporedni-dijalog-gumb {
    border: 1px solid var(--boja-tekst-sekundarni);
    background: white;
    color: var(--boja-tekst-osnovni);
  }
  .potvrda-ne-znam .potvrdi-dijalog-gumb {
    background: var(--boja-akcent);
    color: white;
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
