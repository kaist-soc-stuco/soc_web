import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

const QUESTION_TYPES = [
  "short_text",
  "long_text",
  "single_choice",
  "multiple_choice",
  "dropdown",
  "date",
  "time",
  "datetime",
] as const;

class QuestionOptionDto {
  @IsString()
  value!: string;

  @IsString()
  labelKo!: string;

  @IsOptional()
  @IsString()
  labelEn?: string;
}

export class UpdateQuestionDto {
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
  @IsEnum(QUESTION_TYPES)
  questionType?: (typeof QUESTION_TYPES)[number];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  options?: QuestionOptionDto[];

  @IsOptional()
  @IsString()
  answerRegex?: string;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsISO8601()
  editDeadlineAt?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
