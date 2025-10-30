export interface ScraperLog {
  url: string;
  adsFound: number;
  averagePrice: number;
  minPrice: number;
  maxPrice: number;
}

export interface IScraperLogRepository {
  saveLog(log: ScraperLog): Promise<void>;
  getLogsByUrl(url: string, limit: number): Promise<ScraperLog[]>;
} 