// How many times functions of a library ran while something ran: V8's precise coverage, which counts every call
// of every function it has seen, asked through node:inspector. A test that pins a cost by COUNTING the work (never
// by timing it) reads these: `count(fn, { file, names })` runs `fn` and returns { [name]: calls } for the named
// functions declared in the script whose path ends with `file`. A function that is not found has no entry, so a
// test asserts that the number it reads exists (a renamed function must fail loudly, not pass on a zero).
import inspector from 'node:inspector';

let session = null;
const post = (method, params) => new Promise((resolve, reject) => {
  session.post(method, params, (error, result) => (error ? reject(error) : resolve(result)));
});

/** Run `fn`; the calls made of each function in `names` declared in the script ending in `file`, summed by name. */
export async function count(fn, { file, names }) {
  if (!session) {
    session = new inspector.Session();
    session.connect();
  }
  await post('Profiler.enable');
  await post('Profiler.startPreciseCoverage', { callCount: true, detailed: false });
  let result;
  try {
    await fn();
  } finally {
    ({ result } = await post('Profiler.takePreciseCoverage'));
    await post('Profiler.stopPreciseCoverage');
  }
  const calls = {};
  for (const script of result) {
    if (!script.url.endsWith(file)) continue;
    for (const f of script.functions) {
      if (names.includes(f.functionName) && f.ranges[0].count) calls[f.functionName] = (calls[f.functionName] || 0) + f.ranges[0].count;
    }
  }
  return calls;
}

/** Close the inspector session (a test file's `after`), so it holds the process open for nothing. */
export function stopCounting() {
  session?.disconnect();
  session = null;
}
