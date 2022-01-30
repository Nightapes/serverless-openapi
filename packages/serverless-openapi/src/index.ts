import Serverless from 'serverless';
import { JSONSchema7 } from 'json-schema';
import { customProperties } from './lib/custom.properties';
import { OpenAPIV3 } from 'openapi-types';
import { writeFileSync } from 'fs';
import { HttpMethod } from 'serverless/plugins/aws/package/compile/events/apiGateway/lib/validate';
import { functioneventProperties } from './lib/functionEvent.properties';
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

interface Schema {
  schema?: JSONSchema7;
  name: string;
  description?: string;
}

interface CustomProperties {
  version: string;
  title: string;
  description?: string;
  tags?: { name: string; description?: string }[];
  defaultResponse?: {
    'application/json': Schema;
  };
}

interface HttpEvent {
  path: string;
  method: HttpMethod;
  authorizer?: any;
  cors?: any;
  operationId: string;
  integration?: string | undefined;
  tags: string[];
  defaultResponse: true;
  request: {
    schemas: {
      'application/json': Schema;
    };
  };
  responseSchemas: {
    [key: string]: { 'application/json': Schema };
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

    serverless.configSchemaHandler.defineCustomProperties(customProperties);

    serverless.configSchemaHandler.defineFunctionEventProperties(
      'aws',
      'http',
      functioneventProperties
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

    const customOpenApi = this.serverless.service.custom
      .openapi as CustomProperties;

    openApi.info = {
      title: customOpenApi.title,
      version: customOpenApi.version,
      description: customOpenApi.description,
    };

    openApi.tags = customOpenApi.tags;

    let defaultSchema: OpenAPIV3.ResponsesObject | undefined;

    if (customOpenApi.defaultResponse) {
      defaultSchema = this.handleResponses(
        {
          default: customOpenApi.defaultResponse,
        },
        openApi
      );
    }

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

        const responses = this.handleResponses(
          httpEvent.responseSchemas,
          openApi
        );

        if (httpEvent.defaultResponse && defaultSchema) {
          responses['default'] = defaultSchema['default'];
        }
        if (httpEvent.defaultResponse && !defaultSchema) {
          this.log('Default schema not found, please add default schema');
        }

        const operation: OpenAPIV3.OperationObject = {
          operationId: httpEvent.operationId,
          responses: responses,
          tags: httpEvent.tags,
        };

        if (httpEvent.request && httpEvent.request.schemas) {
          operation.requestBody = this.handleRequestBody(
            httpEvent.request.schemas,
            openApi
          );
        }

        openApi.paths[path][this.getMethod(httpEvent.method)] = operation;
      }
    }

    this.saveToFile(openApi);
  }

  private saveToFile(openApi: OpenAPIV3.Document) {
    let out = 'openapi.json';
    if (this.options['out']) {
      out = this.options['out'];
    }

    let output = JSON.stringify(openApi, undefined, '  ');
    if (out.endsWith('.yaml') || out.endsWith('.yml')) {
      output = dump(JSON.parse(output));
    }

    writeFileSync(out, output);
  }

  private handleRequestBody(
    requestSchemas: { 'application/json': Schema },
    openApi: OpenAPIV3.Document
  ) {
    const request: OpenAPIV3.RequestBodyObject = {
      content: {},
      required: true,
    };

    const schemaJSON = requestSchemas['application/json'];
    request.description = schemaJSON.description;

    if (schemaJSON.schema) {
      request['content'] = {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/' + schemaJSON.name,
          },
        },
      };
      delete schemaJSON.schema['$schema'];
      openApi.components.schemas[schemaJSON.name] = schemaJSON.schema as any;
    }
    return request;
  }

  private handleResponses(
    responseSchemas: { [key: string]: { 'application/json': Schema } },
    openApi: OpenAPIV3.Document
  ): OpenAPIV3.ResponsesObject {
    const responses: OpenAPIV3.ResponsesObject = {};

    for (const code of Object.keys(responseSchemas)) {
      const schemaJSON = responseSchemas[code]['application/json'];
      responses[code] = {
        description: schemaJSON.description,
      };
      if (schemaJSON.schema) {
        responses[code]['content'] = {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/' + schemaJSON.name,
            },
          },
        };
        delete schemaJSON.schema['$schema'];
        openApi.components.schemas[schemaJSON.name] = schemaJSON.schema as any;
      }
    }

    return responses;
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
