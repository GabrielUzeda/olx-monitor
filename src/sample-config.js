
let config = {}

config.urls = [
    'url1',
    'url2'
]

// Interval in minutes between each scraping cycle
config.interval = 5; 
config.telegramChatID = process.env.TELEGRAM_CHAT_ID
config.telegramToken = process.env.TELEGRAM_TOKEN
config.dbFile = '../data/ads.db'

config.logger={
    logFilePath: '../data/scrapper.log',
    timestampFormat:'YYYY-MM-DD HH:mm:ss'
}

module.exports = config