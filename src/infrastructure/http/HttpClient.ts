import { IHttpClient } from '../../core/interfaces/IHttpClient';
import { getCycleTLSInstance } from './CycleTls';
import { requestsFingerprints } from './requestsFingerprints';

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

export class HttpClient implements IHttpClient {
  async get(url: string): Promise<string> {
    const startTime = Date.now();
    const cycleTLS = await getCycleTLSInstance();
    const randomRequestFingerprint =
      requestsFingerprints[
        Math.floor(Math.random() * requestsFingerprints.length)
      ];
    
    try {
      const response = await cycleTLS(
        url,
        {
          userAgent: randomRequestFingerprint[0],
          ja3: randomRequestFingerprint[1],
          headers,
        },
        "get"
      );
      
      const endTime = Date.now();
      console.log(`HTTP request to ${url} took: ${endTime - startTime}ms`);
      return response.body;
    } catch (error) {
      const endTime = Date.now();
      console.log(`HTTP request to ${url} failed after: ${endTime - startTime}ms`);
      throw error;
    }
  }
} 