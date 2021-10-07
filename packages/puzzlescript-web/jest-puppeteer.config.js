const PORT = process.env.PORT || 12490
module.exports = {
    launch: {
      executablePath: process.env.PUPPETEER_CHROME_PATH,
      args: [
        '--disable-dev-shm-usage',
      ],
      devtools: process.env.PUPPETEER_DEBUG === 'true'
    },
    server: {
      command: 'yarn run start:server',
      port: PORT,
    },
  }