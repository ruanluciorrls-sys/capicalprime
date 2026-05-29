import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class ExtensionDeviceStatusFields1716390000000 implements MigrationInterface {
  name = 'ExtensionDeviceStatusFields1716390000000';

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
    const hasConnectionStatus = await this.hasColumnSafe(queryRunner, 'extension_devices', 'connection_status');
    if (!hasConnectionStatus) {
      await queryRunner.addColumn(
        'extension_devices',
        new TableColumn({
          name: 'connection_status',
          type: 'varchar',
          length: '20',
          isNullable: false,
          default: "'OFFLINE'",
        }),
      );
    }

    const hasLastError = await this.hasColumnSafe(queryRunner, 'extension_devices', 'last_error');
    if (!hasLastError) {
      await queryRunner.addColumn(
        'extension_devices',
        new TableColumn({
          name: 'last_error',
          type: 'text',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasLastError = await this.hasColumnSafe(queryRunner, 'extension_devices', 'last_error');
    if (hasLastError) {
      await queryRunner.dropColumn('extension_devices', 'last_error');
    }

    const hasConnectionStatus = await this.hasColumnSafe(queryRunner, 'extension_devices', 'connection_status');
    if (hasConnectionStatus) {
      await queryRunner.dropColumn('extension_devices', 'connection_status');
    }
  }
}
