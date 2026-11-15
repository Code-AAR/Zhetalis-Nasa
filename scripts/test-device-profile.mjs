import assert from 'node:assert/strict';
import { detectPhone, effectiveQuality } from '../game/src/device-profile.js';
assert.equal(detectPhone({mobile:true,ua:'Android Mobile'}),true);
assert.equal(detectPhone({ua:'iPhone',width:390,height:844}),true);
assert.equal(detectPhone({ua:'iPad',coarse:true,touchPoints:5,width:768,height:1024}),false);
assert.equal(detectPhone({mobile:false,coarse:true,touchPoints:10,width:1440,height:900}),false);
assert.equal(detectPhone({coarse:false,width:390,height:844}),false);
assert.equal(detectPhone({coarse:true,touchPoints:5,width:390,height:844}),true);
assert.equal(effectiveQuality('auto',true),'low');
assert.equal(effectiveQuality('auto',false),'high');
assert.equal(effectiveQuality('high',true),'high');
assert.equal(effectiveQuality('low',false),'high');
console.log('Phone detection, desktop resize, tablet exclusion and quality overrides passed.');

for (const ua of ['Windows NT 10.0','Macintosh','X11; Linux x86_64','Android 14; Tablet']) {
  assert.equal(detectPhone({ua,coarse:true,touchPoints:10,width:540,height:900}),false);
}
for (const requested of [undefined,'auto','low','balanced','high']) assert.equal(effectiveQuality(requested,false),'high');
console.log('Small touch desktops, tablets and stale Lite preferences remain Full.');
