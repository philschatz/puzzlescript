const PORT = process.env.PORT || 12490
module.exports = {
    launch: {
      // dumpio: true,
      // product: 'chrome',
      // executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      headless: process.env.HEADLESS !== 'false',
      args: [
        '--disable-dev-shm-usage',
      ],
      devtools: process.env.PUPPETEER_DEBUG === 'true'
    },
    // browserContext: 'default',
    server: {
      command: 'yarn run start:server',
      port: PORT,
    },
  }