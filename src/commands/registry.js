import { readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { suggestNames } from '../utils/similarity.js';

const ROOT = dirname(fileURLToPath(import.meta.url));

async function findCommandFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await findCommandFiles(fullPath));
    else if (
      entry.isFile() &&
      entry.name.endsWith('.js') &&
      !entry.name.startsWith('_') &&
      entry.name !== 'registry.js'
    ) {
      files.push(fullPath);
    }
  }
  return files;
}

function validateCommand(command, file) {
  if (!command || typeof command !== 'object') throw new Error(`Invalid command export: ${file}`);
  if (!command.name || typeof command.execute !== 'function') {
    throw new Error(`Command ${file} must export name and execute()`);
  }
  return Object.freeze({
    category: command.category ?? 'general',
    description: command.description ?? 'No description available.',
    aliases: Array.isArray(command.aliases) ? command.aliases.map(String) : [],
    usage: command.usage ?? null,
    permission: command.permission ?? 'user',
    ...command,
  });
}

export async function createCommandRegistry() {
  const commands = new Map();
  const aliases = new Map();
  const files = await findCommandFiles(ROOT);

  for (const file of files) {
    const module = await import(pathToFileURL(file).href);
    const command = validateCommand(module.default ?? module.command, file);
    const key = command.name.toLowerCase();
    if (commands.has(key)) throw new Error(`Duplicate command: ${command.name}`);
    commands.set(key, command);

    for (const alias of command.aliases) {
      const aliasKey = alias.toLowerCase();
      if (aliases.has(aliasKey) || commands.has(aliasKey)) throw new Error(`Duplicate command alias: ${alias}`);
      aliases.set(aliasKey, key);
    }
  }

  function resolve(name) {
    const key = String(name).toLowerCase();
    return commands.get(key) ?? commands.get(aliases.get(key));
  }

  function all() {
    return [...commands.values()];
  }

  function byCategory() {
    const groups = new Map();
    for (const command of commands.values()) {
      if (!groups.has(command.category)) groups.set(command.category, []);
      groups.get(command.category).push(command);
    }
    for (const list of groups.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    return groups;
  }

  function suggest(name) {
    return suggestNames(name, all().flatMap((command) => [command.name, ...command.aliases]));
  }

  return Object.freeze({ resolve, all, byCategory, suggest });
}
