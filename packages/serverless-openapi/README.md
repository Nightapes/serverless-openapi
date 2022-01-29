# serverless-openapi

A simple openapi generator for [serverless](serverless.com).

Support for serverless 2 and 3

The files is generated locally without any upload to aws apigateway.

## Install

`npm i -D @nightapes/serverless-openapi`

## Usage

Add plugin into your `serverless.yml` file

```yml
plugins:
  - serverless-openapi
```

## Add basic info

Under `custom` add

```yml
custom:
  openapi:
    title: 'my fancy openapi'
    version: '1.0.0'
    description: 'My description of the serverless api'
```

## Example for request and response schema

Works only for http events, the request is the default serverless request schema.

```yml
events:
  - http:
      path: v1/user-settings
      method: put
      authorizer:
        name: authorizer
        scopes:
          - admin
      operationId: setUserSettings
      cors: true
      request:
        schemas:
          application/json:
            schema: ${file(./your-schema.json)}
            name: UserSettings
      responseSchemas:
        200:
          application/json:
            schema: ${file(./your-schema.json)}
            name: UserSettings
            description: 'UserSettings'
        204:
          application/json:
            description: 'OK'
```

## TODO

- Servers
- Authorizer
