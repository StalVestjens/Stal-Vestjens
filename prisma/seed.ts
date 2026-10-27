import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const DEFAULT_EMAIL = "eigenaar@voorbeeld.nl";

/**
 * Eerste inrichting. Draait bij elke start (idempotent).
 *
 * Eigenaar-account: komt uit SEED_OWNER_EMAIL / SEED_OWNER_PASSWORD / SEED_OWNER_NAME.
 * Die waarden zijn leidend: wijzig je het wachtwoord in Render (Environment) en start de app
 * opnieuw, dan geldt het nieuwe wachtwoord. Zo kan de eigenaar altijd weer binnen.
 * Zonder deze waarden wordt alleen buiten productie een standaardaccount aangemaakt.
 */
async function main() {
  const email = (process.env.SEED_OWNER_EMAIL ?? "").toLowerCase().trim();
  const password = (process.env.SEED_OWNER_PASSWORD ?? "").trim();
  const name = (process.env.SEED_OWNER_NAME ?? "").trim() || "Eigenaar";

  if (email && password) {
    await db.user.upsert({
      where: { email },
      update: { name, role: "EIGENAAR", active: true, passwordHash: await bcrypt.hash(password, 10) },
      create: { name, email, role: "EIGENAAR", passwordHash: await bcrypt.hash(password, 10) },
    });
    // Een eventueel standaardaccount (uit een eerdere start zonder instellingen) uitschakelen.
    if (email !== DEFAULT_EMAIL) await db.user.updateMany({ where: { email: DEFAULT_EMAIL }, data: { active: false } });
    console.log(`Eigenaar-account bijgewerkt: ${email}`);
  } else if (process.env.NODE_ENV !== "production") {
    await db.user.upsert({
      where: { email: DEFAULT_EMAIL },
      update: {},
      create: { name: "Eigenaar", email: DEFAULT_EMAIL, role: "EIGENAAR", passwordHash: await bcrypt.hash("wachtwoord123", 10) },
    });
    console.log(`Ontwikkelaccount: ${DEFAULT_EMAIL} / wachtwoord123`);
  } else {
    console.warn("SEED_OWNER_EMAIL en SEED_OWNER_PASSWORD zijn niet ingesteld; er is geen eigenaar-account aangemaakt.");
  }

  const products = [
    { name: "Pensionstalling per maand", unitPrice: 650, vatRate: 21, unit: "maand" },
    { name: "Training per maand", unitPrice: 450, vatRate: 21, unit: "maand" },
    { name: "Les (60 min)", unitPrice: 55, vatRate: 21, unit: "les" },
    { name: "Transport per km", unitPrice: 1.25, vatRate: 21, unit: "km" },
    { name: "Wedstrijdbegeleiding", unitPrice: 85, vatRate: 21, unit: "dag" },
  ];
  for (const p of products) {
    const exists = await db.product.findFirst({ where: { name: p.name } });
    if (!exists) await db.product.create({ data: p });
  }

  const defaults: Record<string, string> = {
    bedrijfsnaam: "Mijn Paardenhouderij",
    adres: "",
    kvk: "",
    btw: "",
    iban: "",
    factuur_prefix: new Date().getFullYear().toString(),
    betaaltermijn_dagen: "14",
  };
  for (const [key, value] of Object.entries(defaults)) {
    await db.setting.upsert({ where: { key }, update: {}, create: { key, value } });
  }
}

main().finally(() => db.$disconnect());
