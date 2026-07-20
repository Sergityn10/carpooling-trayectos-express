# Guía de integración para microservicios

Esta guía explica cómo integrar otros microservicios del ecosistema Carpooling con el servicio de notificaciones.

## Información de conexión

| Parámetro | Valor |
|-----------|-------|
| **Host** | `localhost` (o la URL del contenedor/servidor) |
| **Puerto** | `3004` |
| **Base URL** | `http://localhost:3004` |
| **Protocolo** | HTTP |
| **Formato** | JSON |

## Casos de uso por microservicio

### Microservicio de Users

#### Email de bienvenida

Cuando se registra un nuevo usuario, enviar email de bienvenida:

```javascript
await fetch("http://localhost:3004/api/emails/send/template", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    to: newUser.email,
    template: "welcome",
    data: { name: newUser.name }
  })
});
```

#### Reset de contraseña

Cuando un usuario solicita restablecer su contraseña:

```javascript
await fetch("http://localhost:3004/api/emails/send/template", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    to: user.email,
    template: "password_reset",
    data: {
      name: user.name,
      resetUrl: `https://carpooling.com/reset-password?token=${resetToken}`
    }
  })
});
```

---

### Microservicio de Trips

#### Confirmación de viaje

Cuando un conductor publica un viaje:

```javascript
await fetch("http://localhost:3004/api/emails/send/template", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    to: driver.email,
    template: "trip_confirmation",
    data: {
      userName: driver.name,
      origin: trip.origin,
      destination: trip.destination,
      date: trip.date,
      time: trip.time,
      seats: trip.seats,
      price: trip.price,
      tripId: trip.id
    }
  })
});
```

#### Cancelación de viaje

Cuando un conductor cancela un viaje, notificar a todos los pasajeros:

```javascript
// Notificar por email a cada pasajero
for (const passenger of passengers) {
  await fetch("http://localhost:3004/api/emails/send/template", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: passenger.email,
      template: "trip_cancelled",
      data: {
        userName: passenger.name,
        origin: trip.origin,
        destination: trip.destination,
        date: trip.date,
        time: trip.time,
        reason: cancellationReason
      }
    })
  });
}

// Notificar por push a cada pasajero
for (const passenger of passengers) {
  await fetch("http://localhost:3004/api/push/send/user", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: passenger.id,
      title: "Viaje cancelado",
      body: `El viaje ${trip.origin} → ${trip.destination} ha sido cancelado`,
      data: { tripId: trip.id, type: "trip_cancelled" }
    })
  });
}
```

---

### Microservicio de Bookings

#### Solicitud de reserva

Cuando un pasajero solicita un asiento:

```javascript
// Email al conductor
await fetch("http://localhost:3004/api/emails/send/template", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    to: driver.email,
    template: "booking_request",
    data: {
      driverName: driver.name,
      passengerName: passenger.name,
      origin: trip.origin,
      destination: trip.destination,
      date: trip.date,
      time: trip.time,
      seatsRequested: booking.seats,
      tripId: trip.id
    }
  })
});

// Push al conductor
await fetch("http://localhost:3004/api/push/send/user", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    userId: driver.id,
    title: "Nueva solicitud de reserva",
    body: `${passenger.name} quiere reservar ${booking.seats} asiento(s)`,
    data: { tripId: trip.id, type: "booking_request" }
  })
});
```

---

### Microservicio de Chat / Mensajes

#### Notificación de nuevo mensaje

```javascript
await fetch("http://localhost:3004/api/push/send/user", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    userId: recipientId,
    title: senderName,
    body: messagePreview,
    data: {
      type: "new_message",
      chatId: chatId,
      senderId: senderId
    }
  })
});
```

---

## Integración desde la app móvil

### Flujo de registro de dispositivo

La app móvil debe seguir este flujo para que el servicio pueda enviar push notifications:

```
1. App obtiene token FCM de Firebase SDK
2. App hace login → obtiene JWT del microservicio de auth
3. App llama POST /api/device-tokens con:
   - Authorization: Bearer <JWT>
   - Body: { token, platform, deviceId, deviceName }
4. El servicio guarda la relación userId → token FCM
5. Ya se puede enviar push por userId desde cualquier microservicio
```

### Código de ejemplo (React Native / Firebase)

```javascript
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';

async function registerDeviceToken() {
  // 1. Obtener token FCM
  const fcmToken = await messaging().getToken();

  // 2. Obtener JWT del almacenamiento
  const jwt = await AsyncStorage.getItem('access_token');

  // 3. Registrar en el servicio de notificaciones
  await fetch('http://localhost:3004/api/device-tokens', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      token: fcmToken,
      platform: Platform.OS,        // 'ios' o 'android'
      deviceId: DeviceInfo.getUniqueId(),
      deviceName: DeviceInfo.getModel(),
    }),
  });
}

// Registrar al hacer login
registerDeviceToken();

// Re-registrar si el token FCM cambia
messaging().onTokenRefresh(token => {
  registerDeviceToken();
});
```

### Cerrar sesión / eliminar dispositivo

```javascript
async function unregisterDevice() {
  const jwt = await AsyncStorage.getItem('access_token');
  const deviceId = DeviceInfo.getUniqueId();

  await fetch('http://localhost:3004/api/device-tokens', {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ deviceId }),
  });
}
```

---

## Helper reutilizable para microservicios (Node.js)

```javascript
const NOTIFICATIONS_URL = process.env.NOTIFICATIONS_URL || 'http://localhost:3004';

class NotificationsClient {
  constructor(baseUrl = NOTIFICATIONS_URL) {
    this.baseUrl = baseUrl;
  }

  async sendEmail(to, subject, html) {
    return this._post('/api/emails/send', { to, subject, html });
  }

  async sendTemplatedEmail(to, template, data) {
    return this._post('/api/emails/send/template', { to, template, data });
  }

  async sendBatchEmails(emails) {
    return this._post('/api/emails/send/batch', { emails });
  }

  async sendPushToUser(userId, title, body, data = {}) {
    return this._post('/api/push/send/user', { userId, title, body, data });
  }

  async sendPushToToken(token, title, body, data = {}) {
    return this._post('/api/push/send', { token, title, body, data });
  }

  async sendPushToTopic(topic, title, body, data = {}) {
    return this._post('/api/push/send/topic', { topic, title, body, data });
  }

  async _post(path, body) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const json = await res.json();

    if (!res.ok) {
      throw new Error(`Notifications API error ${res.status}: ${json.error || json.detail}`);
    }

    return json;
  }
}

module.exports = NotificationsClient;
```

### Uso del helper

```javascript
const NotificationsClient = require('./notificationsClient');
const notifications = new NotificationsClient();

// Enviar email de bienvenida
await notifications.sendTemplatedEmail(user.email, 'welcome', { name: user.name });

// Enviar push a un usuario
await notifications.sendPushToUser(userId, 'Nuevo mensaje', 'Tienes un mensaje nuevo', {
  type: 'new_message',
  chatId: chatId
});
```

---

## Consideraciones de integración

- **Sin autenticación para emails y push**: Los endpoints de `/api/emails/*` y `/api/push/*` no requieren JWT. Asegúrate de que solo servicios internos tengan acceso de red a estos endpoints.
- **Autenticación JWT para device tokens**: Los endpoints `/api/device-tokens/me` y `DELETE /api/device-tokens` requieren JWT del usuario. El endpoint `POST /api/device-tokens` espera `req.user` (ver [Autenticación](./authentication.md)).
- **Manejo de errores**: Siempre verifica el campo `success` en la respuesta. En operaciones batch, revisa `succeeded` y `failed`.
- **Idempotencia**: El registro de device tokens es idempotente. Llamarlo múltiples veces con el mismo `token` o `deviceId` actualiza el registro existente.
- **Timeouts**: Configura timeouts adecuados en el cliente HTTP. El envío de emails puede tardar varios segundos.
- **Reintentos**: Para push notifications, FCM puede devolver errores temporales. Considera implementar reintentos con backoff exponencial.
