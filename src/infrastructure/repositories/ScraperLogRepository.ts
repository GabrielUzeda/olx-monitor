import { IScraperLogRepository, ScraperLog } from '../../core/interfaces/IScraperLogRepository';
import { ILogger } from '../../core/interfaces/ILogger';
import { db } from '../../database/database';

export class ScraperLogRepository implements IScraperLogRepository {
  constructor(private readonly logger: ILogger) {}

  async saveLog(log: ScraperLog): Promise<void> {
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
      db.run(query, values, (error: Error) => {
        if (error) return reject(error);
        resolve();
      });
    });
  }

  async getLogsByUrl(url: string, limit: number): Promise<ScraperLog[]> {
    this.logger.debug('ScraperLogRepository: getLogsByUrl');
    const query = `SELECT * FROM logs WHERE url = ? LIMIT ?`;
    const values = [url, limit];
    return new Promise((resolve, reject) => {
      db.all(query, values, (error: Error, rows: any[]) => {
        if (error) return reject(error);
        resolve(rows || []);
      });
    });
  }
} 