import nodemailer from "nodemailer";

function buildTransporter() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
}

export async function sendEmail({ to, subject, text }) {
  const transporter = buildTransporter();
  if (!transporter) {
    console.warn("SMTP no configurado; se omite el envío de email");
    return { skipped: true };
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!from) {
    throw new Error("SMTP_FROM o SMTP_USER requerido para enviar emails");
  }

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    text
  });

  return { skipped: false, messageId: info?.messageId };
}

export async function sendTrayectoEnCursoEmail({ to, trayecto }) {
  const subject = "Tu trayecto ha comenzado";
  const text = `El trayecto #${trayecto.id} de ${trayecto.origen} a ${trayecto.destino} está en curso.`;
  return sendEmail({ to, subject, text });
}
