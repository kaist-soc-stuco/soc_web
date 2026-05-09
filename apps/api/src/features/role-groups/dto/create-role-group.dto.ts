import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

export class CreateRoleGroupDto {
  @IsString()
  code!: string;

  @IsString()
  nameKo!: string;

  @IsOptional()
  @IsString()
  nameEn?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  permissionIds!: number[];
}