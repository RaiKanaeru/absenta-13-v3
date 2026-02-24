module.exports = {
    apps: [{
        name: 'absenta-backend',
        script: './server/index.js',
        instances: 1,
        exec_mode: 'cluster',
        env: {
            NODE_ENV: 'development',
            PORT: 3001
        },
        env_production: {
            NODE_ENV: 'production',
            PORT: 3001
        },
        error_file: './logs/pm2-error.log',
        out_file: './logs/pm2-out.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        merge_logs: true,
        max_memory_restart: '2G',
        node_args: '--max-old-space-size=2048',
        watch: false,
        ignore_watch: ['node_modules', 'logs', 'backups', 'temp', 'downloads', 'reports'],
        max_restarts: 10,
        min_uptime: '10s',
        autorestart: true,
        kill_timeout: 5000,
        wait_ready: true,
        listen_timeout: 10000,
    }]
};


