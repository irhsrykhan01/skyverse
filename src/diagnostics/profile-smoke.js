import assert from 'node:assert/strict';
import { levelFromXp, levelProgress, titleForLevel, xpForLevel } from '../profile/config.js';

assert.equal(levelFromXp(0), 1);
assert.equal(titleForLevel(1), 'Bintang Kecil');
assert.equal(titleForLevel(3), 'Bintang Kecil');
assert.equal(titleForLevel(4), 'Pengawal Langit');
assert.equal(titleForLevel(5), 'Pengawal Langit');
assert.equal(titleForLevel(6), 'Penakluk Cakrawala');
assert.equal(titleForLevel(10), 'Penakluk Cakrawala');
assert.equal(titleForLevel(11), 'Sultan Langit');
assert.equal(titleForLevel(20), 'Sultan Langit');
assert.equal(titleForLevel(22), 'Penguasa Langit');
assert.equal(titleForLevel(100), 'Penguasa Langit');

assert.equal(levelFromXp(xpForLevel(4)), 4);
assert.equal(levelFromXp(xpForLevel(10)), 10);
assert.equal(levelFromXp(xpForLevel(20)), 20);
assert.equal(levelFromXp(xpForLevel(21)), 20);
assert.equal(levelFromXp(xpForLevel(22)), 22);

const progress = levelProgress(xpForLevel(4) + 50);
assert.equal(progress.level, 4);
assert.equal(progress.progress, 50);
assert.equal(progress.percent, 10);

const transition = levelProgress(xpForLevel(20) + 1000);
assert.equal(transition.level, 20);
assert.equal(transition.nextFloor, xpForLevel(22));

const highLevel = levelProgress(xpForLevel(50));
assert.equal(highLevel.level, 50);
assert.equal(highLevel.title, 'Penguasa Langit');

console.log('Profile smoke test passed.');
