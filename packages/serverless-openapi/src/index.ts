import Serverless from 'serverless';
import { customProperties } from './lib/custom.properties';
import { OpenAPIV3 } from 'openapi-types';
import { writeFileSync } from 'fs';
import { functioneventProperties } from './lib/functionEvent.properties';
import { dump } from 'js-yaml';
import { CommandsDefinition } from './lib/comand.types';
import { Generator } from './lib/generator';

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

  private generate() {
    this.serverless.cli.log('Generate open api');
    const openApi = new Generator().generate(this.serverless);
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
}

module.exports = ServerlessPlugin;
