# json-schema-from-graphql

> FORKED from https://github.com/jakubfiala/graphql-json-schema

Converts GraphQL DSL into JSON Schema for validation purposes

### Difference against original version

- [x] cleanup required field in a property
- [x] correction on structuring type definition
- [x] implement @validate directive on **FIELD_DEFINITION** for integer, number, string and array
- [ ] validation on Object

### Supported validation keywords

Arguments within @validate directive follow JSON Schema validation keywords

```js
{
  integer: ["minimum", "maximum"],
  number: ["minimum", "maximum"],
  string: ["maxLength", "minLength", "pattern", "format"],
  array: ["maxItems", "minItems", "uniqueItems"]
}
```

## Installation

```shell
npm install json-schema-from-graphql
```

## Usage

```js
const transform = require("json-schema-from-graphql");

const schema = transform(`
  scalar Foo

  union MyUnion = Foo | String | Float

  enum MyEnum {
    FIRST_ITEM
    SECOND_ITEM
    THIRD_ITEM
  }

  type WithDirective {
    field_one: Int @validate(minimum: 10)
    field_two: Int! @validate(minimum: 10, maximum: 50)
    field_three: String! @validate(maxLength: 8, format: "date-time")
    field_four: String @validate(minLength: 5, pattern: "[abc]+")
    field_five: [String] @validate(uniqueItems: true, minItems: 3)
  }

  type Stuff {
    my_field: Int
    req_field: String!
    recursion: MoreStuff
    custom_scalar: Foo
    enum: MyEnum
  }

  type MoreStuff {
    first: [Float]
    identifier: [ID]!
    reference: Stuff!
    bool: Boolean!
    union: MyUnion
    with_params: Int
  }

  input InputType {
    an_int: Int!
    a_string: String
  }

  `);

console.log(schema);
```

the code above prints the following JSON as a plain JS object:

```json
{
  "$schema": "http://json-schema.org/draft-04/schema#",
  "definitions": {
    "Foo": {
      "title": "Foo",
      "type": "GRAPHQL_SCALAR"
    },
    "MyUnion": {
      "title": "MyUnion",
      "type": "GRAPHQL_UNION",
      "oneOf": [
        {
          "$ref": "#/definitions/Foo"
        },
        {
          "type": "string"
        },
        {
          "type": "number"
        }
      ]
    },
    "MyEnum": {
      "title": "MyEnum",
      "type": "GRAPHQL_ENUM",
      "enum": ["FIRST_ITEM", "SECOND_ITEM", "THIRD_ITEM"]
    },
    "WithDirective": {
      "title": "WithDirective",
      "type": "object",
      "properties": {
        "field_one": {
          "type": "integer",
          "title": "field_one",
          "minimum": 10
        },
        "field_two": {
          "type": "integer",
          "title": "field_two",
          "minimum": 10,
          "maximum": 50
        },
        "field_three": {
          "type": "string",
          "title": "field_three",
          "maxLength": 8,
          "format": "date-time"
        },
        "field_four": {
          "type": "string",
          "title": "field_four",
          "minLength": 5,
          "pattern": "[abc]+"
        },
        "field_five": {
          "type": "array",
          "title": "field_five",
          "minItems": 3,
          "uniqueItems": true,
          "items": {
            "type": "string"
          }
        }
      },
      "required": ["field_two", "field_three"]
    },
    "Stuff": {
      "title": "Stuff",
      "type": "object",
      "properties": {
        "my_field": {
          "type": "integer",
          "title": "my_field"
        },
        "req_field": {
          "type": "string",
          "title": "req_field"
        },
        "recursion": {
          "$ref": "#/definitions/MoreStuff",
          "title": "recursion"
        },
        "custom_scalar": {
          "$ref": "#/definitions/Foo",
          "title": "custom_scalar"
        },
        "enum": {
          "$ref": "#/definitions/MyEnum",
          "title": "enum"
        }
      },
      "required": ["req_field"]
    },
    "MoreStuff": {
      "title": "MoreStuff",
      "type": "object",
      "properties": {
        "first": {
          "type": "array",
          "items": {
            "type": "number"
          },
          "title": "first"
        },
        "identifier": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "title": "identifier"
        },
        "reference": {
          "$ref": "#/definitions/Stuff",
          "title": "reference"
        },
        "bool": {
          "type": "boolean",
          "title": "bool"
        },
        "union": {
          "$ref": "#/definitions/MyUnion",
          "title": "union"
        },
        "with_params": {
          "type": "integer",
          "title": "with_params"
        }
      },
      "required": ["identifier", "reference", "bool"]
    },
    "InputType": {
      "title": "InputType",
      "type": "object",
      "input": true,
      "properties": {
        "an_int": {
          "type": "integer",
          "title": "an_int"
        },
        "a_string": {
          "type": "string",
          "title": "a_string"
        }
      },
      "required": ["an_int"]
    }
  }
}
```
