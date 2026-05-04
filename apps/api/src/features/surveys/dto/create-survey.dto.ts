import {
  IsBoolean,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

export class CreateSurveyDto {
  @IsString()
  titleKo!: string;

  @IsString()
  titleEn!: string;

  @IsOptional()
  @IsString()
  descriptionKo?: string;

  @IsOptional()
  @IsString()
  descriptionEn?: string;

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
