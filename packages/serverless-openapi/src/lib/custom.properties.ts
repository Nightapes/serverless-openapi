import { JSONSchema7 } from 'json-schema';
import { Schema } from './response.types';

export interface CustomProperties {
  out?: string;
  version: string;
  title: string;
  description?: string;
  tags?: { name: string; description?: string }[];
  defaultResponse?: {
    'application/json': Schema;
  };
}

export const customProperties: JSONSchema7 = {
  properties: {
    openapi: {
      type: 'object',
      additionalProperties: false,
      properties: {
        out: {
          type: 'string',
        },
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
