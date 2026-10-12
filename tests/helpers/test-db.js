import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

let prismaClient = null;

/**
 * Obtiene o crea el cliente Prisma para tests
 * Usa variables de entorno específicas de test
 */
export function getTestPrisma() {
  if (prismaClient) return prismaClient;

  const adapter = new PrismaMariaDb({
    host: process.env.DATABASE_HOST || "localhost",
    user: process.env.DATABASE_USER || "test_user",
    password: process.env.DATABASE_PASSWORD || "test_password",
    database: process.env.DATABASE_NAME || "carpooling_test",
    port: Number(process.env.DATABASE_PORT) || 3306,
    connectionLimit: 5,
    allowPublicKeyRetrieval: true,
    ssl: false,
  });

  prismaClient = new PrismaClient({ adapter });
  return prismaClient;
}

/**
 * Inicializa la base de datos de test:
 * - Aplica schema (prisma db push ya se ejecutó en Docker)
 * - Ejecuta seed de datos base (preferencias, tipos evento, CAE status)
 * - Limpia tablas de datos de test
 */
export async function setupTestDB() {
  const prisma = getTestPrisma();

  try {
    // Verificar conexión
    await prisma.$queryRaw`SELECT 1`;
    console.log("✅ Conexión a BD de test establecida");

    // Seed de preference_definitions si vacío
    const prefCount = await prisma.preferenceDefinition.count();
    if (prefCount === 0) {
      await seedPreferences(prisma);
      console.log("✅ Preferences seed completado");
    }

    // Seed de tipos_eventos
    await seedTiposEventos(prisma);
    console.log("✅ Tipos eventos seed completado");

    // Seed de status_info_caes
    await seedStatusCAEs(prisma);
    console.log("✅ Status CAEs seed completado");

  } catch (error) {
    console.error("❌ Error en setupTestDB:", error.message);
    throw error;
  }
}

/**
 * Limpia todas las tablas de datos variables (mantiene seeds)
 * Se ejecuta antes y después de cada suite de tests de integración
 */
export async function cleanTestDB() {
  const prisma = getTestPrisma();

  // Orden de borrado respetando foreign keys
  const tablesToClean = [
    "eventos_trayectos",
    "recorridos",
    "recogidas",
    "reservas",
    "comments",
    "tramos",
    "trayectos",
    "frequents_routes",
    "user_preferences",
    "ubicaciones",
    "trayecto_search_history",
    "info_caes",
    "cae_reports",
  ];

  for (const table of tablesToClean) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE \`${table}\``);
    } catch (error) {
      // Tabla puede no existir o ya estar vacía
      if (!error.message.includes("doesn't exist") && !error.message.includes("Table") && !error.message.includes("Unknown table")) {
        console.warn(`⚠️ No se pudo truncar ${table}:`, error.message);
      }
    }
  }
}

/**
 * Cierra la conexión de Prisma
 */
export async function closeTestDB() {
  if (prismaClient) {
    await prismaClient.$disconnect();
    prismaClient = null;
  }
}

// Alias para compatibilidad con tests que usan cleanupTestData
export async function cleanupTestData() {
  return cleanTestDB();
}

// ============================================
// FUNCIONES DE SEED (Datos base inmutables)
// ============================================

async function seedPreferences(prisma) {
  const preferences = [
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
  ];

  await prisma.preferenceDefinition.createMany({ data: preferences });
}

async function seedTiposEventos(prisma) {
  const tiposEventos = [
    { nombre: "solicitud", descripcion: "El pasajero solicita ser recogido" },
    { nombre: "comienzo", descripcion: "El trayecto ha comenzado" },
    { nombre: "finalizacion", descripcion: "El trayecto ha finalizado" },
    {
      nombre: "recogida",
      descripcion: "El pasajero ha sido recogido por el conductor",
    },
    {
      nombre: "reserva_creada",
      descripcion: "El pasajero ha creado una reserva para el trayecto",
    },
    {
      nombre: "reserva_cancelada",
      descripcion: "El pasajero ha cancelado su reserva del trayecto",
    },
    {
      nombre: "llegada_destino",
      descripcion: "El pasajero ha llegado a su destino",
    },
  ];

  for (const tipo of tiposEventos) {
    await prisma.tipoEvento.upsert({
      where: { nombre: tipo.nombre },
      update: {},
      create: tipo,
    });
  }
}

async function seedStatusCAEs(prisma) {
  const statusCAEs = [
    { name: "pending", description: "CAE report pending calculation" },
    { name: "in_review", description: "CAE report under review" },
    { name: "canceled", description: "CAE report canceled" },
    { name: "completed", description: "CAE report completed" },
  ];

  for (const status of statusCAEs) {
    await prisma.statusInfoCAEs.upsert({
      where: { name: status.name },
      update: { description: status.description },
      create: status,
    });
  }
}