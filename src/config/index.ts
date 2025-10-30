import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export interface AppConfig {
  urls: string[];
  interval: string;
  telegramChatID: string;
  telegramToken: string;
  dbFile: string;
  logger: {
    logFilePath: string;
    timestampFormat: string;
  };
  inactiveThreshold?: number;
}

// Read JSON config file
const configPath = path.resolve(__dirname, '../../config.json');
const jsonConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

export const config: AppConfig = {
  urls: jsonConfig.urls,
  interval: jsonConfig.interval,
  telegramChatID: process.env.TELEGRAM_CHAT_ID || '',
  telegramToken: process.env.TELEGRAM_TOKEN || '',
  dbFile: path.resolve(process.env.DB_FILE || './data/ads.db'),
  logger: {
    logFilePath: path.resolve(process.env.LOG_FILE || './data/scrapper.log'),
    timestampFormat: jsonConfig.logger.timestampFormat
  },
  inactiveThreshold: jsonConfig.inactiveThreshold
};

export function loadConfig(): AppConfig {
  const latestJson = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  return {
    urls: latestJson.urls,
    interval: latestJson.interval,
    telegramChatID: process.env.TELEGRAM_CHAT_ID || '',
    telegramToken: process.env.TELEGRAM_TOKEN || '',
    dbFile: path.resolve(process.env.DB_FILE || './data/ads.db'),
    logger: {
      logFilePath: path.resolve(process.env.LOG_FILE || './data/scrapper.log'),
      timestampFormat: latestJson.logger.timestampFormat
    },
    inactiveThreshold: latestJson.inactiveThreshold
  };
}