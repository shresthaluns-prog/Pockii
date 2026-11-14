module.exports = {
  apps: [
    {
      name: "pockii-api",
      cwd: "/var/www/pockii/server",
      script: "./src/server.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "350M",
      env_production: {
        NODE_ENV: "production",
        PORT: "5000",
      },
    },
  ],
};
