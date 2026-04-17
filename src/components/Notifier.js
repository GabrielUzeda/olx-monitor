'use strict';

const config = require('../config');
const $logger = require('./Logger');

/**
 * Envia uma notificação via Telegram utilizando o fetch nativo do Node.js
 * @param {string|number} chatId - O ID do chat no Telegram
 * @param {string} msg - A mensagem a ser enviada
 */
exports.sendNotification = async (chatId, msg) => {
    const startedAt = new Date().toISOString();
    $logger.info(
        `[Telegram] sendMessage iniciada para chat ${chatId} em ${startedAt} (${msg.length} caracteres)`
    );

    try {
        const apiUrl = `https://api.telegram.org/bot${config.telegramToken}/sendMessage`;
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: chatId,
                text: msg,
                parse_mode: 'HTML', // ESSENCIAL para o <b> funcionar
                disable_web_page_preview: true // Deixa a mensagem mais limpa
            }),
            signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Telegram API Error: ${response.status} - ${errorText}`);
        }

        $logger.info(
            `[Telegram] sendMessage concluída em ${new Date().toISOString()} (HTTP ${response.status})`
        );
        
        return response;
    } catch (error) {
        $logger.error(`[Telegram] Erro ao enviar notificação: ${error.message}`);
        return null;
    }
};
