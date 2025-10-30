"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PriceUtils = void 0;
class PriceUtils {
    static checkMinPrice(price, minPrice) {
        return price < minPrice ? price : minPrice;
    }
    static checkMaxPrice(price, maxPrice) {
        return price > maxPrice ? price : maxPrice;
    }
    static parsePriceString(value) {
        return parseInt((value === null || value === void 0 ? void 0 : value.replace(/[^\d]/g, '')) || '0', 10);
    }
}
exports.PriceUtils = PriceUtils;
