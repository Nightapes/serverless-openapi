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
  - '@nightapes/serverless-openapi'
```

To generate api run

```bash
serverless openapi
```

If you want to change the format (json or yaml) or the file name use

```bash
serverless openapi -o openapi.yaml
```

## Add basic info and tags

Under `custom` add

```yml
custom:
  openapi:
    title: 'my fancy openapi'
    version: '1.0.0'
    description: 'My description of the serverless api'
    tags:
      - name: Settings
        description: Description
```

## Example for request and response schema

Works only for aws http events, the request is the default serverless request schema.

```yml
events:
  - http:
      path: v1/user-settings
      method: put
      tags:
        - Settings
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

## Default respsonse

You can set a default response via

```yml
custom:
  openapi:
    defaultResponse:
      application/json:
        schema: ${file(./apiError.type.json)}
        description: 'Default api error'
        name: ApiError
```

Enable the default response per function via

```yml
events:
  - http:
      path: v1/user-settings
      defaultResponse: true
```

## TODO

- Servers
- Authorizer
