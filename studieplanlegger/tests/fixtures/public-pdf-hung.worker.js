import { workerData } from 'node:worker_threads'

// A deliberately unresponsive CPU-bound reader: termination must stop execution,
// not only stop awaiting the result on the calling thread.
const heartbeat = new Int32Array(workerData.heartbeat)
while (true) Atomics.add(heartbeat, 0, 1)
