import { JSONSchema7 } from 'json-schema';

export interface Schema {
  schema?: JSONSchema7;
  customName?: string;
  name?: string;
  description?: string;
}
