import Serverless from 'serverless';
import { JSONSchema7 } from 'json-schema';
import { customOpenApi } from './lib/customTypes';
import { OpenAPIV3 } from 'openapi-types';
import { writeFileSync } from 'fs';
import { HttpMethod } from 'serverless/plugins/aws/package/compile/events/apiGateway/lib/validate';
import { dump } from 'js-yaml';

type CommandsDefinition = Record<
  string,
  {
    lifecycleEvents?: string[];
    commands?: CommandsDefinition;
    usage?: string;
    options?: {
      [name: string]: {
        type: string;
        usage: string;
        required?: boolean;
        shortcut?: string;
      };
    };
  }
>;

interface HttpEvent {
  path: string;
  method: HttpMethod;
  authorizer?: any;
  cors?: any;
  operationId: string;
  integration?: string | undefined;
  responseSchemas: {
    [key: string]: {
      'application/json': {
        schema?: JSONSchema7;
        name: string;
        description?: string;
      };
    };
  };
}

export class ServerlessPlugin {
  serverless: Serverless;
  options: Serverless.Options & { [key: string]: any };
  hooks: { [key: string]: Serverless.FunctionDefinitionHandler };
  commands: CommandsDefinition;

  constructor(
    serverless: Serverless,
    options: Serverless.Options & { [key: string]: any }
  ) {
    this.serverless = serverless;
    this.options = options;

    this.commands = {
      openapi: {
        usage: 'Generate openapi file locally from your serverless file',
        lifecycleEvents: ['serverless'],
        options: {
          out: {
            type: 'string',
            usage:
              'Specify the output location' +
              '(e.g. "--out \'./openapi.yaml\'" or "-o \'./openapi.json\'")',
            required: false,
            shortcut: 'o',
          },
        },
      },
    };

    serverless.configSchemaHandler.defineCustomProperties(customOpenApi);

    serverless.configSchemaHandler.defineFunctionEventProperties(
      'aws',
      'http',
      {
        properties: {
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
      } as JSONSchema7
    );

    this.hooks = {
      'openapi:serverless': this.generate.bind(this),
    };
  }

  private log(message: string, options?: Serverless.LogOptions): void {
    this.serverless.cli.log(message, '', options);
  }

  private generate() {
    this.log('Generate open api');
    const openApi: OpenAPIV3.Document = {
      openapi: '3.0.0',
      info: {
        title: 'Openapi',
        version: '0.0.1',
      },
      paths: {},
      components: {
        schemas: {},
      },
    };

    const customOpenApi = this.serverless.service.custom.openapi;

    openApi.info = {
      title: customOpenApi.title,
      version: customOpenApi.version,
    };

    for (const func of this.serverless.service.getAllFunctions()) {
      const data = this.serverless.service.getFunction(func);

      for (const event of data.events) {
        if (!event['http']) {
          return;
        }

        if (typeof event['http'] === 'string') {
          return;
        }

        const httpEvent = event['http'] as HttpEvent;
        const path = '/' + httpEvent.path;
        if (!openApi.paths[path]) {
          openApi.paths[path] = {};
        }

        const responseSchemas = httpEvent.responseSchemas;

        const responses: OpenAPIV3.ResponsesObject = {};

        for (const code of Object.keys(responseSchemas)) {
          const schema = responseSchemas[code]['application/json'];
          openApi.components.schemas[schema.name] = schema.schema as any;
          responses[code] = {
            description: schema.description,
          };
          if (schema.schema) {
            responses[code]['content'] = {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/' + schema.name,
                },
              },
            };
          }
        }

        openApi.paths[path][this.getMethod(httpEvent.method)] = {
          operationId: httpEvent.operationId,
          responses: responses,
        } as OpenAPIV3.OperationObject;
      }
    }

    let out = 'openapi.json';
    if (this.options['out']) {
      out = this.options['out'];
    }

    let output = JSON.stringify(openApi, undefined, '  ');
    if (out.endsWith('.yaml') || out.endsWith('.yml')) {
      output = dump(openApi);
    }

    writeFileSync(out, output);
  }
  getMethod(method: HttpMethod): OpenAPIV3.HttpMethods {
    switch (method) {
      case 'get':
        return OpenAPIV3.HttpMethods.GET;
      case 'post':
        return OpenAPIV3.HttpMethods.POST;
      case 'put':
        return OpenAPIV3.HttpMethods.PUT;
      case 'patch':
        return OpenAPIV3.HttpMethods.PATCH;
      case 'head':
        return OpenAPIV3.HttpMethods.HEAD;
      case 'options':
        return OpenAPIV3.HttpMethods.OPTIONS;
      case 'delete':
        return OpenAPIV3.HttpMethods.DELETE;
      default:
        return OpenAPIV3.HttpMethods.TRACE;
    }
  }
}

module.exports = ServerlessPlugin;
