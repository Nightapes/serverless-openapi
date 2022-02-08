import { JSONSchema7 } from 'json-schema';

export interface Schema {
  schema?: JSONSchema7;
  name: string;
  description?: string;
}
