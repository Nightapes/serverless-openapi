import { JSONSchema7 } from 'json-schema';
import { OpenAPIV3_1 } from 'openapi-types';
import { Schema } from './response.types';

export interface CustomProperties {
  out?: string;
  version: string;
  title: string;
  description?: string;
  tags?: { name: string; description?: string }[];
  securitySchemes: {
    [key: string]: OpenAPIV3_1.SecuritySchemeObject;
  };
  defaultResponse?: {
    'application/json': Schema;
  };
  schemaFolder?: string;
}

export const customProperties: JSONSchema7 = {
  properties: {
    openapi: {
      type: 'object',
      additionalProperties: false,
      properties: {
        schemaFolder: {
          type: 'string',
        },
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
        securitySchemes: {
          type: 'object',
          patternProperties: {
            '^[a-zA-Z0-9\\.\\-_]+$': {
              oneOf: [
                {
                  type: 'object',
                  required: ['type', 'name', 'in'],
                  properties: {
                    type: {
                      type: 'string',
                      enum: ['apiKey'],
                    },
                    name: {
                      type: 'string',
                    },
                    in: {
                      type: 'string',
                      enum: ['header', 'query', 'cookie'],
                    },
                    description: {
                      type: 'string',
                    },
                  },
                  patternProperties: {
                    '^x-': {},
                  },
                  additionalProperties: false,
                },
                {
                  type: 'object',
                  required: ['scheme', 'type'],
                  properties: {
                    scheme: {
                      type: 'string',
                    },
                    bearerFormat: {
                      type: 'string',
                    },
                    description: {
                      type: 'string',
                    },
                    type: {
                      type: 'string',
                      enum: ['http'],
                    },
                  },
                  patternProperties: {
                    '^x-': {},
                  },
                  additionalProperties: false,
                  oneOf: [
                    {
                      description: 'Bearer',
                      properties: {
                        scheme: {
                          type: 'string',
                          pattern: '^[Bb][Ee][Aa][Rr][Ee][Rr]$',
                        },
                      },
                    },
                    {
                      description: 'Non Bearer',
                      not: {
                        required: ['bearerFormat'],
                      },
                      properties: {
                        scheme: {
                          not: {
                            type: 'string',
                            pattern: '^[Bb][Ee][Aa][Rr][Ee][Rr]$',
                          },
                        },
                      },
                    },
                  ],
                },
              ],
            },
          },
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
