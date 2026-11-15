// Night-skip rules (game/src/night-vote.js): majority vote, sleeping window and the morning clock.
import assert from 'node:assert/strict';
import { nightVote, canSleepAt, morningClock } from '../game/src/night-vote.js';
const P = (sleeping, vote = false) => ({ sleeping, vote });
assert.equal(nightVote([P(true)]).skip, true, 'alone in a bunk');
assert.equal(nightVote([P(false)]).skip, false);
assert.equal(nightVote([P(true), P(false)]).skip, false, '2 players: both must be ready');
assert.equal(nightVote([P(true), P(false, true)]).skip, true, 'one asleep, one voted');
assert.equal(nightVote([P(true), P(true), P(false)]).skip, true, '2 of 3');
assert.equal(nightVote([P(true), P(false), P(false)]).skip, false);
assert.deepEqual(nightVote([P(true), P(true), P(false), P(false)]), { total: 4, ready: 2, need: 3, sleeping: 2, skip: false });
assert.equal(nightVote([P(true), P(true), P(true), P(true)]).skip, true, 'everyone asleep');
assert.equal(nightVote([]).skip, false);
assert.equal(canSleepAt(.8, .25, .75), true); assert.equal(canSleepAt(.1, .25, .75), true);
assert.equal(canSleepAt(.5, .25, .75), false); assert.equal(canSleepAt(.73, .25, .75), true, 'just before sunset');
assert.equal(canSleepAt(.247, .25, .75), false, 'sun almost up');
assert.equal(morningClock(.9, 300, .25), 300 + .26 * 300, 'evening: wake tomorrow (sol rolls over)');
assert.equal(morningClock(.1, 300, .25), .26 * 300, 'after midnight: wake today');
console.log('night vote: all checks passed');
