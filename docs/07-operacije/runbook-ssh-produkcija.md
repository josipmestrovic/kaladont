# Runbook: SSH na produkcijski VPS

> **Status 2026-11-05:** produkcijski VPS `kaladont-produkcija` je postavljen (Ubuntu 24.04, CPX22, Nuremberg). Osobni admin ulaz ide isključivo kao korisnik `kaladont` s ključem. Root SSH je isključen. Deploy ključ za GitHub Actions još se postavlja u fazi 6.

Ovo je brza, operativna uputa za **svakodnevno spajanje**. Početna izrada servera i hardening opisani su u [vodiču za postavu VPS-a](vodic-postava-vps.md) i [Operacije for dummies](operacije-for-dummies.md).

## Zlatna pravila

1. U git **nikad** ne upisuj stvarni IPv4, passphrase, privatni ključ ni `.env`.
2. Stvarni IPv4, passphrase SSH ključa i bilješke o host fingerprintu drži u Bitwardenu (`Kaladont / produkcija`).
3. Za administraciju koristi **`kaladont@…`**, ne `root@…` i ne `deploy@…`.
4. Ako SSH host ključ servera iznenada “promijeni otisak”, **stani** i provjeri preko Hetzner konzole — ne prepisuj `known_hosts` napamet.

## Što moraš imati na Windowsu

| Stavka | Gdje |
| --- | --- |
| Privatni ključ | `%USERPROFILE%\.ssh\kaladont_prod_admin` |
| Javni ključ | `%USERPROFILE%\.ssh\kaladont_prod_admin.pub` (komentar `joka-kaladont-produkcija`) |
| Passphrase ključa | Bitwarden |
| Produkcijski IPv4 | Bitwarden kao `<PROD_IPV4>` (Primary IP `kaladont-produkcija-ip`) |
| Pinani known_hosts (preporučeno) | `%USERPROFILE%\.ssh\kaladont_prod_known_hosts` |

Provjera alata:

```powershell
Get-Command ssh, ssh-keygen, ssh-add, ssh-keyscan
```

## Brzo spajanje (svaki dan)

**Windows PowerShell:**

```powershell
$ProdIp = '<PROD_IPV4>'   # zamijeni vrijednošću iz Bitwardena
$adminKey = Join-Path $env:USERPROFILE '.ssh\kaladont_prod_admin'
$knownHosts = Join-Path $env:USERPROFILE '.ssh\kaladont_prod_known_hosts'

# Jednom po sesiji Windowsa (ako agent još nema ključ):
ssh-add $adminKey

if (Test-Path $knownHosts) {
  ssh -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$knownHosts" -i $adminKey "kaladont@$ProdIp"
} else {
  ssh -i $adminKey "kaladont@$ProdIp"
}
```

Očekuješ prompt tipa:

```text
kaladont@kaladont-produkcija:~$
```

Provjera unutra:

```bash
whoami          # kaladont
sudo -n true    # uspjeh bez lozinke
hostname        # kaladont-produkcija
```

### Opcionalno: SSH config alias

U `%USERPROFILE%\.ssh\config` (datoteka nije u gitu):

```sshconfig
Host kaladont-produkcija
  HostName <PROD_IPV4>
  User kaladont
  IdentityFile ~/.ssh/kaladont_prod_admin
  IdentitiesOnly yes
  UserKnownHostsFile ~/.ssh/kaladont_prod_known_hosts
  StrictHostKeyChecking yes
```

Zatim:

```powershell
ssh kaladont-produkcija
```

## Prvo pinanje host ključa (samo kad known_hosts još nema)

1. U Hetzner web konzoli servera (ili nakon pouzdane prve prijave) potvrdi otisak:

```bash
ssh-keygen -E sha256 -lf /etc/ssh/ssh_host_ed25519_key.pub
```

2. S Windowsa:

```powershell
$ProdIp = '<PROD_IPV4>'
$keyDir = Join-Path $env:USERPROFILE '.ssh'
$scanFile = Join-Path $keyDir 'kaladont_prod_known_hosts.novi'
$knownHosts = Join-Path $keyDir 'kaladont_prod_known_hosts'
ssh-keyscan -t ed25519 $ProdIp 2>$null | Set-Content -Encoding ascii $scanFile
ssh-keygen -E sha256 -lf $scanFile
```

3. Tek kad se `SHA256:…` **točno** poklopi s konzolom, premjesti datoteku:

```powershell
Move-Item -Force $scanFile $knownHosts
```

`ssh-keyscan` sam po sebi **ne** potvrđuje identitet servera.

## Što je namjerno zabranjeno

| Pokušaj | Očekivano |
| --- | --- |
| `ssh root@<PROD_IPV4>` | `Permission denied (publickey)` |
| Prijava lozinkom | isključena |
| Rad u Hetzner browser konzoli za svakodnevni posao | ne; koristi SSH s Windowsa |

Hetzner konzola služi samo za hitne situacije (npr. reset root lozinke, usporedba host fingerprinta kad SSH ne radi).

## Korisnici na serveru

| Korisnik | Namjena | SSH |
| --- | --- | --- |
| `kaladont` | Osobna administracija, `sudo` bez lozinke | Da — tvoj `kaladont_prod_admin` |
| `deploy` | GitHub Actions / Docker objava | Da — zasebni Actions ključ (faza 6); zasad prazan `authorized_keys` |
| `root` | Lokalni sustav | SSH **ne** |

## Bitwarden stavke (obvezno)

U mapi `Kaladont / produkcija` neka postoje barem:

1. **Produkcijski IPv4** — Primary IP adresa servera  
2. **SSH passphrase — kaladont_prod_admin**  
3. **SSH host fingerprint produkcija** — `SHA256:…` ed25519 host ključa  
4. Bilješka: putanje ključa na Windowsu i naredba `ssh kaladont@…` / alias `kaladont-produkcija`

## Ako nešto ne radi

| Simptom | Prva provjera |
| --- | --- |
| `Permission denied (publickey)` kao `kaladont` | Je li učitan pravi ključ? `ssh-add -l` mora pokazati `joka-kaladont-produkcija` |
| Traži passphrase svaki put | `ssh-add` u toj PowerShell sesiji |
| Host key verification failed | Ne briši blindly; usporedi otisak s Hetzner konzolom |
| Timeout | Hetzner Cloud Firewall i UFW moraju dozvoljavati TCP 22 |
| `sudo` traži lozinku | Na ovoj postavi `kaladont` ima NOPASSWD; ako nema, ne improviziraj — otvori incident / agent |

## Poveznice

- [Vodič postava VPS](vodic-postava-vps.md)
- [Operacije for dummies](operacije-for-dummies.md)
- [CI/CD — produkcijski Environment secrets](ci-cd.md)
- [Incidentni postupak](incidentni-postupak.md)
