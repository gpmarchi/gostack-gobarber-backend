import Bee from 'bee-queue';

import redisConfig from '../config/redis';
import CancellationMail from '../app/jobs/CancellationMail';

const jobs = [CancellationMail];

class Queue {
  constructor() {
    this.queues = {};

    this.init();
  }

  init() {
    jobs.forEach(({ key, handle }) => {
      this.queues[key] = {
        beeQueue: new Bee(key, {
          redis: redisConfig,
        }),
        handle,
      };
    });
  }

  add(queueKey, jobData) {
    return this.queues[queueKey].beeQueue.createJob(jobData).save();
  }

  processQueues() {
    jobs.forEach(job => {
      const { beeQueue, handle } = this.queues[job.key];

      beeQueue.process(handle);
    });
  }
}

export default new Queue();
