import { Ad } from '../entities/Ad';

export interface IAdRepository {
  getAd(id: string): Promise<Ad>;
  createAd(ad: Ad): Promise<void>;
  updateAd(ad: Ad): Promise<void>;
  getAdsBySearchTerm(searchTerm: string): Promise<Ad[]>;
  markAdAsInactive(id: string): Promise<void>;
  incrementMissingCount(id: string): Promise<void>;
  resetMissingCount(id: string): Promise<void>;
}
