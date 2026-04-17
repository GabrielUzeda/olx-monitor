'use strict';

const config = require('../config');
const $logger = require('./Logger');
const subscriptionRepository = require('../repositories/subscriptionRepository');
const notifier = require('./Notifier');

class TelegramBot {
    constructor() {
        this.token = config.telegramToken;
        this.apiUrl = `https://api.telegram.org/bot${this.token}`;
        this.offset = 0;
        this.isRunning = false;
    }

    /**
     * Inicia o Long-Polling para ouvir mensagens do Telegram
     */
    async start() {
        if (!this.token) {
            $logger.warn('Telegram token is missing. Bot cannot start.');
            return;
        }
        
        $logger.info('Telegram Bot Listener started. Ready for commands.');
        this.isRunning = true;
        this.poll();
    }

    /**
     * Para o polling
     */
    stop() {
        this.isRunning = false;
        $logger.info('Telegram Bot Listener stopped.');
    }

    async poll() {
        if (!this.isRunning) return;

        try {
            // timeout=30 enables Long-Polling: the connection stays open up to 30s waiting for messages
            const response = await fetch(`${this.apiUrl}/getUpdates?offset=${this.offset}&timeout=30`);
            
            if (response.ok) {
                const data = await response.json();
                
                if (data.ok && data.result.length > 0) {
                    for (const update of data.result) {
                        this.offset = update.update_id + 1; // Update offset to acknowledge message
                        if (update.message && update.message.text) {
                            await this.handleMessage(update.message);
                        }
                    }
                }
            } else {
                $logger.error(`Telegram API Error (Polling): ${response.status}`);
                await this._sleep(5000); // Backoff em caso de erro da API
            }
        } catch (e) {
            if (e.name !== 'AbortError' && e.code !== 'ECONNRESET') {
                $logger.error(`Polling error: ${e.message}`);
                await this._sleep(5000); // Backoff em erro de rede
            }
        }

        // Loop infinito seguro (chamada assíncrona logo após o término da atual)
        if (this.isRunning) {
            setTimeout(() => this.poll(), 0);
        }
    }

    async handleMessage(message) {
        const chatId = message.chat.id;
        const text = message.text.trim();

        $logger.debug(`Message from ${chatId}: ${text}`);

        if (text.startsWith('/start')) {
            await this.handleStart(chatId);
        } else if (text.startsWith('/add ')) {
            await this.handleAdd(chatId, text);
        } else if (text.startsWith('/remove ') || text === '/remove') {
            await this.handleRemove(chatId, text);
        } else if (text.startsWith('/list') || text === '/list') {
            await this.handleList(chatId);
        }
    }

    async handleStart(chatId) {
        const msg = `👋 <b>Olá! Eu sou o OLX Monitor.</b>\n\n` +
                    `Você pode me usar para rastrear anúncios e preços. Cada grupo ou chat tem sua própria lista de rastreio!\n\n` +
                    `<b>Comandos:</b>\n` +
                    `➕ <code>/add [LINK_DO_OLX]</code> - Começa a rastrear uma busca\n` +
                    `➖ <code>/remove [LINK_DO_OLX]</code> - Para de rastrear uma busca\n` +
                    `📋 <code>/list</code> - Mostra tudo que este chat está rastreando\n\n` +
                    `<i>Faça a busca no site da OLX, copie o link completo e mande o comando /add!</i>`;
        await notifier.sendNotification(chatId, msg);
    }

    async handleAdd(chatId, text) {
        const urlMatch = text.match(/\/add\s+(https?:\/\/[^\s]+)/);
        if (!urlMatch) {
            await notifier.sendNotification(chatId, '❌ Por favor, envie uma URL válida. Exemplo:\n<code>/add https://ba.olx.com.br/autos-e-pecas/carros-vans-e-utilitarios</code>');
            return;
        }

        const url = urlMatch[1];
        
        try {
            const parsedUrl = new URL(url);
            const searchName = parsedUrl.searchParams.get('q') || parsedUrl.pathname.split('/').pop() || 'Busca Geral';

            const success = await subscriptionRepository.addSubscription(chatId, url, searchName);
            
            if (success) {
                await notifier.sendNotification(chatId, `✅ <b>Busca adicionada com sucesso!</b>\n\nNome: ${searchName}\n\nAssim que novos anúncios surgirem ou preços caírem, este chat será notificado.`);
                $logger.info(`Chat ${chatId} subscribed to ${searchName}`);
            } else {
                await notifier.sendNotification(chatId, `⚠️ Este chat já está rastreando essa exata URL.`);
            }
        } catch (e) {
            await notifier.sendNotification(chatId, `❌ URL inválida ou problema ao salvar.`);
        }
    }

    async handleRemove(chatId, text) {
        const urlMatch = text.match(/\/remove\s+(https?:\/\/[^\s]+)/);
        if (!urlMatch) {
            await notifier.sendNotification(chatId, '❌ Envie o comando com a URL que deseja remover. Exemplo:\n<code>/remove https://...</code>\n\nDica: Use /list para ver as URLs.');
            return;
        }

        const url = urlMatch[1];
        const success = await subscriptionRepository.removeSubscription(chatId, url);

        if (success) {
            await notifier.sendNotification(chatId, `🗑️ Busca removida! Este chat não receberá mais notificações para esta URL.`);
            $logger.info(`Chat ${chatId} unsubscribed from a URL.`);
        } else {
            await notifier.sendNotification(chatId, `⚠️ Esta URL não estava na sua lista de rastreio.`);
        }
    }

    async handleList(chatId) {
        const subs = await subscriptionRepository.getSubscriptionsByChat(chatId);

        if (subs.length === 0) {
            await notifier.sendNotification(chatId, `📭 Este chat não está rastreando nenhuma busca atualmente. Use o comando /add.`);
            return;
        }

        let msg = `📋 <b>Buscas Ativas neste Chat (${subs.length}):</b>\n\n`;
        subs.forEach((sub, i) => {
            msg += `<b>${i + 1}.</b> ${sub.searchName}\n🔗 <a href="${sub.url}">Link</a>\n\n`;
        });

        await notifier.sendNotification(chatId, msg);
    }

    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = new TelegramBot();
