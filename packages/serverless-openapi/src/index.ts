import Serverless from 'serverless';
import { CustomProperties, customProperties } from './lib/custom.properties';
import { writeFileSync } from 'fs';
import { functionEventProperties } from './lib/functionEvent.properties';
import { dump } from 'js-yaml';
import { CommandsDefinition } from './lib/comand.types';
import { Generator } from './lib/generator';
import { Log } from './lib/sls.types';

import $RefParser from '@apidevtools/json-schema-ref-parser';
import { readFile } from 'fs/promises';
import * as path from 'path';

export class ServerlessPlugin {
  serverless: Serverless;
  options: Serverless.Options & { [key: string]: any };
  hooks: { [key: string]: Serverless.FunctionDefinitionHandler };
  commands: CommandsDefinition;
  log: Log;

  constructor(serverless: Serverless, options: Serverless.Options & { [key: string]: any }, { log }: { log: Log }) {
    this.serverless = serverless;
    this.options = options;
    this.log = log;

    this.commands = {
      openapi: {
        usage: 'Generate openapi file locally from your serverless file',
        lifecycleEvents: ['serverless'],
        options: {
          out: {
            type: 'string',
            usage: 'Specify the output location' + '(e.g. "--out \'./openapi.yaml\'" or "-o \'./openapi.json\'")',
            required: false,
            shortcut: 'o',
          },
        },
      },
    };

    serverless.configSchemaHandler.defineCustomProperties(customProperties);

    serverless.configSchemaHandler.defineFunctionEventProperties('aws', 'http', functionEventProperties);

    this.hooks = {
      'openapi:serverless': this.generate.bind(this),
      'package:initialize': this.generate.bind(this),
    };
  }

  private async generate() {
    this.log.notice('Generate open api');
    const openApi = await new Generator(this.log).generate(this.serverless);
    const customOpenApi = this.serverless.service.custom.openapi as CustomProperties;

    const api = await $RefParser.bundle(JSON.parse(JSON.stringify(openApi as any)), {
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
    });
    this.log.debug(`API name: ${openApi.info.title}, Version: ${openApi.info.version}`);
    this.saveToFile(api, customOpenApi.out);
  }

  private saveToFile(openApi: any, out = 'openapi.json') {
    if (this.options['out']) {
      out = this.options['out'];
    }

    let output = JSON.stringify(openApi, undefined, '  ');
    if (out.endsWith('.yaml') || out.endsWith('.yml')) {
      output = dump(JSON.parse(output));
    }
    this.log.notice('Saved open api to ' + out);

    writeFileSync(out, output);
  }
}

module.exports = ServerlessPlugin;
