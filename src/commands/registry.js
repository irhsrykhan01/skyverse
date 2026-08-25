import { readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { suggestNames } from '../utils/similarity.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
const BLOCKED_COMMANDS = new Set(['qc', 'bratvid']);

async function findCommandFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await findCommandFiles(fullPath));
    else if (entry.isFile() && entry.name.endsWith('.js') && !entry.name.startsWith('_') && entry.name !== 'registry.js') files.push(fullPath);
  }
  return files;
}

function normalizeAliases(aliases) {
  return [...new Set((Array.isArray(aliases) ? aliases : []).map((alias) => String(alias).trim().toLowerCase()).filter(Boolean))];
}

function validateCommand(command, file) {
  if (!command || typeof command !== 'object') throw new Error(`Invalid command export: ${file}`);
  if (!command.name || typeof command.execute !== 'function') throw new Error(`Command ${file} must export name and execute()`);
  const name = String(command.name).trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(name)) throw new Error(`Invalid command name: ${command.name}`);
  const permission = String(command.permission ?? 'user').toLowerCase();
  if (!['user', 'admin', 'owner'].includes(permission)) throw new Error(`Invalid permission for ${name}: ${permission}`);
  const minArgs = Number.isInteger(command.minArgs) && command.minArgs >= 0 ? command.minArgs : 0;
  const maxArgs = Number.isInteger(command.maxArgs) && command.maxArgs >= minArgs ? command.maxArgs : null;
  const cooldown = Number.isFinite(command.cooldown) && command.cooldown > 0 ? command.cooldown : 0;
  const blocked = BLOCKED_COMMANDS.has(name);
  return Object.freeze({
    ...command,
    name,
    category: String(command.category ?? 'general').trim().toLowerCase() || 'general',
    description: String(command.description ?? 'No description available.'),
    aliases: normalizeAliases(command.aliases),
    usage: command.usage ? String(command.usage) : null,
    examples: Array.isArray(command.examples) ? command.examples.map(String) : [],
    permission,
    minArgs,
    maxArgs,
    cooldown,
    hidden: blocked || command.hidden === true,
    enabled: !blocked && command.enabled !== false,
  });
}

export async function createCommandRegistry() {
  const commands = new Map();
  const aliases = new Map();
  const files = await findCommandFiles(ROOT);

  for (const file of files) {
    const module = await import(pathToFileURL(file).href);
    const command = validateCommand(module.default ?? module.command, file);
    const key = command.name;
    if (commands.has(key) || aliases.has(key)) throw new Error(`Duplicate command: ${command.name}`);
    commands.set(key, command);
    for (const alias of command.aliases) {
      if (aliases.has(alias) || commands.has(alias)) throw new Error(`Duplicate command alias: ${alias}`);
      aliases.set(alias, key);
    }
  }

  function resolve(name) {
    const key = String(name).trim().toLowerCase();
    const command = commands.get(key) ?? commands.get(aliases.get(key));
    return command?.enabled === false ? undefined : command;
  }

  function all({ includeHidden = true, includeDisabled = false } = {}) {
    return [...commands.values()]
      .filter((command) => (includeHidden || !command.hidden) && (includeDisabled || command.enabled))
      .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  }

  function byCategory({ includeHidden = false } = {}) {
    const groups = new Map();
    for (const command of all({ includeHidden })) {
      if (!groups.has(command.category)) groups.set(command.category, []);
      groups.get(command.category).push(command);
    }
    return groups;
  }

  function suggest(name) {
    return suggestNames(name, all({ includeHidden: false }).flatMap((command) => [command.name, ...command.aliases]));
  }

  return Object.freeze({ resolve, all, byCategory, suggest });
}
