const assert = require("node:assert/strict");
const test = require("node:test");
const { Schema } = require("@tiptap/pm/model");
const { Transform } = require("@tiptap/pm/transform");

test("editor model and transform can split a formatted paragraph", () => {
  const schema = new Schema({
    nodes: { doc: { content: "paragraph+" }, paragraph: { content: "text*" }, text: {} },
    marks: { bold: {} },
  });
  const bold = schema.marks.bold.create();
  const doc = schema.node("doc", null, [schema.node("paragraph", null, schema.text("abcd", [bold]))]);
  const result = new Transform(doc).split(3).doc;
  assert.equal(result.childCount, 2);
  assert.equal(result.child(0).textContent, "ab");
  assert.equal(result.child(1).textContent, "cd");
  assert.equal(result.child(1).firstChild.marks[0].type.name, "bold");
});
