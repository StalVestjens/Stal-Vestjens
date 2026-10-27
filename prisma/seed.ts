import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const email = (process.env.SEED_OWNER_EMAIL ?? "eigenaar@voorbeeld.nl").toLowerCase();
  const password = process.env.SEED_OWNER_PASSWORD ?? "wachtwoord123";
  const name = process.env.SEED_OWNER_NAME ?? "Eigenaar";

  await db.user.upsert({
    where: { email },
    update: {},
    create: { name, email, role: "EIGENAAR", passwordHash: await bcrypt.hash(password, 10) },
  });

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

  console.log(`Klaar. Inloggen met ${email} / ${password}`);
}

main().finally(() => db.$disconnect());
