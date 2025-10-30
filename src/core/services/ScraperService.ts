import { IHttpClient } from '../interfaces/IHttpClient';
import { ILogger } from '../interfaces/ILogger';
import { IAdRepository } from '../interfaces/IAdRepository';
import { IScraperLogRepository, ScraperLog } from '../interfaces/IScraperLogRepository';
import { INotifier } from '../interfaces/INotifier';
import { Ad } from '../entities/Ad';
import { AdService } from '../services/AdService';
import { UrlUtils } from '../utils/UrlUtils';
import { PriceUtils } from '../utils/PriceUtils';
import * as cheerio from 'cheerio';

export class ScraperService {
  constructor(
    private readonly httpClient: IHttpClient,
    private readonly logger: ILogger,
    private readonly adRepository: IAdRepository,
    private readonly scraperLogRepository: IScraperLogRepository,
    private readonly notifier: INotifier
  ) {}

  async scrape(url: string): Promise<void> {
    let page = 1;
    let maxPrice = 0;
    let minPrice = Number.MAX_SAFE_INTEGER;
    let sumPrices = 0;
    let validAds = 0;
    let nextPage = true;
    const foundAdIds: Set<string> = new Set();

    const parsedUrl = new URL(url);
    const searchTerm = parsedUrl.searchParams.get('q') || '';
    const notify = await this.urlAlreadySearched(url);

    this.logger.info(`Will notify: ${notify}`);

    do {
      const currentUrl = UrlUtils.setUrlParam(url, 'o', page);
      try {
        const response = await this.httpClient.get(currentUrl);
        nextPage = await this.scrapePage(response, searchTerm, notify, url, {
          updateStats: (ad: Ad) => {
            validAds++;
            foundAdIds.add(ad.id);
            minPrice = PriceUtils.checkMinPrice(ad.price, minPrice);
            maxPrice = PriceUtils.checkMaxPrice(ad.price, maxPrice);
            sumPrices += ad.price;
          }
        });
      } catch (error) {
        this.logger.error(error instanceof Error ? error : String(error));
        return;
      }
      page++;
    } while (nextPage);

    this.logger.info('Valid ads: ' + validAds);

    // Cleanup with debounce: handle missing ads and mark inactive after N misses
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

  private async scrapePage(
    html: string,
    searchTerm: string,
    notify: boolean,
    url: string,
    stats: { updateStats: (ad: Ad) => void }
  ): Promise<boolean> {
    try {
      const $ = cheerio.load(html);
      const script = $('script[id="__NEXT_DATA__"]').text();

      if (!script) return false;

      const adList = JSON.parse(script)?.props?.pageProps?.ads;
      if (!Array.isArray(adList) || !adList.length) return false;

      this.logger.info(`Checking new ads for: ${searchTerm}`);
      this.logger.info('Ads found: ' + adList.length);

    const adService = new AdService(this.adRepository, this.logger, this.notifier);

      for (const advert of adList) {
        const ad = new Ad({
          id: advert.listId,
          url: advert.url,
          title: advert.subject,
          searchTerm,
          price: PriceUtils.parsePriceString(advert.price),
          notify
        });

        ad.validate(); // This was missing!
        await adService.process(ad);

        if (ad.valid) {
          stats.updateStats(ad);
        }
      }

      return true;
    } catch (error) {
      this.logger.error(error instanceof Error ? error : String(error));
      throw new Error('Scraping failed');
    }
  }

  private async urlAlreadySearched(url: string): Promise<boolean> {
    try {
      const logs = await this.scraperLogRepository.getLogsByUrl(url, 1);
      if (logs.length) return true;
      this.logger.info('First run, no notifications');
      return false;
    } catch (error) {
      this.logger.error(error instanceof Error ? error : String(error));
      return false;
    }
  }

  private async cleanupInactiveAds(searchTerm: string, foundAdIds: Set<string>): Promise<void> {
    try {
      this.logger.info(`Checking for inactive ads for search term: ${searchTerm}`);
      const existingAds = await this.adRepository.getAdsBySearchTerm(searchTerm);
      
      // Load threshold dynamically from config.json each run
      const { loadConfig } = await import('../../config');
      const currentConfig = loadConfig();
      const INACTIVE_THRESHOLD = currentConfig.inactiveThreshold ?? 3;
      let inactiveCount = 0;
      for (const ad of existingAds) {
        if (!foundAdIds.has(ad.id)) {
          await this.adRepository.incrementMissingCount(ad.id);
          this.logger.info(`Ad ${ad.id} not found this run (increment missingCount)`);
          // Fetch latest missingCount to decide marking inactive
          const latest = await this.adRepository.getAd(ad.id).catch(() => null);
          if (latest && (latest as any).missingCount >= INACTIVE_THRESHOLD) {
            this.logger.info(`Marking ad ${ad.id} as inactive after ${INACTIVE_THRESHOLD} misses`);
            await this.adRepository.markAdAsInactive(ad.id);
            inactiveCount++;
          }
        } else {
          await this.adRepository.resetMissingCount(ad.id);
        }
      }
      
      if (inactiveCount > 0) {
        this.logger.info(`Marked ${inactiveCount} ads as inactive`);
      } else {
        this.logger.info('No ads to mark as inactive');
      }
    } catch (error) {
      this.logger.error('Error cleaning up inactive ads: ' + (error instanceof Error ? error.message : String(error)));
    }
  }
} 