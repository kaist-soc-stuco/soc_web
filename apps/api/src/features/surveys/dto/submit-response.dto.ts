import { IsArray, IsObject, IsOptional, IsString, IsUUID, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

class AnswerInputDto {
  @IsUUID()
  questionId!: string;

  @IsObject()
  content!: Record<string, unknown>;
}

export class SubmitResponseDto {
  @IsOptional()
  @IsString()
  externalPhone?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerInputDto)
  answers!: AnswerInputDto[];
}
