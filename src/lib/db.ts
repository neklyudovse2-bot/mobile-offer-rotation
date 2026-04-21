import { neon } from '@neondatabase/serverless';

export const sql = neon(process.env.MOBILE_ROTATION_DB_URL!);
