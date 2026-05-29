import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class PaymentConfigSnapshot1716400000000 implements MigrationInterface {
  name = 'PaymentConfigSnapshot1716400000000';

  private async hasColumnSafe(queryRunner: QueryRunner, table: string, column: string): Promise<boolean> {
    const hasTable = await queryRunner.hasTable(table);
    if (!hasTable) return false;

    const dbType = (queryRunner.connection.options as any).type;
    if (dbType === 'sqlite' || dbType === 'better-sqlite3') {
      const rows = await queryRunner.query(`PRAGMA table_info("${table}")`);
      return Array.isArray(rows) && rows.some((row: any) => String(row?.name || '').toLowerCase() === column.toLowerCase());
    }
    return queryRunner.hasColumn(table, column);
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasPaymentSnapshot = await this.hasColumnSafe(queryRunner, 'payments', 'config_snapshot');
    if (!hasPaymentSnapshot) {
      await queryRunner.addColumn(
        'payments',
        new TableColumn({
          name: 'config_snapshot',
          type: 'text',
          isNullable: true,
        }),
      );
    }

    const hasQrSnapshot = await this.hasColumnSafe(queryRunner, 'qr_codes', 'payment_config_snapshot');
    if (!hasQrSnapshot) {
      await queryRunner.addColumn(
        'qr_codes',
        new TableColumn({
          name: 'payment_config_snapshot',
          type: 'text',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasQrSnapshot = await this.hasColumnSafe(queryRunner, 'qr_codes', 'payment_config_snapshot');
    if (hasQrSnapshot) {
      await queryRunner.dropColumn('qr_codes', 'payment_config_snapshot');
    }

    const hasPaymentSnapshot = await this.hasColumnSafe(queryRunner, 'payments', 'config_snapshot');
    if (hasPaymentSnapshot) {
      await queryRunner.dropColumn('payments', 'config_snapshot');
    }
  }
}
