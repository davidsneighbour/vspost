import { readFile } from 'node:fs/promises';
import { AppConfigSchema, type AppConfig } from './schema.js';
import { resolveEnvPlaceholders } from '../utils/env.js';

/**
 * Loads and validates the JSON configuration file.
 *
 * @param configPath - Path to a JSON config file.
 * @returns Validated application configuration.
 */
export async function loadConfig(configPath: string): Promise<AppConfig> {
  const raw = await readFile(configPath, 'utf8');
  const parsed: unknown = JSON.parse(raw);
  const resolved = resolveEnvPlaceholders(parsed);

  return AppConfigSchema.parse(resolved);
}
