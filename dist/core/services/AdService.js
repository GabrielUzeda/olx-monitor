"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdService = void 0;
// AdService.ts
class AdService {
    constructor(adRepository, logger, notifier) {
        this.adRepository = adRepository;
        this.logger = logger;
        this.notifier = notifier;
    }
    async process(ad) {
        if (!ad.valid) {
            this.logger.info(`Ad not valid - ID: ${ad.id}, Price: ${ad.price}, URL: ${ad.url}`);
            return;
        }
        try {
            const saved = await this.adRepository.getAd(ad.id).catch(() => null);
            if (saved) {
                this.logger.info(`Ad found in database, checking price change - ID: ${ad.id}`);
                await this.checkPriceChange(ad, saved);
            }
            else {
                this.logger.info(`Ad not found in database, adding new ad - ID: ${ad.id}`);
                await this.addNewAd(ad);
            }
        }
        catch (error) {
            this.logger.error(error instanceof Error ? error : String(error));
        }
    }
    async addNewAd(ad) {
        await this.adRepository.createAd(ad);
        this.logger.info(`Ad ${ad.id} added to the database`);
        if (ad.notify) {
            const msg = `New ad found!\n${ad.title} - R$${ad.price}\n\n${ad.url}`;
            await this.notifier.sendNotification(msg, ad.id);
        }
    }
    async checkPriceChange(ad, saved) {
        // Reactivate ad if it was previously inactive
        if (!saved.isActive) {
            this.logger.info(`Ad ${ad.id} was inactive, reactivating it`);
            ad.isActive = true;
            await this.adRepository.updateAd(ad);
            if (ad.notify) {
                const msg = `Ad is back online!\n${ad.title} - R$${ad.price}\n\n${ad.url}`;
                await this.notifier.sendNotification(msg, ad.id);
            }
        }
        if (ad.price !== saved.price) {
            await this.adRepository.updateAd(ad);
            this.logger.info('Price changed for ad: ' + ad.id);
            if (ad.price < saved.price) {
                const percentage = Math.abs(Math.round(((ad.price - saved.price) / saved.price) * 100));
                const msg = `Price drop found! ${percentage}% OFF!\nFrom R$${saved.price} to R$${ad.price}\n\n${ad.url}`;
                await this.notifier.sendNotification(msg, ad.id);
            }
        }
    }
}
exports.AdService = AdService;
