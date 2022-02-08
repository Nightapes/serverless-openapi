import Serverless from 'serverless';
import { OpenAPIV3 } from 'openapi-types';
import { HttpMethod } from 'serverless/plugins/aws/package/compile/events/apiGateway/lib/validate';
import { Schema } from './response.types';
import { CustomProperties } from './custom.properties';

interface HttpEvent {
  path: string;
  method: HttpMethod;
  authorizer?: any;
  cors?: any;
  operationId: string;
  integration?: string | undefined;
  tags: string[];
  defaultResponse: true;
  request?: {
    parameters?: {
      querystrings?: { [key: string]: boolean };
      headers?: { [key: string]: boolean };
      paths?: { [key: string]: boolean };
    };
    schemas: {
      'application/json': Schema;
    };
  };
  responseSchemas?: {
    [key: string]: { 'application/json': Schema };
  };
}

export class Generator {
  public generate(serverless: Serverless): OpenAPIV3.Document {
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

    if (customOpenApi.defaultResponse) {
      defaultSchema = this.handleResponses(
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
          serverless.cli.log(
            'Default schema not found, please add default schema'
          );
        }

        const operation: OpenAPIV3.OperationObject = {
          operationId: httpEvent.operationId,
          responses: responses,
          tags: httpEvent.tags,
          parameters: [],
        };

        operation.parameters = this.handleParameters(httpEvent);

        if (httpEvent.request && httpEvent.request.schemas) {
          operation.requestBody = this.handleRequestBody(
            httpEvent.request.schemas,
            openApi
          );
        }

        openApi.paths[path][this.getMethod(httpEvent.method)] = operation;
      }
    }

    return openApi;
  }
  private handleParameters(
    httpEvent: HttpEvent
  ): OpenAPIV3.ParameterObject[] | undefined {
    const paramaters: OpenAPIV3.ParameterObject[] = [];
    if (!httpEvent.request) {
      return;
    }

    if (!httpEvent.request.parameters) {
      return;
    }

    for (const para of Object.entries(
      httpEvent.request.parameters?.paths ?? {}
    )) {
      const name = para[0];
      const required = para[1];
      paramaters.push({
        in: 'path',
        required: required,
        name: name,
        schema: { type: 'string' },
      });
    }

    for (const para of Object.entries(
      httpEvent.request.parameters?.querystrings ?? {}
    )) {
      const name = para[0];
      const required = para[1];
      paramaters.push({
        in: 'query',
        required: required,
        name: name,
        schema: { type: 'string' },
      });
    }

    for (const para of Object.entries(
      httpEvent.request.parameters?.headers ?? {}
    )) {
      const name = para[0];
      const required = para[1];
      paramaters.push({
        in: 'header',
        required: required,
        name: name,
        schema: { type: 'string' },
      });
    }
    return paramaters.length === 0 ? undefined : paramaters;
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
    responseSchemas:
      | { [key: string]: { 'application/json': Schema } }
      | undefined,
    openApi: OpenAPIV3.Document
  ): OpenAPIV3.ResponsesObject | undefined {
    const responses: OpenAPIV3.ResponsesObject = {};

    if (!responseSchemas) {
      return undefined;
    }

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

  private getMethod(method: HttpMethod): OpenAPIV3.HttpMethods {
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
