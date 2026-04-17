'use strict';

const notifier = require('./Notifier');
const $logger = require('./Logger');
const Formatter = require('../utils/Formatter');
const adRepository = require('../repositories/adRepository.js');
const scrapperRepository = require('../repositories/scrapperRepository.js');
const { theilSen } = require('./Trend');

/**
 * Ad class representing a single OLX listing with market intelligence
 */
class Ad {
    constructor(ad) {
        this.id = ad.id;
        this.url = ad.url;
        this.title = ad.title;
        this.searchTerm = ad.searchTerm;
        this.searchUrl = ad.searchUrl;
        this.price = ad.price;
        this.notify = ad.notify;
        this.valid = this.isValidAd();
        this.saved = null;
    }

    /**
     * Builds a detailed market analysis for the Telegram message
     */
    async buildMarketAnalysis() {
        if (!this.searchUrl) return '';

        try {
            const latest = await scrapperRepository.getLatestLog(this.searchUrl);
            if (!latest) return '';

            const sampleSize = Number(latest.sampleSize || 0);
            
            if (sampleSize < 10) {
                return [
                    '📊 <b>Dados limitados</b>',
                    `Amostra: apenas ${sampleSize} anúncios`,
                    'Aguarde mais varreduras para análise detalhada.',
                    '',
                    `Mediana atual: ${Formatter.money(latest.medianPrice)}`,
                    `Preço deste anúncio: ${Formatter.money(this.price)}`
                ].join('\n');
            }
            
            const median = Number(latest.medianPrice || 0);
            const average = Number(latest.averagePrice || 0);
            const cv = Number(latest.cvPrice || 0);

            // Analysis logic
            const recommendedMetric = cv <= 0.30 ? 'media' : 'mediana';
            const referenceValue = recommendedMetric === 'media' ? average : median;
            const trend = await this._calculateTrend();

            return this._formatAnalysisOutput({
                sampleSize,
                median,
                average,
                cv,
                recommendedMetric,
                referenceValue,
                trend,
                latest
            });
        } catch (e) {
            $logger.error(`Analysis failed: ${e.message}`);
            return '';
        }
    }

    async _calculateTrend() {
        const sinceIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const rows = await scrapperRepository.getLogsSince(this.searchUrl, sinceIso);
        
        const byDay = new Map();
        rows.forEach(r => {
            const day = String(r.created).slice(0, 10);
            const y = Number(r.medianPrice);
            if (Number.isFinite(y) && y > 0) byDay.set(day, y);
        });

        const points = [...byDay.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([, y], idx) => ({ xDays: idx, y }));

        return theilSen(points);
    }

    _formatAnalysisOutput(data) {
        const { sampleSize, referenceValue, trend, latest, cv } = data;
        
        let trendText = 'Estável →';
        if (trend?.spanDays >= 7) {
            const direction = trend.slopePerDay > 0 ? 'Subindo ↑' : trend.slopePerDay < 0 ? 'Caindo ↓' : 'Estável →';
            trendText = `${direction} (${trend.slopePerDay.toFixed(1)} R$/dia)`;
        }

        const cvFriendly = cv <= 0.30 ? 'Baixa (Estável)' : cv <= 0.50 ? 'Moderada' : 'Alta (Volátil)';
        const adPrice = this.price;
        let priceContext = '🟡 Preço Justo';
        
        if (adPrice > 0 && referenceValue > 0) {
            const goodPrice = Number(latest.goodPrice || 0);
            if (adPrice <= goodPrice) priceContext = '💚 EXCELENTE NEGÓCIO!';
            else if (adPrice <= referenceValue * 0.90) priceContext = '🟢 PREÇO BOM';
            else if (adPrice >= referenceValue * 1.20) priceContext = '🔴 MUITO CARO';
        }

        return [
            '',
            '🧠 <b>Análise de Mercado</b>',
            `🔍 Amostra: ${sampleSize} anúncios`,
            `🎯 Referência: ${Formatter.money(referenceValue)}`,
            `💡 Ideal até: ${Formatter.money(latest.goodPrice)}`,
            `📏 Volatilidade: ${cvFriendly}`,
            `📈 Tendência: ${trendText}`,
            '',
            `📌 <b>Veredito: ${priceContext}</b>`,
            adPrice <= referenceValue * 0.90 ? '✨ Oportunidade identificada abaixo da média.' : ''
        ].filter(Boolean).join('\n');
    }

    async process() {
        if (!this.valid) return false;

        try {
            const existingAd = await adRepository.getAd(this.id).catch(() => null);
            
            if (existingAd) {
                this.saved = existingAd;
                return this.checkPriceChange();
            }

            await adRepository.createAd(this);
            $logger.info(`Ad ${this.id} added.`);

            if (this.notify) {
                const analysis = await this.buildMarketAnalysis();
                const msg = `🆕 <b>NOVO ANÚNCIO</b>\n\n${this.title}\n\n💵 <b>Preço: ${Formatter.money(this.price)}</b>\n\n🔗 ${this.url}\n${analysis}`;
                await notifier.sendNotification(msg);
            }
            return true;
        } catch (error) {
            $logger.error(`Failed to process ad ${this.id}: ${error.message}`);
        }
    }

    async checkPriceChange() {
        if (this.price !== this.saved.price) {
            await adRepository.updateAd(this);

            if (this.price < this.saved.price) {
                $logger.info(`Price reduction detected for ${this.id}`);
                const discount = Math.round(((this.saved.price - this.price) / this.saved.price) * 100);
                const analysis = await this.buildMarketAnalysis();
                
                const msg = `📉 <b>QUEDA DE PREÇO</b> (${discount}% OFF)\n\n${this.title}\n\n💵 De: ${Formatter.money(this.saved.price)} → <b>Por: ${Formatter.money(this.price)}</b>\n\n🔗 ${this.url}\n${analysis}`;
                await notifier.sendNotification(msg);
            }
        }
    }

    isValidAd() {
        return Boolean(!isNaN(this.price) && this.url && this.id);
    }
}

module.exports = Ad;
