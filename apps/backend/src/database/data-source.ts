import { DataSource } from 'typeorm';
import type { DataSourceOptions } from 'typeorm';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: process.env.DOTENV_PATH ?? resolve(process.cwd(), '.env') });

const isSqlite = (process.env.DATABASE_TYPE ?? 'sqlite') === 'sqlite';

const options: DataSourceOptions = isSqlite
  ? {
      type: 'better-sqlite3',
      database: process.env.DATABASE_PATH ?? './data/aios.db',
      entities: ['dist/**/*.entity.js'],
      migrations: ['dist/database/migrations/*.js'],
      synchronize: false,
    }
  : {
      type: 'postgres',
      host: process.env.DATABASE_HOST ?? 'localhost',
      port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
      username: process.env.DATABASE_USER ?? 'aios',
      password: process.env.DATABASE_PASS ?? '',
      database: process.env.DATABASE_NAME ?? 'aios_db',
      entities: ['dist/**/*.entity.js'],
      migrations: ['dist/database/migrations/*.js'],
      synchronize: false,
    };

export default new DataSource(options);
