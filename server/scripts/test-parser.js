import path from "path";
import { fileURLToPath } from "url";
import { parseEstimateFile } from "../src/services/estimateParser.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const fileArg = process.argv[2];
const filePath = fileArg
  ? path.resolve(process.cwd(), fileArg)
  : path.join(__dirname, "..", "test-fixtures", "sample-estimate.xlsx");

const result = await parseEstimateFile(filePath, path.basename(filePath));
console.log(JSON.stringify(result, null, 2));
