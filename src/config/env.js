import { defaults } from './defaults.js';

const clean = (value) => value?.trim() || undefined;

export function loadConfig(env = process.env) {
  return Object.freeze({
    nodeEnv: clean(env.NODE_ENV) ?? defaults.nodeEnv,
    botName: clean(env.BOT_NAME) ?? defaults.botName,
    prefix: clean(env.PREFIX) ?? defaults.prefix,
    ownerNumber: clean(env.OWNER_NUMBER) ?? null,
    logLevel: clean(env.LOG_LEVEL) ?? defaults.logLevel,
    authPath: clean(env.AUTH_PATH) ?? defaults.authPath,
    whatsappLogLevel: clean(env.WHATSAPP_LOG_LEVEL) ?? defaults.whatsappLogLevel,
  });
}
