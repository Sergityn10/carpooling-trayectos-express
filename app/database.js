import { PrismaClient } from "./generated/prisma/client.ts";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import dotenv from "dotenv";

dotenv.config();

const adapter = new PrismaMariaDb({
  host: process.env.DATABASE_HOST || "localhost",
  user: process.env.DATABASE_USER || "root",
  password: process.env.DATABASE_PASSWORD || "",
  database: process.env.DATABASE_NAME || "carpooling",
  port: Number(process.env.DATABASE_PORT) || 3306,
  connectionLimit: 5,
});

const prisma = new PrismaClient({ adapter });

const initDatabase = async () => {
  // Seed preference_definitions if empty
  const count = await prisma.preferenceDefinition.count();
  if (count === 0) {
    await prisma.preferenceDefinition.createMany({
      data: [
        {
          pref_key: "smoking_allowed",
          value_type: "boolean",
          default_value: "0",
          description: "Permite fumar durante el viaje",
        },
        {
          pref_key: "pets_allowed",
          value_type: "boolean",
          default_value: "0",
          description: "Permite mascotas durante el viaje",
        },
        {
          pref_key: "music",
          value_type: "boolean",
          default_value: "1",
          description: "Música durante el viaje",
        },
        {
          pref_key: "talk_level",
          value_type: "enum",
          default_value: "normal",
          enum_values: '["silencio","normal","charla"]',
          description: "Nivel de conversación",
        },
        {
          pref_key: "temperature",
          value_type: "enum",
          default_value: "templado",
          enum_values: '["frio","templado","calor"]',
          description: "Temperatura preferida",
        },
        {
          pref_key: "luggage_size",
          value_type: "enum",
          default_value: "medio",
          enum_values: '["pequeno","medio","grande"]',
          description: "Tamaño de equipaje admitido",
        },
        {
          pref_key: "stops_allowed",
          value_type: "boolean",
          default_value: "0",
          description: "Permite paradas durante el viaje",
        },
        {
          pref_key: "max_detour_km",
          value_type: "number",
          default_value: "0",
          description: "Desvío máximo aceptado (km)",
        },
      ],
    });
  }
};

const getConnection = async () => {
  return {
    query: async (sql, params = []) => {
      try {
        const firstWord = String(sql ?? "")
          .trim()
          .split(/\s+/)[0]
          ?.toUpperCase();

        const isRowReturning =
          firstWord === "SELECT" ||
          firstWord === "WITH" ||
          firstWord === "SHOW";

        if (isRowReturning) {
          const rows = await prisma.$queryRawUnsafe(sql, ...params);
          return [rows];
        } else {
          const result = await prisma.$executeRawUnsafe(sql, ...params);
          return [{ affectedRows: result, insertId: undefined }];
        }
      } catch (e) {
        const msg = String(e?.message || "");
        if (
          /FOREIGN KEY constraint failed/i.test(msg) ||
          /foreign key/i.test(msg)
        )
          e.code = "ER_NO_REFERENCED_ROW_2";
        else if (
          /UNIQUE constraint failed/i.test(msg) ||
          /SQLITE_CONSTRAINT_UNIQUE/i.test(msg) ||
          /Duplicate entry/i.test(msg) ||
          /constraint.*unique/i.test(msg)
        )
          e.code = "ER_DUP_ENTRY";
        throw e;
      }
    },
  };
};

export const database = { getConnection };
export { initDatabase, prisma };
