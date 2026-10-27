# Stalbeheer

Managementplatform voor een paardenhouderij. Eigen code, dus volledig uit te breiden.

**Modules**

| Module | Wat erin zit |
|---|---|
| Vandaag | Dagplanning, verlopen gezondheidsdata, transport komende week, openstaande facturen, tachograaftermijnen, RVO te melden |
| Paarden | Dossier per paard: identiteit (UELN, chip, stamboek), afstamming, eigenaar, stal, discipline. Tabs: Gezondheid, Foto's & video, Röntgen, Documenten, Wedstrijden, Planning, RVO |
| Planning | Taken per dag/week, per medewerker, per paard; herhalend (dagelijks/wekelijks); dag kopiëren; afvinken |
| Gezondheid | Overzicht vaccinaties, ontworming, smid, tandarts per paard met volgende datum |
| Wedstrijden | Resultaten per paard/jaar, filmpjes erbij, CSV-import (KNHS/Equi Competitions), Equipe-koppeling |
| Postvak | Media uit WhatsApp of "Delen" die nog aan een paard gekoppeld moeten worden |
| Klanten | Eigenaren/pensionklanten met hun paarden, facturen en transporten |
| Facturen | Diensten & tarieven, maandfacturen in één klik, herinneringen in bulk, creditnota's, PDF via afdrukken, mail naar klant |
| Transport | Ritten (met Google Maps-link), voertuigen, APK, tachograaf-ijking en wettelijke downloadtermijnen, rit factureren, FleetGo-koppeling |
| Zonnepanelen | Installaties, dagmetingen, CSV-import uit omvormer-app, maandgrafiek, waarde teruglevering |
| RVO I&R | Meldingen aanvoer/afvoer/geboorte/dood/import/export met 7-dagen termijn; afvinken of (na koppeling) direct versturen |
| Instellingen | Bedrijfsgegevens, medewerkers met rollen, **eigen velden** (maatwerk zonder programmeren), diensten, koppelingen |

**Rollen:** Eigenaar (alles) en Medewerker (geen facturen/instellingen).

---

## 1. Installeren (lokaal, eerste keer)

Vereist: Node.js 20 of hoger, en een PostgreSQL-database (lokaal, of gratis bij [Supabase](https://supabase.com) / [Neon](https://neon.tech)).

```bash
cd stalbeheer
npm install
cp .env.example .env
```

Open `.env` en vul in:
- `DATABASE_URL` – de verbindingsstring van je database
- `AUTH_SECRET` – een lange willekeurige tekst (bv. `openssl rand -hex 32`)
- `SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD` – je eigen inlog

Daarna:

```bash
npm run db:push      # maakt de tabellen aan
npm run db:seed      # maakt het eigenaar-account en standaarddiensten aan
npm run dev          # start op http://localhost:3000
```

Inloggen met het e-mailadres en wachtwoord uit `.env`.

## 2. Online zetten (zodat medewerkers en je telefoon erbij kunnen)

**Snelste route: Render.com (geen server nodig).** De repository bevat een `render.yaml` die app, database en opslag voor foto's/video's in één keer aanmaakt.

1. Maak een account op [render.com](https://render.com) en koppel je GitHub-account.
2. Kies *New › Blueprint*, selecteer de repository `stalbeheer` en klik *Apply*.
3. Render vraagt om je naam, e-mailadres en wachtwoord voor het eerste account (`SEED_OWNER_*`). Na een paar minuten staat de app op `https://stalbeheer-….onrender.com`.
4. Kosten: ≈ $7 (app) + $6 (database) + $5 (20 GB opslag) + $1 (dagelijkse synchronisatie) per maand. In `render.yaml` staat hoe je gratis kunt proberen.

Elke wijziging die in GitHub wordt gezet, wordt daarna automatisch gecontroleerd (`npm install`, typecontrole, build, opstarten) en door Render opnieuw uitgerold.

**Eigen server met Docker** (bv. een VPS bij Hetzner of TransIP, vanaf ca. €5/maand). Foto's en video's staan dan gewoon op de schijf van de server.

```bash
cp .env.example .env     # vul AUTH_SECRET en SEED_* in; DATABASE_URL staat al goed voor docker-compose
docker compose up -d --build
docker compose exec app npm run db:push
docker compose exec app npm run db:seed
```

De app draait dan op poort 3000; zet er een reverse proxy met HTTPS voor (bv. Caddy of Nginx) en koppel je domeinnaam. Dagelijkse synchronisatie (Equipe/FleetGo): een cronjob die `GET https://<domein>/api/sync` aanroept met header `Authorization: Bearer <SYNC_SECRET>`.

**Alternatief: Vercel + Supabase.** Werkt ook, met twee aandachtspunten:
1. Op Vercel is de schijf niet blijvend; laat een ontwikkelaar `src/lib/storage.ts` omzetten naar S3 of Supabase Storage (één bestand, drie functies). Zonder die stap gaan uploads verloren.
2. De dagelijkse synchronisatie draait via `vercel.json` (cron om 05:00); zet daarvoor de environment variable `CRON_SECRET` (willekeurige tekst).

**Op je telefoon:** open de site in Chrome (Android) en kies *Toevoegen aan startscherm*. Daarna kun je vanuit WhatsApp *Delen → Stalbeheer* gebruiken. Op iPhone: *Zet op beginscherm* in Safari (delen vanuit WhatsApp werkt daar niet; gebruik het WhatsApp-stalnummer of upload via het dossier).

De app rekent altijd in Nederlandse tijd (`APP_TIMEZONE`), ongeacht de tijdzone van de server.

## 3. Koppelingen

Alles staat in de app onder **Instellingen › Koppelingen**, inclusief kant-en-klare aanvraag-mails. Samengevat:

| Koppeling | Wat je nodig hebt | Van wie |
|---|---|---|
| FleetGo | client_id + client_secret, plus je FleetGo-login | info@fleetgo.com |
| Equipe | access token met scope `read` | online.equipe.com (profiel) of info@equipe.com |
| WhatsApp Business | Meta-app met WhatsApp-product, permanent token, Phone Number ID, webhook-URL | developers.facebook.com |
| RVO I&R | PKIoverheid-certificaat, aanmelding + testaccount, Berichtenboek | dr.fab.edv@rvo.nl |
| KNHS / Equi Competitions | geen API bekend → CSV-import | info@knhs.nl (vragen) |

Zie ook `docs/aanvraag-mails.md`.

De koppelingscode staat in `src/lib/integrations/`. Voor RVO moet een ontwikkelaar, zodra het Berichtenboek en testaccount binnen zijn, de XML-elementnamen in `rvo.ts` controleren tegen de WSDL van RVO.

## 4. Maatwerk

- **Zonder programmeren:** Instellingen › Eigen velden. Velden verschijnen op het formulier en de detailpagina van paard, klant of voertuig.
- **Met programmeren:** elke module is een map in `src/app/(app)/<module>/` met `page.tsx` (scherm) en `actions.ts` (opslaan). Het datamodel staat in `prisma/schema.prisma`; na een wijziging: `npm run db:push`.

## 5. Structuur

```
prisma/schema.prisma        datamodel
prisma/seed.ts              eerste account + standaarddiensten
src/app/(app)/              alle schermen (ingelogd)
src/app/login/              inloggen
src/app/api/bestand/[id]    beveiligd serveren van foto's/video's/documenten
src/app/api/whatsapp/webhook  WhatsApp Cloud API webhook
src/app/api/delen           deel-doel (Android "Delen naar Stalbeheer")
src/app/api/sync            dagelijkse synchronisatie
src/app/print/factuur/[id]  afdrukweergave factuur (PDF)
src/lib/auth.ts             sessies en rollen
src/lib/storage.ts          bestandsopslag (vervangbaar door S3/Supabase)
src/lib/integrations/       fleetgo, equipe, whatsapp, rvo, knhs
src/components/             formulieren en UI-bouwstenen
```

## 6. Veelgestelde vragen

**Resultaten uit Equipe worden niet aan een paard gekoppeld.** De naam in Equipe moet overeenkomen met de naam (of roepnaam) van het paard in het dossier. Zet de Equipe-schrijfwijze als roepnaam.

**Een filmpje via WhatsApp kwam in het Postvak.** Er stond geen (herkenbare) paardnaam in het bijschrift. Koppel het in het Postvak; de volgende keer de naam in het bijschrift zetten.

**Tachograaftermijnen staan op 'onbekend'.** Vul bij Transport › Voertuigen de laatste downloaddatums in, of activeer de FleetGo-koppeling (en vraag FleetGo naar het endpoint voor de downloadstatus; zie `fleetgo.ts`).

**Wachtwoord van de eigenaar vergeten?** Het eigenaarswachtwoord komt uit de instelling `SEED_OWNER_PASSWORD` (bij Render: de web service › Environment). Pas die aan en start de app opnieuw (Manual Deploy); daarna geldt het nieuwe wachtwoord. Medewerkers krijgen een nieuw wachtwoord via Instellingen › Medewerkers.

**Ik wil pensionklanten zelf laten inloggen.** Dat is een uitbreiding: een rol `KLANT` toevoegen in `schema.prisma` en de pagina's filteren op `ownerId`. De basis (rollen, sessies) is er al.
