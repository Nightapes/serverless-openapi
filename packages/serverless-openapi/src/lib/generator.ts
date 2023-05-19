import Serverless from 'serverless';
import { OpenAPIV3 } from 'openapi-types';
import { Schema } from './response.types';
import { CustomProperties } from './custom.properties';
import Aws, { HttpRequestParametersValidation } from 'serverless/plugins/aws/provider/awsProvider';
import { Log } from './sls.types';
import $RefParser from '@apidevtools/json-schema-ref-parser';
import { readFile, readdir } from 'fs/promises';
import * as path from 'path';

interface ParameterMapper {
  type: 'string' | 'enum' | 'number' | 'boolean';
  description?: string;
  deprecated?: boolean;
  isArray?: boolean;
  format?: 'int32' | 'int64' | 'float' | 'double' | 'binary' | 'byte' | 'date' | 'date-time' | 'password';
  options?: string[];
}
interface HttpEvent extends Aws.Http {
  operationId: string;
  tags: string[];
  defaultResponse: true;
  request?: {
    parameters?: HttpRequestParametersValidation | undefined;
    schemas?: { 'application/json': Record<string, unknown> } | undefined;
  };
  responseSchemas?: {
    [key: string]: { 'application/json': Schema };
  };
  parameterMappers: {
    querystrings: { [key: string]: ParameterMapper };
    headers: { [key: string]: ParameterMapper };
    paths: { [key: string]: ParameterMapper };
  };
}

export class Generator {
  constructor(private log: Log) {}

  public async generate(serverless: Serverless): Promise<OpenAPIV3.Document> {
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

    const customOpenApi = serverless.service.custom.openapi as CustomProperties;

    openApi.info = {
      title: customOpenApi.title,
      version: customOpenApi.version,
      description: customOpenApi.description,
    };

    openApi.tags = customOpenApi.tags;

    let defaultSchema: OpenAPIV3.ResponsesObject | undefined;

    try {
      const files = await readdir(customOpenApi.schemaFolder);

      for (const file of files) {
        if (file.endsWith('.json') || file.endsWith('.yml')) {
          const name = this.capitalizeFirstLetter(file.split('.')[0]);
          openApi.components.schemas[name] = {
            $ref: './' + file,
          };
        }
      }
    } catch (error) {
      this.log.debug('No types found');
    }

    try {
      const files = await readdir(customOpenApi.schemaFolder + '/shared');

      for (const file of files) {
        if (file.endsWith('.json') || file.endsWith('.yml')) {
          const name = this.capitalizeFirstLetter(file.split('.')[0]);
          openApi.components.schemas[name] = {
            $ref: './shared/' + file,
          };
        }
      }
    } catch (error) {
      this.log.debug('No shared types found');
    }

    if (customOpenApi.defaultResponse) {
      defaultSchema = await this.handleResponses(
        {
          default: customOpenApi.defaultResponse,
        },
        openApi
      );
    }

    for (const func of serverless.service.getAllFunctions()) {
      const data = serverless.service.getFunction(func);

      for (const event of data.events) {
        if (!event['http']) {
          break;
        }

        if (typeof event['http'] === 'string') {
          break;
        }

        const httpEvent = event['http'] as HttpEvent;
        const httpPath = '/' + httpEvent.path;
        if (!openApi.paths[httpPath]) {
          openApi.paths[httpPath] = {};
        }

        const responses = await this.handleResponses(httpEvent.responseSchemas, openApi);
        // Clean up, as not needed in serverless
        delete httpEvent.responseSchemas;

        const auth: OpenAPIV3.SecurityRequirementObject[] | undefined = [];
        if (httpEvent.authorizer) {
          for (const key in customOpenApi.securitySchemes) {
            let name = '';

            if (typeof httpEvent.authorizer === 'string') {
              name = httpEvent.authorizer;
            } else {
              if (httpEvent.authorizer.name) {
                name = httpEvent.authorizer.name;
              }

              // Fallback to auth if id and no name is specified
              if (httpEvent.authorizer.type && Object.keys(customOpenApi.securitySchemes).length === 1) {
                name = key;
              }
            }

            if (key === name) {
              auth.push({
                [key]: [],
              });
            }
          }
        }

        if (httpEvent.defaultResponse && defaultSchema) {
          responses['default'] = defaultSchema['default'];
        }
        if (httpEvent.defaultResponse && !defaultSchema) {
          this.log.error('Default schema not found, please add default schema');
        }

        const operation: OpenAPIV3.OperationObject = {
          operationId: httpEvent.operationId,
          responses: responses,
          tags: httpEvent.tags,
          parameters: [],
          security: auth,
        };

        operation.parameters = this.handleParameters(httpEvent);

        if (httpEvent.request && httpEvent.request.schemas) {
          operation.requestBody = this.handleRequestBody(httpEvent.request.schemas, openApi);

          httpEvent.request.schemas = (await $RefParser.dereference(
            JSON.parse(JSON.stringify(httpEvent.request.schemas)),
            {
              resolve: {
                file: {
                  canRead: ['.yml', '.json'],
                  read: async (ref) => {
                    const orgRef = (ref.url as string).replace(process.cwd(), '');
                    const realPath = path.join(process.cwd(), customOpenApi.schemaFolder, orgRef);
                    return await readFile(realPath);
                  },
                },
              },
            }
          )) as any;
        }

        openApi.paths[httpPath][this.getMethod(httpEvent.method)] = operation;
      }
    }

    if (customOpenApi.securitySchemes) {
      openApi.components.securitySchemes = {};
      for (const key in customOpenApi.securitySchemes) {
        const value = customOpenApi.securitySchemes[key];
        delete value['default'];
        openApi.components.securitySchemes[key] = value;
      }
    }

    return openApi;
  }

  private parameterMapper(
    name: string,
    required: boolean,
    location: 'querystrings' | 'headers' | 'paths',
    httpEvent: HttpEvent
  ): OpenAPIV3.ParameterObject {
    let inType = 'path';
    switch (location) {
      case 'headers':
        inType = 'header';
        break;
      case 'paths':
        inType = 'path';
        break;
      case 'querystrings':
        inType = 'query';
        break;
    }

    if (!httpEvent.parameterMappers) {
      return {
        in: inType,
        required: required,
        name: name,
        schema: { type: 'string' },
      };
    }

    if (!httpEvent.parameterMappers[location]) {
      return {
        in: inType,
        required: required,
        name: name,
        schema: { type: 'string' },
      };
    }

    if (!httpEvent.parameterMappers[location][name]) {
      return {
        in: inType,
        required: required,
        name: name,
        schema: { type: 'string' },
      };
    }

    const mapper = httpEvent.parameterMappers[location][name];

    if (mapper.isArray) {
      if (mapper.type === 'enum') {
        return {
          in: inType,
          required: required,
          name: name,
          schema: {
            type: 'array',
            items: {
              type: 'string',
              enum: mapper.options ?? [],
            },
          },
        };
      }

      return {
        in: inType,
        required: required,
        name: name,
        schema: {
          type: 'array',
          items: {
            type: mapper.type,
            format: mapper.format,
          },
        },
        deprecated: mapper.deprecated,
        description: mapper.description,
      };
    }

    if (mapper.type === 'enum') {
      return {
        in: inType,
        required: required,
        name: name,
        schema: {
          type: 'string',
          enum: mapper.options ?? [],
        },
      };
    }

    return {
      in: inType,
      required: required,
      name: name,
      schema: { type: mapper.type, format: mapper.format },
      deprecated: mapper.deprecated,
      description: mapper.description,
    };
  }

  private handleParameters(httpEvent: HttpEvent): OpenAPIV3.ParameterObject[] | undefined {
    const parameters: OpenAPIV3.ParameterObject[] = [];
    if (!httpEvent.request) {
      return;
    }

    if (!httpEvent.request.parameters) {
      return;
    }

    for (const para of Object.entries(httpEvent.request.parameters?.paths ?? {})) {
      const name = para[0];
      const required = para[1];
      parameters.push(this.parameterMapper(name, required, 'paths', httpEvent));
    }

    for (const para of Object.entries(httpEvent.request.parameters?.querystrings ?? {})) {
      const name = para[0];
      const required = para[1];
      parameters.push(this.parameterMapper(name, required, 'querystrings', httpEvent));
    }

    for (const para of Object.entries(httpEvent.request.parameters?.headers ?? {})) {
      const name = para[0];
      const required = para[1];
      parameters.push(this.parameterMapper(name, required, 'headers', httpEvent));
    }

    return parameters.length === 0 ? undefined : parameters;
  }

  private handleRequestBody(requestSchemas: { 'application/json': any }, openApi: OpenAPIV3.Document) {
    const request: OpenAPIV3.RequestBodyObject = {
      content: {},
      required: true,
    };

    const schemaJSON = requestSchemas['application/json'];
    request.description = schemaJSON.description;
    const name = this.capitalizeFirstLetter(schemaJSON.customName ?? schemaJSON.name);

    if (schemaJSON.schema) {
      request['content'] = {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/' + name,
          },
        },
      };
      delete schemaJSON.schema['$schema'];
      openApi.components.schemas[name] = schemaJSON.schema as any;
    }
    return request;
  }

  private async handleResponses(
    responseSchemas: { [key: string]: { 'application/json': Schema } } | undefined,
    openApi: OpenAPIV3.Document
  ): Promise<OpenAPIV3.ResponsesObject | undefined> {
    const responses: OpenAPIV3.ResponsesObject = {};

    if (!responseSchemas) {
      return undefined;
    }

    for (const code of Object.keys(responseSchemas)) {
      const schemaJSON = responseSchemas[code]['application/json'];
      responses[code] = {
        description: schemaJSON.description,
      };
      if (schemaJSON.schema && schemaJSON.schema.type !== 'array') {
        const name = this.capitalizeFirstLetter(schemaJSON.name);
        responses[code]['content'] = {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/' + name,
            },
          },
        };
        delete schemaJSON.schema['$schema'];
        openApi.components.schemas[name] = schemaJSON.schema as any;
      }

      if (schemaJSON.schema && schemaJSON.schema.type === 'array' && schemaJSON.schema.title) {
        const name = this.capitalizeFirstLetter(schemaJSON.schema.title);
        responses[code]['content'] = {
          'application/json': {
            schema: {
              items: {
                type: 'array',
                $ref: '#/components/schemas/' + name,
              },
            },
          },
        };
        delete schemaJSON.schema['$schema'];
        openApi.components.schemas[name] = schemaJSON.schema.items as any;
      }

      if (schemaJSON.schema && schemaJSON.schema.type === 'array' && !schemaJSON.schema.title) {
        responses[code]['content'] = {
          'application/json': {
            schema: {
              items: schemaJSON.schema.items,
              type: 'array',
            },
          },
        };
        delete schemaJSON.schema['$schema'];
      }
    }

    return responses;
  }

  private capitalizeFirstLetter(value: string) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  private getMethod(method: string): OpenAPIV3.HttpMethods {
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
