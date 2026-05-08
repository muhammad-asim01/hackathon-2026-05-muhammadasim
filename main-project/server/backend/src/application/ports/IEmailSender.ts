export interface SendEmailInput {
  readonly to: string;
  readonly subject: string;
  readonly body: string;
  readonly fromName?: string;
}

export interface IEmailSender {
  send(input: SendEmailInput): Promise<{ messageId: string }>;
}
