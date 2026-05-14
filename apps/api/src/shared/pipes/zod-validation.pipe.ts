import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from "@nestjs/common";
import { ZodSchema, ZodError } from "zod";

/**
 * NestJS Pipe that validates request body using a Zod schema.
 *
 * @example
 * ```ts
 * @Post()
 * async create(@Body(new ZodValidationPipe(ArticleCreateSchema)) body: ArticleCreateRequest) {
 *   ...
 * }
 * ```
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    const result = this.schema.safeParse(value);

    if (result.success) {
      return result.data;
    }

    const formatted = this.formatZodError(result.error);
    throw new BadRequestException({
      message: "Validation failed",
      errors: formatted,
    });
  }

  private formatZodError(error: ZodError): Array<{ field: string; message: string }> {
    return error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
  }
}
