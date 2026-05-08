/**
 * GmailService — sends outreach emails via Gmail OAuth2.
 *
 * Prerequisites (run once):
 *   npm install googleapis
 *
 * Required env vars:
 *   GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN,
 *   GMAIL_SENDER_EMAIL, GMAIL_REDIRECT_URI
 *
 * OAuth2 refresh tokens never expire unless revoked — set it once and forget.
 */
import type { IEmailSender, SendEmailInput } from "@/application/ports/IEmailSender";
import { ExternalServiceError } from "@/domain/errors";
import { logger } from "@/utils/logger";

interface GmailConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  redirectUri: string;
  senderEmail: string;
}

export class GmailService implements IEmailSender {
  private readonly config: GmailConfig;

  constructor(config: GmailConfig) {
    this.config = config;
  }

  async send(input: SendEmailInput): Promise<{ messageId: string }> {
    // Lazy-load googleapis to avoid startup crash when the package isn't installed
    let google: typeof import("googleapis").google;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      ({ google } = require("googleapis") as typeof import("googleapis"));
    } catch {
      throw new ExternalServiceError(
        'googleapis package not installed — run: npm install googleapis',
        false
      );
    }

    const auth = new google.auth.OAuth2(
      this.config.clientId,
      this.config.clientSecret,
      this.config.redirectUri
    );

    auth.setCredentials({ refresh_token: this.config.refreshToken });

    const gmail = google.gmail({ version: "v1", auth });

    // Strip CRLF to prevent email header injection via fromName
    const safeName = input.fromName?.replace(/[\r\n]+/g, " ").trim();
    const fromHeader = safeName
      ? `"${safeName}" <${this.config.senderEmail}>`
      : this.config.senderEmail;

    // RFC 2822 message — Gmail API requires base64url encoding
    const raw = [
      `From: ${fromHeader}`,
      `To: ${input.to}`,
      `Subject: ${input.subject}`,
      `Content-Type: text/plain; charset=utf-8`,
      `MIME-Version: 1.0`,
      ``,
      input.body,
    ].join("\r\n");

    const encoded = Buffer.from(raw)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    try {
      const response = await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw: encoded },
      });

      const messageId = response.data.id ?? `gmail-${Date.now()}`;
      logger.info({ to: input.to, subject: input.subject, messageId }, "GmailService: sent");
      return { messageId };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient = msg.includes("429") || msg.includes("503");
      throw new ExternalServiceError(`Gmail send failed: ${msg}`, isTransient);
    }
  }
}
