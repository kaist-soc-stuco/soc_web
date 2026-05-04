import { IsEnum, IsOptional, IsString } from "class-validator";

const REVIEW_STATUSES = ["approved", "rejected", "waitlisted"] as const;

export class ReviewResponseDto {
  @IsEnum(REVIEW_STATUSES)
  status!: (typeof REVIEW_STATUSES)[number];

  @IsOptional()
  @IsString()
  reason?: string;
}
