import { Ad } from '../entities/Ad';
import { IAdRepository } from '../interfaces/IAdRepository';
import { ILogger } from '../interfaces/ILogger';
import { INotifier } from '../interfaces/INotifier';

// AdService.ts
export class AdService {
  constructor(
    private readonly adRepository: IAdRepository,
    private readonly logger: ILogger,
    private readonly notifier: INotifier
  ) {}

  async process(ad: Ad): Promise<void> {
    if (!ad.valid) {
      this.logger.debug(`Ad not valid - ID: ${ad.id}, Price: ${ad.price}, URL: ${ad.url}`);
      return;
    }

    try {
      const saved = await this.adRepository.getAd(ad.id).catch(() => null);
      if (saved) {
        this.logger.debug(`Ad found in database, checking price change - ID: ${ad.id}`);
        await this.checkPriceChange(ad, saved);
      } else {
        this.logger.debug(`Ad not found in database, adding new ad - ID: ${ad.id}`);
        await this.addNewAd(ad);
      }
    } catch (error) {
      this.logger.error(error instanceof Error ? error : String(error));
    }
  }

  private async addNewAd(ad: Ad): Promise<void> {
    await this.adRepository.createAd(ad);
    this.logger.info(`Ad ${ad.id} added to the database`);
    if (ad.notify) {
      const msg = `New ad found!\n${ad.title} - R$${ad.price}\n\n${ad.url}`;
      await this.notifier.sendNotification(msg, ad.id);
    }
  }

  private async checkPriceChange(ad: Ad, saved: Ad): Promise<void> {
    // Reactivate silently if previously inactive (suppress noisy notifications)
    if (!saved.isActive) {
      this.logger.info(`Ad ${ad.id} was inactive, reactivating it (no notification)`);
      ad.isActive = true;
      await this.adRepository.updateAd(ad);
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
