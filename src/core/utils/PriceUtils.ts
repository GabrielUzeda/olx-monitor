export class PriceUtils {
  static checkMinPrice(price: number, minPrice: number): number {
    return price < minPrice ? price : minPrice;
  }

  static checkMaxPrice(price: number, maxPrice: number): number {
    return price > maxPrice ? price : maxPrice;
  }

   static parsePriceString(value?: string): number {
    return parseInt(value?.replace(/[^\d]/g, '') || '0', 10);
  }
} 