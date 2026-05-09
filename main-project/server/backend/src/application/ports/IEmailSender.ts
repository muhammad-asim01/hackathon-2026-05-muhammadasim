export interface SendEmailInput {
  readonly to:        string;
  readonly subject:   string;
  readonly body:      string;      // plain-text fallback (always required)
  readonly htmlBody?: string;      // HTML alternative — rendered by email clients that support it
  readonly fromName?: string;
}

export interface IEmailSender {
  send(input: SendEmailInput): Promise<{ messageId: string }>;
}
