const cheerio = require('cheerio')
const $logger = require('./Logger')
const $httpClient = require('./HttpClient.js')
const scraperRepository = require('../repositories/scrapperRepository.js')
const config = require('../config')

const Ad = require('./Ad.js');

const scraper = async (url) => {
    const state = {
        page: 1,
        maxPrice: 0,
        minPrice: 99999999,
        sumPrices: 0,
        validAds: 0,
        adsFound: 0,
        nextPage: true,
        prices: [],
        pricedAds: 0,
        searchName: ''
    }

    const parsedUrl = new URL(url)
    const searchTerm = parsedUrl.searchParams.get('q') || ''
    state.searchName = searchTerm || parsedUrl.pathname || 'search'
    const notify = await urlAlreadySearched(url)
    $logger.info(`Will notify: ${notify}`)

    do {
        const currentUrl = setUrlParam(url, 'o', state.page)
        let response
        try {
            response        = await $httpClient(currentUrl)
            const $         = cheerio.load(response)
            state.nextPage  = await scrapePage($, searchTerm, notify, url, state)
        } catch (error) {
            $logger.error(error)
            return
        }
        state.page++

    } while (state.nextPage);

    $logger.info(`Finished scraping ${state.searchName}: ${state.page - 1} pages, ${state.validAds} valid ads, ${state.pricedAds} with price > 0`)
    $logger.info('Priced ads (price > 0): ' + state.pricedAds)

    if (state.pricedAds) {
        const stats = calculatePriceStats(state.prices)
        const averagePrice = stats.average;

        $logger.info('Maximum price: ' + stats.maxPriceFiltered)
        $logger.info('Minimum price: ' + stats.minPriceFiltered)
        $logger.info('Average price: ' + Math.round(averagePrice))
        $logger.info('Median price: ' + stats.median)

        if (stats.mode !== null) {
            $logger.info('Mode price: ' + stats.mode)
        }
        if (stats.modalInterval !== null) {
            $logger.info(
                `Modal interval (binWidth=${stats.modalInterval.width}): ${stats.modalInterval.label} (${stats.modalInterval.count} ads)`
            )
        }

        if (stats.stdDev !== null) {
            $logger.info('Std dev: ' + stats.stdDev.toFixed(2))
        }
        if (stats.cv !== null) {
            $logger.info('CV (std/avg): ' + stats.cv.toFixed(3))
        }

        $logger.info(`Recommended central tendency: ${stats.recommended}`)

        const scrapperLog = {
            url,
            adsFound: state.validAds,
            averagePrice,
            minPrice: stats.minPriceFiltered,
            maxPrice: stats.maxPriceFiltered,
            rawMinPrice: state.minPrice,
            rawMaxPrice: state.maxPrice,
            medianPrice: stats.median,
            modePrice: stats.mode,
            modalIntervalStart: stats.modalInterval?.start ?? null,
            modalIntervalEnd: stats.modalInterval?.end ?? null,
            modalIntervalWidth: stats.modalInterval?.width ?? null,
            modalIntervalCount: stats.modalInterval?.count ?? null,
            modalTop3BinsJson: stats.modalTop3BinsJson,
            goodPrice: stats.goodPrice,
            goodPriceType: stats.goodPriceType,
            stdDevPrice: stats.stdDev,
            cvPrice: stats.cv,
            sampleSize: stats.count,
        }

        await scraperRepository.saveLog(scrapperLog)

        await logTrendIfMeaningful(url, stats)
    }
}

const logTrendIfMeaningful = async (url, stats) => {
    try {
        const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        const prev = await scraperRepository.getLatestLogBefore(url, cutoff)
        if (!prev) return
        if (prev.medianPrice === null || prev.medianPrice === undefined) return
        if (stats.median === null || stats.median === undefined) return

        const prevMedian = Number(prev.medianPrice)
        const currMedian = Number(stats.median)
        if (!Number.isFinite(prevMedian) || !Number.isFinite(currMedian) || prevMedian <= 0) return

        const deltaPct = ((currMedian - prevMedian) / prevMedian) * 100
        $logger.info(
            `Trend (>=7d): median ${prevMedian} -> ${currMedian} (${deltaPct.toFixed(1)}%)`
        )
    } catch (error) {
        $logger.error(error)
    }
}

const scrapePage = async ($, searchTerm, notify, searchUrl, state) => {
    try {
        const script = $('script[id="__NEXT_DATA__"]').text()

        if (!script) {
            return false
        }

        const adList = JSON.parse(script).props.pageProps.ads

        if (!Array.isArray(adList) || !adList.length ) {
            return false
        }

        state.adsFound += adList.length

        $logger.info(`Checking new ads for: ${searchTerm}`)
        $logger.info('Total ads found so far: ' + state.adsFound)

        for (let i = 0; i < adList.length; i++) {

            $logger.debug('Checking ad: ' + (i + 1))

            const advert = adList[i]
            const title = advert.subject
            const id = advert.listId
            const adUrl = advert.url
            const price = parseInt(advert.price?.replace('R$ ', '')?.replace(/\./g, '') || '0')

            const result = {
                id,
                url: adUrl,
                title,
                searchTerm,
                searchUrl,
                price,
                notify
            }

            const ad = new Ad(result)
            await ad.process()

            if (ad.valid) {
                state.validAds++
                // Price stats ignore entries without a meaningful price ("a combinar"/missing -> 0)
                if (ad.price > 0) {
                    state.pricedAds++
                    state.minPrice = checkMinPrice(ad.price, state.minPrice)
                    state.maxPrice = checkMaxPrice(ad.price, state.maxPrice)
                    state.sumPrices += ad.price
                    state.prices.push(ad.price)
                }
            }
        }

        return true
    } catch (error) {
        $logger.error(error);
        throw new Error('Scraping failed');
    }
}

const urlAlreadySearched = async (url) => {
    try {
        const ad = await scraperRepository.getLogsByUrl(url, 1)
        if (ad.length) {
            return true
        }
        $logger.info('First run, no notifications')
        return false
    } catch (error) {
        $logger.error(error)
        return false
    }
}

const setUrlParam = (url, param, value) => {
    const newUrl = new URL(url)
    let searchParams = newUrl.searchParams;
    searchParams.set(param, value);
    newUrl.search = searchParams.toString();
    return newUrl.toString();
}

const checkMinPrice = (price, minPrice) => {
    if (price < minPrice) return price
    else return minPrice
}

const checkMaxPrice = (price, maxPrice) => {
    if (price > maxPrice) return price
    else return maxPrice
}

const calculatePriceStats = (values) => {
    const clean = values
        .filter((v) => Number.isFinite(v) && v > 0)
        .map((v) => Math.trunc(v))
    const count = clean.length

    if (count === 0) {
        return {
            count: 0,
            q1: null,
            q3: null,
            iqr: null,
            outlierHigh: null,
            median: null,
            mode: null,
            modalInterval: null,
            modalTop3BinsJson: null,
            goodPrice: null,
            goodPriceType: null,
            stdDev: null,
            cv: null,
            recommended: 'none',
        }
    }

    const sorted = [...clean].sort((a, b) => a - b)
    const mid = Math.floor(count / 2)
    const median =
        count % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid]

    const percentile = (p) => {
        if (count === 1) return sorted[0]
        const idx = (count - 1) * p
        const lo = Math.floor(idx)
        const hi = Math.ceil(idx)
        if (lo === hi) return sorted[lo]
        const w = idx - lo
        return Math.round(sorted[lo] * (1 - w) + sorted[hi] * w)
    }

    const q1 = percentile(0.25)
    const q3 = percentile(0.75)
    const iqr = q3 - q1
    const outlierHigh = Math.round(q3 + 1.5 * iqr)
    const outlierLow = Math.round(q1 - 1.5 * iqr)

    // Filter outliers for min/max calculation (prices outside 1.5*IQR are considered outliers)
    const filteredPrices = clean.filter(v => v >= outlierLow && v <= outlierHigh)
    const minPriceFiltered = filteredPrices.length > 0 ? Math.min(...filteredPrices) : sorted[0]
    const maxPriceFiltered = filteredPrices.length > 0 ? Math.max(...filteredPrices) : sorted[sorted.length - 1]

    // "Good price" = P45 (45th percentile)
    // More realistic threshold - represents price below which 45% of listings fall
    const goodPrice = percentile(0.45)

    // Base target array for sensitive stats (mean/mode/stddev) on filtered data to avoid extreme outliers skewing results
    const targetPrices = filteredPrices.length > 0 ? filteredPrices : clean
    const trmCount = targetPrices.length

    // Mode: only meaningful when there is repetition
    const freq = new Map()
    for (const v of targetPrices) {
        freq.set(v, (freq.get(v) || 0) + 1)
    }

    let mode = null
    let modeCount = 1
    for (const [v, c] of freq.entries()) {
        if (c > modeCount) {
            mode = v
            modeCount = c
        }
    }

    // Modal interval (histogram binning)
    // Bin width = 10% of observed range (max-min). This makes "mode" more meaningful when prices
    // are mostly unique but cluster in a band.
    const min = minPriceFiltered
    const max = maxPriceFiltered
    const range = max - min
    const rawBinWidth = Math.floor(range * 0.10)
    const binWidth = Math.max(1, rawBinWidth)

    const bins = new Map()
    for (const v of targetPrices) {
        const idx = Math.floor((v - min) / binWidth)
        bins.set(idx, (bins.get(idx) || 0) + 1)
    }

    const topBins = [...bins.entries()]
        .sort((a, b) => (b[1] - a[1]) || (a[0] - b[0]))
        .slice(0, 3)
        .map(([idx, c]) => {
            const start = min + idx * binWidth
            const end = start + binWidth
            return { start, end, width: binWidth, count: c, label: `${start}-${end}` }
        })
    const modalTop3BinsJson = JSON.stringify(topBins)

    let modalInterval = null
    let modalBinCount = 0
    let modalIdx = 0
    for (const [idx, c] of bins.entries()) {
        if (c > modalBinCount || (c === modalBinCount && idx < modalIdx)) {
            modalBinCount = c
            modalIdx = idx
        }
    }
    if (modalBinCount > 0) {
        const start = min + modalIdx * binWidth
        const end = start + binWidth
        modalInterval = {
            start,
            end,
            width: binWidth,
            count: modalBinCount,
            label: `${start}-${end}`,
        }
    }

    // Std dev + CV (population)
    const avg = targetPrices.reduce((a, b) => a + b, 0) / trmCount
    const variance =
        targetPrices.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / (trmCount > 0 ? trmCount : 1)
    const stdDev = Math.sqrt(variance)
    const cv = avg > 0 ? stdDev / avg : null

    // Heuristic: avg is only "stable" when dispersion is low and sample size isn't tiny
    const avgStable = trmCount >= 10 && cv !== null && cv <= 0.20

    const recommended = count < 5 ? 'median' : avgStable ? 'average' : 'median'

    // Good price: use P10 (10th percentile) with floor at 30% of median for realism
    const goodPriceType = 'p10_with_floor'

    return {
        count,
        q1,
        q3,
        iqr,
        outlierHigh,
        outlierLow,
        median,
        mode,
        modalInterval,
        modalTop3BinsJson,
        goodPrice,
        goodPriceType,
        stdDev: Number.isFinite(stdDev) ? stdDev : null,
        cv,
        recommended,
        minPriceFiltered,
        maxPriceFiltered,
        average: avg,
    }
}

module.exports = {
    scraper
}
