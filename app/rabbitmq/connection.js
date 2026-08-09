import amqp from "amqplib";
import dotenv from "dotenv";

dotenv.config();

const RABBITMQ_URL =
  process.env.RABBITMQ_URL || "amqp://carpooling:carpooling123@localhost:5672";
const EXCHANGE_NAME = process.env.RABBITMQ_EXCHANGE || "carpooling_events";
const APP_QUEUE_NAME = "carpooling_trayectos_events";

let connection = null;
let channel = null;

async function connect() {
  if (connection && channel) return channel;

  try {
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();

    await channel.assertExchange(EXCHANGE_NAME, "topic", {
      durable: true,
    });

    await channel.assertQueue(APP_QUEUE_NAME, { durable: true });

    connection.on("close", () => {
      console.error("[RabbitMQ] Conexión cerrada");
      connection = null;
      channel = null;
    });

    connection.on("error", (err) => {
      console.error("[RabbitMQ] Error de conexión:", err.message);
    });

    console.log("[RabbitMQ] Conectado correctamente");
    return channel;
  } catch (error) {
    console.error("[RabbitMQ] Error al conectar:", error.message);
    connection = null;
    channel = null;
    throw error;
  }
}

async function getChannel() {
  if (!channel) {
    await connect();
  }
  return channel;
}

async function publishEvent(routingKey, data, source = "carpooling-trayectos") {
  try {
    const ch = await getChannel();
    const message = {
      event: routingKey,
      source,
      timestamp: new Date().toISOString(),
      data,
    };
    ch.publish(
      EXCHANGE_NAME,
      routingKey,
      Buffer.from(JSON.stringify(message)),
      { persistent: true },
    );
    console.log(`[RabbitMQ] Evento publicado: ${routingKey}`);
  } catch (error) {
    console.error(`[RabbitMQ] Error publicando evento ${routingKey}:`, error.message);
  }
}

async function bindQueue(routingPattern) {
  const ch = await getChannel();
  await ch.bindQueue(APP_QUEUE_NAME, EXCHANGE_NAME, routingPattern);
  console.log(`[RabbitMQ] Queue vinculada con pattern: ${routingPattern}`);
}

async function startConsumer(handler) {
  const ch = await getChannel();

  await ch.consume(
    APP_QUEUE_NAME,
    async (msg) => {
      if (!msg) return;

      try {
        const content = JSON.parse(msg.content.toString());
        const routingKey = msg.fields.routingKey;
        console.log(`[RabbitMQ] Evento recibido: ${routingKey}`);

        await handler(routingKey, content);

        ch.ack(msg);
      } catch (error) {
        console.error(
          `[RabbitMQ] Error procesando evento ${msg.fields.routingKey}:`,
          error.message,
        );
        ch.nack(msg, false, false);
      }
    },
    { noAck: false },
  );

  console.log("[RabbitMQ] Consumer iniciado");
}

async function close() {
  if (channel) {
    await channel.close();
    channel = null;
  }
  if (connection) {
    await connection.close();
    connection = null;
  }
}

export const RabbitMQ = {
  connect,
  getChannel,
  publishEvent,
  bindQueue,
  startConsumer,
  close,
  EXCHANGE_NAME,
  APP_QUEUE_NAME,
};
