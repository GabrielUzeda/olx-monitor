import { IAdRepository } from '../interfaces/IAdRepository';
import { ILogger } from '../interfaces/ILogger';
import { INotifier } from '../interfaces/INotifier';

export interface AdProps {
  id: string;
  url: string;
  title: string;
  searchTerm: string;
  price: number;
  notify: boolean;
  isActive?: boolean;
}

export class Ad {
  id: string;
  url: string;
  title: string;
  searchTerm: string;
  price: number;
  notify: boolean;
  valid: boolean = false;
  saved: any = null;
  isActive: boolean = true;

  constructor(props: AdProps) {
    this.id = props.id;
    this.url = props.url;
    this.title = props.title;
    this.searchTerm = props.searchTerm;
    this.price = props.price;
    this.notify = props.notify;
    this.isActive = props.isActive !== undefined ? props.isActive : true;
  }

  private async alreadySaved(adRepository: IAdRepository): Promise<boolean> {
    try {
      this.saved = await adRepository.getAd(this.id);
      return true;
    } catch (error) {
      return false;
    }
  }

  private async addToDatabase(
    adRepository: IAdRepository,
    logger: ILogger,
    notifier: INotifier
  ): Promise<void> {
    try {
      await adRepository.createAd(this);
      logger.info('Ad ' + this.id + ' added to the database');
    } catch (error) {
      logger.error(error instanceof Error ? error : String(error));
    }
    if (this.notify) {
      try {
        const msg = `New ad found!\n${this.title} - R$${this.price}\n\n${this.url}`;
        await notifier.sendNotification(msg, this.id);
      } catch (error) {
        logger.error(error instanceof Error ? error : String(error));
      }
    }
  }

  private async updatePrice(adRepository: IAdRepository, logger: ILogger): Promise<void> {
    logger.info('updatePrice');
    try {
      await adRepository.updateAd(this);
    } catch (error) {
      logger.error(error instanceof Error ? error : String(error));
    }
  }

  private async checkPriceChange(
    adRepository: IAdRepository,
    logger: ILogger,
    notifier: INotifier
  ): Promise<void> {
    if (this.price !== this.saved.price) {
      await this.updatePrice(adRepository, logger);
      if (this.price < this.saved.price) {
        logger.info('This ad had a price reduction: ' + this.url);
        const decreasePercentage = Math.abs(
          Math.round(((this.price - this.saved.price) / this.saved.price) * 100)
        );
        const msg = `Price drop found! ${decreasePercentage}% OFF!\nFrom R$${this.saved.price} to R$${this.price}\n\n${this.url}`;
        try {
          await notifier.sendNotification(msg, this.id);
        } catch (error) {
          logger.error(error instanceof Error ? error : String(error));
        }
      }
    }
  }

  validate(): void {
   this.valid = !isNaN(this.price) && !!this.url && !!this.id;
  }
} 