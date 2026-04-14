'use strict';

const notifier = require('./Notifier')
const $logger = require('./Logger')

const adRepository = require('../repositories/adRepository.js')
const scrapperRepository = require('../repositories/scrapperRepository.js')
const { theilSen } = require('./Trend')

class Ad {

    constructor(ad) {
        this.id         = ad.id
        this.url        = ad.url
        this.title      = ad.title
        this.searchTerm = ad.searchTerm
        this.searchUrl  = ad.searchUrl
        this.price      = ad.price
        this.valid      = false
        this.saved      = null,
        this.notify     = ad.notify
    }

    formatMoneyBR = (value) => {
        if (value === null || value === undefined) return 'N/A'
        const n = Number(value)
        if (!Number.isFinite(n)) return 'N/A'
        return `R$${Math.round(n)}`
    }

    formatPercent = (value) => {
        const n = Number(value)
        if (!Number.isFinite(n)) return 'N/A'
        return `${n.toFixed(1)}%`
    }

    metricBadge = (isRecommended, reason) => {
        return isRecommended ? 'recomendada' : `não recomendada (${reason})`
    }

    metricsForMessage = async () => {
        if (!this.searchUrl) return ''

        const latest = await scrapperRepository.getLatestLog(this.searchUrl)
        if (!latest) return ''

        const sampleSize = Number(latest.sampleSize || 0)
        
        // Insufficient sample - simplified message
        if (sampleSize < 10) {
            return [
                '📊 Dados limitados',
                `Amostra: apenas ${sampleSize} anúncios`,
                'Aguarde mais varreduras para análise detalhada.',
                '',
                `Mediana atual: ${this.formatMoneyBR(latest.medianPrice || 0)}`,
                `Preço deste anúncio: ${this.formatMoneyBR(this.price)}`
            ].join('\n')
        }
        
        const cv = latest.cvPrice === null || latest.cvPrice === undefined ? null : Number(latest.cvPrice)
        const median = Number(latest.medianPrice || 0)
        const average = Number(latest.averagePrice || 0)

        // Determine recommended metric
        // Average is recommended only when CV is low (stable market)
        const cvLow = cv !== null && cv <= 0.30
        const recommendedMetric = cvLow ? 'media' : 'mediana'
        const referenceValue = recommendedMetric === 'media' ? average : median

        // Determine market condition
        const isDispersed = cv === null || cv > 0.50  // CV > 50% considered high dispersion

        // Theil–Sen trend from daily medians (last 30d), requires >=7d coverage
        const sinceIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        const rows = await scrapperRepository.getLogsSince(this.searchUrl, sinceIso)
        const byDay = new Map()
        for (const r of rows) {
            const day = String(r.created).slice(0, 10)
            const y = Number(r.medianPrice)
            if (!Number.isFinite(y) || y <= 0) continue
            byDay.set(day, y)
        }
        const days = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]))
        const points = days.map(([, y], idx) => ({ xDays: idx, y }))
        const trend = theilSen(points)

        let trendText = 'N/A'
        if (trend && trend.spanDays >= 7) {
            const direction = trend.slopePerDay > 0 ? '↑' : trend.slopePerDay < 0 ? '↓' : '→'
            trendText = `${direction} ${trend.slopePerDay.toFixed(2)} R$/dia (${trend.n} dias)`
        }

        const cvText = cv !== null && Number.isFinite(cv) ? cv.toFixed(3) : 'N/A'
        let cvFriendly = 'N/A'
        if (cv !== null) {
            if (cv <= 0.30) cvFriendly = `Baixa (Preços parecidos, CV=${cvText})`
            else if (cv <= 0.50) cvFriendly = `Moderada (CV=${cvText})`
            else cvFriendly = `Alta (Preços bagunçados, CV=${cvText})`
        }

        // Build smart analysis based on market conditions
        let analysis = ''
        
        if (isDispersed) {
            analysis = `⚠️ Dica: Os preços variam bastante na plataforma, mas ${this.formatMoneyBR(referenceValue)} é considerado o "ponto de equilíbrio". Foque em opções abaixo de ${this.formatMoneyBR(latest.goodPrice)} para garantir o melhor negócio.`
        } else {
            // Low dispersion - stable market
            if (trend && trend.slopePerDay < -5) {
                analysis = `📉 Os preços estão caindo recentemente! O valor padrão seguro hoje é ${this.formatMoneyBR(referenceValue)}. Ótima época para comprar!`
            } else if (trend && trend.slopePerDay > 5) {
                analysis = `📈 O mercado está aquecido e os preços subindo. O valor base está em ${this.formatMoneyBR(referenceValue)}. Se achar um desconto bom, feche logo.`
            } else {
                analysis = `✅ O mercado está bem estável. Use ${this.formatMoneyBR(referenceValue)} como sua bússola.`
            }
        }

        // Contextual analysis of THIS ad's price vs market
        const adPrice = this.price
        let priceContext = ''
        if (adPrice > 0 && referenceValue > 0) {
            const p45 = Number(latest.goodPrice || 0)
            
            if (adPrice <= p45) {
                const discount = Math.round(((referenceValue - adPrice) / referenceValue) * 100)
                priceContext = `💚 EXCELENTE NEGÓCIO: Promoção pura! ${discount}% mais barato que a vitrine do mercado.`
            } else if (adPrice <= referenceValue * 0.90) {
                const discount = Math.round(((referenceValue - adPrice) / referenceValue) * 100)
                priceContext = `🟢 PREÇO BOM: Encontrado por ${discount}% a menos que a referência atual.`
            } else if (adPrice <= referenceValue * 1.05) {
                priceContext = `🟡 PREÇO JUSTO: Está cobrando o valor padrão habitual.`
            } else if (adPrice <= referenceValue * 1.20) {
                const premium = Math.round(((adPrice - referenceValue) / referenceValue) * 100)
                priceContext = `🟠 OFERTA CARA: Pedindo cerca de ${premium}% a mais que outras pessoas.`
            } else {
                const premium = Math.round(((adPrice - referenceValue) / referenceValue) * 100)
                priceContext = `🔴 MUITO CARO: Totalmente inflacionado! ${premium}% acima do mercado.`
            }
        }

        const lines = []

        const metricLabel = recommendedMetric === 'media' ? 'Valor de Referência (Média)' : 'Valor de Referência (Mediana)'
        const otherMetric = recommendedMetric === 'media' ? 'Mediana (para comparar)' : 'Média Geral (para comparar)'
        const otherValue = recommendedMetric === 'media' ? latest.medianPrice : latest.averagePrice

        lines.push('🧠 Resumo do Mercado')
        lines.push(`🔍 Base de dados: ${sampleSize} anúncios analisados`)
        lines.push(`🎯 ${metricLabel}: ${this.formatMoneyBR(referenceValue)}`)
        lines.push(`📊 ${otherMetric}: ${this.formatMoneyBR(otherValue)}`)
        if (latest.modalIntervalStart !== null && latest.modalIntervalEnd !== null) {
            lines.push(`🔥 Faixa mais anunciada: ${this.formatMoneyBR(latest.modalIntervalStart)} a ${this.formatMoneyBR(latest.modalIntervalEnd)} (${latest.modalIntervalCount} anúncios)`)
        }
        lines.push(`💡 Preço ideal para compra: Menos de ${this.formatMoneyBR(latest.goodPrice)}`)
        lines.push(`📏 Variação dos anúncios: ${cvFriendly}`)
        lines.push(`📉 Tendência: ${trendText}`)
        lines.push('')
        lines.push('📌 O que achamos deste anúncio?')
        if (priceContext) {
            lines.push(priceContext)
        }
        lines.push(analysis)

        return lines.join('\n')
    }

    process = async () => {

        if (!this.isValidAd()) {
            $logger.debug('Ad not valid');
            return false
        }

        try {

            // check if this entry was already added to DB
            if (await this.alreadySaved()) {
                return this.checkPriceChange()
            }

            else {
                // create a new entry in the database
                return this.addToDataBase()
            }

        } catch (error) {
            $logger.error(error);
        }
    }

    alreadySaved = async () => {
        try {
            this.saved = await adRepository.getAd(this.id)
            return true
        } catch (error) {
            return false
        }
    }

    addToDataBase = async () => {

        try {
            await adRepository.createAd(this)
            $logger.info('Ad ' + this.id + ' added to the database')
        }

        catch (error) {
            $logger.error(error)
        }

        if (this.notify) {
            try {
                const metrics = await this.metricsForMessage()
                const msg =
                    `🆕 NOVO ANÚNCIO 🆕\n\n` +
                    `${this.title}\n\n` +
                    `💵 Preço: ${this.formatMoneyBR(this.price)}\n\n` +
                    `${this.url}\n\n` +
                    (metrics ? metrics : '')
                notifier.sendNotification(msg)
            } catch (error) {
                $logger.error('Could not send a notification')
            }
        }
    }

    updatePrice = async () => {
        $logger.info('updatePrice')

        try {
            await adRepository.updateAd(this)
        } catch (error) {
            $logger.error(error)
        }
    }

    checkPriceChange = async () => {

        if (this.price !== this.saved.price) {

            await this.updatePrice(this)

            // just send a notification if the price dropped
            if (this.price < this.saved.price) {

                $logger.info('This ad had a price reduction: ' + this.url)

                const decreasePercentage = Math.abs(Math.round(((this.price - this.saved.price) / this.saved.price) * 100))

                const msg =
                    `📉 QUEDA DE PREÇO 📉\n\n` +
                    `${this.title}\n\n` +
                    `💵 De: ${this.formatMoneyBR(this.saved.price)} → Para: ${this.formatMoneyBR(this.price)}\n` +
                    `📊 Desconto: ${this.formatPercent(decreasePercentage)} OFF\n\n` +
                    `${this.url}\n\n` +
                    (await this.metricsForMessage())

                try {
                    await notifier.sendNotification(msg)
                } catch (error) {
                    $logger.error(error)
                }
            }
        }
    }

    // some elements found in the ads selection don't have an url
    // I supposed that OLX adds other content between the ads,
    // let's clean those empty ads
    isValidAd = () => {

        if (!isNaN(this.price) && this.url && this.id) {
            this.valid = true
            return true
        }
        else {
            this.valid = false
            return false
        }
    }
}

module.exports = Ad
