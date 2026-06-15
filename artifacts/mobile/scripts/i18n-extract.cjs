/* Extracts t("key","default") and i18n.t("key","default") calls via the TS AST. */
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const ROOT = path.resolve(__dirname, "..");
const DIRS = ["app", "components", "lib"];
const EXCLUDE = path.join(ROOT, "lib", "i18n");

function walk(dir, acc) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (full.startsWith(EXCLUDE)) continue;
      if (full.includes("node_modules")) continue;
      walk(full, acc);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

function strLit(node) {
  if (!node) return null;
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
}

function isTCall(expr) {
  // t(...)
  if (ts.isIdentifier(expr) && expr.text === "t") return true;
  // i18n.t(...) / i18next.t(...)
  if (ts.isPropertyAccessExpression(expr) && expr.name.text === "t") return true;
  return false;
}

const map = {}; // key -> default
const collisions = [];
let calls = 0;
let missingDefault = [];

const files = [];
for (const d of DIRS) walk(path.join(ROOT, d), files);

for (const file of files) {
  const src = ts.createSourceFile(
    file,
    fs.readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    /\.tsx$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const visit = (node) => {
    if (ts.isCallExpression(node) && isTCall(node.expression)) {
      const key = strLit(node.arguments[0]);
      if (key) {
        calls++;
        const def = strLit(node.arguments[1]);
        if (def === null) {
          missingDefault.push(`${path.relative(ROOT, file)}: ${key}`);
        } else {
          if (map[key] !== undefined && map[key] !== def) {
            collisions.push(`${key}\n   A: ${map[key]}\n   B: ${def} (${path.relative(ROOT, file)})`);
          }
          map[key] = def;
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(src);
}

// Build nested object by "." separator
function setNested(obj, dottedKey, value) {
  const parts = dottedKey.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (typeof cur[p] !== "object" || cur[p] === null) cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

const nested = {};
const keys = Object.keys(map).sort();
for (const k of keys) setNested(nested, k, map[k]);

const outDir = path.join(ROOT, "lib", "i18n", "locales");
fs.writeFileSync(path.join(outDir, "en.json"), JSON.stringify(nested, null, 2) + "\n");

console.log(`Files scanned: ${files.length}`);
console.log(`t() calls with string key: ${calls}`);
console.log(`Unique keys: ${keys.length}`);
console.log(`Wrote en.json`);
if (missingDefault.length) {
  console.log(`\n[WARN] ${missingDefault.length} t() calls missing a string default:`);
  console.log(missingDefault.slice(0, 40).join("\n"));
}
if (collisions.length) {
  console.log(`\n[WARN] ${collisions.length} key collisions (same key, different defaults):`);
  console.log(collisions.slice(0, 40).join("\n"));
}
