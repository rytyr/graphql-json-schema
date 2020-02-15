const parse = require("graphql/language").parse;
const transform = require("./transform.js");

module.exports = schema => {
  if (typeof schema !== "string")
    throw new TypeError("GraphQL Schema must be a string");
  const parsedSchema = parse(schema, { noLocation: true });
  // console.log(schemaWithDirective);
  // console.log(JSON.stringify(parsedSchema, null, 4));
  return transform(parsedSchema);
};
