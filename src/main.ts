import { Logger } from './infrastructure/logger/Logger';
import { HttpClient } from './infrastructure/http/HttpClient';
import { AdRepository } from './infrastructure/repositories/AdRepository';
import { ScraperLogRepository } from './infrastructure/repositories/ScraperLogRepository';
import { Notifier } from './infrastructure/notification/Notifier';
import { ScraperService } from './core/services/ScraperService';
import { config, loadConfig } from './config';
import cron from 'node-cron';

// Instantiate dependencies
const logger = new Logger();
const httpClient = new HttpClient();
const adRepository = new AdRepository(logger);
const scraperLogRepository = new ScraperLogRepository(logger);
const notifier = new Notifier();
const scraperService = new ScraperService(
  httpClient,
  logger,
  adRepository,
  scraperLogRepository,
  notifier
);

// Schedule the job using the interval from config
cron.schedule(config.interval, () => {
  const currentConfig = loadConfig();
  logger.info('Starting scheduled scraping job...');
  for (const url of currentConfig.urls) {
    scraperService.scrape(url)
      .then(() => logger.info(`Scraping completed for ${url}`))
      .catch(err => logger.error(err instanceof Error ? err : String(err)));
  }
});