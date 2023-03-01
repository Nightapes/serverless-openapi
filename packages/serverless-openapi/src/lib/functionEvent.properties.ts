import { JSONSchema7 } from 'json-schema';

export const functionEventProperties = {
  properties: {
    tags: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
    defaultResponse: { type: 'boolean' },
    responseSchemas: {
      type: 'object',
      additionalProperties: false,
      patternProperties: {
        '^[0-9]{3}$': {
          type: 'object',
          properties: {
            'application/json': {
              type: 'object',
              properties: {
                schema: { type: 'object' },
                name: { type: 'string' },
                description: { type: 'string' },
              },
              required: ['description'],
            },
          },
        },
      },
    },
  },
} as JSONSchema7;
