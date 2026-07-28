import "server-only";
import { Resend } from "resend";
import { serverEnv, integrationsAvailable } from "@/env";
import { errorClass, safeLog } from "@/lib/security/safe-logger";
import { isProcessorEnabled } from "@/lib/privacy/processors";

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
  unsubscribeUrl?: string;
}

/** Transactional email wrapper; addresses and content are never logged. */
export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  if (!integrationsAvailable.resend() || !isProcessorEnabled("resend")) {
    safeLog("warn", "email.provider_not_configured");
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
      safeLog("error", "email.send_rejected", {
        errorClass: error.name ?? "provider_error",
      });
      return false;
    }
    return true;
  } catch (reason) {
    safeLog("error", "email.send_failed", { errorClass: errorClass(reason) });
    return false;
  }
}
