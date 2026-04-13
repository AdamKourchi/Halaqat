/**
 * Migration barrel – import every migration here in ascending version order.
 *
 * When you add a new migration:
 *   1. Create the file  NNN_description.migration.ts
 *   2. Add it to this list (keep them sorted!)
 *   3. The MigrationRunner will apply it automatically on next app start.
 */
import { migration001 } from './001_initial_schema.migration';
import { migration002 } from './002_domain_tables.migration';
import { migration003 } from './003_quran_seed.migration';

import { Migration } from './migration.interface';

export const ALL_MIGRATIONS: Migration[] = [
  migration001,
  migration002,
  migration003,
];
