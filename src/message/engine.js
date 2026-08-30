import { createMessageContext } from './context.js';
import { parseIncomingMessage } from './parser.js';
import { createAfkService } from '../services/afk.js';
import { createAntideleteService } from '../services/antidelete.js';
import { getMessageText } from './parser.js';
import { isBombReply, guessBomb, updateBombMessage } from '../games/bomb.js';

const STATUS_JIDS = new Set(['status@broadcast']);