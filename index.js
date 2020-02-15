const parse = require("graphql/language").parse;
const transform = require("./transform.js");

const baseDirective = `
directive @range(
  min: Int
  max: Int
) on FIELD_DEFINITION
`;

module.exports = schema => {
  if (typeof schema !== "string")
    throw new TypeError("GraphQL Schema must be a string");
  const schemaWithDirective = baseDirective + schema;
  const parsedSchema = parse(schemaWithDirective, { noLocation: true });
  // console.log(schemaWithDirective);
  // console.log(JSON.stringify(parsedSchema, null, 4));
  return transform(parsedSchema);
};
