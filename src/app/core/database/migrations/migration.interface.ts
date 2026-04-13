/**
 * Every database migration must implement this interface.
 * Migrations are numbered sequentially and run in order.
 */
export interface Migration {
  /** Sequential version number, e.g. 1, 2, 3 … */
  version: number;
  /** Human-readable description shown in logs */
  description: string;
  /** SQL statements to apply this migration (forward) */
  up(db: import('@capacitor-community/sqlite').SQLiteDBConnection): Promise<void>;
  /** SQL statements to undo this migration (rollback) */
  down(db: import('@capacitor-community/sqlite').SQLiteDBConnection): Promise<void>;
}
