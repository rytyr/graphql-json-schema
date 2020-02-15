/**
 * Mapping between GQL primitive types and JSON Schema property types
 *
 */
const PRIMITIVES = {
  Int: "integer",
  Float: "number",
  String: "string",
  Boolean: "boolean",
  ID: "string"
};

const ValidationKeywords = {
  integer: ["minimum", "maximum"],
  number: ["minimum", "maximum"],
  string: ["maxLength", "minLength", "pattern", "format"],
  array: ["maxItems", "minItems", "uniqueItems"]
};

/**
 * returns a JSON schema property type for a given GQL field type
 *
 * @param      {object}  type    The GQL type object
 * @return     {Object}  the property type object or a reference to a type definition
 */
const getPropertyType = type => {
  switch (type.kind) {
    case "NonNullType":
      return Object.assign(getPropertyType(type.type), { required: true });
    case "ListType":
      return {
        type: "array",
        items: getPropertyType(type.type)
      };
    default:
      if (type.name.value in PRIMITIVES) {
        return {
          type: PRIMITIVES[type.name.value]
        };
      } else {
        return { $ref: `#/definitions/${type.name.value}` };
      }
  }
};

const castValueByKeyword = (keyName, value) => {
  switch (keyName) {
    case "minimum":
    case "maximum":
    case "maxLength":
    case "minLength":
    case "maxItems":
    case "minItems":
    case "minProperties":
    case "maxProperties":
      return Number(value);
    case "uniqueItems":
      return Boolean(value);
    default:
      return value;
  }
};

/**
 *
 * transform Validation Directives into properties
 * @param {*} directive
 * @param {*} type
 */
const convertFieldDirective = (directive, type) => {
  // only proceed for @validate
  if (directive.name.value !== "validate") return {};
  // otherwise
  const allowedKeywords = ValidationKeywords[type];
  const finalProperties = directive.arguments.reduce((acc, arg) => {
    // bypass if arguments is not valid
    if (allowedKeywords.includes(arg.name.value) === false) {
      return acc;
    }
    // cast value based on keywords
    const castedValueType = castValueByKeyword(arg.name.value, arg.value.value);
    // if its number and Integer --> ROUND
    const shouldBeRoundNumber =
      typeof castedValueType === "number" && type === PRIMITIVES.Int;
    const finalValueType = shouldBeRoundNumber
      ? Math.round(castedValueType)
      : castedValueType;
    // put on accumulator
    acc[arg.name.value] = finalValueType;
    return acc;
  }, {});

  // return
  return finalProperties;
};

/**
 * maps a GQL type field onto a JSON Schema property
 *
 * @param      {object}  field   The GQL field object
 * @return     {Object}  a plain JS object containing the property schema or a reference to another definition
 */
const toSchemaProperty = field => {
  let propertyType = getPropertyType(field.type);

  const validationProperties = field.directives.reduce(
    (acc, el) =>
      Object.assign(acc, convertFieldDirective(el, propertyType.type) || {}),
    {}
  );

  return Object.assign(
    propertyType,
    { title: field.name.value },
    validationProperties
  );
};

/**
 * Converts a single GQL definition into a plain JS schema object
 *
 * @param      {Object}  definition  The GQL definition object
 * @return     {Object}  A plain JS schema object
 */
const toSchemaObject = definition => {
  if (definition.kind === "ScalarTypeDefinition") {
    return {
      title: definition.name.value,
      type: "GRAPHQL_SCALAR"
    };
  } else if (definition.kind === "UnionTypeDefinition") {
    return {
      title: definition.name.value,
      type: "GRAPHQL_UNION",
      oneOf: definition.types.map(getPropertyType)
    };
  } else if (definition.kind === "EnumTypeDefinition") {
    return {
      title: definition.name.value,
      type: "GRAPHQL_ENUM",
      enum: definition.values.map(v => v.name.value)
    };
  }

  /**
   * @type {Array}
   */

  const fields = definition.fields.map(toSchemaProperty);

  const properties = {};
  for (let f of fields) properties[f.title] = f.allOf ? { allOf: f.allOf } : f;

  // construct required arrays
  const required = fields.filter(f => f.required).map(f => f.title);

  // remove required from fields
  fields.forEach(val => delete val.required);

  let schemaObject = {
    title: definition.name.value,
    type: "object",
    properties
  };

  if (required.length > 0) schemaObject.required = required;

  if (definition.kind === "InputObjectTypeDefinition") {
    Object.assign(schemaObject, { input: true });
  }

  return schemaObject;
};

/**
 * GQL -> JSON Schema transform
 *
 * @param      {Document}  document  The GraphQL document returned by the parse function of graphql/language
 * @return     {object}  A plain JavaScript object which conforms to JSON Schema
 */
const transform = document => {
  // ignore directives
  const definitions = document.definitions
    .filter(
      d =>
        d.kind !== "DirectiveDefinition" &&
        d.name.value !== "StringValidationFormat"
    )
    .map(toSchemaObject);

  const schema = {
    $schema: "http://json-schema.org/draft-04/schema#",
    definitions: {}
  };

  for (let def of definitions) {
    schema.definitions[def.title] = def;
  }

  return schema;
};

module.exports = transform;
