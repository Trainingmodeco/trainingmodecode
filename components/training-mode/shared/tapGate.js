// How long a tap may wait on something that only has to be started, such as
// unlocking the phone's speech engine. The first START used to hold the screen
// for the whole unlock (about 2.5 s on a phone whose voices load late); now it
// waits a beat at most, and the unlock carries on in the background (the
// recorded clips do not depend on it, and a spoken line waits for the engine
// itself). Never rejects.
export function waitUpTo(work, ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    Promise.resolve(work).then(
      () => { clearTimeout(timer); resolve(); },
      () => { clearTimeout(timer); resolve(); },
    );
  });
}

// Unlock window for a START tap, in ms.
export const START_PRIME_CAP_MS = 300;
