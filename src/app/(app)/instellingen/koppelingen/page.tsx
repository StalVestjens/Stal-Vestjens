import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { Card, Field, Badge, Empty } from "@/components/ui";
import { getSettings } from "@/lib/settings";
import { fmtDate, fmtTime } from "@/lib/format";
import { saveIntegrations, testIntegration } from "../actions";
import { runEquipeSync } from "../../wedstrijden/actions";
import { runFleetGoSync } from "../../transport/actions";

const SECRET = "••••••••";
const mask = (v: string) => (v ? SECRET : "");

export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<{ test?: string; ok?: string; msg?: string }> }) {
  await requireSession("EIGENAAR");
  const sp = await searchParams;
  const s = await getSettings(["fleetgo_client_id", "fleetgo_client_secret", "fleetgo_username", "fleetgo_password", "equipe_token", "whatsapp_verify_token", "whatsapp_access_token", "whatsapp_phone_number_id", "whatsapp_app_secret", "rvo_ubn", "rvo_endpoint", "rvo_cert_path", "rvo_key_path", "bedrijfsnaam"]);
  const logs = await db.syncLog.findMany({ orderBy: { createdAt: "desc" }, take: 30 });
  const status = (ok: boolean) => <Badge tone={ok ? "ok" : undefined}>{ok ? "Ingesteld" : "Nog niet ingesteld"}</Badge>;
  const bedrijf = s.bedrijfsnaam || "[bedrijfsnaam]";

  const mails = {
    fleetgo: { to: "info@fleetgo.com", subject: "Aanvraag API-toegang FleetGo", body: `Beste FleetGo,\n\nWij gebruiken FleetGo (incl. Remote Tacho Download) voor onze paardentransporten bij ${bedrijf}. Wij bouwen een eigen managementsysteem en willen onze FleetGo-gegevens daarin koppelen.\n\nGraag ontvangen wij API-toegang (client_id en client_secret) voor api.fleetgo.com voor ons account [FleetGo-gebruikersnaam].\n\nWij willen gebruikmaken van:\n- voertuigen en kilometerstanden (equipment/Getfleet)\n- ritten (trips/GetTrips)\n- de status van de tachograaf-downloads (laatste download voertuigunit en chauffeurskaart). Kunt u aangeven welk endpoint hiervoor beschikbaar is?\n\nMet vriendelijke groet,\n[naam]\n${bedrijf}\n[telefoon]` },
    equipe: { to: "info@equipe.com", subject: "API access token for results (online.equipe.com)", body: `Hello Equipe team,\n\nWe run ${bedrijf}, an equestrian stable in the Netherlands, and would like to import our own competition results from online.equipe.com into our stable management system via the API (GET /api/v2/results, scope "read").\n\nCould you tell us how to create a personal access token for our account [Equipe account e-mail], or issue one for us?\n\nKind regards,\n[naam]\n${bedrijf}` },
    rvo: { to: "dr.fab.edv@rvo.nl", subject: "Aanmelding webservice I&R paardachtigen + testaccount", body: `Geachte heer/mevrouw,\n\nWij, ${bedrijf} (UBN ${s.rvo_ubn || "[UBN]"}, KvK [KvK-nummer]), houden paardachtigen en willen onze I&R-meldingen (aanvoer, afvoer, geboorte, dood, import, export) rechtstreeks vanuit ons eigen bedrijfsmanagementsysteem doorgeven.\n\nGraag melden wij ons systeem aan voor de webservice I&R (Berichtenboek I&R) en ontvangen wij een testaccount. Wij beschikken over / vragen aan een PKIoverheid-certificaat op naam van ${bedrijf}.\n\nContactpersoon voor de technische koppeling: [naam], [e-mail], [telefoon].\n\nMet vriendelijke groet,\n[naam]\n${bedrijf}` },
    knhs: { to: "info@knhs.nl", subject: "Koppeling wedstrijdresultaten met eigen stalsysteem", body: `Geachte heer/mevrouw,\n\nWij, ${bedrijf}, willen de wedstrijdresultaten van onze paarden (KNHS-nummers: [...]) automatisch ophalen in ons eigen stalmanagementsysteem.\n\nBiedt de KNHS hiervoor een API of gegevenskoppeling voor stallen/eigenaren, en zo ja: hoe kunnen wij ons daarvoor aanmelden? Als alternatief: is er een exportmogelijkheid (CSV) van resultaten uit Mijn KNHS?\n\nMet vriendelijke groet,\n[naam]\n${bedrijf}` },
  };
  const mailto = (m: { to: string; subject: string; body: string }) => `mailto:${m.to}?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(m.body)}`;

  return (
    <div className="space-y-4">
      {sp.test && <p className={`card p-3 text-sm ${sp.ok === "1" ? "" : "text-[var(--danger)]"}`}>{sp.ok === "1" ? "✓" : "✕"} {sp.test}: {sp.msg}</p>}
      <p className="text-sm muted">Vul hier de sleutels in zodra je ze hebt ontvangen. Ze worden in de database bewaard; je kunt ze ook in <code>.env</code> zetten. Per dienst staat een kant-en-klare aanvraag-mail klaar.</p>

      <form action={saveIntegrations} className="space-y-4">
        <Card title="FleetGo (tachograaf, ritten, voertuigen)" actions={status(!!s.fleetgo_client_id)}>
          <div className="grid md:grid-cols-4 gap-3">
            <Field label="Client ID"><input name="fleetgo_client_id" className="input" defaultValue={s.fleetgo_client_id} /></Field>
            <Field label="Client secret"><input name="fleetgo_client_secret" className="input" defaultValue={mask(s.fleetgo_client_secret)} /></Field>
            <Field label="FleetGo-gebruikersnaam"><input name="fleetgo_username" className="input" defaultValue={s.fleetgo_username} /></Field>
            <Field label="FleetGo-wachtwoord"><input name="fleetgo_password" type="password" className="input" defaultValue={mask(s.fleetgo_password)} /></Field>
          </div>
          <details className="mt-3 text-sm"><summary className="muted">Hoe krijg ik toegang?</summary>
            <ol className="list-decimal ml-5 mt-2 space-y-1">
              <li>Stuur de aanvraag-mail naar FleetGo: <a className="underline" href={mailto(mails.fleetgo)}>mail openen</a>.</li>
              <li>Je ontvangt een client_id en client_secret. Vul die hier in, samen met je normale FleetGo-login.</li>
              <li>Klik op "Test". Daarna haalt "FleetGo ophalen" bij Transport je voertuigen en ritten binnen; dagelijks automatisch via /api/sync.</li>
            </ol></details>
        </Card>

        <Card title="Equipe (wedstrijdresultaten)" actions={status(!!s.equipe_token)}>
          <Field label="Access token (scope: read)"><input name="equipe_token" className="input" defaultValue={mask(s.equipe_token)} /></Field>
          <details className="mt-3 text-sm"><summary className="muted">Hoe krijg ik toegang?</summary>
            <ol className="list-decimal ml-5 mt-2 space-y-1">
              <li>Log in op <a className="underline" href="https://online.equipe.com" target="_blank">online.equipe.com</a> met het account waaronder jullie ruiters/paarden starten; zoek bij je profiel naar "API"/"Access tokens".</li>
              <li>Staat die optie er niet? <a className="underline" href={mailto(mails.equipe)}>Mail Equipe</a> met de aanvraag.</li>
              <li>Plak het token hier en klik op "Test". Resultaten worden op paardnaam gekoppeld; zorg dat de naam in het dossier overeenkomt met de naam in Equipe (of zet de Equipe-naam als roepnaam).</li>
            </ol>
            <p className="mt-2 muted">KNHS en Equi Competitions: nog geen openbare API bekend. <a className="underline" href={mailto(mails.knhs)}>Mail de KNHS</a> om te vragen naar een koppeling; intussen werkt de CSV-import bij Wedstrijden.</p></details>
        </Card>

        <Card title="WhatsApp Business (filmpjes per paard)" actions={status(!!s.whatsapp_access_token)}>
          <div className="grid md:grid-cols-4 gap-3">
            <Field label="Verify token (zelf kiezen)"><input name="whatsapp_verify_token" className="input" defaultValue={s.whatsapp_verify_token} placeholder="bijv. stal-2026-geheim" /></Field>
            <Field label="Permanent access token"><input name="whatsapp_access_token" className="input" defaultValue={mask(s.whatsapp_access_token)} /></Field>
            <Field label="Phone Number ID"><input name="whatsapp_phone_number_id" className="input" defaultValue={s.whatsapp_phone_number_id} /></Field>
            <Field label="App Secret (App settings › Basic)"><input name="whatsapp_app_secret" className="input" defaultValue={mask(s.whatsapp_app_secret)} /></Field>
          </div>
          <details className="mt-3 text-sm"><summary className="muted">Hoe werkt het en hoe stel ik het in?</summary>
            <p className="mt-2">Je krijgt een apart WhatsApp-nummer voor de stal. Iedereen stuurt filmpjes/foto's naar dat nummer met de paardnaam in het bijschrift; ze komen automatisch in het dossier. Zonder herkende naam komen ze in het Postvak.</p>
            <ol className="list-decimal ml-5 mt-2 space-y-1">
              <li>Maak een app op <a className="underline" href="https://developers.facebook.com" target="_blank">developers.facebook.com</a> (type Business), voeg het product "WhatsApp" toe en koppel een (nieuw) telefoonnummer.</li>
              <li>Maak een System User met permanent token (whatsapp_business_messaging) en noteer het "Phone number ID" en het App Secret (App settings › Basic).</li>
              <li>Webhook: URL <code>https://[jouw-domein]/api/whatsapp/webhook</code>, verify token = het token hierboven; abonneer op "messages".</li>
              <li>Vul alles hier in, klik op "Test", en stuur een testfilmpje met de naam van een paard.</li>
            </ol>
            <p className="mt-2 muted">Alternatief op Android: open de app in Chrome, kies "Toevoegen aan startscherm"; daarna kun je vanuit WhatsApp direct "Delen → Stalbeheer".</p></details>
        </Card>

        <Card title="RVO · I&R paardachtigen" actions={status(!!s.rvo_endpoint)}>
          <div className="grid md:grid-cols-4 gap-3">
            <Field label="UBN"><input name="rvo_ubn" className="input" defaultValue={s.rvo_ubn} /></Field>
            <Field label="Webservice-endpoint (van RVO)"><input name="rvo_endpoint" className="input" defaultValue={s.rvo_endpoint} placeholder="https://…rvo.nl/…" /></Field>
            <Field label="Pad certificaat (.pem)"><input name="rvo_cert_path" className="input" defaultValue={s.rvo_cert_path} placeholder="/etc/stal/rvo-cert.pem" /></Field>
            <Field label="Pad privésleutel (.pem)"><input name="rvo_key_path" className="input" defaultValue={s.rvo_key_path} placeholder="/etc/stal/rvo-key.pem" /></Field>
          </div>
          <details className="mt-3 text-sm"><summary className="muted">Hoe krijg ik toegang?</summary>
            <ol className="list-decimal ml-5 mt-2 space-y-1">
              <li>Vraag een PKIoverheid-certificaat aan (bijv. via KPN of QuoVadis/DigiCert) op naam van je bedrijf.</li>
              <li><a className="underline" href={mailto(mails.rvo)}>Mail RVO</a> om je systeem aan te melden voor de I&R-webservice en een testaccount te krijgen. Je ontvangt het Berichtenboek en de endpoints.</li>
              <li>Zet certificaat en sleutel op de server, vul de paden en het endpoint in. Een ontwikkelaar controleert dan de berichtstructuur in <code>src/lib/integrations/rvo.ts</code> tegen het Berichtenboek en test met het testaccount.</li>
              <li>Tot die tijd: meld via <a className="underline" href="https://mijn.rvo.nl" target="_blank">Mijn RVO</a> en vink de melding af bij RVO I&R.</li>
            </ol></details>
        </Card>

        <button className="btn btn-primary">Alle koppelingen opslaan</button>
      </form>

      <Card title="Testen en synchroniseren">
        <div className="flex flex-wrap gap-2">
          <form action={testIntegration}><input type="hidden" name="which" value="fleetgo" /><button className="btn">Test FleetGo</button></form>
          <form action={testIntegration}><input type="hidden" name="which" value="equipe" /><button className="btn">Test Equipe</button></form>
          <form action={testIntegration}><input type="hidden" name="which" value="whatsapp" /><button className="btn">Test WhatsApp</button></form>
          <form action={runFleetGoSync}><button className="btn btn-primary">↻ FleetGo nu ophalen</button></form>
          <form action={runEquipeSync}><button className="btn btn-primary">↻ Equipe nu ophalen</button></form>
        </div>
        <p className="text-xs muted mt-2">Automatisch dagelijks: laat een planner <code>GET /api/sync</code> aanroepen met header <code>Authorization: Bearer [SYNC_SECRET]</code> (bij Vercel gebeurt dit via vercel.json).</p>
      </Card>

      <Card title="Logboek koppelingen">
        {logs.length === 0 ? <Empty>Nog geen synchronisaties.</Empty> : (
          <table className="tbl"><thead><tr><th>Wanneer</th><th>Koppeling</th><th>Resultaat</th></tr></thead>
            <tbody>{logs.map((l) => <tr key={l.id}><td className="whitespace-nowrap">{fmtDate(l.createdAt)} {fmtTime(l.createdAt)}</td><td><Badge tone={l.ok ? "ok" : "danger"}>{l.integration}</Badge></td><td className="text-sm">{l.message}</td></tr>)}</tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
