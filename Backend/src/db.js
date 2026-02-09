import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
const ssl =
  process.env.PGSSL === "true" ||
  (connectionString && connectionString.includes("sslmode=require"))
    ? { rejectUnauthorized: false }
    : undefined;

const pool = new Pool({
  connectionString,
  ssl,
});

export const query = (text, params) => pool.query(text, params);
export default pool;
