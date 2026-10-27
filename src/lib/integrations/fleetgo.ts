/**
 * FleetGo-koppeling (voertuigen, ritten, tachograaf).
 *
 * FleetGo (voorheen RitAssist) heeft een REST-API op https://api.fleetgo.com.
 * Toegang (client_id + client_secret) vraag je aan via info@fleetgo.com; je gebruikt
 * daarnaast je gewone FleetGo-gebruikersnaam en -wachtwoord.
 *
 * Gebruikte endpoints (zoals bekend uit de openbare FleetGo/RitAssist-client):
 *   POST /api/session/login                       → access_token
 *   GET  /api/equipment/Getfleet?groupId=0&hasDeviceOnly=false → voertuigen incl. kilometerstand
 *   GET  /api/trips/GetTrips?equipmentId=..&from=..&to=..&extendedInfo=True → ritten
 *
 * De tachograaf-downloaddata (laatste download voertuigunit / chauffeurskaart) zitten in
 * FleetGo's "Remote Tacho Download"-module. Het exacte endpoint daarvoor staat niet in de
 * openbare client; vraag FleetGo bij het aanvragen van de API-toegang naar het endpoint voor
 * "tacho download status" en vul dat in bij TACHO_STATUS_PATH hieronder. Tot die tijd worden
 * de datums handmatig bijgehouden bij Transport › Voertuigen.
 */
import { db } from "../db";
import { getSettings, logSync } from "../settings";

const BASE = "https://api.fleetgo.com";
const TACHO_STATUS_PATH = process.env.FLEETGO_TACHO_STATUS_PATH ?? ""; // bv. "/api/tacho/GetDownloadStatus"

type Creds = { clientId: string; clientSecret: string; username: string; password: string };

async function creds(): Promise<Creds | null> {
  const s = await getSettings(["fleetgo_client_id", "fleetgo_client_secret", "fleetgo_username", "fleetgo_password"]);
  const c = {
    clientId: s.fleetgo_client_id || process.env.FLEETGO_CLIENT_ID || "",
    clientSecret: s.fleetgo_client_secret || process.env.FLEETGO_CLIENT_SECRET || "",
    username: s.fleetgo_username || process.env.FLEETGO_USERNAME || "",
    password: s.fleetgo_password || process.env.FLEETGO_PASSWORD || "",
  };
  return c.clientId && c.clientSecret && c.username && c.password ? c : null;
}

async function login(c: Creds): Promise<string> {
  const r = await fetch(`${BASE}/api/session/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: c.clientId, client_secret: c.clientSecret, username: c.username, password: c.password }),
  });
  if (!r.ok) throw new Error(`Inloggen bij FleetGo mislukt (${r.status})`);
  const j = (await r.json()) as { access_token?: string };
  if (!j.access_token) throw new Error("FleetGo gaf geen access_token terug; controleer client_id/secret en gebruikersnaam/wachtwoord.");
  return j.access_token;
}

async function get<T>(token: string, path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`FleetGo ${path} → ${r.status}`);
  return r.json() as Promise<T>;
}

type FleetItem = { Id: number; EquipmentHeader: { SerialNumber: string; Make?: string; Model?: string; EquipmentID?: string }; Odometer?: number };
type TripAddress = { Address?: string; City?: string; PostalCode?: string; Country?: string } | null;
type TripEnd = { DateTime: string | null; Odometer?: number; Description?: string; Address?: TripAddress };
type FleetTrip = { Id: number; RideNumber?: string; EquipmentId: number; Distance?: number; RideType?: string; From: TripEnd; To: TripEnd };

const fmtAddr = (a?: TripAddress, fallback = "") => (a ? [a.Address, a.City].filter(Boolean).join(", ") : "") || fallback || "Onbekend";
const normPlate = (p: string) => p.replace(/[-\s]/g, "").toUpperCase();

export async function testFleetGo(): Promise<{ ok: boolean; message: string }> {
  try {
    const c = await creds();
    if (!c) return { ok: false, message: "Nog niet alle FleetGo-gegevens ingevuld." };
    const token = await login(c);
    const fleet = await get<FleetItem[]>(token, "/api/equipment/Getfleet?groupId=0&hasDeviceOnly=false");
    return { ok: true, message: `Verbonden. ${fleet.length} voertuig(en) gevonden: ${fleet.map((f) => f.EquipmentHeader?.SerialNumber).join(", ")}` };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

/**
 * Synchroniseert:
 *  - voertuigen: koppelt op kenteken, werkt kilometerstand bij, maakt onbekende voertuigen aan
 *  - ritten van de afgelopen 14 dagen: maakt per FleetGo-rit een Transport (status AFGEROND) als die nog niet bestaat
 *  - tachograafstatus (alleen als TACHO_STATUS_PATH is ingesteld)
 */
export async function syncFleetGo(): Promise<{ ok: boolean; message: string }> {
  const c = await creds();
  if (!c) return { ok: false, message: "FleetGo niet ingesteld." };
  try {
    const token = await login(c);
    const fleet = await get<FleetItem[]>(token, "/api/equipment/Getfleet?groupId=0&hasDeviceOnly=false");
    const vehicles = await db.vehicle.findMany();
    let newVehicles = 0, newTrips = 0;

    for (const f of fleet) {
      const plate = f.EquipmentHeader?.SerialNumber ?? "";
      if (!plate) continue;
      let v = vehicles.find((x) => x.fleetgoId === String(f.Id)) ?? vehicles.find((x) => normPlate(x.licensePlate) === normPlate(plate));
      const odo = f.Odometer != null ? Math.round(Number(f.Odometer)) : undefined;
      if (v) {
        v = await db.vehicle.update({ where: { id: v.id }, data: { fleetgoId: String(f.Id), ...(odo ? { odometerKm: odo } : {}) } });
      } else {
        v = await db.vehicle.create({ data: { name: [f.EquipmentHeader.Make, f.EquipmentHeader.Model].filter(Boolean).join(" ") || plate, licensePlate: plate, fleetgoId: String(f.Id), odometerKm: odo ?? null, type: "Vrachtwagen" } });
        newVehicles++;
      }

      // Ritten van de afgelopen 14 dagen
      const to = new Date();
      const from = new Date(Date.now() - 14 * 864e5);
      const trips = await get<FleetTrip[]>(token, `/api/trips/GetTrips?equipmentId=${f.Id}&from=${from.toISOString().slice(0, 10)}&to=${to.toISOString().slice(0, 10)}&extendedInfo=True`);
      for (const t of trips) {
        const ext = `fleetgo:${t.Id}`;
        const exists = await db.transport.findFirst({ where: { externalTripId: ext } });
        if (exists || !t.From?.DateTime) continue;
        const km = t.Distance != null ? Number(t.Distance) : (t.To?.Odometer != null && t.From?.Odometer != null ? Number(t.To.Odometer) - Number(t.From.Odometer) : null);
        await db.transport.create({
          data: {
            date: new Date(t.From.DateTime),
            fromAddress: fmtAddr(t.From.Address, t.From.Description),
            toAddress: fmtAddr(t.To?.Address, t.To?.Description),
            distanceKm: km != null && km > 0 ? Math.round(km * 10) / 10 : null,
            status: "AFGEROND",
            vehicleId: v.id,
            externalTripId: ext,
            notes: t.RideType ? `FleetGo rit ${t.RideNumber ?? t.Id} (${t.RideType})` : `FleetGo rit ${t.RideNumber ?? t.Id}`,
          },
        });
        newTrips++;
      }

      if (TACHO_STATUS_PATH) {
        try {
          const st = await get<{ LastVehicleDownload?: string; LastDriverCardDownload?: string }>(token, `${TACHO_STATUS_PATH}?equipmentId=${f.Id}`);
          await db.vehicle.update({ where: { id: v.id }, data: { ...(st.LastVehicleDownload ? { lastTachoDownload: new Date(st.LastVehicleDownload) } : {}), ...(st.LastDriverCardDownload ? { lastCardDownload: new Date(st.LastDriverCardDownload) } : {}) } });
        } catch { /* tacho-endpoint (nog) niet beschikbaar */ }
      }
    }
    const message = `${fleet.length} voertuigen gecontroleerd, ${newVehicles} nieuw; ${newTrips} nieuwe ritten geïmporteerd.`;
    await logSync("fleetgo", true, message, newTrips);
    return { ok: true, message };
  } catch (e) {
    const message = (e as Error).message;
    await logSync("fleetgo", false, message);
    return { ok: false, message };
  }
}
