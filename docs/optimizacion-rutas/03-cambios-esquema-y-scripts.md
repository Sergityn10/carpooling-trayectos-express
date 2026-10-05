# Cambios en Esquema de Base de Datos y Scripts de Soporte

## 1. Actualizaciones en el Esquema de Base de Datos (`prisma/schema.prisma`)

Para almacenar métricas precalculadas y optimizar las consultas en base de datos sin recalcular distancias totales repetidamente:

### 1.1 Modelo `Trayecto`
```prisma
model Trayecto {
  id               String   @id @db.VarChar(36)
  origen           String   @db.Text
  destino          String   @db.Text
  hora             DateTime
  plazas           Int
  disponible       Int
  precio           Float
  precio_conductor Float    @default(0)
  conductor        String   @db.VarChar(36)
  vehiculo_id      String?  @db.VarChar(36)
  routeIndex       Int?     @default(0)
  status           String   @default("programado") @db.VarChar(20)
  origen_lat       Float?
  origen_lng       Float?
  destino_lat      Float?
  destino_lng      Float?
  notified_15min   Int      @default(0)
  evento_id        String?  @db.VarChar(36)
  
  // Nuevos campos para enrutamiento optimizado
  distance_km      Float?
  duration_sec     Int?
  max_detour_km    Float?   @default(5.0)
  max_detour_mins  Int?     @default(15)
  
  created_at       DateTime @default(now())
  updated_at       DateTime @default(now()) @updatedAt

  Reservas         Reserva[]
  Tramos           Tramo[]

  @@index([origen_lat, origen_lng], name: "idx_trayectos_origen")
  @@index([destino_lat, destino_lng], name: "idx_trayectos_destino")
  @@index([hora], name: "idx_trayectos_hora")
  @@index([conductor], name: "idx_trayectos_conductor")
  @@index([evento_id], name: "idx_trayectos_evento_id")
  @@index([status, hora], name: "idx_trayectos_status_hora")

  @@map("trayectos")
}
```

### 1.2 Modelo `Tramo`
```prisma
model Tramo {
  id               String   @id @db.VarChar(36)
  id_trayecto      String   @db.VarChar(36)
  lat              Float
  lng              Float
  address          String   @db.Text
  step_order       Int      @default(0)
  
  // Nuevos campos acumulados para cálculo instantáneo de subtramos
  cum_distance_km  Float?   @default(0)
  cum_duration_sec Int?     @default(0)
  
  created_at       DateTime @default(now())

  Trayecto         Trayecto @relation(fields: [id_trayecto], references: [id])

  @@index([id_trayecto, step_order], name: "idx_tramos_trayecto_order")
  @@index([lat, lng], name: "idx_tramos_coords")

  @@map("tramos")
}
```

---

## 2. Scripts de Soporte y Mantenimiento

### 2.1 Script de Reindexación y Backfill (`scripts/reindex-routes.js`)
- **Función**:
  1. Itera sobre trayectos históricos existentes en base de datos.
  2. Calcula distancias acumuladas para cada tramo (`cum_distance_km`).
  3. Actualiza los campos `distance_km` y `duration_sec` en los registros de `Trayecto`.

### 2.2 Script de Benchmark y Pruebas de Carga (`scripts/benchmark-routing.js`)
- **Función**:
  1. Genera escenarios de 1.000, 5.000 y 20.000 trayectos con tramos viales realistas en España.
  2. Ejecuta 500 búsquedas concurrentes de pasajeros con solicitud de desvío.
  3. Compara latencia (ms), uso de CPU y memoria entre:
     - Método anterior: $O(N \times M)$ lineal con filtrado en memoria JS.
     - Nuevo motor: $O(\log N)$ con R-Tree espacial + A*.
