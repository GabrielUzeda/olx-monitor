"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdRepository = void 0;
const Ad_1 = require("../../core/entities/Ad");
const database_1 = require("../../database/database");
class AdRepository {
    constructor(logger) {
        this.logger = logger;
    }
    async getAd(id) {
        this.logger.debug('AdRepository: getAd');
        const query = `SELECT * FROM ads WHERE id = ?`;
        const values = [id];
        return new Promise((resolve, reject) => {
            database_1.db.get(query, values, (error, row) => {
                if (error)
                    return reject(error);
                if (!row)
                    return reject(new Error('No ad with this ID was found'));
                resolve(new Ad_1.Ad(row));
            });
        });
    }
    async createAd(ad) {
        this.logger.debug('AdRepository: createAd');
        const query = `
      INSERT INTO ads(id, url, title, searchTerm, price, created, lastUpdate, isActive)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
        const now = new Date().toISOString();
        const values = [
            ad.id, ad.url, ad.title, ad.searchTerm, ad.price, now, now, ad.isActive ? 1 : 0
        ];
        return new Promise((resolve, reject) => {
            database_1.db.run(query, values, (error) => {
                if (error)
                    return reject(error);
                resolve();
            });
        });
    }
    async updateAd(ad) {
        this.logger.debug('AdRepository: updateAd');
        const query = `UPDATE ads SET price = ?, lastUpdate = ? WHERE id = ?`;
        const values = [ad.price, new Date().toISOString(), ad.id];
        return new Promise((resolve, reject) => {
            database_1.db.run(query, values, (error) => {
                if (error)
                    return reject(error);
                resolve();
            });
        });
    }
    async getAdsBySearchTerm(searchTerm) {
        this.logger.debug('AdRepository: getAdsBySearchTerm');
        const query = `SELECT * FROM ads WHERE searchTerm = ? AND isActive = 1`;
        const values = [searchTerm];
        return new Promise((resolve, reject) => {
            database_1.db.all(query, values, (error, rows) => {
                if (error)
                    return reject(error);
                const ads = rows.map((row) => new Ad_1.Ad({
                    ...row,
                    isActive: row.isActive === 1
                }));
                resolve(ads);
            });
        });
    }
    async markAdAsInactive(id) {
        this.logger.debug('AdRepository: markAdAsInactive');
        const query = `UPDATE ads SET isActive = 0, lastUpdate = ? WHERE id = ?`;
        const values = [new Date().toISOString(), id];
        return new Promise((resolve, reject) => {
            database_1.db.run(query, values, (error) => {
                if (error)
                    return reject(error);
                resolve();
            });
        });
    }
}
exports.AdRepository = AdRepository;
