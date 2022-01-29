import { JSONSchema7 } from 'json-schema';

export const customOpenApi: JSONSchema7 = {
  properties: {
    openapi: {
      type: 'object',
      additionalProperties: false,
      properties: {
        version: {
          type: 'string',
        },
        title: {
          type: 'string',
        },
        description: {
          type: 'string',
        },
      },
      required: ['version', 'title'],
    },
  },
};
