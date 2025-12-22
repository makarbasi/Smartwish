/**
 * PM2 Ecosystem Configuration for SmartWish Print Agent
 * 
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 save
 *   pm2 startup
 */

module.exports = {
  apps: [{
    name: 'SmartWishPrintAgent',
    script: 'backend/local-print-agent.js',
    cwd: __dirname,
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      CLOUD_SERVER_URL: 'https://smartwish.onrender.com',
      DEFAULT_PRINTER: 'HPA4CC43 (HP Smart Tank 7600 series)',
      POLL_INTERVAL: '5000'
    },
    error_file: './logs/print-agent-error.log',
    out_file: './logs/print-agent-output.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    time: true
  }]
};

