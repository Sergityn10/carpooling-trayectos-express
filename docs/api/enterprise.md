# Gestión de Empresas (`/api/enterprise`)

Endpoints para consultar y actualizar el perfil de la empresa autenticada.

---

## 1. Obtener mi perfil de empresa

**URL:** `GET /api/enterprise/me`

**Autenticación:** Requerida (`isEnterpriseLoged`).

**Descripción:** Devuelve los datos completos de la empresa autenticada.

**Salida (200):**
```json
{
  "status": "Success",
  "enterprise": {
    "id": 1,
    "name": "Mi Empresa",
    "email": "info@empresa.com",
    "phone": "910123456",
    "cif": "B12345678",
    "website": "https://miempresa.com",
    "address_line1": "Calle Mayor 1",
    "address_line2": null,
    "city": "Madrid",
    "province": "Madrid",
    "postal_code": "28001",
    "country": "ES",
    "verified": 0,
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

---

## 2. Actualizar mi perfil de empresa

**URL:** `PATCH /api/enterprise/me`

**Autenticación:** Requerida (`isEnterpriseLoged`).

**Descripción:** Actualiza parcialmente los datos de la empresa autenticada. No permite modificar `id`, `verified`, ni `email`.

**Entrada (body JSON, campos opcionales):**
```json
{
  "name": "string",
  "phone": "string",
  "cif": "string",
  "website": "string",
  "address_line1": "string",
  "address_line2": "string",
  "city": "string",
  "province": "string",
  "postal_code": "string",
  "country": "string"
}
```

**Salida (200):**
```json
{
  "status": "Success",
  "message": "Enterprise updated successfully",
  "enterprise": {
    "id": 1,
    "name": "Mi Empresa Actualizada",
    "email": "info@empresa.com",
    "phone": "910123456",
    "cif": "B12345678",
    "website": "https://miempresa.com",
    "address_line1": "Calle Mayor 1",
    "address_line2": null,
    "city": "Madrid",
    "province": "Madrid",
    "postal_code": "28001",
    "country": "ES",
    "verified": 0,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-02T00:00:00Z"
  }
}
```

**Errores:**
- `400` — Validación fallida o no hay campos para actualizar.
- `500` — Error al actualizar.
