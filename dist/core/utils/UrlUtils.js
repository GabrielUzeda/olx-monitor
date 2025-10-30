"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UrlUtils = void 0;
class UrlUtils {
    static setUrlParam(url, param, value) {
        const newUrl = new URL(url);
        newUrl.searchParams.set(param, value.toString());
        return newUrl.toString();
    }
}
exports.UrlUtils = UrlUtils;
