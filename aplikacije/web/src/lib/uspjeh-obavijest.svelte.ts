let poruka = $state<string | null>(null);
let timer: ReturnType<typeof setTimeout> | null = null;

export function dohvatiUspjehObavijest() {
  return {
    get poruka() {
      return poruka;
    },
  };
}

export function pokaziUspjeh(tekst: string, trajanjeMs = 3000): void {
  poruka = tekst;
  if (timer !== null) clearTimeout(timer);
  timer = setTimeout(() => {
    poruka = null;
    timer = null;
  }, trajanjeMs);
}

export function zatvoriUspjeh(): void {
  if (timer !== null) clearTimeout(timer);
  timer = null;
  poruka = null;
}
