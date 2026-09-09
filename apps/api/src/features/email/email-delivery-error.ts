export type EmailDeliveryFailureKind = "pre_send" | "ambiguous";

export class EmailDeliveryError extends Error {
  readonly kind: EmailDeliveryFailureKind;
  readonly acceptedCount: number;
  readonly rejectedCount: number;
  readonly providerMessageId: string | null;

  constructor(
    message: string,
    kind: EmailDeliveryFailureKind,
    options: {
      acceptedCount?: number;
      rejectedCount?: number;
      providerMessageId?: string | null;
      cause?: unknown;
    } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "EmailDeliveryError";
    this.kind = kind;
    this.acceptedCount = options.acceptedCount ?? 0;
    this.rejectedCount = options.rejectedCount ?? 0;
    this.providerMessageId = options.providerMessageId ?? null;
  }
}

export function isAmbiguousEmailDeliveryFailure(error: unknown): boolean {
  return error instanceof EmailDeliveryError && error.kind === "ambiguous";
}
