import test from "node:test";
import assert from "node:assert/strict";

async function fixture(name, stored = null, broken = false) {
  const old = {
    window: globalThis.window,
    document: globalThis.document,
    localStorage: globalThis.localStorage,
  };
  const events = [],
    contexts = [],
    store = new Map(stored === null ? [] : [["chesslens-sound-v1", stored]]);
  const param = () => ({
    value: 0,
    cancelScheduledValues(t) {
      events.push(["cancel", t]);
    },
    setValueAtTime(v, t) {
      events.push(["gain", v, t]);
    },
    exponentialRampToValueAtTime(v, t) {
      events.push(["ramp", v, t]);
    },
  });
  class Audio {
    state = "running";
    currentTime = 1;
    destination = {};
    constructor() {
      if (broken) throw Error("blocked");
      contexts.push(this);
    }
    createGain() {
      return { gain: param(), connect() {}, disconnect() {} };
    }
    createOscillator() {
      return {
        frequency: param(),
        connect() {},
        disconnect() {},
        start(t) {
          events.push(["start", t]);
        },
        stop(t) {
          events.push(["stop", t]);
        },
      };
    }
    async resume() {
      this.state = "running";
      events.push(["resume"]);
    }
  }
  globalThis.window = { AudioContext: Audio };
  globalThis.document = { hidden: false };
  globalThis.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, v),
  };
  const sound = await import(`../src/sound.ts?${name}`);
  return {
    sound,
    events,
    contexts,
    store,
    restore() {
      for (const [key, v] of Object.entries(old)) {
        if (v === undefined) delete globalThis[key];
        else globalThis[key] = v;
      }
    },
  };
}
test("audio is lazy, local, quiet and stops immediately when muted", async () => {
  const f = await fixture("lazy");
  try {
    const { sound: s, events, contexts } = f;
    s.playSound("move");
    assert.equal(contexts.length, 0);
    assert.equal(events.length, 0);
    s.primeAudio();
    assert.equal(contexts.length, 1);
    assert.equal(events.length, 0);
    s.playSound("move");
    assert.equal(events.filter((e) => e[0] === "start").length, 2);
    s.setSoundEnabled(false);
    assert.equal(f.store.get("chesslens-sound-v1"), "off");
    assert.ok(events.some((e) => e[0] === "gain" && e[1] === 0));
    const count = events.length;
    s.playSound("scan");
    s.primeAudio();
    assert.equal(events.length, count);
    assert.equal(contexts.length, 1);
  } finally {
    f.restore();
  }
});
test("saved mute, preference subscriptions, background suppression and suspended audio recovery", async () => {
  const f = await fixture("saved", "off");
  try {
    const s = f.sound;
    assert.equal(s.getSoundEnabled(), false);
    s.primeAudio();
    assert.equal(f.contexts.length, 0);
    let changes = 0;
    const off = s.subscribeSound(() => changes++);
    s.setSoundEnabled(true);
    assert.equal(changes, 1);
    off();
    s.primeAudio();
    f.contexts[0].state = "suspended";
    s.primeAudio();
    assert.equal(f.contexts[0].state, "running");
    document.hidden = true;
    const n = f.events.length;
    s.playSound("finish");
    assert.equal(f.events.length, n);
    document.hidden = false;
    s.playSound("scan");
    assert.equal(f.events.filter((e) => e[0] === "start").length, 2);
    s.setSoundEnabled(false);
    assert.equal(changes, 1);
  } finally {
    f.restore();
  }
});
test("unavailable storage or Web Audio never breaks chess actions", async () => {
  const f = await fixture("blocked", null, true);
  try {
    globalThis.localStorage = {
      getItem() {
        throw Error("blocked");
      },
      setItem() {
        throw Error("blocked");
      },
    };
    assert.equal(f.sound.getSoundEnabled(), true);
    assert.doesNotThrow(() => {
      f.sound.primeAudio();
      f.sound.playSound("capture");
      f.sound.setSoundEnabled(false);
      f.sound.stopSounds();
    });
    assert.equal(f.sound.getSoundEnabled(), false);
  } finally {
    f.restore();
  }
});
