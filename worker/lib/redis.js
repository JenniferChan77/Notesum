import Redis from 'ioredis';

const connection = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  
  connectTimeout: 10000,       // connection timeout in 10s
  family: 4,                   // IPv4
  db: 0                        // default database
});

connection.on('connect', () => {
  console.log('Redis connected');
});

connection.on('error', (err) => {
  console.error('Redis error:', err);
});

export default connection;