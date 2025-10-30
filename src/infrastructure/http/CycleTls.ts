const initCycleTLS = require('cycletls');

let instance: any = null;

export async function getCycleTLSInstance() {
  if (!instance) {
    instance = await initCycleTLS();
  }
  return async (url: string, options: any, method: string) => {
    if (typeof instance[method] !== 'function') {
      throw new Error(`CycleTLS: method ${method} is not supported`);
    }
    const response = await instance[method](url, options);
    return response;
  };
}