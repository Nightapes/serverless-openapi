import { JSONSchema7 } from 'json-schema';

export const customProperties: JSONSchema7 = {
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
        tags: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
              },
              description: {
                type: 'string',
              },
            },
            required: ['name'],
          },
        },
        defaultResponse: {
          type: 'object',
          properties: {
            'application/json': {
              type: 'object',
              properties: {
                schema: { type: 'object' },
                name: { type: 'string' },
                description: { type: 'string' },
              },
              required: ['description', 'name', 'schema'],
            },
          },
        },
      },
      required: ['version', 'title'],
    },
  },
};
