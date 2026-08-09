import { RabbitMQ } from "./connection.js";
import { EventConsumer } from "./consumer.js";

async function startRabbitMQ() {
  try {
    await RabbitMQ.connect();

    for (const pattern of EventConsumer.BIND_PATTERNS) {
      await RabbitMQ.bindQueue(pattern);
    }

    await RabbitMQ.startConsumer(async (routingKey, message) => {
      await EventConsumer.handleEvent(routingKey, message);
    });

    console.log("[RabbitMQ] Consumer de eventos iniciado correctamente");
  } catch (error) {
    console.error("[RabbitMQ] No se pudo iniciar el consumer:", error.message);
    console.error("[RabbitMQ] El microservicio continuará sin eventos de RabbitMQ");
  }
}

export { startRabbitMQ };
