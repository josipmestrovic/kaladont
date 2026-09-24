# Runbook: zahtjev za podatke ili brisanje računa

## Ulazni zahtjev

Korisnik šalje zahtjev na `info@kaladont.hr` s email adrese registrirane na računu. Zahtjev s druge adrese ne izvršava se bez dodatne provjere vlasništva.

Podržane kategorije su brisanje računa, pristup vlastitim podacima i ispravak podataka. Cilj je odgovoriti i obraditi zahtjev u roku do 7 dana.

## Brisanje

1. Provjeriti da je pošiljatelj registrirana email adresa.
2. Napraviti sigurnosnu kopiju prema važećem operativnom postupku prije destruktivne izmjene.
3. Pokrenuti `pnpm --filter posluzitelj obrisi-racun --email <adresa> --potvrdi` iz odgovarajućeg imagea/okruženja.
4. Provjeriti da login i postojeći Socket.IO token više ne rade.
5. Provjeriti da je povijest partija ostala čitljiva s nadimkom `Obrisani igrač`.
6. Korisniku poslati kratku potvrdu obrade.

CLI uklanja email, lozinku, potvrdu emaila, sesije i privatni napredak. Zajedničke partije, potezi, plasmani i prijave ostaju anonimizirani radi drugih igrača i integriteta povijesti.

Ne kopirati lozinke, tokene, cijele dumpove ili nepotrebne osobne podatke u email, chat ili log. Evidencija zahtjeva čuva samo datum, kategoriju i ishod; email komunikacija se čuva 12 mjeseci.

## Pristup i ispravak

Za pristup se priprema ograničen izvoz podataka konkretnog računa, bez podataka drugih igrača. Za ispravak se koriste postojeće postavke računa ili se promjena napravi ručno nakon provjere registrirane adrese.