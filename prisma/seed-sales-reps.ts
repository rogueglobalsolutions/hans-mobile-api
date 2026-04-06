import dotenv from "dotenv";
dotenv.config();

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { Role } from "../src/generated/prisma/enums";
import bcrypt from "bcryptjs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const reps = [
  { fullName: "Lindsay",       email: "lindsay@hansapp.com" },
  { fullName: "Gladys",        email: "gladys@hansapp.com" },
  { fullName: "Tristen",       email: "tristen@hansapp.com" },
  { fullName: "Brooke Wish",   email: "brookewish@hansapp.com" },
  { fullName: "Circe Phairas", email: "circephairas@hansapp.com" },
  { fullName: "Jan",           email: "jan@hansapp.com" },
  { fullName: "Bridget",       email: "bridget@hansapp.com" },
  { fullName: "Aslaam",        email: "aslaam@hansapp.com" },
];

const DEFAULT_PASSWORD = "HansRep2025!";

async function main() {
  const hashed = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  for (let i = 0; i < reps.length; i++) {
    const rep = reps[i];
    const existing = await prisma.user.findFirst({ where: { email: rep.email } });
    if (existing) {
      console.log(`⏭  Skipped (already exists): ${rep.fullName}`);
      continue;
    }

    const phone = `000000000${i + 1}`.slice(-10); // unique placeholder per rep

    await prisma.user.create({
      data: {
        fullName:    rep.fullName,
        email:       rep.email,
        phoneNumber: phone,
        password:    hashed,
        role:        Role.SALES_REP,
      },
    });
    console.log(`✅ Created: ${rep.fullName} (${rep.email})`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
