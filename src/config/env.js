import { defaults } from './defaults.js';

const clean = (value) => value?.trim() || undefined;
const toBoolean = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};

export function loadConfig(env = process.env) {
  return Object.freeze({
    nodeEnv: clean(env.NODE_ENV) ?? defaults.nodeEnv,
    botName: clean(env.BOT_NAME) ?? defaults.botName,
    prefix: clean(env.SKYVERSE_PREFIX) ?? defaults.prefix,
    ownerNumber: clean(env.OWNER_NUMBER) ?? null,
    logLevel: clean(env.LOG_LEVEL) ?? defaults.logLevel,
    authPath: clean(env.AUTH_PATH) ?? defaults.authPath,
    databasePath: clean(env.DATABASE_PATH) ?? defaults.databasePath,
    delineBaseUrl: clean(env.DELINE_BASE_URL) ?? defaults.delineBaseUrl,
    zenzxzBaseUrl: clean(env.ZENZXZ_BASE_URL) ?? defaults.zenzxzBaseUrl,
    vredenBaseUrl: clean(env.VREDEN_BASE_URL) ?? defaults.vredenBaseUrl,
    siputzxBaseUrl: clean(env.SIPUTZX_BASE_URL) ?? defaults.siputzxBaseUrl,
    tikwmBaseUrl: clean(env.TIKWM_BASE_URL) ?? defaults.tikwmBaseUrl,
    reelsVideoBaseUrl: clean(env.REELSVIDEO_BASE_URL) ?? defaults.reelsVideoBaseUrl,
    keyraBaseUrl: clean(env.KEYRA_BASE_URL) ?? defaults.keyraBaseUrl,
    keyraApiKey: clean(env.KEYRA_API_KEY) ?? defaults.keyraApiKey,
    bratBaseUrl: clean(env.BRAT_BASE_URL) ?? defaults.bratBaseUrl,
    nexrayBaseUrl: clean(env.NEXRAY_BASE_URL) ?? defaults.nexrayBaseUrl,
    removeBgBaseUrl: clean(env.REMOVE_BG_BASE_URL) ?? defaults.removeBgBaseUrl,
    whatsappLogLevel: clean(env.WHATSAPP_LOG_LEVEL) ?? defaults.whatsappLogLevel,
    autoRead: toBoolean(env.AUTO_READ, defaults.autoRead),
    autoOnline: toBoolean(env.AUTO_ONLINE, defaults.autoOnline),
    usePairingCode: toBoolean(env.USE_PAIRING_CODE, defaults.usePairingCode),
    pairingNumber: clean(env.PAIRING_NUMBER) ?? defaults.pairingNumber,
  });
}
