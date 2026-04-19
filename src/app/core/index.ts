/**
 * Core barrel – the single import point for everything inside /core.
 *
 * Usage in any feature:
 *   import { DatabaseService, UserService, User } from '@core';
 *
 * (The @core path alias is configured in tsconfig.json)
 */
export * from './database/index';
export * from './models/index';
export * from './repositories/index';
export * from './services/index';
export * from './helpers/index';
export * from './theme/theme.service';