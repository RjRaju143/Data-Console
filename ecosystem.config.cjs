module.exports = {
  apps: [
    {
      name: "data-console",
      script: "dist/server.js",
      cwd: __dirname,
      instances: 1,          // keep at 1: sessions and the Redis Commander child process are per-process
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      kill_timeout: 5000,    // gives the app time to stop Redis Commander on shutdown
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        REDIS_COMMANDER_PORT: 8081,
        REDIS_COMMANDER_HOST: "127.0.0.1",
      },
      out_file: "./logs/out.log",
      error_file: "./logs/error.log",
      merge_logs: true,
      time: true,
    },
  ],
};

