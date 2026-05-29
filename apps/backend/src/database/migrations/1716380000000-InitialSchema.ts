import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1716380000000 implements MigrationInterface {
    name = 'InitialSchema1716380000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    const dbType = (queryRunner.connection.options as any).type;
    if (dbType === 'postgres') {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "audit_logs" ("id" varchar PRIMARY KEY NOT NULL, "action" varchar NOT NULL, "entity" varchar NOT NULL, "entityId" varchar, "actorId" varchar, "details" text, "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    } else {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "audit_logs" ("id" varchar PRIMARY KEY NOT NULL, "action" varchar NOT NULL, "entity" varchar NOT NULL, "entityId" varchar, "actorId" varchar, "details" text, "createdAt" datetime NOT NULL DEFAULT (datetime('now')))`);
    }
  }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "audit_logs"`);
    }
}
