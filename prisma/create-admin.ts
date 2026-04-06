import dotenv from "dotenv";
dotenv.config();

import readline from "readline";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { Role } from "../src/generated/prisma/enums";
import bcrypt from "bcryptjs";
import { validateAndFormatPhone } from "../src/utils/phone";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q: string): Promise<string> => new Promise((res) => rl.question(q, res));

async function main() {
  console.log("=== Create Admin Account ===\n");
  console.log("Phone number must be in E.164 format (e.g. +639XXXXXXXXX, +1XXXXXXXXXX)\n");

  const fullName    = (await ask("Full name: ")).trim();
  const email       = (await ask("Email: ")).trim();
  const phoneRaw    = (await ask("Phone number: ")).trim();
  const password    = (await ask("Password: ")).trim();

  rl.close();

  if (!fullName || !email || !phoneRaw || !password) {
    console.error("All fields are required.");
    process.exit(1);
  }

  const phoneValidation = validateAndFormatPhone(phoneRaw);
  if (!phoneValidation.isValid || !phoneValidation.formatted) {
    console.error(`Invalid phone number: ${phoneValidation.error}`);
    process.exit(1);
  }
  const phoneNumber = phoneValidation.formatted;

  const existingEmail = await prisma.user.findFirst({ where: { email } });
  if (existingEmail) {
    console.error(`User with email ${email} already exists.`);
    process.exit(1);
  }

  const existingPhone = await prisma.user.findFirst({ where: { phoneNumber } });
  if (existingPhone) {
    console.error(`Phone number ${phoneNumber} is already registered.`);
    process.exit(1);
  }

  const hashed = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      fullName,
      email,
      phoneNumber,
      password: hashed,
      role: Role.ADMIN,
    },
  });

  console.log(`\n✅ Admin created: ${fullName} (${email})`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
