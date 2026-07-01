import { zodToJsonSchema } from 'zod-to-json-schema';
import { ZodSchema } from 'zod';

/**
 * Reuses the same Zod schema already passed to ZodValidationPipe to derive the
 * @ApiBody schema, so request validation and Swagger docs can't drift apart.
 */
export function zodApiSchema(schema: ZodSchema): Record<string, unknown> {
  const jsonSchema = zodToJsonSchema(schema, { target: 'openApi3' }) as Record<
    string,
    unknown
  >;
  delete jsonSchema.$schema;
  return jsonSchema;
}
