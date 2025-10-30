"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScraperService = void 0;
const Ad_1 = require("../entities/Ad");
const AdService_1 = require("../services/AdService");
const UrlUtils_1 = require("../utils/UrlUtils");
const PriceUtils_1 = require("../utils/PriceUtils");
const cheerio = __importStar(require("cheerio"));
class ScraperService {
    constructor(httpClient, logger, adRepository, scraperLogRepository, notifier) {
        this.httpClient = httpClient;
        this.logger = logger;
        this.adRepository = adRepository;
        this.scraperLogRepository = scraperLogRepository;
        this.notifier = notifier;
    }
    async scrape(url) {
        let page = 1;
        let maxPrice = 0;
        let minPrice = Number.MAX_SAFE_INTEGER;
        let sumPrices = 0;
        let validAds = 0;
        let nextPage = true;
        const foundAdIds = new Set();
        const parsedUrl = new URL(url);
        const searchTerm = parsedUrl.searchParams.get('q') || '';
        const notify = await this.urlAlreadySearched(url);
        this.logger.info(`Will notify: ${notify}`);
        do {
            const currentUrl = UrlUtils_1.UrlUtils.setUrlParam(url, 'o', page);
            try {
                const response = await this.httpClient.get(currentUrl);
                nextPage = await this.scrapePage(response, searchTerm, notify, url, {
                    updateStats: (ad) => {
                        validAds++;
                        foundAdIds.add(ad.id);
                        minPrice = PriceUtils_1.PriceUtils.checkMinPrice(ad.price, minPrice);
                        maxPrice = PriceUtils_1.PriceUtils.checkMaxPrice(ad.price, maxPrice);
                        sumPrices += ad.price;
                    }
                });
            }
            catch (error) {
                this.logger.error(error instanceof Error ? error : String(error));
                return;
            }
            page++;
        } while (nextPage);
        this.logger.info('Valid ads: ' + validAds);
        // Cleanup: Mark ads not found in this scrape as inactive
        await this.cleanupInactiveAds(searchTerm, foundAdIds);
        if (validAds) {
            const averagePrice = sumPrices / validAds;
            this.logger.info('Maximum price: ' + maxPrice);
            this.logger.info('Minimum price: ' + minPrice);
            this.logger.info('Average price: ' + averagePrice);
            await this.scraperLogRepository.saveLog({
                url,
                adsFound: validAds,
                averagePrice,
                minPrice,
                maxPrice,
            });
        }
    }
    async scrapePage(html, searchTerm, notify, url, stats) {
        var _a, _b, _c;
        try {
            const $ = cheerio.load(html);
            const script = $('script[id="__NEXT_DATA__"]').text();
            if (!script)
                return false;
            const adList = (_c = (_b = (_a = JSON.parse(script)) === null || _a === void 0 ? void 0 : _a.props) === null || _b === void 0 ? void 0 : _b.pageProps) === null || _c === void 0 ? void 0 : _c.ads;
            if (!Array.isArray(adList) || !adList.length)
                return false;
            this.logger.info(`Checking new ads for: ${searchTerm}`);
            this.logger.info('Ads found: ' + adList.length);
            const adService = new AdService_1.AdService(this.adRepository, this.logger, this.notifier);
            for (const advert of adList) {
                const ad = new Ad_1.Ad({
                    id: advert.listId,
                    url: advert.url,
                    title: advert.subject,
                    searchTerm,
                    price: PriceUtils_1.PriceUtils.parsePriceString(advert.price),
                    notify
                });
                ad.validate(); // This was missing!
                await adService.process(ad);
                if (ad.valid) {
                    stats.updateStats(ad);
                }
            }
            return true;
        }
        catch (error) {
            this.logger.error(error instanceof Error ? error : String(error));
            throw new Error('Scraping failed');
        }
    }
    async urlAlreadySearched(url) {
        try {
            const logs = await this.scraperLogRepository.getLogsByUrl(url, 1);
            if (logs.length)
                return true;
            this.logger.info('First run, no notifications');
            return false;
        }
        catch (error) {
            this.logger.error(error instanceof Error ? error : String(error));
            return false;
        }
    }
    async cleanupInactiveAds(searchTerm, foundAdIds) {
        try {
            this.logger.info(`Checking for inactive ads for search term: ${searchTerm}`);
            const existingAds = await this.adRepository.getAdsBySearchTerm(searchTerm);
            let inactiveCount = 0;
            for (const ad of existingAds) {
                if (!foundAdIds.has(ad.id)) {
                    this.logger.info(`Marking ad ${ad.id} as inactive - no longer found in results`);
                    await this.adRepository.markAdAsInactive(ad.id);
                    inactiveCount++;
                }
            }
            if (inactiveCount > 0) {
                this.logger.info(`Marked ${inactiveCount} ads as inactive`);
            }
            else {
                this.logger.info('No ads to mark as inactive');
            }
        }
        catch (error) {
            this.logger.error('Error cleaning up inactive ads: ' + (error instanceof Error ? error.message : String(error)));
        }
    }
}
exports.ScraperService = ScraperService;
