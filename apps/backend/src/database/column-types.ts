/**
 * Tipos de coluna que dependem do banco em uso (compatibilidade SQLite/Postgres).
 *
 * Como funciona:
 * - Em PRODUCAO (Docker): a variavel de ambiente DATABASE_TYPE=postgres ja esta setada
 *   no shell antes do node iniciar (via docker-compose). Resolve para 'timestamp'.
 * - Em DEV (local): DATABASE_TYPE esta no .env mas ainda nao foi carregado pelo
 *   ConfigModule no momento em que os decoradores @Column rodam. Fallback para
 *   'datetime', que e o que better-sqlite3 aceita.
 *
 * IMPORTANTE: Importar esta constante em todas as entidades em vez de fixar 'datetime'
 * ou 'timestamp' diretamente nos decoradores.
 */

const dbType = (process.env.DATABASE_TYPE || '').toLowerCase();
const isPostgres = dbType === 'postgres' || dbType === 'postgresql';

export const COL_DATETIME: 'datetime' | 'timestamp' = isPostgres ? 'timestamp' : 'datetime';
