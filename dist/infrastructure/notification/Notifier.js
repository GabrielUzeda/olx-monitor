"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Notifier = void 0;
const config_1 = require("../../config");
const axios_1 = __importDefault(require("axios"));
class Notifier {
    async sendNotification(msg, id) {
        const apiUrl = `https://api.telegram.org/bot${config_1.config.telegramToken}/sendMessage?chat_id=${config_1.config.telegramChatID}&text=`;
        const encodedMsg = encodeURIComponent(msg);
        await axios_1.default.get(apiUrl + encodedMsg, { timeout: 5000 });
    }
}
exports.Notifier = Notifier;
