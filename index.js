const parse = require("graphql/language").parse;
const Transformer = require("./transform.js");

function transform(schema) {
  if (typeof schema !== "string")
    throw new TypeError("GraphQL Schema must be a string");
  let cleanedSchema = schema.replace(/\#.*/gim, "");
  cleanedSchema = cleanedSchema.replace(
    /(?:type|enum|input|scalar)\s\S+\s{\s*}/gim,
    ""
  );
  cleanedSchema = cleanedSchema.trim();
  // empty schema should be cleaned out
  if (cleanedSchema.length === 0) return {};
  const parsedSchema = parse(cleanedSchema, { noLocation: true });
  // console.log(schemaWithDirective);
  // console.log(JSON.stringify(parsedSchema, null, 4));
  return Transformer.transform(parsedSchema);
}

module.exports = {
  transform,
  extendAjv: Transformer.extendAjv,
};
