import twilio from "twilio";

let twilioClient: ReturnType<typeof twilio> | null = null;

function getClient() {
  if (!twilioClient) {
    twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }
  return twilioClient;
}

export async function sendWhatsApp(to: string, message: string) {
  const client = getClient();
  const from = process.env.TWILIO_WHATSAPP_NUMBER || "whatsapp:+14155238886";

  await client.messages.create({
    from,
    to: to.startsWith("whatsapp:") ? to : `whatsapp:${to}`,
    body: message,
  });
}
