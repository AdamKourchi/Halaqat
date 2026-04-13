# /src/app/core

The **core** layer is the single source of truth for:

| Subfolder        | Purpose |
|------------------|---------|
| `database/`      | SQLite connection bootstrap + `MigrationRunner` |
| `database/migrations/` | One file per schema version, named `NNN_description.migration.ts` |
| `models/`        | Plain TypeScript interfaces that mirror DB table columns |
| `repositories/`  | One class per table – all raw SQL lives here, NOWHERE else |
| `services/`      | Business logic on top of repositories; expose RxJS observables |
| `guards/`        | Route guards (`DbReadyGuard`, `AuthGuard`, …) |

## Adding a migration

1. Create `src/app/core/database/migrations/NNN_description.migration.ts`
2. Implement the `Migration` interface (`up` + `down`)
3. Add it to `migrations/index.ts` – `MigrationRunner` picks it up automatically

## Adding a domain entity

1. Add interface to `models/`
2. Add repository to `repositories/`
3. Add service to `services/`
4. Export from each `index.ts` barrel
