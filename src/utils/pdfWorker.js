import { runJobs } from '@/utils/pdfWorkerJobs';
import { onFaceFetched } from '@/utils/fontFallback';

// The PDF engine's own thread (R2-142, PERF-6): react-pdf lays out and writes the PDF here, so the
// editor never stops answering while a preview or an export is built. pdfBuild.js starts it.
const queue = runJobs((reply) => self.postMessage(reply, reply.bytes ? [reply.bytes.buffer] : []));
self.onmessage = (event) => { queue(event.data); };
// A borrowing face's own data arrived after its build: the main thread's preview builds again (R4-LO-17).
onFaceFetched(() => self.postMessage({ faceFetched: true }));
