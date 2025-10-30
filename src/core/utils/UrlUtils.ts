export class UrlUtils {
  static setUrlParam(url: string, param: string, value: string | number): string {
    const newUrl = new URL(url);
    newUrl.searchParams.set(param, value.toString());
    return newUrl.toString();
  }
} 