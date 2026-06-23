/**
 * PM2 — use após `npm run build` na VPS.
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 */
module.exports = {
  apps: [
    {
      name: 'erp-api',
      cwd: __dirname,
      script: 'npm',
      args: 'run start:api',
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'erp-web',
      cwd: __dirname,
      script: 'npm',
      args: 'run start:web',
      env: { NODE_ENV: 'production' },
    },
  ],
}
