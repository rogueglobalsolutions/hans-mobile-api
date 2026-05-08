import path from "path";
import dotenv from "dotenv";

const NODE_ENV = process.env.NODE_ENV || "development";
const cwd = process.cwd();

// Load the most specific env first so values are not overwritten by fallbacks.
dotenv.config({ path: path.join(cwd, `.env.${NODE_ENV}.local`) });
dotenv.config({ path: path.join(cwd, `.env.${NODE_ENV}`) });
dotenv.config({ path: path.join(cwd, ".env.local") });
dotenv.config({ path: path.join(cwd, ".env") });
