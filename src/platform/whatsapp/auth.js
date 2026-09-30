import { rm } from 'node:fs/promises';
import { useMultiFileAuthState } from '@whiskeysockets/baileys';

export async function loadAuthState(authPath) {
  return useMultiFileAuthState(authPath);
}

export async function clearAuthState(authPath, logger = console) {
  try {
    await rm(authPath, { recursive: true, force: true });
    logger.warn?.('WhatsApp auth state direset. SkyVerse membutuhkan koneksi ulang.');
  } catch (error) {
    logger.error?.(`Gagal mereset WhatsApp auth state = ${error?.message ?? String(error)}`);
    throw error;
  }
}
