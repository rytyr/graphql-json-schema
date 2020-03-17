const { transform, extendAjv } = require("../index.js");
const fs = require("fs");
const path = require("path");
const Ajv = require("ajv");

const mockJSONSchema = require(path.join(__dirname, "data/mock_schema.json"));
const mockGraphQL = fs.readFileSync(
  path.join(__dirname, "data/mock_schema.graphql"),
  { encoding: "utf-8" }
);

describe("GraphQL to JSON Schema transform", () => {
  // it("fails if the schema is not a string", () => {
  //   expect(() => transform(Math.PI)).toThrowError();
  // });

  // it("fails if the schema is not a valid GraphQL schema", () => {
  //   expect(() =>
  //     transform(`
  //     type MyBrokenType {
  //       semicolon: String;
  //     }
  //   `)
  //   ).toThrowError();
  // });

  it("parses a test GraphQL Schema properly", () => {
    const transformResult = transform(mockGraphQL);
    // console.log(JSON.stringify(transformResult, null, 4));
    expect(transformResult).toEqual(mockJSONSchema);
  });

  it("validate ajv extension", () => {
    //
    const conv = transform(`
        type dummy {
          intro: [String!] @validate(format:"email")
        }
      `);

    const ajv = new Ajv();
    extendAjv(ajv);
    //
    const data = {
      intro: ["abc@gmail.com"]
    };

    console.log("validate: " + ajv.validate(conv.definitions.dummy, data));
    console.log(ajv.errors);
  });
});
