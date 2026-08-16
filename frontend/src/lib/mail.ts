import { getPrismaClient } from "./prisma";

export async function queueEmail(to: string, subject: string, bodyText?: string, bodyHtml?: string) {
  const prisma = getPrismaClient();
  try {
    await prisma.outgoingEmail.create({
      data: {
        to,
        subject,
        bodyText: bodyText ?? null,
        bodyHtml: bodyHtml ?? null,
      },
    });
    console.log('Queued email to', to, 'subject:', subject);
  } catch (err) {
    console.error('Failed to queue email', err);
  }
}
