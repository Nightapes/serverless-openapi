import { JSONSchema7 } from 'json-schema';

const requestParametersSchema: JSONSchema7 = {
  type: 'object',
  additionalProperties: {
    anyOf: [
      {
        type: 'object',
        required: ['type'],
        properties: {
          type: {
            type: 'string',
            enum: ['string', 'enum', 'number', 'boolean'],
          },
          description: {
            type: 'string',
          },
          deprecated: {
            type: 'boolean',
          },
          isArray: {
            type: 'boolean',
          },
          format: {
            type: 'string',
            enum: ['int32', 'int64', 'float', 'double', 'binary', 'byte', 'date', 'date-time', 'password'],
          },
          options: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
        },
      },
    ],
  },
};

export const functionEventProperties: JSONSchema7 = {
  properties: {
    tags: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
    defaultResponse: { type: 'boolean' },
    parameterMappers: {
      type: 'object',
      additionalProperties: true,
      properties: {
        parameters: {
          type: 'object',
          properties: {
            querystrings: requestParametersSchema,
            headers: requestParametersSchema,
            paths: requestParametersSchema,
          },
        },
      },
    },
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
};
