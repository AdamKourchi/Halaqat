/**
 * Core database barrel
 *
 * Import from here inside feature modules:
 *   import { DatabaseService } from '@core/database';
 */
export { DatabaseService, DB_NAME } from './database.service';
export { MigrationRunner }          from './migration-runner.service';
export { Migration }                from './migrations/migration.interface';
export { ALL_MIGRATIONS }           from './migrations/index';
