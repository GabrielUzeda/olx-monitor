"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpClient = void 0;
const CycleTls_1 = require("./CycleTls");
const requestsFingerprints_1 = require("./requestsFingerprints");
const headers = {
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate, br",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    Pragma: "no-cache",
    "Cache-Control": "no-cache",
};
class HttpClient {
    async get(url) {
        const startTime = Date.now();
        const cycleTLS = await (0, CycleTls_1.getCycleTLSInstance)();
        const randomRequestFingerprint = requestsFingerprints_1.requestsFingerprints[Math.floor(Math.random() * requestsFingerprints_1.requestsFingerprints.length)];
        try {
            const response = await cycleTLS(url, {
                userAgent: randomRequestFingerprint[0],
                ja3: randomRequestFingerprint[1],
                headers,
            }, "get");
            const endTime = Date.now();
            console.log(`HTTP request to ${url} took: ${endTime - startTime}ms`);
            return response.body;
        }
        catch (error) {
            const endTime = Date.now();
            console.log(`HTTP request to ${url} failed after: ${endTime - startTime}ms`);
            throw error;
        }
    }
}
exports.HttpClient = HttpClient;
