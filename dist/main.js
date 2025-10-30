"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Logger_1 = require("./infrastructure/logger/Logger");
const HttpClient_1 = require("./infrastructure/http/HttpClient");
const AdRepository_1 = require("./infrastructure/repositories/AdRepository");
const ScraperLogRepository_1 = require("./infrastructure/repositories/ScraperLogRepository");
const Notifier_1 = require("./infrastructure/notification/Notifier");
const ScraperService_1 = require("./core/services/ScraperService");
const config_1 = require("./config");
const node_cron_1 = __importDefault(require("node-cron"));
// Instantiate dependencies
const logger = new Logger_1.Logger();
const httpClient = new HttpClient_1.HttpClient();
const adRepository = new AdRepository_1.AdRepository(logger);
const scraperLogRepository = new ScraperLogRepository_1.ScraperLogRepository(logger);
const notifier = new Notifier_1.Notifier();
const scraperService = new ScraperService_1.ScraperService(httpClient, logger, adRepository, scraperLogRepository, notifier);
// Schedule the job using the interval from config
node_cron_1.default.schedule(config_1.config.interval, () => {
    logger.info('Starting scheduled scraping job...');
    for (const url of config_1.config.urls) {
        scraperService.scrape(url)
            .then(() => logger.info(`Scraping completed for ${url}`))
            .catch(err => logger.error(err instanceof Error ? err : String(err)));
    }
});
