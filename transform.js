const ajvFormats = require("ajv/lib/compile/formats")("fast");
/**
 * Mapping between GQL primitive types and JSON Schema property types
 *
 */
const PRIMITIVES = {
  Int: "integer",
  Float: "number",
  String: "string",
  Boolean: "boolean",
  ID: "string",
  JSON: "object",
  DateTime: "DateTime",
};

const ValidationKeywords = {
  integer: ["minimum", "maximum"],
  number: ["minimum", "maximum"],
  string: ["maxLength", "minLength", "pattern", "format"],
  array: ["maxItems", "minItems", "uniqueItems"],
};

const ExtendedKeywords = {
  integer: [],
  number: [],
  string: [],
  array: ["format"],
};

/**
 * returns a JSON schema property type for a given GQL field type
 *
 * @param      {object}  type    The GQL type object
 * @return     {Object}  the property type object or a reference to a type definition
 */
const getPropertyType = (type, parentType) => {
  switch (type.kind) {
    case "NonNullType":
      return Object.assign(
        getPropertyType(type.type),
        parentType && parentType === "ListType" ? {} : { required: true }
      );
    case "ListType":
      // console.log(JSON.stringify(type, null, 2));
      return {
        type: "array",
        items: getPropertyType(type.type, type.kind),
      };
    default:
      if (type.name.value in PRIMITIVES) {
        if (parentType && parentType === "ListType") {
          return {
            type: [PRIMITIVES[type.name.value], "null"],
          };
        } else if (type.name.value === "DateTime") {
          return {
            type: "string",
            format: "date-time",
          };
        }
        //otherwise
        return {
          type: PRIMITIVES[type.name.value],
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
  const allowedKeywords = [
    ...ValidationKeywords[type],
    ...ExtendedKeywords[type],
  ];
  const additionalKeywords = ExtendedKeywords[type];
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
    const accKey = additionalKeywords.includes(arg.name.value)
      ? `ext_${arg.name.value}`
      : arg.name.value;
    acc[accKey] = finalValueType;
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
const toSchemaProperty = (field) => {
  // console.log(JSON.stringify(field, null, 2));

  let propertyType = getPropertyType(field.type);

  // process directives
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

const DefaultScalars = ["DateTime", "Date", "JSON"];

/**
 * Converts a single GQL definition into a plain JS schema object
 *
 * @param      {Object}  definition  The GQL definition object
 * @return     {Object}  A plain JS schema object
 */
const toSchemaObject = (definition) => {
  if (definition.kind === "ScalarTypeDefinition") {
    return {
      title: definition.name.value,
      type: "GRAPHQL_SCALAR",
    };
  } else if (definition.kind === "UnionTypeDefinition") {
    return {
      title: definition.name.value,
      type: "GRAPHQL_UNION",
      oneOf: definition.types.map(getPropertyType),
    };
  } else if (definition.kind === "EnumTypeDefinition") {
    return {
      title: definition.name.value,
      type: "GRAPHQL_ENUM",
      enum: definition.values.map((v) => v.name.value),
    };
  }

  /**
   * @type {Array}
   */
  const fields = definition.fields.map(toSchemaProperty);

  const properties = {};
  for (let f of fields) properties[f.title] = f.allOf ? { allOf: f.allOf } : f;

  // construct required arrays
  const required = fields.filter((f) => f.required).map((f) => f.title);

  // remove required from fields
  fields.forEach((val) => delete val.required);

  let schemaObject = {
    title: definition.name.value,
    type: "object",
    properties,
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
const transform = (document) => {
  // ignore directives
  const definitions = document.definitions
    .filter(
      (d) =>
        d.kind !== "DirectiveDefinition" &&
        d.name.value !== "StringValidationFormat"
    )
    .map(toSchemaObject);

  const schema = {
    $schema: "http://json-schema.org/draft-04/schema#",
    definitions: {},
  };

  for (let def of definitions) {
    // console.log(JSON.stringify(def, null, 2));
    schema.definitions[def.title] = def;
  }

  return schema;
};

module.exports.transform = transform;

/**
 * extend AJV
 * @param {import("ajv").Ajv} ajvObj
 */
function extendAjv(ajvObj) {
  if (ajvObj && ajvObj.addKeyword) {
    // extend on ext_format
    ajvObj.addKeyword("ext_format", {
      validate: function (schema, data) {
        // console.log([typeof schema, schema, data]);
        // console.log(ajvFormats);
        const regexCheck = ajvFormats[schema]
          ? new RegExp(ajvFormats[schema])
          : null;
        // invalid if it is not string and match with regex
        const invalidContent = data.findIndex(
          (str) => typeof str !== "string" || regexCheck.test(str) === false
        );
        if (invalidContent != -1) return false;
        return true;
      },
      errors: true,
    });
  }
}

module.exports.extendAjv = extendAjv;
