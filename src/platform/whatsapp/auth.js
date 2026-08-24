import { useMultiFileAuthState } from '@whiskeysockets/baileys';

export async function loadAuthState(authPath) {
  return useMultiFileAuthState(authPath);
}
