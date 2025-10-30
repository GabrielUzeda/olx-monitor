"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScraperLogRepository = void 0;
const database_1 = require("../../database/database");
class ScraperLogRepository {
    constructor(logger) {
        this.logger = logger;
    }
    async saveLog(log) {
        this.logger.debug('ScraperLogRepository: saveLog');
        const query = `
      INSERT INTO logs(url, adsFound, averagePrice, minPrice, maxPrice, created)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
        const now = new Date().toISOString();
        const values = [
            log.url, log.adsFound, log.averagePrice, log.minPrice, log.maxPrice, now
        ];
        return new Promise((resolve, reject) => {
            database_1.db.run(query, values, (error) => {
                if (error)
                    return reject(error);
                resolve();
            });
        });
    }
    async getLogsByUrl(url, limit) {
        this.logger.debug('ScraperLogRepository: getLogsByUrl');
        const query = `SELECT * FROM logs WHERE url = ? LIMIT ?`;
        const values = [url, limit];
        return new Promise((resolve, reject) => {
            database_1.db.all(query, values, (error, rows) => {
                if (error)
                    return reject(error);
                resolve(rows || []);
            });
        });
    }
}
exports.ScraperLogRepository = ScraperLogRepository;
