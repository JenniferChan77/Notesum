import { Queue } from "bullmq";
import connection from "../redis.js";

export const transcribeQueue = new Queue('transcribe', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 30_000
    },
    removeOnComplete: true,
    removeOnFail: false
  }
})