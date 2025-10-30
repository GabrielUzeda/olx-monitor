import { IAdRepository } from '../../core/interfaces/IAdRepository';
import { Ad } from '../../core/entities/Ad';
import { ILogger } from '../../core/interfaces/ILogger';
import { db } from '../../database/database';

export class AdRepository implements IAdRepository {
  constructor(private readonly logger: ILogger) {}

  async getAd(id: string): Promise<Ad> {
    this.logger.debug('AdRepository: getAd');
    const query = `SELECT * FROM ads WHERE id = ?`;
    const values = [id];
    return new Promise((resolve, reject) => {
      db.get(query, values, (error: Error, row: any) => {
        if (error) return reject(error);
        if (!row) return reject(new Error('No ad with this ID was found'));
        resolve(new Ad({
          ...row,
          isActive: row.isActive === 1
        }));
      });
    });
  }

  async createAd(ad: Ad): Promise<void> {
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
      db.run(query, values, (error: Error) => {
        if (error) return reject(error);
        resolve();
      });
    });
  }

  async updateAd(ad: Ad): Promise<void> {
    this.logger.debug('AdRepository: updateAd');
    const query = `UPDATE ads SET price = ?, lastUpdate = ?, isActive = ?, missingCount = 0 WHERE id = ?`;
    const values = [ad.price, new Date().toISOString(), ad.isActive ? 1 : 0, ad.id];
    return new Promise((resolve, reject) => {
      db.run(query, values, (error: Error) => {
        if (error) return reject(error);
        resolve();
      });
    });
  }

  async incrementMissingCount(id: string): Promise<void> {
    this.logger.debug('AdRepository: incrementMissingCount');
    const query = `UPDATE ads SET missingCount = missingCount + 1 WHERE id = ?`;
    const values = [id];
    return new Promise((resolve, reject) => {
      db.run(query, values, (error: Error) => {
        if (error) return reject(error);
        resolve();
      });
    });
  }

  async resetMissingCount(id: string): Promise<void> {
    this.logger.debug('AdRepository: resetMissingCount');
    const query = `UPDATE ads SET missingCount = 0 WHERE id = ?`;
    const values = [id];
    return new Promise((resolve, reject) => {
      db.run(query, values, (error: Error) => {
        if (error) return reject(error);
        resolve();
      });
    });
  }

  async getAdsBySearchTerm(searchTerm: string): Promise<Ad[]> {
    this.logger.debug('AdRepository: getAdsBySearchTerm');
    const query = `SELECT * FROM ads WHERE searchTerm = ? AND isActive = 1`;
    const values = [searchTerm];
    return new Promise((resolve, reject) => {
      db.all(query, values, (error: Error, rows: any[]) => {
        if (error) return reject(error);
        const ads = rows.map((row: any) => new Ad({
          ...row,
          isActive: row.isActive === 1
        }));
        resolve(ads);
      });
    });
  }

  async markAdAsInactive(id: string): Promise<void> {
    this.logger.debug('AdRepository: markAdAsInactive');
    const query = `UPDATE ads SET isActive = 0, lastUpdate = ? WHERE id = ?`;
    const values = [new Date().toISOString(), id];
    return new Promise((resolve, reject) => {
      db.run(query, values, (error: Error) => {
        if (error) return reject(error);
        resolve();
      });
    });
  }
} 