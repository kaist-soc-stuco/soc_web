import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

const SURVEY_STATUSES = ["draft", "scheduled", "open", "closed", "archived"] as const;

export class UpdateSurveyDto {
  @IsOptional()
  @IsString()
  titleKo?: string;

  @IsOptional()
  @IsString()
  titleEn?: string;

  @IsOptional()
  @IsString()
  descriptionKo?: string;

  @IsOptional()
  @IsString()
  descriptionEn?: string;

  @IsOptional()
  @IsEnum(SURVEY_STATUSES)
  status?: (typeof SURVEY_STATUSES)[number];

  @IsOptional()
  @IsBoolean()
  feePayersOnly?: boolean;

  @IsOptional()
  @IsBoolean()
  allowAnonymous?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxResponses?: number;

  @IsOptional()
  @IsISO8601()
  opensAt?: string;

  @IsOptional()
  @IsISO8601()
  closesAt?: string;

  @IsOptional()
  @IsString()
  connectedPostId?: string;
}
