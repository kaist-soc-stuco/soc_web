import { BadRequestException } from "@nestjs/common";

export function requireDownloadReason(value: unknown): string {
  if (typeof value !== "string") {
    throw new BadRequestException("download_reason_required");
  }

  const reason = value.trim();
  if (reason.length < 2 || reason.length > 200) {
    throw new BadRequestException("download_reason_required");
  }

  return reason;
}
