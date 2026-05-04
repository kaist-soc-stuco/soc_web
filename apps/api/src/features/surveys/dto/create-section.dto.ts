import { IsInt, IsOptional, IsString, Min } from "class-validator";

export class CreateSectionDto {
  @IsString()
  titleKo!: string;

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
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
