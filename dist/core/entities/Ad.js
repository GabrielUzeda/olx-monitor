"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Ad = void 0;
class Ad {
    constructor(props) {
        this.valid = false;
        this.saved = null;
        this.isActive = true;
        this.id = props.id;
        this.url = props.url;
        this.title = props.title;
        this.searchTerm = props.searchTerm;
        this.price = props.price;
        this.notify = props.notify;
        this.isActive = props.isActive !== undefined ? props.isActive : true;
    }
    async alreadySaved(adRepository) {
        try {
            this.saved = await adRepository.getAd(this.id);
            return true;
        }
        catch (error) {
            return false;
        }
    }
    async addToDatabase(adRepository, logger, notifier) {
        try {
            await adRepository.createAd(this);
            logger.info('Ad ' + this.id + ' added to the database');
        }
        catch (error) {
            logger.error(error instanceof Error ? error : String(error));
        }
        if (this.notify) {
            try {
                const msg = `New ad found!\n${this.title} - R$${this.price}\n\n${this.url}`;
                await notifier.sendNotification(msg, this.id);
            }
            catch (error) {
                logger.error(error instanceof Error ? error : String(error));
            }
        }
    }
    async updatePrice(adRepository, logger) {
        logger.info('updatePrice');
        try {
            await adRepository.updateAd(this);
        }
        catch (error) {
            logger.error(error instanceof Error ? error : String(error));
        }
    }
    async checkPriceChange(adRepository, logger, notifier) {
        if (this.price !== this.saved.price) {
            await this.updatePrice(adRepository, logger);
            if (this.price < this.saved.price) {
                logger.info('This ad had a price reduction: ' + this.url);
                const decreasePercentage = Math.abs(Math.round(((this.price - this.saved.price) / this.saved.price) * 100));
                const msg = `Price drop found! ${decreasePercentage}% OFF!\nFrom R$${this.saved.price} to R$${this.price}\n\n${this.url}`;
                try {
                    await notifier.sendNotification(msg, this.id);
                }
                catch (error) {
                    logger.error(error instanceof Error ? error : String(error));
                }
            }
        }
    }
    validate() {
        this.valid = !isNaN(this.price) && !!this.url && !!this.id;
    }
}
exports.Ad = Ad;
