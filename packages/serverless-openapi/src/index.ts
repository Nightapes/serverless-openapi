import Serverless from 'serverless';
import { CustomProperties, customProperties } from './lib/custom.properties';
import { OpenAPIV3 } from 'openapi-types';
import { writeFileSync } from 'fs';
import { functioneventProperties } from './lib/functionEvent.properties';
import { dump } from 'js-yaml';
import { CommandsDefinition } from './lib/comand.types';
import { Generator } from './lib/generator';
import { Log } from './lib/sls.types';

export class ServerlessPlugin {
  serverless: Serverless;
  options: Serverless.Options & { [key: string]: any };
  hooks: { [key: string]: Serverless.FunctionDefinitionHandler };
  commands: CommandsDefinition;
  log: Log

  constructor(
    serverless: Serverless,
    options: Serverless.Options & { [key: string]: any },
    { log } : {log: Log}
  ) {
    this.serverless = serverless;
    this.options = options;
    this.log = log

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
      'package:initialize': this.generate.bind(this),
    };
  }

  private generate() {
    this.log.notice('Generate open api');
    const openApi = new Generator(this.log).generate(this.serverless);
    const customOpenApi = this.serverless.service.custom
      .openapi as CustomProperties;
    this.saveToFile(openApi, customOpenApi.out);
  }

  private saveToFile(openApi: OpenAPIV3.Document, out = 'openapi.json') {
    if (this.options['out']) {
      out = this.options['out'];
    }

    let output = JSON.stringify(openApi, undefined, '  ');
    if (out.endsWith('.yaml') || out.endsWith('.yml')) {
      output = dump(JSON.parse(output));
    }
    this.log.notice('Saved open api to ', out);

    writeFileSync(out, output);
  }
}

module.exports = ServerlessPlugin;
