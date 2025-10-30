"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCycleTLSInstance = getCycleTLSInstance;
const initCycleTLS = require('cycletls');
let instance = null;
async function getCycleTLSInstance() {
    if (!instance) {
        instance = await initCycleTLS();
    }
    return async (url, options, method) => {
        if (typeof instance[method] !== 'function') {
            throw new Error(`CycleTLS: method ${method} is not supported`);
        }
        const response = await instance[method](url, options);
        return response;
    };
}
