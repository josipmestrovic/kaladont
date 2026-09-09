# ADR-005: hrLex kao izvor rječnika

- **Status:** prihvaćen (opseg filtra proširen [ADR-om 013](013-sve-vrste-rijeci-leksemske-grupe.md) — sve vrste riječi)
- **Datum:** 2026-08-20

## Kontekst

Igra treba strojno čitljiv popis hrvatskih općih imenica u nominativu jednine, bez vlastitih imena i kratica. Ručno sastavljanje ne dolazi u obzir; komercijalni rječnici (HJP) nemaju otvorene licence.

## Odluka

**hrLex 1.3** (Ljubešić, CLARIN.SI, <http://hdl.handle.net/11356/1232>): 6,4 M oblika riječi sa MSD morfološkim oznakama i frekvencijama iz korpusa hrWaC, licenca **CC BY-SA 4.0**. Oznake omogućuju precizno filtriranje upravo onoga što pravila traže. Uvozi se **bez praga frekvencije** — sve opće imenice; čišćenje ide isključivo kroz prijave igrača.

## Razmotrene alternative

- **Hunspell hr_HR** — aktivno održavan, ali bez oznaka vrste riječi; ne može izdvojiti „samo imenice u nominativu".
- **Wikirječnik** — nepotpun i neujednačen.
- **Prag frekvencije pri uvozu** — razmatran i odbačen: radije bogatija baza uz igračko čišćenje, nego tiho izbačene legitimne rijetke riječi.

## Posljedice

- Obavezna atribucija u aplikaciji i dokumentaciji (vidi [izvor-i-licenca.md](../../04-rjecnik/izvor-i-licenca.md)).
- Izvedeni popis riječi je CC BY-SA → **ne commita se** u repozitorij (ADR-010).
- Web-korpusni šum (tipfeleri) ući će u bazu — prijave igrača i admin stranica su predviđeni mehanizam ispravljanja.
