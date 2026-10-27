# Aanvraag-mails voor de koppelingen

Vul de tekst tussen [haken] in en verstuur. Dezelfde mails staan ook klikbaar in de app onder Instellingen › Koppelingen.

---

## 1. FleetGo – API-toegang (tachograaf, ritten, voertuigen)

**Aan:** info@fleetgo.com
**Onderwerp:** Aanvraag API-toegang FleetGo

Beste FleetGo,

Wij gebruiken FleetGo (incl. Remote Tacho Download) voor onze paardentransporten bij [bedrijfsnaam]. Wij bouwen een eigen managementsysteem en willen onze FleetGo-gegevens daarin koppelen.

Graag ontvangen wij API-toegang (client_id en client_secret) voor api.fleetgo.com voor ons account [FleetGo-gebruikersnaam].

Wij willen gebruikmaken van:
- voertuigen en kilometerstanden (equipment/Getfleet)
- ritten (trips/GetTrips)
- de status van de tachograaf-downloads (laatste download voertuigunit en chauffeurskaart). Kunt u aangeven welk endpoint hiervoor beschikbaar is?

Met vriendelijke groet,
[naam]
[bedrijfsnaam]
[telefoon]

---

## 2. Equipe – access token voor resultaten

Eerst zelf proberen: log in op https://online.equipe.com, open je profiel en kijk of je daar een "API"- of "Access token"-optie ziet. Zo niet:

**Aan:** info@equipe.com
**Onderwerp:** API access token for results (online.equipe.com)

Hello Equipe team,

We run [bedrijfsnaam], an equestrian stable in the Netherlands, and would like to import our own competition results from online.equipe.com into our stable management system via the API (GET /api/v2/results, scope "read").

Could you tell us how to create a personal access token for our account [Equipe account e-mail], or issue one for us?

Kind regards,
[naam]
[bedrijfsnaam]

---

## 3. RVO – webservice I&R paardachtigen

Vooraf: vraag een **PKIoverheid-certificaat** aan op naam van je bedrijf (bijv. via KPN, QuoVadis/DigiCert of Digidentity). Dit kost enkele weken; begin daar dus mee.

**Aan:** dr.fab.edv@rvo.nl
**Onderwerp:** Aanmelding webservice I&R paardachtigen + testaccount

Geachte heer/mevrouw,

Wij, [bedrijfsnaam] (UBN [UBN], KvK [KvK-nummer]), houden paardachtigen en willen onze I&R-meldingen (aanvoer, afvoer, geboorte, dood, import, export) rechtstreeks vanuit ons eigen bedrijfsmanagementsysteem doorgeven.

Graag melden wij ons systeem aan voor de webservice I&R (Berichtenboek I&R) en ontvangen wij een testaccount. Wij beschikken over / vragen aan een PKIoverheid-certificaat op naam van [bedrijfsnaam].

Contactpersoon voor de technische koppeling: [naam], [e-mail], [telefoon].

Met vriendelijke groet,
[naam]
[bedrijfsnaam]

---

## 4. KNHS – vraag naar een koppeling

**Aan:** info@knhs.nl
**Onderwerp:** Koppeling wedstrijdresultaten met eigen stalsysteem

Geachte heer/mevrouw,

Wij, [bedrijfsnaam], willen de wedstrijdresultaten van onze paarden (KNHS-nummers: [...]) automatisch ophalen in ons eigen stalmanagementsysteem.

Biedt de KNHS hiervoor een API of gegevenskoppeling voor stallen/eigenaren, en zo ja: hoe kunnen wij ons daarvoor aanmelden? Als alternatief: is er een exportmogelijkheid (CSV) van resultaten uit Mijn KNHS?

Met vriendelijke groet,
[naam]
[bedrijfsnaam]

---

## 5. WhatsApp Business (geen mail nodig, zelf instellen)

1. Ga naar https://developers.facebook.com, maak een app (type *Business*) en voeg het product **WhatsApp** toe.
2. Koppel een **nieuw** telefoonnummer (het stalnummer; dit nummer kan daarna niet meer in de gewone WhatsApp-app).
3. Maak onder *Business settings › System users* een system user met een **permanent token** (rechten: `whatsapp_business_messaging`, `whatsapp_business_management`). Noteer ook het **Phone number ID** en het **App Secret** (App settings › Basic).
4. Webhook: URL `https://[jouw-domein]/api/whatsapp/webhook`, verify token = wat je in de app bij WhatsApp invult; abonneer op het veld **messages**.
5. Vul token, Phone number ID en verify token in bij Instellingen › Koppelingen en klik op *Test WhatsApp*.
6. Stuur een testfilmpje naar het nummer met de naam van een paard in het bijschrift.
