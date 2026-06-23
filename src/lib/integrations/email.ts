import "server-only";
import { Resend } from "resend";
import { serverEnv, integrationsAvailable } from "@/env";

/**
 * Transactional email via Resend (https://resend.com). A thin wrapper so call
 * sites don't touch the SDK directly. No-ops (returns false) when RESEND_API_KEY
 * isn't configured, so the rest of the app keeps working without email set up.
 */

let client: Resend | null = null;
function resend(): Resend {
  if (!client) client = new Resend(serverEnv().RESEND_API_KEY);
  return client;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** List-Unsubscribe target (a URL); adds the one-click unsubscribe headers. */
  unsubscribeUrl?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  if (!integrationsAvailable.resend()) {
    console.warn("[email] RESEND_API_KEY not set — skipping send to", input.to);
    return false;
  }

  try {
    const { error } = await resend().emails.send({
      from: serverEnv().EMAIL_FROM,
      to: input.to,
      subject: input.subject,
      html: input.html,
      ...(input.text ? { text: input.text } : {}),
      ...(input.unsubscribeUrl
        ? {
            headers: {
              "List-Unsubscribe": `<${input.unsubscribeUrl}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
          }
        : {}),
    });
    if (error) {
      console.error("[email] send failed:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] send threw:", err);
    return false;
  }
}
