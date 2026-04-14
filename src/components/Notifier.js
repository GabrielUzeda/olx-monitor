'use strict';

const config = require('../config');
const axios = require('axios');
const $logger = require('./Logger');

exports.sendNotification = async (msg) => {
    const startedAt = new Date().toISOString();
    $logger.info(
        `[Telegram] sendMessage iniciada em ${startedAt} (${msg.length} caracteres)`
    );
    const apiUrl = `https://api.telegram.org/bot${config.telegramToken}/sendMessage?chat_id=${config.telegramChatID}&text=`;
    const encodedMsg = encodeURIComponent(msg);
    const res = await axios.get(apiUrl + encodedMsg, { timeout: 5000 });
    $logger.info(
        `[Telegram] sendMessage concluída em ${new Date().toISOString()} (HTTP ${res.status})`
    );
    return res;
};
