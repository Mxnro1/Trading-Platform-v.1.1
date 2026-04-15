// Конфигурация
const config = {
    symbols: {
        BTCUSDT: {
            name: 'Bitcoin',
            pair: 'BTCUSDT',
            priceFormat: {
                minMove: 0.01,
                precision: 2
            }
        },
        TRXUSDT: {
            name: 'Tron',
            pair: 'TRXUSDT',
            priceFormat: {
                minMove: 0.0001,
                precision: 4
            }
        },
        ETHUSDT: {
            name: 'Ethereum',
            pair: 'ETHUSDT',
            priceFormat: {
                minMove: 0.01,
                precision: 2
            }
        },
        BNBUSDT: {
            name: 'Binance Coin',
            pair: 'BNBUSDT',
            priceFormat: {
                minMove: 0.01,
                precision: 2
            }
        },
        ADAUSDT: {
            name: 'Cardano',
            pair: 'ADAUSDT',
            priceFormat: {
                minMove: 0.01,
                precision: 2
            }
        },
        DOGEUSDT: {
            name: 'Dogecoin',
            pair: 'DOGEUSDT',
            priceFormat: {
                minMove: 0.01,
                precision: 2
            }
        },
        XRPUSDT: {
            name: 'Ripple',
            pair: 'XRPUSDT',
            priceFormat: {
                minMove: 0.01,
                precision: 2
            }
        },
        SOLUSDT: {
            name: 'Solana',
            pair: 'SOLUSDT',
            priceFormat: {
                minMove: 0.01,
                precision: 2
            }
        },
        DOTUSDT: {
            name: 'Polkadot',
            pair: 'DOTUSDT',
            priceFormat: {
                minMove: 0.01,
                precision: 2
            }
        },
        LINKUSDT: {
            name: 'Chainlink',
            pair: 'LINKUSDT',
            priceFormat: {
                minMove: 0.01,
                precision: 2
            }
        },
        AVAXUSDT: {
            name: 'Avalanche',
            pair: 'AVAXUSDT',
            priceFormat: {
                minMove: 0.01,
                precision: 2
            }
        },
        MATICUSDT: {
            name: 'Polygon',
            pair: 'MATICUSDT',
            priceFormat: {
                minMove: 0.01,
                precision: 2
            }
        },
        SUIUSDT: {
            name: 'Sui',
            pair: 'SUIUSDT',
            priceFormat: {
                minMove: 0.0001,
                precision: 4
            }
        },
        HYPE: {
            name: 'Hyperliquid',
            pair: 'HYPE',
            provider: 'hyperliquid',
            providerSymbol: 'HYPE',
            priceFormat: {
                minMove: 0.001,
                precision: 3
            }
        },
        PUMPUSDT: {
            name: 'Pump.fun',
            pair: 'PUMPUSDT',
            priceFormat: {
                minMove: 0.000001,
                precision: 6
            }
        }
    },
    startDate: (() => {
        const date = new Date();
        date.setMonth(date.getMonth() - 3); // Устанавливаем дату на 3 месяца назад
        return date.toISOString().split('T')[0];
    })(),
    endDate: new Date().toISOString().split('T')[0],
    defaultInterval: '15m',
    updateInterval: 5 * 60 * 1000 // 5 минут
};

const BINANCE_API_BASES = [
    'https://api-gcp.binance.com',
    'https://api.binance.com',
    'https://api1.binance.com',
    'https://api2.binance.com',
    'https://api3.binance.com',
    'https://data-api.binance.vision'
];
const BINANCE_REQUEST_TIMEOUT_MS = 8000;
const BINANCE_MAX_RETRIES = 3;
const BINANCE_WS_BASES = [
    'wss://stream.binance.com:9443/ws',
    'wss://stream.binance.com:443/ws',
    'wss://data-stream.binance.vision/ws'
];
const WS_RECONNECT_BASE_DELAY_MS = 2500;
const WS_RECONNECT_MAX_DELAY_MS = 15000;
const WS_FALLBACK_POLL_MS = 5000;
const WS_COOLDOWN_MS = 120000;
const HYPERLIQUID_INFO_URL = 'https://api.hyperliquid.xyz/info';
const HYPERLIQUID_WS_URL = 'wss://api.hyperliquid.xyz/ws';
const HYPERLIQUID_MAX_CANDLES = 5000;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options = {}, timeoutMs = BINANCE_REQUEST_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            cache: 'no-store',
            ...options,
            signal: controller.signal
        });
        return response;
    } finally {
        clearTimeout(timeoutId);
    }
}

async function fetchBinance(path, options = {}, timeoutMs = BINANCE_REQUEST_TIMEOUT_MS) {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const errors = [];

    for (const baseUrl of BINANCE_API_BASES) {
        try {
            const response = await fetchWithTimeout(`${baseUrl}${normalizedPath}`, options, timeoutMs);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return response;
        } catch (error) {
            errors.push(`${baseUrl}: ${error.message || error}`);
        }
    }

    throw new Error(`Binance API недоступен. ${errors.join(' | ')}`);
}

async function fetchBinanceJson(path, options = {}, timeoutMs = BINANCE_REQUEST_TIMEOUT_MS) {
    const response = await fetchBinance(path, options, timeoutMs);
    return response.json();
}

function getSymbolConfig(symbol) {
    return config.symbols[symbol] || null;
}

function isHyperliquidSymbol(symbol) {
    return getSymbolConfig(symbol)?.provider === 'hyperliquid';
}

async function fetchHyperliquidInfo(type, req = {}) {
    const response = await fetchWithTimeout(HYPERLIQUID_INFO_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type, req })
    });

    if (!response.ok) {
        throw new Error(`Hyperliquid HTTP ${response.status}`);
    }

    return response.json();
}

function mapHyperliquidCandle(candle) {
    return {
        time: candle.t / 1000,
        open: parseFloat(candle.o),
        high: parseFloat(candle.h),
        low: parseFloat(candle.l),
        close: parseFloat(candle.c),
        volume: parseFloat(candle.v)
    };
}

window.fetchBinance = fetchBinance;
window.fetchBinanceJson = fetchBinanceJson;

function getChartDisplayLabel(symbol) {
    const symbolConfig = getSymbolConfig(symbol);
    return symbolConfig ? `${symbolConfig.name} (${symbol})` : symbol;
}

function ensureChartLoader(container = document.querySelector('.chart-container')) {
    if (!container) return null;

    let loader = container.querySelector('.chart-loader');
    if (loader) return loader;

    loader = document.createElement('div');
    loader.className = 'chart-loader';
    loader.hidden = true;
    loader.setAttribute('aria-hidden', 'true');
    loader.setAttribute('role', 'status');
    loader.setAttribute('aria-live', 'polite');
    loader.innerHTML = `
        <div class="chart-loader-card">
            <span class="chart-loader-spinner" aria-hidden="true"></span>
            <div class="chart-loader-copy">
                <strong class="chart-loader-title">Загружаем график</strong>
                <span class="chart-loader-hint">Подтягиваем свечи и обновляем интерфейс...</span>
            </div>
        </div>
    `;
    container.appendChild(loader);
    return loader;
}

function showChartLoading({
    title = 'Загружаем график',
    hint = 'Подтягиваем свечи и обновляем интерфейс...'
} = {}) {
    const container = document.querySelector('.chart-container');
    if (!container) return null;

    const loader = ensureChartLoader(container);
    const titleEl = loader?.querySelector('.chart-loader-title');
    const hintEl = loader?.querySelector('.chart-loader-hint');

    activeChartLoadingToken += 1;
    const token = activeChartLoadingToken;
    activeChartLoadingShownAt = Date.now();

    if (titleEl) titleEl.textContent = title;
    if (hintEl) hintEl.textContent = hint;
    if (loader) {
        loader.hidden = false;
        loader.setAttribute('aria-hidden', 'false');
        container.appendChild(loader);
    }

    container.classList.add('is-loading');
    container.setAttribute('aria-busy', 'true');
    return token;
}

async function hideChartLoading(token) {
    if (!token || token !== activeChartLoadingToken) return;

    const remaining = CHART_LOADING_MIN_DURATION_MS - (Date.now() - activeChartLoadingShownAt);
    if (remaining > 0) {
        await sleep(remaining);
    }

    if (token !== activeChartLoadingToken) return;

    const container = document.querySelector('.chart-container');
    const loader = container?.querySelector('.chart-loader');
    if (!container || !loader) return;

    container.classList.remove('is-loading');
    container.setAttribute('aria-busy', 'false');
    loader.hidden = true;
    loader.setAttribute('aria-hidden', 'true');
}

async function withChartLoading(task, options = {}) {
    const token = showChartLoading(options);
    try {
        return await task();
    } finally {
        await hideChartLoading(token);
    }
}

function clearChartContainer(container) {
    if (!container) return;

    const loader = ensureChartLoader(container);
    const mountedChart = container._mountedChart;
    if (mountedChart?.main && typeof mountedChart.main.remove === 'function') {
        try {
            mountedChart.main.remove();
        } catch (error) {
            console.warn('[clearChartContainer] Не удалось корректно удалить предыдущий график:', error);
        }
    }
    container._mountedChart = null;

    Array.from(container.children).forEach((child) => {
        if (child !== loader) child.remove();
    });

    if (loader && loader.parentElement !== container) {
        container.appendChild(loader);
    }
}

function reuseChartForSymbol(nextSymbol, previousSymbol) {
    const nextConfig = getSymbolConfig(nextSymbol);
    if (!nextConfig) {
        throw new Error(`Не найдена конфигурация для ${nextSymbol}`);
    }

    const chartObject = charts[previousSymbol] || charts[nextSymbol];
    if (!chartObject) {
        throw new Error('Текущий график не найден');
    }

    chartObject.symbol = nextSymbol;
    chartObject.candlestickSeries.applyOptions({
        priceFormat: {
            type: 'price',
            precision: nextConfig.priceFormat.precision,
            minMove: nextConfig.priceFormat.minMove,
        }
    });

    clearChartDrawings(chartObject);
    clearOverlayIndicators(chartObject);
    removeFibonacciLevels(chartObject);
    loadFibonacciLevels(chartObject, nextSymbol);

    charts[nextSymbol] = chartObject;
    if (previousSymbol !== nextSymbol) {
        delete charts[previousSymbol];
    }

    return chartObject;
}

// Текущая выбранная криптовалюта
let currentSymbol = 'BTCUSDT';
let currentIndicator = 'ma20';
let indicatorHelpVisible = false;
let currentDrawingTool = null;

const INDICATOR_DEFINITIONS = {
    ma20: {
        label: 'MA (20)',
        subtitle: 'Простая скользящая средняя за 20 свечей.',
        meaning: 'MA сглаживает шум цены и помогает быстро понять, куда смещается локальный баланс рынка.',
        reading: 'Если цена держится выше линии MA и сама MA смотрит вверх, тренд чаще считается устойчивым. Если цена ниже и линия наклонена вниз, рынок слабее.',
        example: 'Пример: цена ETH долго идет выше MA(20), а откаты останавливаются возле линии. Это часто читают как поддержку краткосрочного тренда.'
    },
    ema50: {
        label: 'EMA (50)',
        subtitle: 'Экспоненциальная средняя за 50 свечей.',
        meaning: 'EMA сильнее реагирует на свежие свечи, поэтому быстрее показывает изменение импульса, чем обычная MA.',
        reading: 'Когда цена возвращается к EMA(50) и отталкивается от нее, это часто используют как ориентир для продолжения движения. Пробой вниз или вверх может намекать на смену фазы.',
        example: 'Пример: после роста цена откатилась к EMA(50), но быстро вернулась выше. Это можно трактовать как подтверждение, что покупатели еще контролируют движение.'
    },
    rsi: {
        label: 'RSI (14)',
        subtitle: 'Индекс относительной силы за 14 свечей.',
        meaning: 'RSI измеряет силу импульса и показывает, насколько движение уже разогнано вверх или вниз относительно недавней истории.',
        reading: 'Зоны выше 70 часто считают перегретыми, а ниже 30 перепроданными. Но сам по себе RSI не дает вход без контекста: важнее смотреть, как индикатор реагирует возле уровней и в тренде.',
        example: 'Пример: цена обновляет локальный максимум, а RSI уже не поднимается так же высоко. Это может быть ранним намеком, что импульс ослабевает.'
    },
    bollinger: {
        label: 'Bollinger Bands',
        subtitle: 'Средняя линия и две границы волатильности.',
        meaning: 'Полосы Боллинджера показывают не только среднюю цену, но и то, насколько рынок сейчас растянут относительно обычной волатильности.',
        reading: 'Если полосы сжимаются, рынок часто готовится к импульсу. Если цена касается верхней или нижней полосы, это не разворот само по себе, а сигнал смотреть на силу движения и возможный перегрев.',
        example: 'Пример: полосы сузились, потом свеча резко вышла вверх и полосы начали раскрываться. Это часто читают как старт сильного импульса.'
    },
    none: {
        label: 'Без индикатора',
        subtitle: 'На графике остаются только свечи.',
        meaning: 'Этот режим нужен, когда ты хочешь смотреть чистое движение цены без дополнительных наложений.',
        reading: 'Полезно, если хочется сосредоточиться на уровнях, структуре свечей и собственных сценариях без подсказок индикаторов.',
        example: 'Пример: сначала оцениваешь уровни и реакцию цены без индикаторов, а потом включаешь нужный индикатор только для уточнения идеи.'
    }
};

const MARKET_TICKER_SYMBOLS = [
    'BTCUSDT',
    'ETHUSDT',
    'SOLUSDT',
    'XRPUSDT',
    'TRXUSDT',
    'BNBUSDT',
    'DOTUSDT'
];

const MARKET_TICKER_REFRESH_MS = 5000;
let marketTickerIntervalId = null;
const CHART_LOADING_MIN_DURATION_MS = 420;
let activeChartLoadingToken = 0;
let activeChartLoadingShownAt = 0;

const MOSCOW_TIMEZONE = 'Europe/Moscow';
const MOSCOW_UTC_OFFSET_MS = 3 * 60 * 60 * 1000;
const MOSCOW_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('ru-RU', {
    timeZone: MOSCOW_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
});
const MOSCOW_AXIS_TIME_FORMATTER = new Intl.DateTimeFormat('ru-RU', {
    timeZone: MOSCOW_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
});
const MOSCOW_AXIS_DATE_FORMATTER = new Intl.DateTimeFormat('ru-RU', {
    timeZone: MOSCOW_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: '2-digit'
});

const DRAWING_COLORS = {
    pencil: '#2563eb',
    line: '#2563eb',
    preview: '#94a3b8'
};

// Инициализация графиков
let charts = {};

function stopChartFallbackPolling(chartObject) {
    if (chartObject?.wsFallbackPollId) {
        clearInterval(chartObject.wsFallbackPollId);
        chartObject.wsFallbackPollId = null;
    }
}

function closeAllChartWebSockets() {
    Object.values(charts).forEach((chartObject) => {
        if (chartObject?.wsReconnectTimer) {
            clearTimeout(chartObject.wsReconnectTimer);
            chartObject.wsReconnectTimer = null;
        }
        stopChartFallbackPolling(chartObject);
        if (chartObject?.ws) {
            chartObject.ws._manualClose = true;
            try {
                chartObject.ws.close();
            } catch (error) {}
            chartObject.ws = null;
        }
    });
}

async function fetchLatestKline(symbol, interval) {
    if (isHyperliquidSymbol(symbol)) {
        const providerSymbol = getSymbolConfig(symbol)?.providerSymbol || symbol;
        const intervalInMs = getIntervalInMs(interval);
        const endTime = Date.now();
        const startTime = endTime - (intervalInMs * 2);
        const data = await fetchHyperliquidInfo('candleSnapshot', {
            coin: providerSymbol,
            interval,
            startTime,
            endTime
        });

        if (!Array.isArray(data) || !data.length) return null;
        return mapHyperliquidCandle(data[data.length - 1]);
    }

    const data = await fetchBinanceJson(`/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=2`);
    if (!Array.isArray(data) || !data.length) return null;
    const candle = data[data.length - 1];
    return {
        time: candle[0] / 1000,
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[5])
    };
}

function startChartFallbackPolling(symbol, interval, connectionId) {
    const chartObject = charts[symbol];
    if (!chartObject) return;

    stopChartFallbackPolling(chartObject);

    chartObject.wsFallbackPollId = setInterval(async () => {
        if (symbol !== currentSymbol || interval !== config.defaultInterval) {
            stopChartFallbackPolling(chartObject);
            return;
        }

        if (chartObject.wsConnectionId !== connectionId) {
            stopChartFallbackPolling(chartObject);
            return;
        }

        try {
            const candle = await fetchLatestKline(symbol, interval);
            if (candle) {
                updateChart(symbol, candle);
            }
        } catch (error) {
            console.warn(`[ws fallback] Не удалось обновить свечу для ${symbol} через REST:`, error);
        }
    }, WS_FALLBACK_POLL_MS);
}

const APP_STATE_KEY = "crypto_platform_state_v1";

function saveAppState(patch = {}) {
    try {
        const current = JSON.parse(localStorage.getItem(APP_STATE_KEY) || '{}');
        const next = { ...current, ...patch };
        localStorage.setItem(APP_STATE_KEY, JSON.stringify(next));
    } catch (e) {}
}

function loadAppState() {
    try {
        return JSON.parse(localStorage.getItem(APP_STATE_KEY) || '{}');
    } catch (e) {
        return {};
    }
}

function updateHomeStatus() {
    const symbolEl = document.getElementById('homeCurrentSymbol');
    const intervalEl = document.getElementById('homeCurrentInterval');
    const periodEl = document.getElementById('homeCurrentPeriod');
    if (symbolEl) symbolEl.textContent = currentSymbol;
    if (intervalEl) intervalEl.textContent = config.defaultInterval;
    if (periodEl) periodEl.textContent = `${config.startDate} → ${config.endDate}`;
    syncHomeInsights();
}

function getTextContentById(id, fallback = '-') {
    const text = document.getElementById(id)?.textContent?.trim();
    return text ? text : fallback;
}

function normalizeUpdatedValue(value) {
    const cleaned = String(value || '').replace(/^Обновление:\s*/i, '').trim();
    return cleaned && cleaned !== '-' ? cleaned : '-';
}

function syncHomeInsights() {
    const scenarioTargetEl = document.getElementById('homeDataAnalyticsScenario');
    if (!scenarioTargetEl) return;

    const scenarioSourceEl = document.getElementById('analyticsScenarioValue');
    const scoreSourceEl = document.getElementById('analyticsScoreValue');
    const scenarioHint = getTextContentById('analyticsScenarioHint', 'Открой Аналитику для расчета bias.');
    const scenarioValue = getTextContentById('analyticsScenarioValue', 'NEUTRAL');
    const scoreValue = getTextContentById('analyticsScoreValue', '0 / 100');
    const riskValue = getTextContentById('analyticsRiskValue', 'Риск: -');

    scenarioTargetEl.textContent = scenarioValue;
    scenarioTargetEl.style.color = scenarioSourceEl?.style?.color || '';
    const scoreTargetEl = document.getElementById('homeDataAnalyticsScore');
    if (scoreTargetEl) {
        scoreTargetEl.textContent = scoreValue;
        scoreTargetEl.style.color = scoreSourceEl?.style?.color || '';
    }

    const scenarioHintEl = document.getElementById('homeDataAnalyticsHint');
    if (scenarioHintEl) scenarioHintEl.textContent = scenarioHint;
    const riskEl = document.getElementById('homeDataAnalyticsRisk');
    if (riskEl) riskEl.textContent = riskValue;

    const liquidationTotal = getTextContentById('liquidationEventsCount', '0 $');
    const liquidationMeta = getTextContentById('liquidationTotalBreakdown', 'Событий: 0');
    const liquidationTotalEl = document.getElementById('homeDataLiquidationTotal');
    if (liquidationTotalEl) liquidationTotalEl.textContent = liquidationTotal;
    const liquidationMetaEl = document.getElementById('homeDataLiquidationMeta');
    if (liquidationMetaEl) liquidationMetaEl.textContent = liquidationMeta;

    const newsImportant = getTextContentById('newsImportantCount', '0');
    const newsTotal = getTextContentById('newsTotalCount', '0');
    const newsSources = getTextContentById('newsSourcesCount', '0');
    const newsImportantEl = document.getElementById('homeDataNewsImportant');
    if (newsImportantEl) newsImportantEl.textContent = newsImportant;
    const newsMetaEl = document.getElementById('homeDataNewsMeta');
    if (newsMetaEl) newsMetaEl.textContent = `Всего: ${newsTotal} • Источники: ${newsSources}`;

    const analyticsUpdated = normalizeUpdatedValue(getTextContentById('analyticsUpdatedAt', '-'));
    const liquidationUpdated = normalizeUpdatedValue(getTextContentById('liquidationUpdatedAt', '-'));
    const newsUpdated = normalizeUpdatedValue(getTextContentById('newsUpdatedAt', '-'));
    const lastUpdateEl = document.getElementById('homeDataLastUpdate');
    if (!lastUpdateEl) return;

    if (analyticsUpdated === '-' && liquidationUpdated === '-' && newsUpdated === '-') {
        lastUpdateEl.textContent = 'Последние обновления: данные появятся после загрузки модулей.';
        return;
    }

    lastUpdateEl.textContent = `Последние обновления: Аналитика ${analyticsUpdated} • Ликвидации ${liquidationUpdated} • Новости ${newsUpdated}`;
}

function getIndicatorDefinition(indicatorKey = currentIndicator) {
    return INDICATOR_DEFINITIONS[indicatorKey] || INDICATOR_DEFINITIONS.none;
}

function clearOverlayIndicators(chartObject) {
    if (!chartObject) return;
    chartObject.maSeries?.setData([]);
    chartObject.emaSeries?.setData([]);
    chartObject.bollingerUpperSeries?.setData([]);
    chartObject.bollingerMiddleSeries?.setData([]);
    chartObject.bollingerLowerSeries?.setData([]);
    chartObject.rsiSeries?.setData([]);
}

function applyIndicatorToChart(chartObject, data = []) {
    if (!chartObject) return;
    clearOverlayIndicators(chartObject);
    chartObject.activeIndicator = currentIndicator;
    updateIndicatorLayout(chartObject);

    if (!Array.isArray(data) || data.length === 0) return;

    if (currentIndicator === 'ma20' && data.length >= 20) {
        chartObject.maSeries?.setData(calculateMA(data, 20));
        return;
    }

    if (currentIndicator === 'ema50' && data.length >= 2) {
        chartObject.emaSeries?.setData(calculateEMA(data, 50));
        return;
    }

    if (currentIndicator === 'rsi' && data.length >= 15) {
        chartObject.rsiSeries?.setData(calculateRSI(data, 14));
        return;
    }

    if (currentIndicator === 'bollinger' && data.length >= 20) {
        const bands = calculateBollingerBands(data, 20, 2);
        chartObject.bollingerUpperSeries?.setData(bands.upper);
        chartObject.bollingerMiddleSeries?.setData(bands.middle);
        chartObject.bollingerLowerSeries?.setData(bands.lower);
    }
}

function renderIndicatorInfoPanel() {
    const panel = document.getElementById('indicatorInfoPanel');
    const titleEl = document.getElementById('indicatorInfoTitle');
    const subtitleEl = document.getElementById('indicatorInfoSubtitle');
    const bodyEl = document.getElementById('indicatorInfoBody');
    const helpBtn = document.getElementById('indicatorHelpBtn');
    const definition = getIndicatorDefinition();

    if (helpBtn) {
        helpBtn.disabled = currentIndicator === 'none';
        helpBtn.textContent = currentIndicator === 'none' ? 'Выбери индикатор' : 'Как понять индикатор?';
    }

    if (!panel || !titleEl || !subtitleEl || !bodyEl) return;

    if (currentIndicator === 'none' || !indicatorHelpVisible) {
        panel.style.display = 'none';
        return;
    }

    titleEl.textContent = `Как понять ${definition.label}`;
    subtitleEl.textContent = definition.subtitle;
    bodyEl.innerHTML = `
        <article class="indicator-info-card">
            <h4>Что показывает</h4>
            <p>${definition.meaning}</p>
        </article>
        <article class="indicator-info-card">
            <h4>Как читать</h4>
            <p>${definition.reading}</p>
        </article>
        <article class="indicator-info-card">
            <h4>Пример</h4>
            <p>${definition.example}</p>
        </article>
    `;
    panel.style.display = 'block';
}

function getTickerSymbolLabel(symbol) {
    const baseAsset = symbol.replace('USDT', '');
    return `${baseAsset}/USDT`;
}

function getTradingViewSymbolLink(symbol) {
    return `https://www.tradingview.com/symbols/${symbol}/`;
}

function formatTickerPrice(symbol, value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return '--';

    const precision = config.symbols[symbol]?.priceFormat?.precision;
    const maximumFractionDigits = typeof precision === 'number'
        ? precision
        : numericValue >= 1000
            ? 2
            : numericValue >= 1
                ? 3
                : 5;

    return numericValue.toLocaleString('en-US', {
        minimumFractionDigits: maximumFractionDigits,
        maximumFractionDigits: maximumFractionDigits
    });
}

function renderMarketTicker(items = []) {
    const track = document.getElementById('marketTickerTrack');
    if (!track) return;

    const normalizedItems = items.length > 0
        ? items
        : MARKET_TICKER_SYMBOLS.map(symbol => ({
            symbol,
            unavailable: true
        }));

    const itemMarkup = normalizedItems.map((item) => {
        const changeValue = Number(item.priceChangePercent);
        const changeClass = item.unavailable
            ? 'market-ticker-flat'
            : changeValue > 0
                ? 'market-ticker-up'
                : changeValue < 0
                    ? 'market-ticker-down'
                    : 'market-ticker-flat';
        const changeLabel = item.unavailable
            ? 'Нет данных'
            : `${changeValue > 0 ? '+' : ''}${changeValue.toFixed(2)}%`;
        const priceLabel = item.unavailable
            ? '--'
            : `${formatTickerPrice(item.symbol, item.lastPrice)} $`;

        return `
            <a
                class="market-ticker-item"
                role="listitem"
                href="${getTradingViewSymbolLink(item.symbol)}"
                target="_blank"
                rel="noopener noreferrer"
                title="Открыть ${getTickerSymbolLabel(item.symbol)} в TradingView"
            >
                <span class="market-ticker-symbol">${getTickerSymbolLabel(item.symbol)}</span>
                <span class="market-ticker-price">${priceLabel}</span>
                <span class="market-ticker-change ${changeClass}">${changeLabel}</span>
            </a>
        `;
    }).join('');

    track.innerHTML = itemMarkup + itemMarkup;
    track.setAttribute('role', 'list');
    track.style.animationDuration = `${Math.max(28, normalizedItems.length * 6)}s`;
}

async function loadMarketTicker() {
    try {
        const payload = await fetchBinanceJson(
            `/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(MARKET_TICKER_SYMBOLS))}`
        );
        if (!Array.isArray(payload) || payload.length === 0) {
            throw new Error('Ticker payload is empty');
        }

        const tickerMap = new Map(payload.map(item => [item.symbol, item]));
        const items = MARKET_TICKER_SYMBOLS
            .map(symbol => tickerMap.get(symbol))
            .filter(Boolean)
            .map(item => ({
                symbol: item.symbol,
                lastPrice: Number(item.lastPrice),
                priceChangePercent: Number(item.priceChangePercent)
            }));

        renderMarketTicker(items);
    } catch (error) {
        console.error('[loadMarketTicker] Ошибка при загрузке рыночной ленты:', error);
        renderMarketTicker();
    }
}

function startMarketTicker() {
    if (!document.getElementById('marketTickerTrack')) return;

    loadMarketTicker();

    if (marketTickerIntervalId) {
        clearInterval(marketTickerIntervalId);
    }

    marketTickerIntervalId = setInterval(loadMarketTicker, MARKET_TICKER_REFRESH_MS);
}

function startInterfaceAnimations() {
    document.body.classList.add('page-intro');
    requestAnimationFrame(() => {
        document.body.classList.add('is-ready');
    });
}

function getMoscowDateBoundaryTimestamp(dateString, endOfDay = false) {
    if (!dateString || typeof dateString !== 'string') {
        return NaN;
    }

    const [year, month, day] = dateString.split('-').map(Number);
    if (![year, month, day].every(Number.isFinite)) {
        return NaN;
    }

    const hours = endOfDay ? 23 : 0;
    const minutes = endOfDay ? 59 : 0;
    const seconds = endOfDay ? 59 : 0;
    const milliseconds = endOfDay ? 999 : 0;

    return Date.UTC(year, month - 1, day, hours, minutes, seconds, milliseconds) - MOSCOW_UTC_OFFSET_MS;
}

function normalizeChartTimeToMs(timeValue) {
    if (typeof timeValue === 'number') {
        return timeValue * 1000;
    }

    if (typeof timeValue === 'string') {
        const parsed = Date.parse(timeValue);
        return Number.isFinite(parsed) ? parsed : NaN;
    }

    if (timeValue && typeof timeValue === 'object' && 'year' in timeValue && 'month' in timeValue && 'day' in timeValue) {
        return Date.UTC(timeValue.year, timeValue.month - 1, timeValue.day);
    }

    return NaN;
}

function formatMoscowDateTime(timeValue) {
    const timestampMs = normalizeChartTimeToMs(timeValue);
    if (!Number.isFinite(timestampMs)) return '';
    return MOSCOW_DATE_TIME_FORMATTER.format(new Date(timestampMs));
}

function formatMoscowAxisLabel(timeValue) {
    const timestampMs = normalizeChartTimeToMs(timeValue);
    if (!Number.isFinite(timestampMs)) return '';
    const formatter = config.defaultInterval === '1d'
        ? MOSCOW_AXIS_DATE_FORMATTER
        : MOSCOW_AXIS_TIME_FORMATTER;
    return formatter.format(new Date(timestampMs));
}

// Добавляем конфигурацию для уровней Фибоначчи
const fibonacciConfig = {
    colors: {
        0: '#FF0000',    // Красный
        0.236: '#FF7F00', // Оранжевый
        0.382: '#FFFF00', // Желтый
        0.5: '#00FF00',   // Зеленый
        0.618: '#0000FF', // Синий
        0.786: '#4B0082', // Индиго
        1: '#8B00FF'      // Фиолетовый
    },
    labels: {
        0: '0%',
        0.236: '23.6%',
        0.382: '38.2%',
        0.5: '50%',
        0.618: '61.8%',
        0.786: '78.6%',
        1: '100%'
    }
};

// Удаляем конфигурацию для линий
const lineConfig = {
    colors: ['#2196F3', '#4CAF50', '#FFC107', '#9C27B0', '#FF5722'],
    lineWidth: 2,
    lineStyle: 0, // 0 = сплошная линия
};

// Глобальные переменные для линий уровней покупки/продажи
let buyLevelLine = null;
let sellLevelLine = null;

// Функция для маппинга интервалов Binance/Chart -> Bybit
function mapIntervalToBybit(interval) {
    const map = {
        '1m': '1',
        '3m': '3',
        '5m': '5',
        '15m': '15',
        '30m': '30',
        '1h': '60',
        '2h': '120',
        '4h': '240',
        '6h': '360',
        '12h': '720',
        '1d': 'D',
        '1w': 'W',
        '1M': 'M'
    };
    return map[interval] || '15'; // Возвращаем '15' по умолчанию
}

// Функции для работы с API - ВОЗВРАЩЕНО К BINANCE
async function fetchHistoricalData(symbol) {
    try {
        console.log(`[fetchHistoricalData] Начало загрузки данных для ${symbol}`);
        
        // Получаем даты из конфигурации и устанавливаем точное время
        const startTimestamp = getMoscowDateBoundaryTimestamp(config.startDate);
        let endTimestamp = getMoscowDateBoundaryTimestamp(config.endDate, true);
        
        // Проверяем валидность дат
        if (startTimestamp >= endTimestamp) {
            throw new Error('Начальная дата должна быть раньше конечной даты');
        }
        
        // Проверяем, что даты не в будущем
        const now = new Date();
        now.setHours(23, 59, 59, 999); // Устанавливаем конец текущего дня
        const nowTimestamp = now.getTime();
        
        if (startTimestamp > nowTimestamp) {
            throw new Error('Начальная дата не может быть в будущем');
        }
        
        // Если конечная дата в будущем, используем текущую дату
        if (endTimestamp > nowTimestamp) {
            endTimestamp = nowTimestamp;
            console.log('[fetchHistoricalData] Конечная дата установлена на текущий момент');
        }

        const intervalInMs = getIntervalInMs(config.defaultInterval);
        const totalCandles = Math.ceil((endTimestamp - startTimestamp) / intervalInMs);

        if (isHyperliquidSymbol(symbol)) {
            const providerSymbol = getSymbolConfig(symbol)?.providerSymbol || symbol;
            const maxRangeMs = intervalInMs * HYPERLIQUID_MAX_CANDLES;
            const adjustedStartTimestamp = Math.max(startTimestamp, endTimestamp - maxRangeMs);

            if (adjustedStartTimestamp !== startTimestamp) {
                console.warn(`[fetchHistoricalData] ${symbol}: Hyperliquid хранит только последние ${HYPERLIQUID_MAX_CANDLES} свечей, поэтому загружаю доступный недавний диапазон.`);
            }

            const data = await fetchHyperliquidInfo('candleSnapshot', {
                coin: providerSymbol,
                interval: config.defaultInterval,
                startTime: adjustedStartTimestamp,
                endTime: endTimestamp
            });

            if (!Array.isArray(data) || data.length === 0) {
                throw new Error(`Нет данных Hyperliquid для ${symbol} за выбранный период`);
            }

            const formattedData = data
                .map(mapHyperliquidCandle)
                .sort((a, b) => a.time - b.time);

            console.log(`[fetchHistoricalData] Получено ${formattedData.length} свечей Hyperliquid для ${symbol}`);
            return formattedData;
        }
        
        const maxCandles = 1000;
        
        let allCandles = [];
        
        console.log(`[fetchHistoricalData] Запрос данных для ${symbol}`, {
            interval: config.defaultInterval,
            startTime: new Date(startTimestamp).toISOString(),
            endTime: new Date(endTimestamp).toISOString()
        });

        for (let i = 0; i < Math.ceil(totalCandles / maxCandles); i++) {
            const chunkStartTime = startTimestamp + (i * maxCandles * intervalInMs);
            const chunkEndTime = Math.min(chunkStartTime + (maxCandles * intervalInMs), endTimestamp);
            
            if (chunkStartTime >= chunkEndTime) continue;

            const path = `/api/v3/klines?symbol=${symbol}&interval=${config.defaultInterval}&startTime=${chunkStartTime}&endTime=${chunkEndTime}&limit=${maxCandles}`;
            let chunkLoaded = false;

            for (let attempt = 1; attempt <= BINANCE_MAX_RETRIES; attempt++) {
                try {
                    const data = await fetchBinanceJson(path);
                    if (data && data.length > 0) {
                        allCandles = allCandles.concat(data);
                    }
                    await sleep(100);
                    chunkLoaded = true;
                    break;
                } catch (error) {
                    console.error(`[fetchHistoricalData] Ошибка при загрузке чанка ${i + 1}, попытка ${attempt}/${BINANCE_MAX_RETRIES}:`, error);
                    if (attempt === BINANCE_MAX_RETRIES) {
                        throw new Error(`Не удалось получить исторические данные ${symbol} после ${BINANCE_MAX_RETRIES} попыток`);
                    }
                    await sleep(1200 * attempt);
                }
            }

            if (!chunkLoaded) {
                throw new Error(`Загрузка данных для ${symbol} была прервана`);
            }
        }

        if (allCandles.length === 0) {
            throw new Error(`Нет данных для ${symbol} за выбранный период`);
        }

        console.log(`[fetchHistoricalData] Получено ${allCandles.length} свечей`);
        
        // Форматируем данные для графика
        const formattedData = allCandles.map(candle => ({
            time: candle[0] / 1000,
            open: parseFloat(candle[1]),
            high: parseFloat(candle[2]),
            low: parseFloat(candle[3]),
            close: parseFloat(candle[4]),
            volume: parseFloat(candle[5])
        })).sort((a, b) => a.time - b.time);
        
        // Фильтруем данные по точному времени
        const filteredData = formattedData.filter(candle => {
            const candleTime = candle.time * 1000;
            return candleTime >= startTimestamp && candleTime <= endTimestamp;
        });
        
        // Убираем дубликаты
        const uniqueCandles = Array.from(new Map(filteredData.map(item => [item.time, item])).values());
        
        console.log(`[fetchHistoricalData] Подготовлено ${uniqueCandles.length} уникальных свечей`);
        return uniqueCandles;
        
    } catch (error) {
        console.error(`[fetchHistoricalData] Ошибка при загрузке данных для ${symbol}:`, error);
        throw error;
    }
}

// Функция для получения интервала в миллисекундах
function getIntervalInMs(interval) {
    const units = {
        'm': 60 * 1000,           // минута
        'h': 60 * 60 * 1000,     // час
        'd': 24 * 60 * 60 * 1000 // день
    };
    
    const value = parseInt(interval);
    const unit = interval.slice(-1);
    
    return value * units[unit];
}

// Расчет индикаторов
function calculateMA(data, period) {
    return data.map((candle, index) => {
        if (index < period - 1) return null;
        const sum = data.slice(index - period + 1, index + 1).reduce((acc, curr) => acc + curr.close, 0);
        return {
            time: candle.time,
            value: sum / period
        };
    }).filter(item => item !== null);
}

function calculateRSI(data, period = 14) {
    if (!Array.isArray(data) || data.length <= period) {
        return [];
    }

    let gainSum = 0;
    let lossSum = 0;

    for (let index = 1; index <= period; index++) {
        const change = data[index].close - data[index - 1].close;
        if (change >= 0) {
            gainSum += change;
        } else {
            lossSum += Math.abs(change);
        }
    }

    let avgGain = gainSum / period;
    let avgLoss = lossSum / period;
    const rsiPoints = [];

    const calculateRsiValue = () => {
        if (avgLoss === 0) return 100;
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    };

    rsiPoints.push({
        time: data[period].time,
        value: calculateRsiValue()
    });

    for (let index = period + 1; index < data.length; index++) {
        const change = data[index].close - data[index - 1].close;
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? Math.abs(change) : 0;

        avgGain = ((avgGain * (period - 1)) + gain) / period;
        avgLoss = ((avgLoss * (period - 1)) + loss) / period;

        rsiPoints.push({
            time: data[index].time,
            value: calculateRsiValue()
        });
    }

    return rsiPoints;
}

function calculateMACD(data) {
    const ema12 = calculateEMA(data, 12);
    const ema26 = calculateEMA(data, 26);
    
    const macd = ema12.map((ema, index) => ({
        time: ema.time,
        value: ema.value - ema26[index].value
    }));

    const signal = calculateEMA(macd, 9);

    const histogram = macd.map((macd, index) => ({
        time: macd.time,
        value: macd.value - signal[index].value
    }));

    return { macd, signal, histogram };
}

function calculateEMA(data, period) {
    const k = 2 / (period + 1);
    let ema = [data[0].close];

    for (let i = 1; i < data.length; i++) {
        ema.push(data[i].close * k + ema[i - 1] * (1 - k));
    }

    return data.map((candle, index) => ({
        time: candle.time,
        value: ema[index]
    }));
}

function calculateBollingerBands(data, period = 20, multiplier = 2) {
    const middle = calculateMA(data, period);
    const middleMap = new Map(middle.map(point => [point.time, point.value]));

    const upper = [];
    const lower = [];

    data.forEach((candle, index) => {
        if (index < period - 1) return;
        const slice = data.slice(index - period + 1, index + 1);
        const mean = middleMap.get(candle.time);
        const variance = slice.reduce((sum, item) => sum + Math.pow(item.close - mean, 2), 0) / period;
        const stdDev = Math.sqrt(variance);

        upper.push({ time: candle.time, value: mean + stdDev * multiplier });
        lower.push({ time: candle.time, value: mean - stdDev * multiplier });
    });

    return { upper, middle, lower };
}

function updateIndicatorLayout(chartObject) {
    if (!chartObject?.main) return;

    const showRsi = currentIndicator === 'rsi';
    chartObject.main.applyOptions({
        rightPriceScale: {
            borderColor: 'var(--border-color)',
            scaleMargins: showRsi
                ? { top: 0.08, bottom: 0.34 }
                : { top: 0.1, bottom: 0.1 }
        },
        leftPriceScale: {
            visible: false,
            borderColor: 'var(--border-color)',
            scaleMargins: showRsi
                ? { top: 0.72, bottom: 0.08 }
                : { top: 0.9, bottom: 0.02 }
        }
    });
}

function updateDrawingToolButtons() {
    const drawingToolSelect = document.getElementById('drawingToolSelect');
    if (drawingToolSelect) {
        drawingToolSelect.value = currentDrawingTool || '';
    }

    const chartContainer = document.querySelector('.chart-container');
    if (!chartContainer) return;

    chartContainer.style.cursor = currentDrawingTool === 'eraser'
        ? 'not-allowed'
        : currentDrawingTool
            ? 'crosshair'
            : 'default';

    const activeChart = charts[currentSymbol];
    if (activeChart?.drawingOverlay) {
        activeChart.drawingOverlay.classList.toggle('is-active', Boolean(currentDrawingTool));
    }
}

function createDrawingSvgElement(type, color, dashed = false) {
    const namespace = 'http://www.w3.org/2000/svg';
    const shape = document.createElementNS(namespace, type === 'line' ? 'line' : 'polyline');
    shape.setAttribute('class', 'chart-drawing-shape');
    shape.setAttribute('stroke', color);
    shape.setAttribute('stroke-width', '3');
    if (dashed) {
        shape.setAttribute('stroke-dasharray', '8 6');
    }
    return shape;
}

function setDrawingElementPoints(element, type, points) {
    if (!element || !Array.isArray(points) || points.length === 0) return;

    if (type === 'line' && points.length >= 2) {
        element.setAttribute('x1', points[0].x);
        element.setAttribute('y1', points[0].y);
        element.setAttribute('x2', points[1].x);
        element.setAttribute('y2', points[1].y);
        return;
    }

    element.setAttribute(
        'points',
        points.map((point) => `${point.x},${point.y}`).join(' ')
    );
}

function createDrawingRecord(chartObject, type, points, color, dashed = false) {
    const element = createDrawingSvgElement(type === 'line' ? 'line' : 'pencil', color, dashed);
    const record = {
        id: `${type}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
        type,
        points: [...points],
        element
    };
    setDrawingElementPoints(element, type, record.points);
    chartObject.drawingOverlay?.appendChild(element);
    chartObject.drawings.push(record);
    return record;
}

function resetDrawingPreview(chartObject) {
    const previewElement = chartObject?.drawingState?.previewElement;
    if (!previewElement) return;
    previewElement.remove();
    chartObject.drawingState.previewElement = null;
}

function resetDrawingState(chartObject) {
    if (!chartObject?.drawingState) return;

    chartObject.drawingState.startPoint = null;
    chartObject.drawingState.freehandRecord = null;
    chartObject.drawingState.isPointerDown = false;
    chartObject.drawingState.lastEraserHitId = null;
    resetDrawingPreview(chartObject);
}

function clearChartDrawings(chartObject) {
    if (!chartObject?.drawingOverlay) return;

    (chartObject.drawings || []).forEach((drawing) => {
        if (drawing?.element) {
            drawing.element.remove();
        }
    });

    chartObject.drawings = [];
    resetDrawingState(chartObject);
}

function normalizeDrawingTool(savedTool) {
    if (savedTool === 'trend') return 'line';
    if (savedTool === 'cursor' || savedTool === 'horizontal') return null;
    return savedTool || null;
}

function getDrawingPointFromCoordinates(chartObject, x, y) {
    if (!chartObject?.drawingOverlay) return null;
    return { x, y };
}

function getLocalPointerPosition(container, event) {
    const rect = container.getBoundingClientRect();
    return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    };
}

function updateDrawingPreview(chartObject, x, y) {
    if (currentDrawingTool === 'line' && chartObject?.drawingState?.startPoint) {
        const nextPoint = getDrawingPointFromCoordinates(chartObject, x, y);
        if (!nextPoint) return;

        if (!chartObject.drawingState.previewElement) {
            chartObject.drawingState.previewElement = createDrawingSvgElement('line', DRAWING_COLORS.preview, true);
            chartObject.drawingOverlay?.appendChild(chartObject.drawingState.previewElement);
        }

        setDrawingElementPoints(chartObject.drawingState.previewElement, 'line', [
            chartObject.drawingState.startPoint,
            nextPoint
        ]);
        return;
    }

    if (currentDrawingTool === 'pencil' && chartObject?.drawingState?.isPointerDown) {
        const nextPoint = getDrawingPointFromCoordinates(chartObject, x, y);
        if (!nextPoint) return;

        if (!chartObject.drawingState.freehandRecord) {
            chartObject.drawingState.freehandRecord = createDrawingRecord(
                chartObject,
                'pencil',
                [nextPoint],
                DRAWING_COLORS.pencil
            );
            return;
        }

        const freehandPoints = chartObject.drawingState.freehandRecord.points;
        const lastPoint = freehandPoints[freehandPoints.length - 1];
        if (!lastPoint) return;

        if (Math.abs(lastPoint.x - nextPoint.x) < 5 && Math.abs(lastPoint.y - nextPoint.y) < 5) {
            return;
        }

        freehandPoints.push(nextPoint);
        setDrawingElementPoints(chartObject.drawingState.freehandRecord.element, 'pencil', freehandPoints);
    }
}

function distanceToSegment(point, segmentStart, segmentEnd) {
    const dx = segmentEnd.x - segmentStart.x;
    const dy = segmentEnd.y - segmentStart.y;

    if (dx === 0 && dy === 0) {
        return Math.hypot(point.x - segmentStart.x, point.y - segmentStart.y);
    }

    const t = Math.max(0, Math.min(1, ((point.x - segmentStart.x) * dx + (point.y - segmentStart.y) * dy) / (dx * dx + dy * dy)));
    const projectionX = segmentStart.x + t * dx;
    const projectionY = segmentStart.y + t * dy;
    return Math.hypot(point.x - projectionX, point.y - projectionY);
}

function findDrawingAtCoordinates(chartObject, x, y, threshold = 10) {
    if (!chartObject?.drawings?.length) return null;

    const targetPoint = { x, y };

    for (let drawingIndex = chartObject.drawings.length - 1; drawingIndex >= 0; drawingIndex--) {
        const drawing = chartObject.drawings[drawingIndex];
        if (!drawing?.points || drawing.points.length === 0) continue;

        for (let pointIndex = 1; pointIndex < drawing.points.length; pointIndex++) {
            const startPoint = drawing.points[pointIndex - 1];
            const endPoint = drawing.points[pointIndex];

            if (distanceToSegment(targetPoint, startPoint, endPoint) <= threshold) {
                return drawing;
            }
        }
    }

    return null;
}

function removeDrawing(chartObject, drawing) {
    if (!chartObject?.drawingOverlay || !drawing?.element) return;

    drawing.element.remove();
    chartObject.drawings = (chartObject.drawings || []).filter((item) => item.id !== drawing.id);
}

function finishLineDrawing(chartObject, x, y) {
    if (!chartObject?.drawingState?.startPoint) return;

    const endPoint = getDrawingPointFromCoordinates(chartObject, x, y);
    if (!endPoint) {
        chartObject.drawingState.startPoint = null;
        resetDrawingPreview(chartObject);
        return;
    }

    createDrawingRecord(
        chartObject,
        'line',
        [
            chartObject.drawingState.startPoint,
            endPoint
        ],
        DRAWING_COLORS.line
    );
    chartObject.drawingState.startPoint = null;
    resetDrawingPreview(chartObject);
}

// Функция форматирования времени
function formatDateTime(timestamp) {
    return formatMoscowDateTime(timestamp);
}

// Функция инициализации обработчиков событий
function initEventHandlers() {
    try {
        console.log('[initEventHandlers] Начало инициализации обработчиков событий');
        
        const elements = {
            cryptoSymbol: document.getElementById('cryptoSymbol'),
            startDate: document.getElementById('startDate'),
            endDate: document.getElementById('endDate'),
            intervalSelect: document.getElementById('intervalSelect'),
            indicatorSelect: document.getElementById('indicatorSelect'),
            drawingToolSelect: document.getElementById('drawingToolSelect'),
            indicatorHelpBtn: document.getElementById('indicatorHelpBtn'),
            indicatorInfoClose: document.getElementById('indicatorInfoClose'),
            themeToggleHeader: document.getElementById('themeToggleHeader'),
            forecastButtons: document.querySelectorAll('.forecast-btn'),
            calculateButton: document.getElementById('calculateGrid'),
            clearGridCalculationButton: document.getElementById('clearGridCalculation')
        };

        // Проверяем наличие всех необходимых элементов
        Object.entries(elements).forEach(([name, element]) => {
            if (!element) {
                console.warn(`[initEventHandlers] Элемент ${name} не найден`);
            }
        });

        // Обработчик изменения криптовалюты
        if (elements.cryptoSymbol) {
            elements.cryptoSymbol.addEventListener('change', async (e) => {
                try {
                    console.log(`[initEventHandlers] Изменение криптовалюты на ${e.target.value}`);
                    const nextSymbol = e.target.value;
                    const previousSymbol = currentSymbol;
                    currentSymbol = nextSymbol;
                    saveAppState({ currentSymbol });
                    updateHomeStatus();

                    await withChartLoading(async () => {
                        const activeChart = charts[previousSymbol] || charts[currentSymbol];
                        if (!activeChart) {
                            const container = document.querySelector('.chart-container');
                            if (!container) {
                                throw new Error('Контейнер графика не найден');
                            }
                            clearChartContainer(container);
                            charts[currentSymbol] = createChart(container);
                            if (!charts[currentSymbol]) {
                                throw new Error('Не удалось создать график');
                            }
                        } else {
                            reuseChartForSymbol(currentSymbol, previousSymbol);
                        }

                        const isLoaded = await loadData(currentSymbol);
                        if (isLoaded) {
                            setupWebSocket(currentSymbol);
                        }
                    }, {
                        title: 'Переключаем монету',
                        hint: `Обновляем график с ${getChartDisplayLabel(previousSymbol)} на ${getChartDisplayLabel(currentSymbol)}.`
                    });
                } catch (error) {
                    console.error('[initEventHandlers] Ошибка при смене криптовалюты:', error);
                    alert('Ошибка при смене криптовалюты: ' + error.message);
                }
            });
        }

        // Обработчики изменения дат
        if (elements.startDate && elements.endDate) {
            const updateDates = async () => {
                try {
                    console.log('[initEventHandlers] Обновление дат');
                    config.startDate = elements.startDate.value;
                    config.endDate = elements.endDate.value;
                    saveAppState({ startDate: config.startDate, endDate: config.endDate });
                    updateHomeStatus();
                    await withChartLoading(
                        () => loadData(currentSymbol),
                        {
                            title: 'Обновляем период',
                            hint: `Подтягиваем свечи ${getChartDisplayLabel(currentSymbol)} за выбранные даты.`
                        }
                    );
                } catch (error) {
                    console.error('[initEventHandlers] Ошибка при обновлении дат:', error);
                }
            };

            elements.startDate.addEventListener('change', updateDates);
            elements.endDate.addEventListener('change', updateDates);
        }

        if (elements.indicatorSelect) {
            elements.indicatorSelect.addEventListener('change', () => {
                const nextIndicator = elements.indicatorSelect.value;
                if (!INDICATOR_DEFINITIONS[nextIndicator]) return;
                currentIndicator = nextIndicator;
                saveAppState({ selectedIndicator: currentIndicator });
                const activeChart = charts[currentSymbol];
                if (activeChart) {
                    applyIndicatorToChart(activeChart, activeChart.lastData || []);
                }
                if (currentIndicator === 'none') {
                    indicatorHelpVisible = false;
                    saveAppState({ indicatorHelpVisible: false });
                }
                renderIndicatorInfoPanel();
            });
        }

        if (elements.indicatorHelpBtn) {
            elements.indicatorHelpBtn.addEventListener('click', () => {
                if (currentIndicator === 'none') return;
                indicatorHelpVisible = !indicatorHelpVisible;
                saveAppState({ indicatorHelpVisible });
                renderIndicatorInfoPanel();
            });
        }

        if (elements.indicatorInfoClose) {
            elements.indicatorInfoClose.addEventListener('click', () => {
                indicatorHelpVisible = false;
                saveAppState({ indicatorHelpVisible: false });
                renderIndicatorInfoPanel();
            });
        }

        // Обработчик переключения темы
        if (elements.themeToggleHeader) {
            elements.themeToggleHeader.addEventListener('click', toggleTheme);
        }

        updateDrawingToolButtons();

        if (elements.drawingToolSelect) {
            elements.drawingToolSelect.addEventListener('change', () => {
                currentDrawingTool = normalizeDrawingTool(elements.drawingToolSelect.value || null);
                saveAppState({ drawingTool: currentDrawingTool });
                updateDrawingToolButtons();

                const activeChart = charts[currentSymbol];
                if (activeChart?.drawingState) {
                    resetDrawingState(activeChart);
                }
            });
        }

        if (elements.intervalSelect) {
            elements.intervalSelect.addEventListener('change', async () => {
                try {
                    const interval = elements.intervalSelect.value;
                    console.log(`[initEventHandlers] Изменение интервала на ${interval}`);
                    await updateInterval(interval);
                    saveAppState({ defaultInterval: interval });
                    updateHomeStatus();
                } catch (error) {
                    console.error('[initEventHandlers] Ошибка при изменении интервала:', error);
                }
            });
        }

        // Обработчики кнопок прогноза
        if (elements.forecastButtons) {
            elements.forecastButtons.forEach(button => {
                button.addEventListener('click', async () => {
                    try {
                        const forecast = button.dataset.forecast;
                        console.log(`[initEventHandlers] Изменение прогноза на ${forecast}`);
                        await updateForecast(forecast);
                    } catch (error) {
                        console.error('[initEventHandlers] Ошибка при изменении прогноза:', error);
                    }
                });
            });
        }

        // Обработчик кнопки расчета грид-бота
        if (elements.calculateButton) {
            elements.calculateButton.addEventListener('click', async () => {
                try {
                    console.log('[initEventHandlers] Запуск расчета грид-бота');
                    const modeInput = document.getElementById('triggerMode');
                    const buyPriceInput = document.getElementById('buyPrice');
                    const sellPriceInput = document.getElementById('sellPrice');
                    
                    if (!modeInput || !buyPriceInput || !sellPriceInput) {
                         throw new Error('Не найдены поля расчета срабатываний');
                    }
                    
                    const mode = modeInput.value || 'long';
                    const buyPrice = parseFloat(buyPriceInput.value);
                    const sellPrice = parseFloat(sellPriceInput.value);
                    saveAppState({ triggerMode: modeInput.value || 'long', buyPrice: buyPriceInput.value || '', sellPrice: sellPriceInput.value || '' });

                    if (isNaN(buyPrice) || isNaN(sellPrice)) {
                        throw new Error('Введите корректные значения уровней');
                    }

                    if (buyPrice <= 0 || sellPrice <= 0) {
                         throw new Error('Уровни должны быть положительными');
                    }
                    
                    if (buyPrice >= sellPrice) {
                        throw new Error('Нижний уровень должен быть меньше верхнего');
                    }

                    if (!charts[currentSymbol] || !charts[currentSymbol].candlestickSeries) {
                        throw new Error('Нет данных для расчета');
                    }

                    const data = charts[currentSymbol].candlestickSeries.data();
                    if (!data || data.length === 0) {
                        throw new Error('Нет данных для расчета');
                    }
                    console.log(`Получено ${data.length} свечей для расчета.`); // Отладка

                    // Отрисовываем линии уровней на графике
                    drawPriceLevelLines(mode, buyPrice, sellPrice);

                    const result = calculateTriggerStats(mode, buyPrice, sellPrice, data);
                    displayTriggerResults(result, mode, buyPrice, sellPrice);
                } catch (error) {
                    console.error('[initEventHandlers] Ошибка при расчете грид-бота:', error);
                    alert(error.message);
        }
    });
        }

        if (elements.clearGridCalculationButton) {
            elements.clearGridCalculationButton.addEventListener('click', () => {
                clearGridCalculation();
            });
        }

        const triggerModeEl = document.getElementById('triggerMode');
        const buyPriceEl = document.getElementById('buyPrice');
        const sellPriceEl = document.getElementById('sellPrice');
        [triggerModeEl, buyPriceEl, sellPriceEl].forEach((el) => {
            if (el) {
                el.addEventListener('input', () => saveAppState({
                    triggerMode: triggerModeEl?.value || 'long',
                    buyPrice: buyPriceEl?.value || '',
                    sellPrice: sellPriceEl?.value || ''
                }));
                el.addEventListener('change', () => saveAppState({
                    triggerMode: triggerModeEl?.value || 'long',
                    buyPrice: buyPriceEl?.value || '',
                    sellPrice: sellPriceEl?.value || ''
                }));
            }
        });

        console.log('[initEventHandlers] Инициализация обработчиков событий завершена');
    } catch (error) {
        console.error('[initEventHandlers] Критическая ошибка при инициализации обработчиков:', error);
    }
}

function createChart(container) {
    const chart = LightweightCharts.createChart(container, {
        width: container.clientWidth,
        height: container.clientHeight,
        layout: {
            background: { color: 'transparent' },
            textColor: 'var(--text-color)',
        },
        localization: {
            locale: 'ru-RU',
            timeFormatter: (time) => formatMoscowDateTime(time)
        },
        grid: {
            vertLines: { color: 'var(--border-color)' },
            horzLines: { color: 'var(--border-color)' },
        },
        crosshair: {
            mode: LightweightCharts.CrosshairMode.Normal,
        },
        rightPriceScale: {
            borderColor: 'var(--border-color)',
            scaleMargins: {
                top: 0.1,
                bottom: 0.1,
            },
        },
        leftPriceScale: {
            visible: false,
            borderColor: 'var(--border-color)',
            scaleMargins: {
                top: 0.9,
                bottom: 0.02,
            },
        },
        timeScale: {
            borderColor: 'var(--border-color)',
            timeVisible: true,
            secondsVisible: false,
            tickMarkFormatter: (time) => formatMoscowAxisLabel(time)
        },
    });

    const candlestickSeries = chart.addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: false,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
        priceFormat: {
            type: 'price',
            precision: config.symbols[currentSymbol].priceFormat.precision,
            minMove: config.symbols[currentSymbol].priceFormat.minMove,
        }
    });

    const maSeries = chart.addLineSeries({
        color: '#2962FF',
        lineWidth: 2,
        title: 'MA(20)'
    });

    const emaSeries = chart.addLineSeries({
        color: '#ff9800',
        lineWidth: 2,
        title: 'EMA(50)'
    });

    const bollingerUpperSeries = chart.addLineSeries({
        color: '#7c4dff',
        lineWidth: 1,
        title: 'BB Upper'
    });

    const bollingerMiddleSeries = chart.addLineSeries({
        color: '#00a67e',
        lineWidth: 1,
        title: 'BB Middle'
    });

    const bollingerLowerSeries = chart.addLineSeries({
        color: '#7c4dff',
        lineWidth: 1,
        title: 'BB Lower'
    });

    const rsiSeries = chart.addLineSeries({
        color: '#8b5cf6',
        lineWidth: 2,
        title: 'RSI(14)',
        priceScaleId: 'left',
        lastValueVisible: false,
        priceLineVisible: false,
        priceFormat: {
            type: 'price',
            precision: 2,
            minMove: 0.01,
        }
    });

    rsiSeries.createPriceLine({
        price: 70,
        color: '#ef4444',
        lineWidth: 1,
        lineStyle: LightweightCharts.LineStyle.Dashed,
        axisLabelVisible: false,
        title: '70'
    });

    rsiSeries.createPriceLine({
        price: 30,
        color: '#22c55e',
        lineWidth: 1,
        lineStyle: LightweightCharts.LineStyle.Dashed,
        axisLabelVisible: false,
        title: '30'
    });

    const drawingOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    drawingOverlay.classList.add('chart-drawing-overlay');
    drawingOverlay.setAttribute('width', '100%');
    drawingOverlay.setAttribute('height', '100%');
    container.appendChild(drawingOverlay);

    // Создаем объект с расширенными свойствами
    const chartObject = {
        main: chart,
        candlestickSeries: candlestickSeries,
        maSeries: maSeries,
        emaSeries: emaSeries,
        bollingerUpperSeries: bollingerUpperSeries,
        bollingerMiddleSeries: bollingerMiddleSeries,
        bollingerLowerSeries: bollingerLowerSeries,
        rsiSeries,
        activeIndicator: currentIndicator,
        lastData: [],
        symbol: currentSymbol,
        drawingOverlay,
        drawings: [],
        drawingState: {
            startPoint: null,
            previewElement: null,
            freehandRecord: null,
            isPointerDown: false,
            lastEraserHitId: null
        },
        ws: null,
        wsConnectionId: 0,
        wsReconnectTimer: null,
        wsFallbackPollId: null,
        wsReconnectAttempts: 0,
        wsEndpointIndex: 0,
        wsDisabledUntil: 0,
        wsCooldownNoticeShown: false,
        // Добавляем свойства для работы с уровнями Фибоначчи
        fibonacciLines: [],
        fibonacciLevels: null,
        fibonacciStartTime: null,
        fibonacciEndTime: null
    };
    container._mountedChart = chartObject;

    chart.subscribeCrosshairMove((param) => {
        const candleInfo = document.getElementById('candleInfo');
        if (!candleInfo) return;

        if (
            !param.point ||
            !param.time ||
            param.point.x < 0 ||
            param.point.y < 0 ||
            param.point.x > container.clientWidth ||
            param.point.y > container.clientHeight
        ) {
            candleInfo.style.display = 'none';
            return;
        }

        const candleData = param.seriesData.get(candlestickSeries);
        if (!candleData) {
            candleInfo.style.display = 'none';
            return;
        }

        const rsiData = currentIndicator === 'rsi' ? param.seriesData.get(rsiSeries) : null;
        const rsiMarkup = rsiData && typeof rsiData.value === 'number'
            ? `<div><strong>RSI (14):</strong> ${rsiData.value.toFixed(2)}</div>`
            : '';

        candleInfo.innerHTML = `
            <div><strong>${formatDateTime(param.time)}</strong></div>
            <div>O: ${Number(candleData.open).toFixed(2)}</div>
            <div>H: ${Number(candleData.high).toFixed(2)}</div>
            <div>L: ${Number(candleData.low).toFixed(2)}</div>
            <div>C: ${Number(candleData.close).toFixed(2)}</div>
            ${rsiMarkup}
        `;

        candleInfo.style.display = 'block';

        const containerRect = container.getBoundingClientRect();
        const tooltipRect = candleInfo.getBoundingClientRect();
        const offset = 16;
        const viewportPadding = 12;

        let left = containerRect.left + param.point.x + offset;
        let top = containerRect.top + param.point.y + offset;

        if (left + tooltipRect.width > window.innerWidth - viewportPadding) {
            left = containerRect.left + param.point.x - tooltipRect.width - offset;
        }

        if (top + tooltipRect.height > window.innerHeight - viewportPadding) {
            top = containerRect.top + param.point.y - tooltipRect.height - offset;
        }

        left = Math.max(viewportPadding, left);
        top = Math.max(viewportPadding, top);

        candleInfo.style.left = `${left}px`;
        candleInfo.style.top = `${top}px`;
    });

    drawingOverlay.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        drawingOverlay.setPointerCapture?.(event.pointerId);

        const { x, y } = getLocalPointerPosition(container, event);
        const candleInfo = document.getElementById('candleInfo');
        if (candleInfo) {
            candleInfo.style.display = 'none';
        }

        if (currentDrawingTool === 'pencil') {
            chartObject.drawingState.isPointerDown = true;
            chartObject.drawingState.freehandRecord = null;
            updateDrawingPreview(chartObject, x, y);
            return;
        }

        if (currentDrawingTool === 'line') {
            const startPoint = getDrawingPointFromCoordinates(chartObject, x, y);
            if (!startPoint) return;
            chartObject.drawingState.isPointerDown = true;
            chartObject.drawingState.startPoint = startPoint;
            updateDrawingPreview(chartObject, x, y);
        }
    });

    drawingOverlay.addEventListener('pointermove', (event) => {
        if (!currentDrawingTool) return;
        event.preventDefault();

        const { x, y } = getLocalPointerPosition(container, event);

        if ((currentDrawingTool === 'pencil' || currentDrawingTool === 'line') && chartObject.drawingState.isPointerDown) {
            updateDrawingPreview(chartObject, x, y);
        }

        if (currentDrawingTool === 'eraser') {
            const hitDrawing = findDrawingAtCoordinates(chartObject, x, y);
            if (hitDrawing && chartObject.drawingState.lastEraserHitId !== hitDrawing.id) {
                chartObject.drawingState.lastEraserHitId = hitDrawing.id;
                removeDrawing(chartObject, hitDrawing);
            } else if (!hitDrawing) {
                chartObject.drawingState.lastEraserHitId = null;
            }
        }
    });

    const stopPointerDrawing = (event) => {
        if (!currentDrawingTool) return;
        event.preventDefault();

        const { x, y } = getLocalPointerPosition(container, event);

        if (currentDrawingTool === 'line' && chartObject.drawingState.isPointerDown) {
            finishLineDrawing(chartObject, x, y);
        }

        if (currentDrawingTool === 'pencil' && chartObject.drawingState.freehandRecord?.points?.length < 2) {
            removeDrawing(chartObject, chartObject.drawingState.freehandRecord);
        }

        chartObject.drawingState.isPointerDown = false;
        chartObject.drawingState.freehandRecord = null;
        if (drawingOverlay.hasPointerCapture?.(event.pointerId)) {
            drawingOverlay.releasePointerCapture(event.pointerId);
        }
    };

    drawingOverlay.addEventListener('pointerup', stopPointerDrawing);
    drawingOverlay.addEventListener('pointerleave', stopPointerDrawing);
    drawingOverlay.addEventListener('pointercancel', stopPointerDrawing);
    drawingOverlay.addEventListener('contextmenu', (event) => event.preventDefault());

    updateIndicatorLayout(chartObject);
    updateDrawingToolButtons();
    console.log('[createChart] График успешно создан');
    return chartObject;
}

async function initCharts() {
    try {
        console.log('[initCharts] Начало инициализации графиков');
        clearPriceLevelLines(); // Очищаем линии при инициализации
        
        const container = document.querySelector('.chart-container');
        if (!container) {
            throw new Error('Контейнер для графика не найден');
        }

        await withChartLoading(async () => {
            clearChartContainer(container);

            const chart = createChart(container);
            if (!chart) {
                throw new Error('Не удалось создать график');
            }

            charts[currentSymbol] = chart;

            const success = await loadData(currentSymbol);
            if (!success) {
                throw new Error('Не удалось загрузить данные');
            }

            setupWebSocket(currentSymbol);
        }, {
            title: 'Запускаем график',
            hint: `Загружаем ${getChartDisplayLabel(currentSymbol)} и готовим свечи ${config.defaultInterval}.`
        });

        console.log('[initCharts] Графики успешно инициализированы');
    } catch (error) {
        console.error('[initCharts] Ошибка при инициализации графиков:', error);
        alert('Ошибка при инициализации графиков: ' + error.message);
    }
}

// Добавляем вызов initCharts при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    const saved = loadAppState();
    if (saved.currentSymbol && config.symbols[saved.currentSymbol]) {
        currentSymbol = saved.currentSymbol;
    }
    if (saved.selectedIndicator && INDICATOR_DEFINITIONS[saved.selectedIndicator]) {
        currentIndicator = saved.selectedIndicator;
    }
    if (saved.drawingTool) {
        currentDrawingTool = normalizeDrawingTool(saved.drawingTool);
    }
    indicatorHelpVisible = Boolean(saved.indicatorHelpVisible);
    if (saved.defaultInterval) {
        config.defaultInterval = saved.defaultInterval;
    }
    if (saved.startDate) config.startDate = saved.startDate;
    if (saved.endDate) config.endDate = saved.endDate;

    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const cryptoSymbolInput = document.getElementById('cryptoSymbol');
    const intervalSelectInput = document.getElementById('intervalSelect');
    const indicatorSelectInput = document.getElementById('indicatorSelect');
    const drawingToolSelectInput = document.getElementById('drawingToolSelect');
    const triggerModeInput = document.getElementById('triggerMode');
    const buyPriceInput = document.getElementById('buyPrice');
    const sellPriceInput = document.getElementById('sellPrice');

    if (startDateInput && endDateInput) {
        startDateInput.value = config.startDate;
        endDateInput.value = config.endDate;
        const today = new Date().toISOString().split('T')[0];
        startDateInput.max = today;
        endDateInput.max = today;
    }
    if (cryptoSymbolInput) cryptoSymbolInput.value = currentSymbol;
    if (intervalSelectInput) intervalSelectInput.value = config.defaultInterval;
    if (indicatorSelectInput) indicatorSelectInput.value = currentIndicator;
    if (drawingToolSelectInput) drawingToolSelectInput.value = currentDrawingTool || '';
    if (triggerModeInput && saved.triggerMode) triggerModeInput.value = saved.triggerMode;
    if (buyPriceInput && saved.buyPrice !== undefined) buyPriceInput.value = saved.buyPrice;
    if (sellPriceInput && saved.sellPrice !== undefined) sellPriceInput.value = saved.sellPrice;

    updateHomeStatus();
    initCharts();
    initEventHandlers();
    renderIndicatorInfoPanel();
    startMarketTicker();
    startInterfaceAnimations();
});

// Функция загрузки данных
async function loadData(symbol) {
    try {
        console.log(`[loadData] Загрузка данных для ${symbol}...`);
        clearPriceLevelLines(); // Очищаем линии при загрузке новых данных
        
        const chartObject = charts[symbol];
        if (!chartObject) {
            console.error(`[loadData] График для ${symbol} не инициализирован`);
            throw new Error('График не инициализирован');
        }

        chartObject.loadRequestId = (chartObject.loadRequestId || 0) + 1;
        const requestId = chartObject.loadRequestId;

        const data = await fetchHistoricalData(symbol);
        if (charts[symbol] !== chartObject || chartObject.loadRequestId !== requestId) {
            console.warn(`[loadData] Пропускаю устаревший ответ для ${symbol}`);
            return false;
        }
        if (!data || data.length === 0) {
            throw new Error('Нет данных для выбранного периода');
        }
        
        // Получаем даты из конфигурации
        const startTimestamp = getMoscowDateBoundaryTimestamp(config.startDate) / 1000;
        const endTimestamp = getMoscowDateBoundaryTimestamp(config.endDate, true) / 1000;
        
        // Фильтруем данные по выбранному периоду
        const filteredData = data.filter(candle => {
            return candle.time >= startTimestamp && candle.time <= endTimestamp;
        });

        if (filteredData.length === 0) {
            throw new Error('Нет данных для выбранного периода');
        }

        if (charts[symbol] !== chartObject || chartObject.loadRequestId !== requestId) {
            console.warn(`[loadData] Отрисовка ${symbol} отменена: уже есть более новый запрос`);
            return false;
        }

        // Устанавливаем данные на график
        chartObject.candlestickSeries.setData(filteredData);
        chartObject.lastData = filteredData;
        applyIndicatorToChart(chartObject, filteredData);

        // Настраиваем видимый диапазон
        if (filteredData.length > 0) { 
            const lastIndex = filteredData.length - 1;
            const firstIndex = Math.max(0, lastIndex - 100); // Показываем последние 100 свечей или меньше
            
            chartObject.main.timeScale().setVisibleRange({
                from: filteredData[firstIndex].time, 
                to: endTimestamp
            });
        }

        console.log(`[loadData] Данные успешно загружены для ${symbol}`);
        updateHomeStatus();
        return true;
    } catch (error) {
        console.error(`[loadData] Ошибка при загрузке данных для ${symbol}:`, error);
        throw error; // Пробрасываем ошибку дальше
    }
}

// WebSocket подключение - РАСКОММЕНТИРОВАНО
function setupWebSocket(symbol) {
    const chartObject = charts[symbol];
    if (!chartObject) {
        console.warn(`[setupWebSocket] Объект графика для ${symbol} не найден`);
        return null;
    }

    closeAllChartWebSockets();

    if (chartObject.wsDisabledUntil && Date.now() < chartObject.wsDisabledUntil) {
        if (!chartObject.wsCooldownNoticeShown) {
            console.warn(`[setupWebSocket] WebSocket для ${symbol} временно отключен, используем REST-обновление свечи до ${new Date(chartObject.wsDisabledUntil).toLocaleTimeString('ru-RU')}`);
            chartObject.wsCooldownNoticeShown = true;
        }
        startChartFallbackPolling(symbol, config.defaultInterval, chartObject.wsConnectionId);
        return null;
    }

    chartObject.wsConnectionId += 1;
    const connectionId = chartObject.wsConnectionId;
    const streamInterval = config.defaultInterval;
    const symbolConfig = getSymbolConfig(symbol);
    const providerSymbol = symbolConfig?.providerSymbol || symbol;
    const wsBaseUrls = isHyperliquidSymbol(symbol) ? [HYPERLIQUID_WS_URL] : BINANCE_WS_BASES;
    const maxConsecutiveFailures = wsBaseUrls.length;
    const endpointIndex = chartObject.wsEndpointIndex % wsBaseUrls.length;
    const wsBaseUrl = wsBaseUrls[endpointIndex];
    const wsUrl = isHyperliquidSymbol(symbol)
        ? wsBaseUrl
        : `${wsBaseUrl}/${symbol.toLowerCase()}@kline_${streamInterval}`;
    console.log(`Подключение к WebSocket: ${wsUrl}`);
    const ws = new WebSocket(wsUrl);
    chartObject.ws = ws;

    if (isHyperliquidSymbol(symbol)) {
        ws.onopen = () => {
            if (chartObject.ws !== ws) return;
            ws.send(JSON.stringify({
                method: 'subscribe',
                subscription: {
                    type: 'candle',
                    coin: providerSymbol,
                    interval: streamInterval
                }
            }));
            chartObject.wsReconnectAttempts = 0;
            chartObject.wsDisabledUntil = 0;
            chartObject.wsCooldownNoticeShown = false;
            chartObject.wsEndpointIndex = 0;
            stopChartFallbackPolling(chartObject);
            console.log(`WebSocket Hyperliquid подключен для ${symbol}`);
        };

        ws.onmessage = (event) => {
            if (chartObject.ws !== ws) return;
            try {
                const payload = JSON.parse(event.data);
                if (payload.channel !== 'candle' || !payload.data) return;
                updateChart(symbol, mapHyperliquidCandle(payload.data));
            } catch (error) {
                console.error(`Ошибка обработки Hyperliquid WebSocket данных для ${symbol}:`, error, event.data);
            }
        };
    } else {
        ws.onopen = () => {
            if (chartObject.ws !== ws) return;
            chartObject.wsReconnectAttempts = 0;
            chartObject.wsDisabledUntil = 0;
            chartObject.wsCooldownNoticeShown = false;
            chartObject.wsEndpointIndex = 0;
            stopChartFallbackPolling(chartObject);
            console.log(`WebSocket подключен для ${symbol}`);
        };
    
        ws.onmessage = (event) => {
            if (chartObject.ws !== ws) return;
            try {
                const data = JSON.parse(event.data);
                if (data.k) {
                    const candle = data.k;
                    const newCandle = {
                        time: candle.t / 1000,
                        open: parseFloat(candle.o),
                        high: parseFloat(candle.h),
                        low: parseFloat(candle.l),
                        close: parseFloat(candle.c),
                        volume: parseFloat(candle.v)
                    };
                    updateChart(symbol, newCandle); 
                }
            } catch (error) {
                console.error(`Ошибка обработки WebSocket данных для ${symbol}:`, error, event.data);
            }
        };
    }
    
    ws.onerror = (error) => {
        if (ws._manualClose || chartObject.ws !== ws) return;
        ws._hadError = true;
        console.warn(`WebSocket ошибка для ${symbol}. Переключаемся на резервное обновление, если соединение не восстановится.`);
    };
    
    ws.onclose = (event) => {
        if (chartObject.wsReconnectTimer) {
            clearTimeout(chartObject.wsReconnectTimer);
            chartObject.wsReconnectTimer = null;
        }
        const closeLog = ws._hadError ? console.warn : console.log;
        closeLog(`WebSocket закрыт для ${symbol}. Code: ${event.code}, Reason: ${event.reason || 'n/a'}`);
        if (charts[symbol]?.ws === ws) {
            charts[symbol].ws = null;
        }

        const shouldReconnect =
            !ws._manualClose &&
            chartObject.wsConnectionId === connectionId &&
            symbol === currentSymbol &&
            streamInterval === config.defaultInterval;

        if (shouldReconnect) {
            chartObject.wsReconnectAttempts += 1;
            chartObject.wsEndpointIndex = (endpointIndex + 1) % wsBaseUrls.length;
            startChartFallbackPolling(symbol, streamInterval, connectionId);

            if (chartObject.wsReconnectAttempts >= maxConsecutiveFailures) {
                chartObject.wsDisabledUntil = Date.now() + WS_COOLDOWN_MS;
                chartObject.wsCooldownNoticeShown = false;
                console.warn(`[setupWebSocket] WebSocket для ${symbol} недоступен после ${chartObject.wsReconnectAttempts} попыток. Переходим на REST-обновление на ${Math.round(WS_COOLDOWN_MS / 1000)} сек.`);
                chartObject.wsReconnectTimer = setTimeout(() => {
                    if (symbol !== currentSymbol || streamInterval !== config.defaultInterval) return;
                    chartObject.wsDisabledUntil = 0;
                    chartObject.wsCooldownNoticeShown = false;
                    setupWebSocket(symbol);
                }, WS_COOLDOWN_MS);
                return;
            }

            const retryDelay = Math.min(
                WS_RECONNECT_BASE_DELAY_MS * chartObject.wsReconnectAttempts,
                WS_RECONNECT_MAX_DELAY_MS
            );

            console.log(`Попытка переподключения WebSocket через ${Math.round(retryDelay / 1000)} сек...`);
            chartObject.wsReconnectTimer = setTimeout(() => {
                if (chartObject.wsConnectionId !== connectionId) return;
                setupWebSocket(symbol);
            }, retryDelay);
        }
    };

    return ws;
}

// Функция обновления графика по данным WebSocket
function updateChart(symbol, newCandle) {
    if (charts[symbol] && charts[symbol].candlestickSeries) {
        const chartObject = charts[symbol];
        chartObject.candlestickSeries.update(newCandle);
        const currentData = Array.isArray(chartObject.lastData) ? [...chartObject.lastData] : [];
        const lastPoint = currentData[currentData.length - 1];

        if (lastPoint && lastPoint.time === newCandle.time) {
            currentData[currentData.length - 1] = newCandle;
        } else {
            currentData.push(newCandle);
        }

        chartObject.lastData = currentData;
        applyIndicatorToChart(chartObject, currentData);
    } else {
         console.warn(`[updateChart] График или серия свечей для ${symbol} не найдены.`);
    }
}

// Функция для расчета уровней Фибоначчи
function calculateFibonacciLevels(startPrice, endPrice) {
    const diff = endPrice - startPrice;
    return {
        0: startPrice,
        0.236: startPrice + diff * 0.236,
        0.382: startPrice + diff * 0.382,
        0.5: startPrice + diff * 0.5,
        0.618: startPrice + diff * 0.618,
        0.786: startPrice + diff * 0.786,
        1: endPrice
    };
}

// Функция для сохранения уровней Фибоначчи
function saveFibonacciLevels(chart, symbol) {
    if (chart.fibonacciLevels) {
        localStorage.setItem(`fibonacci_${symbol}`, JSON.stringify({
            levels: chart.fibonacciLevels,
            startTime: chart.fibonacciStartTime,
            endTime: chart.fibonacciEndTime
        }));
    }
}

// Функция для загрузки уровней Фибоначчи
function loadFibonacciLevels(chart, symbol) {
    const saved = localStorage.getItem(`fibonacci_${symbol}`);
    if (saved) {
        const data = JSON.parse(saved);
        chart.fibonacciLevels = data.levels;
        chart.fibonacciStartTime = data.startTime;
        chart.fibonacciEndTime = data.endTime;
        drawFibonacciLevels(chart, data.levels[0], data.levels[1], data.startTime, data.endTime);
    }
}

function drawFibonacciLevels(chart, startPrice, endPrice, startTime, endTime) {
    console.log('[drawFibonacciLevels] Начало отрисовки уровней Фибоначчи');
    try {
        // Проверяем наличие графика и его компонентов
        if (!chart || !chart.main) {
            console.error('[drawFibonacciLevels] График не инициализирован');
            return;
        }

        // Инициализируем массив fibonacciLines, если он не существует
        if (!chart.fibonacciLines) {
            chart.fibonacciLines = [];
        }

    // Удаляем предыдущие линии Фибоначчи
    chart.fibonacciLines.forEach(line => {
            if (line) {
        chart.main.removeSeries(line);
            }
    });
    chart.fibonacciLines = [];

    // Сохраняем временные метки
    chart.fibonacciStartTime = startTime;
    chart.fibonacciEndTime = endTime;

    // Рассчитываем уровни
    const levels = calculateFibonacciLevels(startPrice, endPrice);
    chart.fibonacciLevels = levels;

    // Создаем линии для каждого уровня
    Object.entries(levels).forEach(([level, price]) => {
            try {
        const line = chart.main.addLineSeries({
            color: fibonacciConfig.colors[level],
            lineWidth: 1,
            lineStyle: 2, // Пунктирная линия
            title: `Fib ${fibonacciConfig.labels[level]}`,
            priceFormat: {
                type: 'price',
                precision: 2,
            }
        });

        // Добавляем точки для линии
        line.setData([
            { time: startTime, value: price },
            { time: endTime, value: price }
        ]);

                chart.fibonacciLines.push(line);
            } catch (e) {
                console.error(`[drawFibonacciLevels] Ошибка при создании линии для уровня ${level}:`, e);
            }
    });

    // Сохраняем уровни
    saveFibonacciLevels(chart, chart.symbol);
        console.log('[drawFibonacciLevels] Уровни Фибоначчи успешно отрисованы');
    } catch (error) {
        console.error('[drawFibonacciLevels] Ошибка при отрисовке уровней Фибоначчи:', error);
    }
}

// Функция для удаления уровней Фибоначчи
function removeFibonacciLevels(chart) {
    if (chart && chart.fibonacciLines && chart.fibonacciLines.length > 0) {
        chart.fibonacciLines.forEach(line => {
            if (line && chart.main) {
                chart.main.removeSeries(line);
            }
        });
        chart.fibonacciLines = [];
        chart.fibonacciLevels = null;
        chart.fibonacciStartTime = null;
        chart.fibonacciEndTime = null;
        if (chart.symbol) {
            localStorage.removeItem(`fibonacci_${chart.symbol}`);
        }
    }
}

// Обработчик изменения размера окна
window.addEventListener('resize', () => {
    if (charts[currentSymbol] && charts[currentSymbol].main) {
        const chartContainer = document.querySelector('.chart-container');
        if (!chartContainer) return;
        charts[currentSymbol].main.applyOptions({
            width: chartContainer.clientWidth,
            height: chartContainer.clientHeight || 450
        });
    }
});

// Экспорт в CSV
const exportCsvButton = document.getElementById('exportCSV');
if (exportCsvButton) {
    exportCsvButton.addEventListener('click', exportToCSV);
}

// Загружаем сохраненные уровни Фибоначчи при инициализации
for (const [key, chart] of Object.entries(charts)) {
    chart.symbol = key;
    loadFibonacciLevels(chart, key);
}

// Функция для отображения лога сделок
function displayTradeLog(tradeLog) {
    const tableBody = document.getElementById('gridTradeLogBody');
    tableBody.innerHTML = '';

    if (!tradeLog || tradeLog.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="3">Сделок не найдено.</td></tr>';
        return;
    }

    tradeLog.forEach(log => {
        const row = tableBody.insertRow();
        const dateCell = row.insertCell();
        const typeCell = row.insertCell();
        const priceCell = row.insertCell();

        dateCell.textContent = formatDateTime(log.time);
        typeCell.textContent = log.type;
        priceCell.textContent = log.price.toFixed(2);

        row.classList.add(log.type === 'Покупка' ? 'buy-log' : 'sell-log');
    });
}

// Функция для изменения размера активного графика
function resizeActiveChart() {
    try {
        const chartContainer = document.querySelector('.chart-container');
        if (!chartContainer) return;

        if (charts[currentSymbol] && charts[currentSymbol].main) {
            charts[currentSymbol].main.applyOptions({
                width: chartContainer.clientWidth,
                height: chartContainer.clientHeight || 450
            });
            charts[currentSymbol].main.timeScale().fitContent();
        }
    } catch (error) {
        console.error('[resizeActiveChart] Ошибка:', error);
    }
}

// Экспорт в CSV
function exportToCSV() {
    if (!charts[currentSymbol] || !charts[currentSymbol].candlestickSeries) {
        alert('Нет данных для экспорта');
        return;
    }

    const BOM = "\uFEFF";
    const headers = ['Время', 'Открытие', 'Максимум', 'Минимум', 'Закрытие', 'Объем'];
    
    const data = charts[currentSymbol].candlestickSeries.data();
    const symbolInfo = config.symbols[currentSymbol];
    
    const csvContent = BOM + [
        `Криптовалюта: ${symbolInfo.name} (${currentSymbol})`,
        `Период: ${config.startDate} - ${config.endDate}`,
        `Интервал: ${config.defaultInterval}`,
        '',
        headers.join(';'),
        ...data.map(candle => [
            formatDateTime(candle.time),
            candle.open.toString().replace('.', ','),
            candle.high.toString().replace('.', ','),
            candle.low.toString().replace('.', ','),
            candle.close.toString().replace('.', ','),
            (candle.volume || 0).toString().replace('.', ',')
        ].join(';'))
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${currentSymbol}_${config.startDate}_${config.endDate}_${config.defaultInterval}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
}

async function updateInterval(interval) {
    try {
        console.log(`[updateInterval] Обновление интервала на ${interval}`);
        config.defaultInterval = interval;
        await withChartLoading(async () => {
            const isLoaded = await loadData(currentSymbol);
            if (isLoaded) {
                setupWebSocket(currentSymbol);
            }
        }, {
            title: 'Меняем таймфрейм',
            hint: `Перестраиваем ${getChartDisplayLabel(currentSymbol)} на интервал ${interval}.`
        });
    } catch (error) {
        console.error('[updateInterval] Ошибка при обновлении интервала:', error);
    }
}

async function updateForecast(forecast) {
    try {
        console.log(`[updateForecast] Обновление прогноза на ${forecast}`);
        config.forecastType = forecast;
        await withChartLoading(
            () => loadData(currentSymbol),
            {
                title: 'Обновляем сценарий',
                hint: `Пересчитываем данные для ${getChartDisplayLabel(currentSymbol)}.`
            }
        );
    } catch (error) {
        console.error('[updateForecast] Ошибка при обновлении прогноза:', error);
    }
}

function toggleTheme() {
    try {
        console.log('[toggleTheme] Переключение темы');
        const currentTheme = document.body.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.body.setAttribute('data-theme', newTheme);

        // Обновляем цвета графика
        if (charts[currentSymbol] && charts[currentSymbol].main) {
            const chartOptions = {
                layout: {
                    background: { color: 'transparent' },
                    textColor: getComputedStyle(document.body).getPropertyValue('--text-color'),
                },
                grid: {
                    vertLines: { color: newTheme === 'dark' ? 'rgba(42, 46, 57, 0.5)' : 'rgba(197, 203, 206, 0.5)' },
                    horzLines: { color: newTheme === 'dark' ? 'rgba(42, 46, 57, 0.5)' : 'rgba(197, 203, 206, 0.5)' },
                }
            };
            
            charts[currentSymbol].main.applyOptions(chartOptions);

            // Обновляем цвета для всех серий
            if (charts[currentSymbol].candlestickSeries) {
                charts[currentSymbol].candlestickSeries.applyOptions({
                    upColor: newTheme === 'dark' ? '#26a69a' : '#26a69a',
                    downColor: newTheme === 'dark' ? '#ef5350' : '#ef5350',
                    wickUpColor: newTheme === 'dark' ? '#26a69a' : '#26a69a',
                    wickDownColor: newTheme === 'dark' ? '#ef5350' : '#ef5350',
                });
            }

            if (charts[currentSymbol].maSeries) {
                charts[currentSymbol].maSeries.applyOptions({
                    color: '#2962FF',
                });
            }

            if (charts[currentSymbol].emaSeries) {
                charts[currentSymbol].emaSeries.applyOptions({
                    color: '#ff9800',
                });
            }

            if (charts[currentSymbol].bollingerUpperSeries) {
                charts[currentSymbol].bollingerUpperSeries.applyOptions({
                    color: '#7c4dff',
                });
            }

            if (charts[currentSymbol].bollingerMiddleSeries) {
                charts[currentSymbol].bollingerMiddleSeries.applyOptions({
                    color: '#00a67e',
                });
            }

            if (charts[currentSymbol].bollingerLowerSeries) {
                charts[currentSymbol].bollingerLowerSeries.applyOptions({
                    color: '#7c4dff',
                });
            }

            // Обновляем цвета для всех линий Фибоначчи
            if (charts[currentSymbol].fibonacciLines) {
                charts[currentSymbol].fibonacciLines.forEach(line => {
                    if (line) {
                        const level = line.options().title.split(' ')[1];
                        line.applyOptions({
                            color: fibonacciConfig.colors[level],
                        });
                    }
                });
            }
        }
    } catch (error) {
        console.error('[toggleTheme] Ошибка при переключении темы:', error);
    }
}

// Функция для очистки линий уровней
function clearPriceLevelLines() {
    try {
        const series = charts[currentSymbol]?.candlestickSeries; // Получаем серию
        if (!series) {
            buyLevelLine = null; // Сбрасываем ссылки на всякий случай
            sellLevelLine = null;
            return;
        }
        
        if (buyLevelLine) {
            series.removePriceLine(buyLevelLine); // Удаляем с серии
            buyLevelLine = null;
        }
        if (sellLevelLine) {
            series.removePriceLine(sellLevelLine); // Удаляем с серии
            sellLevelLine = null;
        }
    } catch (e) {
        console.debug('[clearPriceLevelLines] Ошибка при удалении линий уровней:', e);
        // Дополнительно сбрасываем ссылки в случае ошибки
        buyLevelLine = null;
        sellLevelLine = null;
    }
}

// Функция для отрисовки линий уровней покупки/продажи
function drawPriceLevelLines(mode, buyPrice, sellPrice) {
    console.log(`[drawPriceLevelLines] Попытка отрисовки линий: mode=${mode}, lower=${buyPrice}, upper=${sellPrice}`);
    try {
        const series = charts[currentSymbol]?.candlestickSeries; // Получаем серию
        if (!series) {
            console.error('[drawPriceLevelLines] Серия свечей не найдена!');
            return;
        }
        console.log('[drawPriceLevelLines] Серия свечей найдена:', series);

        // Очищаем предыдущие линии
        clearPriceLevelLines();

        // Проверяем валидность цен еще раз
        if (isNaN(buyPrice) || isNaN(sellPrice) || buyPrice <= 0 || sellPrice <= 0) {
             console.error('[drawPriceLevelLines] Невалидные цены для отрисовки линий.');
             return;
        }

        // Рисуем линию покупки (зеленая, упрощенный стиль)
        try {
             console.log(`[drawPriceLevelLines] Создание линии покупки: Price=${buyPrice}`);
             buyLevelLine = series.createPriceLine({ // Вызываем у серии
                price: buyPrice,
                color: '#00FF00', // Ярко-зеленый
                lineWidth: 1,
                lineStyle: LightweightCharts.LineStyle.Solid, // Сплошная
                axisLabelVisible: true,
                title: `${mode === 'short' ? 'TP' : 'Buy'} ${buyPrice.toFixed(2)}`,
             });
             console.log('[drawPriceLevelLines] Линия покупки создана:', buyLevelLine);
        } catch (e) {
             console.error('[drawPriceLevelLines] Ошибка при создании линии покупки:', e);
             buyLevelLine = null;
        }

        // Рисуем линию продажи (красная, упрощенный стиль)
        try {
             console.log(`[drawPriceLevelLines] Создание линии продажи: Price=${sellPrice}`);
             sellLevelLine = series.createPriceLine({ // Вызываем у серии
                price: sellPrice,
                color: '#FF0000', // Ярко-красный
                lineWidth: 1,
                lineStyle: LightweightCharts.LineStyle.Solid, // Сплошная
                axisLabelVisible: true,
                title: `${mode === 'short' ? 'Short' : 'Sell'} ${sellPrice.toFixed(2)}`,
             });
             console.log('[drawPriceLevelLines] Линия продажи создана:', sellLevelLine);
        } catch (e) {
             console.error('[drawPriceLevelLines] Ошибка при создании линии продажи:', e);
             sellLevelLine = null;
        }
        
        if (buyLevelLine || sellLevelLine) {
            console.log('[drawPriceLevelLines] Линии уровней покупки/продажи отрисованы (или одна из них).');
        } else {
            console.warn('[drawPriceLevelLines] Не удалось отрисовать ни одну линию.');
        }

    } catch (error) {
        console.error('[drawPriceLevelLines] Общая ошибка при отрисовке линий уровней:', error);
    }
}

function calculateTriggerStats(mode, buyPrice, sellPrice, data) {
    try {
        console.log('[calculateTriggerStats] Начало расчета', { mode, buyPrice, sellPrice, dataLength: data.length });

        if (!Array.isArray(data) || data.length === 0) {
            throw new Error('Нет данных свечей для расчета');
        }

        if (buyPrice <= 0 || sellPrice <= 0) {
            throw new Error('Уровни должны быть больше нуля');
        }

        if (buyPrice >= sellPrice) {
            throw new Error('Нижний уровень должен быть меньше верхнего');
        }

        let state = 'looking_for_entry';
        let totalProfit = 0;
        let totalTrades = 0;
        let totalEntries = 0;
        let totalExits = 0;
        let trades = [];
        let lastEntryPrice = 0;
        let openPosition = false;

        for (let i = 0; i < data.length; i++) {
            const candle = data[i];

            if (mode === 'long') {
                if (state === 'looking_for_entry' && candle.low <= buyPrice) {
                    lastEntryPrice = buyPrice;
                    state = 'looking_for_exit';
                    openPosition = true;
                    totalEntries++;

                    trades.push({
                        type: 'entry_long',
                        label: 'Открытие LONG',
                        price: buyPrice,
                        time: candle.time
                    });
                } else if (state === 'looking_for_exit' && candle.high >= sellPrice) {
                    const profit = sellPrice - lastEntryPrice;

                    totalProfit += profit;
                    totalTrades++;
                    totalExits++;
                    state = 'looking_for_entry';
                    openPosition = false;

                    trades.push({
                        type: 'exit_long',
                        label: 'Закрытие LONG',
                        price: sellPrice,
                        time: candle.time
                    });

                    lastEntryPrice = 0;
                }
            } else {
                if (state === 'looking_for_entry' && candle.high >= sellPrice) {
                    lastEntryPrice = sellPrice;
                    state = 'looking_for_exit';
                    openPosition = true;
                    totalEntries++;

                    trades.push({
                        type: 'entry_short',
                        label: 'Открытие SHORT',
                        price: sellPrice,
                        time: candle.time
                    });
                } else if (state === 'looking_for_exit' && candle.low <= buyPrice) {
                    const profit = lastEntryPrice - buyPrice;

                    totalProfit += profit;
                    totalTrades++;
                    totalExits++;
                    state = 'looking_for_entry';
                    openPosition = false;

                    trades.push({
                        type: 'exit_short',
                        label: 'Закрытие SHORT',
                        price: buyPrice,
                        time: candle.time
                    });

                    lastEntryPrice = 0;
                }
            }
        }

        const distancePercent = ((sellPrice - buyPrice) / buyPrice) * 100;

        return {
            mode,
            totalProfit,
            totalTrades,
            totalEntries,
            totalExits,
            openPosition,
            distancePercent,
            trades
        };
    } catch (error) {
        console.error('[calculateTriggerStats] Ошибка при расчете:', error);
        throw error;
    }
}

function displayTriggerResults(result, mode, buyPrice, sellPrice) {
    try {
        console.log('[displayTriggerResults] Начало отображения результатов');
        const resultDiv = document.getElementById('gridResult');
        const tradeLogBody = document.getElementById('gridTradeLogBody');

        if (!resultDiv || !tradeLogBody) {
            throw new Error('Не найдены элементы для отображения результатов');
        }

        tradeLogBody.innerHTML = '';
        resultDiv.innerHTML = '';

        const modeLabel = mode === 'long' ? 'LONG' : 'SHORT';

        resultDiv.innerHTML = `
            <div class="grid-stats">
                <p><strong>Режим:</strong> ${modeLabel}</p>
                <p><strong>Всего циклов:</strong> ${result.totalTrades}</p>
                <p><strong>Открытий:</strong> ${result.totalEntries}</p>
                <p><strong>Закрытий:</strong> ${result.totalExits}</p>
                <p><strong>Есть незакрытая позиция:</strong> ${result.openPosition ? 'Да' : 'Нет'}</p>
                <p><strong>Нижний уровень:</strong> ${buyPrice}</p>
                <p><strong>Верхний уровень:</strong> ${sellPrice}</p>
                <p><strong>Разница уровней:</strong> ${result.distancePercent.toFixed(2)}%</p>
                <p><strong>Суммарный результат:</strong> ${result.totalProfit.toFixed(2)}</p>
            </div>
        `;

        if (result.trades && result.trades.length > 0) {
            result.trades.forEach(trade => {
                const row = document.createElement('tr');

                if (trade.type.includes('long')) {
                    row.className = trade.type.includes('entry') ? 'buy-log' : 'sell-log';
                } else {
                    row.className = trade.type.includes('entry') ? 'sell-log' : 'buy-log';
                }

                const timeCell = document.createElement('td');
                timeCell.textContent = formatDateTime(trade.time);

                const typeCell = document.createElement('td');
                typeCell.textContent = trade.label;

                const priceCell = document.createElement('td');
                priceCell.textContent = Number(trade.price).toFixed(2);

                row.appendChild(timeCell);
                row.appendChild(typeCell);
                row.appendChild(priceCell);
                tradeLogBody.appendChild(row);
            });
        } else {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 3;
            cell.textContent = 'Срабатываний не было';
            row.appendChild(cell);
            tradeLogBody.appendChild(row);
        }

        console.log('[displayTriggerResults] Результаты успешно отображены');
    } catch (error) {
        console.error('[displayTriggerResults] Ошибка при отображении результатов:', error);
        alert('Ошибка при отображении результатов: ' + error.message);
    }
}

function clearGridCalculation() {
    clearPriceLevelLines();

    const resultDiv = document.getElementById('gridResult');
    const tradeLogBody = document.getElementById('gridTradeLogBody');

    if (resultDiv) {
        resultDiv.innerHTML = '';
    }

    if (tradeLogBody) {
        tradeLogBody.innerHTML = '';
    }
}

// === Биржевой стакан (Orderbook) ===
(function() {
  const orderbookTab = document.getElementById('orderbook-tab');
  if (!orderbookTab) return;

  const symbolSelect = document.getElementById('orderbook-symbol');
  const tableBody = document.getElementById('orderbook-body');
  const spreadEl = document.getElementById('orderbook-spread');
  const indicatorsEl = document.getElementById('orderbook-indicators');
  let errorEl = document.getElementById('orderbook-error');
  const refreshBtn = document.getElementById('orderbook-refresh');
  const exportBtn = document.getElementById('orderbook-export');
  const volumeFilterInput = document.getElementById('orderbook-volume-filter');

  let orderbookSymbol = symbolSelect.value;
  let updateInterval = null;
  let lastOrderbook = { asks: [], bids: [] };

  symbolSelect.addEventListener('change', () => {
    orderbookSymbol = symbolSelect.value;
    fetchAndRenderOrderbook();
  });
  if (refreshBtn) refreshBtn.addEventListener('click', fetchAndRenderOrderbook);
  if (exportBtn) exportBtn.addEventListener('click', exportOrderbookToCSV);
  if (volumeFilterInput) volumeFilterInput.addEventListener('input', fetchAndRenderOrderbook);

  function startAutoUpdate() {
    if (updateInterval) clearInterval(updateInterval);
    updateInterval = setInterval(fetchAndRenderOrderbook, 2000);
  }

  async function fetchOrderbook(symbol) {
    try {
      errorEl.textContent = `Запрос к Binance API... (${symbol})`;
      const res = await fetchBinance(`/api/v3/depth?symbol=${symbol}&limit=20`);
      const text = await res.text();
      errorEl.textContent = `Ответ получен, парсинг...`;
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        errorEl.textContent = `Ошибка парсинга JSON: ${parseErr.message}\n${text}`;
        throw parseErr;
      }
      errorEl.textContent = '';
      return data;
    } catch (e) {
      errorEl.textContent = 'Ошибка загрузки стакана: ' + (e.message || e);
      throw e;
    }
  }

  function detectWalls(orders) {
    // Стена — если объём заявки больше 10% от суммы топ-20
    const total = orders.reduce((sum, o) => sum + parseFloat(o[1]), 0);
    return orders.map(o => parseFloat(o[1]) > total * 0.10);
  }

  function getHeatmap(orders) {
    // Для тепловой карты: нормализуем объёмы
    const volumes = orders.map(o => parseFloat(o[1]));
    const max = Math.max(...volumes, 1);
    return volumes.map(v => v / max);
  }

  function formatNum(num, digits = 4) {
    return parseFloat(num).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: digits });
  }

  function renderOrderbook(asks, bids) {
    const volumeFilter = getVolumeFilter();
    const filteredAsks = asks.filter(a => parseFloat(a[1]) >= volumeFilter);
    const filteredBids = bids.filter(b => parseFloat(b[1]) >= volumeFilter);
    const askCum = getCumulativeVolumes(filteredAsks);
    const bidCum = getCumulativeVolumes(filteredBids);
    const askWalls = detectWalls(filteredAsks);
    const bidWalls = detectWalls(filteredBids);
    const askHeat = getHeatmap(filteredAsks);
    const bidHeat = getHeatmap(filteredBids);
    const maxRows = Math.max(filteredAsks.length, filteredBids.length);
    let html = '';
    for (let i = 0; i < maxRows; i++) {
      const ask = filteredAsks[i];
      const bid = filteredBids[i];
      html += '<tr>';
      // Ask (продажа)
      if (ask) {
        html += `<td class="ask-col${askWalls[i] ? ' orderbook-wall' : ''}${askHeat[i] > 0.5 ? ' heat' : ''}" style="background: linear-gradient(to left, #ffebee 0%, #ffcdd2 ${Math.round(askHeat[i]*100)}%);">${formatNum(ask[0], 2)}</td>`;
        html += `<td class="ask-col${askWalls[i] ? ' orderbook-wall' : ''}${askHeat[i] > 0.5 ? ' heat' : ''}" style="background: linear-gradient(to left, #ffebee 0%, #ffcdd2 ${Math.round(askHeat[i]*100)}%);">${formatNum(ask[1], 4)}</td>`;
        html += `<td class="ask-col cumvol${askWalls[i] ? ' orderbook-wall' : ''}" style="background: linear-gradient(to left, #e3f0fc 0%, #ffcdd2 ${Math.round(askHeat[i]*100)}%);">${formatNum(askCum[i], 4)}</td>`;
      } else {
        html += '<td class="ask-col"></td><td class="ask-col"></td><td class="ask-col cumvol"></td>';
      }
      html += '<td class="center"></td>';
      // Bid (покупка)
      if (bid) {
        html += `<td class="bid-col cumvol${bidWalls[i] ? ' orderbook-wall' : ''}" style="background: linear-gradient(to right, #e3f0fc 0%, #c8e6c9 ${Math.round(bidHeat[i]*100)}%);">${formatNum(bidCum[i], 4)}</td>`;
        html += `<td class="bid-col${bidWalls[i] ? ' orderbook-wall' : ''}${bidHeat[i] > 0.5 ? ' heat' : ''}" style="background: linear-gradient(to right, #e8f5e9 0%, #c8e6c9 ${Math.round(bidHeat[i]*100)}%);">${formatNum(bid[1], 4)}</td>`;
        html += `<td class="bid-col${bidWalls[i] ? ' orderbook-wall' : ''}${bidHeat[i] > 0.5 ? ' heat' : ''}" style="background: linear-gradient(to right, #e8f5e9 0%, #c8e6c9 ${Math.round(bidHeat[i]*100)}%);">${formatNum(bid[0], 2)}</td>`;
      } else {
        html += '<td class="bid-col cumvol"></td><td class="bid-col"></td><td class="bid-col"></td>';
      }
      html += '</tr>';
    }
    tableBody.innerHTML = html;
  }

  function renderIndicators(asks, bids) {
    if (!asks.length || !bids.length) {
      spreadEl.textContent = '';
      indicatorsEl.innerHTML = '';
            return;
    }
    const bestAsk = parseFloat(asks[0][0]);
    const bestBid = parseFloat(bids[0][0]);
    const spread = bestAsk - bestBid;
    const spreadPerc = (spread / bestAsk) * 100;
    const askVol = asks.reduce((sum, o) => sum + parseFloat(o[1]), 0);
    const bidVol = bids.reduce((sum, o) => sum + parseFloat(o[1]), 0);
    const vwapAsk = calcVWAP(asks);
    const vwapBid = calcVWAP(bids);
    indicatorsEl.innerHTML = `
      <span>Ликвидность Ask <span class="tooltip" title="Суммарный объём всех заявок на продажу.">?</span>: <b>${formatNum(askVol, 2)}</b></span>
      <span>Ликвидность Bid <span class="tooltip" title="Суммарный объём всех заявок на покупку.">?</span>: <b>${formatNum(bidVol, 2)}</b></span>
      <span>Спред <span class="tooltip" title="Разница между лучшей ценой покупки и продажи.">?</span>: <b>${spread.toFixed(2)} (${spreadPerc.toFixed(3)}%)</b></span>
      <span>VWAP Ask <span class="tooltip" title="VWAP (Volume Weighted Average Price) — средневзвешенная цена по объёму для продаж (Ask).">?</span>: <b>${formatNum(vwapAsk, 2)}</b></span>
      <span>VWAP Bid <span class="tooltip" title="VWAP (Volume Weighted Average Price) — средневзвешенная цена по объёму для покупок (Bid).">?</span>: <b>${formatNum(vwapBid, 2)}</b></span>
    `;
  }

  function getVolumeFilter() {
    const val = parseFloat(volumeFilterInput?.value);
    return isNaN(val) ? 0 : val;
  }

  function getCumulativeVolumes(orders, reverse = false) {
    let cum = [];
    let sum = 0;
    const arr = reverse ? orders.slice().reverse() : orders;
    for (let i = 0; i < arr.length; i++) {
      sum += parseFloat(arr[i][1]);
      cum.push(sum);
    }
    return reverse ? cum.reverse() : cum;
  }

  function calcVWAP(orders) {
    let totalVol = 0, totalPV = 0;
    for (const [price, vol] of orders) {
      totalVol += parseFloat(vol);
      totalPV += parseFloat(price) * parseFloat(vol);
    }
    return totalVol ? (totalPV / totalVol) : 0;
  }

  async function fetchAndRenderOrderbook() {
    errorEl.textContent = '';
    try {
      const data = await fetchOrderbook(orderbookSymbol);
      const asks = (data.asks || []).slice().reverse();
      const bids = data.bids || [];
      renderOrderbook(asks, bids);
      renderIndicators(asks, bids);
      if (!asks.length && !bids.length) {
        errorEl.textContent = 'Нет данных по выбранной паре.';
      }
    } catch (e) {
      errorEl.textContent = 'Ошибка загрузки стакана: ' + (e.message || e);
      tableBody.innerHTML = '';
      spreadEl.textContent = '';
      indicatorsEl.innerHTML = '';
    }
  }

  function exportOrderbookToCSV() {
    try {
      let csv = 'Side;Price;Volume;Cumulative Volume\n';
      // Asks
      const asks = (lastOrderbook.asks || []).slice().reverse();
      const askCum = getCumulativeVolumes(asks);
      for (let i = 0; i < asks.length; i++) {
        csv += `Ask;${asks[i][0]};${asks[i][1]};${askCum[i]}\n`;
      }
      // Bids
      const bids = lastOrderbook.bids || [];
      const bidCum = getCumulativeVolumes(bids);
      for (let i = 0; i < bids.length; i++) {
        csv += `Bid;${bids[i][0]};${bids[i][1]};${bidCum[i]}\n`;
      }
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${orderbookSymbol}_orderbook.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (e) {
      errorEl.textContent = 'Ошибка экспорта: ' + (e.message || e);
    }
  }

  function stopAutoUpdate() {
    if (updateInterval) {
      clearInterval(updateInterval);
      updateInterval = null;
    }
  }

  document.addEventListener('app:tab-changed', (event) => {
    const activeTab = event.detail?.tabId;
    if (activeTab === 'orderbook') {
      fetchAndRenderOrderbook();
      startAutoUpdate();
    } else {
      stopAutoUpdate();
    }
  });

  if (orderbookTab.classList.contains('active')) {
    fetchAndRenderOrderbook();
    startAutoUpdate();
  }
})(); 

// === Вкладка "Вероятности движения" ===
(function() {
  const tabContent = document.getElementById('probability-tab');
  if (!tabContent) return;

  const form = document.getElementById('probability-form');
  const resultEl = document.getElementById('probability-result');
  const errorEl = document.getElementById('probability-error');
  const select = document.getElementById('probability-symbol-select');
  const input = document.getElementById('probability-symbol');
  const intervalSel = document.getElementById('probability-interval');
  const startInput = document.getElementById('probability-start');
  const endInput = document.getElementById('probability-end');
  const chartContainer = document.getElementById('probability-chart-container');
  const chartCanvas = document.getElementById('probability-chart');
  let chartInstance = null;

  if (select && input) {
    select.addEventListener('change', () => {
      input.value = select.value;
    });
    input.addEventListener('focus', () => {
      if (!input.value) input.value = select.value;
    });
  }

  function getIntervalMs(interval) {
    switch (interval) {
      case '1m': return 60 * 1000;
      case '5m': return 5 * 60 * 1000;
      case '15m': return 15 * 60 * 1000;
      case '1h': return 60 * 60 * 1000;
      case '4h': return 4 * 60 * 60 * 1000;
      case '1d': return 24 * 60 * 60 * 1000;
      default: return 60 * 1000;
    }
  }

  if (!form) return;

  async function fetchAllKlines(symbol, interval, startTime, endTime, maxTotal = 10000, onProgress) {
    const intervalMs = getIntervalMs(interval);
    let all = [];
    let from = startTime;
    let left = maxTotal;
      while (from < endTime && left > 0) {
      const limit = Math.min(1000, Math.floor((endTime - from) / intervalMs), left);
      if (limit <= 0) break;
      const data = await fetchBinanceJson(`/api/v3/klines?symbol=${symbol}&interval=${interval}&startTime=${from}&endTime=${endTime}&limit=${limit}`);
      if (!Array.isArray(data) || !data.length) break;
      all = all.concat(data);
      if (onProgress) onProgress(all.length);
      if (data.length < limit) break; // больше нет данных
      from = data[data.length - 1][0] + intervalMs;
      left = maxTotal - all.length;
      // Защита от rate limit (можно убрать или уменьшить задержку)
      await new Promise(r => setTimeout(r, 120));
    }
    return all;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    resultEl.textContent = '';
    errorEl.textContent = '';
    chartContainer.style.display = 'none';
    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

    const symbol = input.value.trim().toUpperCase();
    const interval = intervalSel.value;
    const startStr = startInput.value;
    const endStr = endInput.value;
    if (!symbol || !interval || !startStr || !endStr) {
      errorEl.textContent = 'Проверьте корректность ввода.';
      return;
    }
    const startTime = new Date(startStr).getTime();
    const endTime = new Date(endStr).getTime();
    if (isNaN(startTime) || isNaN(endTime) || endTime <= startTime) {
      errorEl.textContent = 'Некорректные даты.';
      return;
    }
    const intervalMs = getIntervalMs(interval);
    let total = Math.floor((endTime - startTime) / intervalMs);
    if (total <= 0) {
      errorEl.textContent = 'Слишком маленький диапазон дат.';
      return;
    }
    if (total > 10000) {
      errorEl.textContent = 'Слишком большой диапазон: максимум 10 000 свечей.';
      return;
    }
    try {
      errorEl.textContent = `Загрузка данных с Binance... (0/${total})`;
      const klines = await fetchAllKlines(symbol, interval, startTime, endTime, 10000, (loaded) => {
        errorEl.textContent = `Загрузка данных с Binance... (${loaded}/${total})`;
      });
      if (!Array.isArray(klines) || !klines.length) {
        errorEl.textContent = 'Нет данных по выбранной паре.';
        return;
      }
      let up = 0, down = 0, flat = 0;
      for (const kline of klines) {
        const open = parseFloat(kline[1]);
        const close = parseFloat(kline[4]);
        if (isNaN(open) || isNaN(close)) continue;
        const diff = close - open;
        const rel = Math.abs(diff) / open;
        if (rel < 0.001) flat++;
        else if (diff > 0) up++;
        else if (diff < 0) down++;
      }
      const totalUsed = up + down + flat;
      if (!totalUsed) {
        errorEl.textContent = 'Недостаточно данных для анализа.';
        return;
      }
      const upP = (up / totalUsed * 100).toFixed(1);
      const downP = (down / totalUsed * 100).toFixed(1);
      const flatP = (flat / totalUsed * 100).toFixed(1);
      resultEl.innerHTML = `📈 Рост: <b>${upP}%</b>  <br>📉 Падение: <b>${downP}%</b>  <br>➖ Боковик: <b>${flatP}%</b>` +
        `<div style='margin-top:10px;font-size:0.98em;color:#555;'>` +
        `Всего свечей: <b>${totalUsed}</b><br>` +
        `Рост: <b>${up}</b> (${upP}%)<br>` +
        `Падение: <b>${down}</b> (${downP}%)<br>` +
        `Боковик: <b>${flat}</b> (${flatP}%)` +
        `</div>` +
        `<div style='margin-top:10px;font-size:0.95em;color:#888;background:#f7fafd;border-radius:7px;padding:8px 12px;'>` +
        `<b>Формулы расчёта:</b><br>` +
        `• <b>Боковик</b>: |close - open| / open &lt; 0.001 (0.1%)<br>` +
        `• <b>Рост</b>: close &gt; open и не боковик<br>` +
        `• <b>Падение</b>: close &lt; open и не боковик<br>` +
        `• <b>Проценты</b>: (кол-во / всего) × 100%` +
        `</div>`;
      chartContainer.style.display = 'block';
      chartInstance = new Chart(chartCanvas, {
        type: 'doughnut',
        data: {
          labels: ['Рост', 'Падение', 'Боковик'],
          datasets: [{
            data: [up, down, flat],
            backgroundColor: ['#43a047', '#e53935', '#bdbdbd'],
            borderWidth: 1.5
          }]
        },
        options: {
          plugins: {
            legend: { display: true, position: 'bottom' },
            tooltip: { enabled: true }
          },
          cutout: '65%',
          responsive: true,
          maintainAspectRatio: false
        }
      });
      errorEl.textContent = '';
    } catch (e) {
      errorEl.textContent = 'Ошибка загрузки или обработки данных: ' + (e.message || e);
    }
  });
})(); 

// === Вкладка "Новости по крипте" ===
(function() {
  const tabContent = document.getElementById('news-tab');
  if (!tabContent) return;

  const newsList = document.getElementById('news-list');
  const newsError = document.getElementById('news-error');
  const newsStatus = document.getElementById('news-status');
  const newsSourceFilter = document.getElementById('newsSourceFilter');
  const newsSearchInput = document.getElementById('newsSearchInput');
  const newsImportantOnly = document.getElementById('newsImportantOnly');
  const newsRefreshBtn = document.getElementById('newsRefreshBtn');
  const newsTotalCount = document.getElementById('newsTotalCount');
  const newsImportantCount = document.getElementById('newsImportantCount');
  const newsSourcesCount = document.getElementById('newsSourcesCount');
  const newsUpdatedAt = document.getElementById('newsUpdatedAt');
  if (
    !newsList ||
    !newsError ||
    !newsStatus ||
    !newsSourceFilter ||
    !newsSearchInput ||
    !newsImportantOnly ||
    !newsRefreshBtn
  ) return;

  const NEWS_CACHE_KEY = 'crypto_news_feed_cache_v2';
  const NEWS_AUTO_REFRESH_MS = 10 * 60 * 1000;
  const NEWS_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;
  const NEWS_FEED_PROXY_URL = 'https://api.rss2json.com/v1/api.json?rss_url=';
  const NEWS_RSS_FALLBACK_PROXY_URL = 'https://api.allorigins.win/raw?url=';
  const IMPORTANT_NEWS_RE = /bitcoin|btc|ethereum|eth|solana|xrp|trx|dot|binance|sec|etf|listing|delisting|mainnet|launch|burn|airdrop|token|upgrade|hard fork|partnership|integration|event|conference|release|testnet|migration|merge|halving|ico|ido|ieo|staking|governance|vote|roadmap|update|announcement|hack|exploit|lawsuit/i;
  const NEWS_SOURCES = [
    { name: 'Forklog', rssUrl: 'https://forklog.com/feed' },
    { name: 'Investing.com', rssUrl: 'https://ru.investing.com/rss/news_301.rss' },
    { name: 'BitNovosti', rssUrl: 'https://bitnovosti.io/feed/' },
    { name: 'Happy Coin News', rssUrl: 'https://happycoin.club/feed/' },
    { name: 'CoinSpot', rssUrl: 'https://coinspot.io/feed/' }
  ];

  let allNews = [];
  let isLoading = false;
  let hasLoadedOnce = false;
  let lastLoadedAt = null;

  function setStatus(message, tone = 'neutral') {
    newsStatus.textContent = message;
    newsStatus.dataset.tone = tone;
  }

  function setError(message = '') {
    newsError.hidden = !message;
    newsError.textContent = message;
  }

  function setMetrics(filteredNews) {
    const importantCount = filteredNews.filter((item) => item.important).length;
    const sourceCount = new Set(filteredNews.map((item) => item.source)).size;
    if (newsTotalCount) newsTotalCount.textContent = String(filteredNews.length);
    if (newsImportantCount) newsImportantCount.textContent = String(importantCount);
    if (newsSourcesCount) newsSourcesCount.textContent = String(sourceCount);
    if (newsUpdatedAt) newsUpdatedAt.textContent = lastLoadedAt ? formatUpdatedAt(lastLoadedAt) : '-';
    syncHomeInsights();
  }

  function cleanText(value) {
    if (typeof value !== 'string') return '';
    const temp = document.createElement('div');
    temp.innerHTML = value;
    return (temp.textContent || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normalizeLink(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
      const parsed = new URL(value.trim(), window.location.href);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return '';
      }
      return parsed.href;
    } catch (error) {
      return '';
    }
  }

  function truncateText(text, maxLength = 240) {
    if (!text || text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 1).trimEnd()}…`;
  }

  function parseTimestamp(value) {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  function isImportantNews(item) {
    return IMPORTANT_NEWS_RE.test(`${item.title} ${item.summary}`);
  }

  function normalizeNewsItem(rawItem, source) {
    const title = cleanText(rawItem?.title || rawItem?.name || '');
    const summary = truncateText(cleanText(rawItem?.description || rawItem?.content || rawItem?.summary || ''), 260);
    const link = normalizeLink(rawItem?.link || rawItem?.guid || '');
    const timestamp = parseTimestamp(rawItem?.pubDate || rawItem?.published || rawItem?.isoDate || rawItem?.date);
    if (!title || !link || !timestamp) return null;

    const item = {
      title,
      summary,
      link,
      source: source.name,
      timestamp
    };

    return {
      ...item,
      important: isImportantNews(item)
    };
  }

  function sortNews(items) {
    return [...items].sort((a, b) => b.timestamp - a.timestamp);
  }

  function dedupeNews(items) {
    const map = new Map();

    items.forEach((item) => {
      const key = (normalizeLink(item.link).toLowerCase() || `${item.source}:${item.title.toLowerCase()}`).trim();
      const existing = map.get(key);
      if (!existing || item.timestamp > existing.timestamp) {
        map.set(key, item);
      }
    });

    return sortNews([...map.values()]);
  }

  function formatAbsoluteDate(timestamp) {
    return new Intl.DateTimeFormat('ru-RU', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(timestamp));
  }

  function formatUpdatedAt(date) {
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  function formatRelativeDate(timestamp) {
    const diffMs = Date.now() - timestamp;
    const minutes = Math.max(0, Math.round(diffMs / 60000));

    if (minutes < 1) return 'только что';
    if (minutes < 60) return `${minutes} мин назад`;

    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} ч назад`;

    const days = Math.round(hours / 24);
    if (days < 30) return `${days} дн назад`;

    const months = Math.round(days / 30);
    return `${months} мес назад`;
  }

  function saveNewsCache() {
    try {
      localStorage.setItem(NEWS_CACHE_KEY, JSON.stringify({
        savedAt: Date.now(),
        updatedAt: lastLoadedAt ? lastLoadedAt.getTime() : null,
        items: allNews
      }));
    } catch (error) {}
  }

  function loadNewsCache() {
    try {
      const raw = localStorage.getItem(NEWS_CACHE_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.items)) return null;

      const items = parsed.items
        .map((item) => ({
          title: cleanText(item?.title || ''),
          summary: cleanText(item?.summary || ''),
          link: normalizeLink(item?.link || ''),
          source: cleanText(item?.source || ''),
          timestamp: Number(item?.timestamp) || 0,
          important: Boolean(item?.important)
        }))
        .filter((item) => item.title && item.link && item.source && item.timestamp);

      return {
        updatedAt: parsed.updatedAt ? new Date(parsed.updatedAt) : null,
        items: sortNews(items)
      };
    } catch (error) {
      return null;
    }
  }

  function updateSourceOptions() {
    const currentValue = newsSourceFilter.value || 'all';
    const availableSources = NEWS_SOURCES
      .map((source) => source.name)
      .filter((sourceName) => allNews.some((item) => item.source === sourceName));

    newsSourceFilter.replaceChildren();
    newsSourceFilter.add(new Option('Все источники', 'all'));

    availableSources.forEach((sourceName) => {
      newsSourceFilter.add(new Option(sourceName, sourceName));
    });

    newsSourceFilter.value = availableSources.includes(currentValue) || currentValue === 'all'
      ? currentValue
      : 'all';
  }

  function getFilteredNews() {
    const activeSource = newsSourceFilter.value || 'all';
    const searchQuery = newsSearchInput.value.trim().toLowerCase();
    const onlyImportant = newsImportantOnly.checked;

    return allNews.filter((item) => {
      if (activeSource !== 'all' && item.source !== activeSource) return false;
      if (onlyImportant && !item.important) return false;
      if (searchQuery) {
        const haystack = `${item.title} ${item.summary} ${item.source}`.toLowerCase();
        if (!haystack.includes(searchQuery)) return false;
      }
      return true;
    });
  }

  function createEmptyState(title, text) {
    const wrap = document.createElement('div');
    wrap.className = 'news-empty';

    const heading = document.createElement('strong');
    heading.textContent = title;

    const description = document.createElement('p');
    description.textContent = text;

    wrap.append(heading, description);
    return wrap;
  }

  function parseRssXml(text, source) {
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'text/xml');
    const parserError = xml.querySelector('parsererror');
    if (parserError) {
      throw new Error(`Не удалось разобрать RSS ${source.name}`);
    }

    return [...xml.querySelectorAll('item')]
      .map((itemNode) => normalizeNewsItem({
        title: itemNode.querySelector('title')?.textContent || '',
        description: itemNode.querySelector('description')?.textContent || '',
        link: itemNode.querySelector('link')?.textContent || '',
        pubDate: itemNode.querySelector('pubDate')?.textContent || ''
      }, source))
      .filter(Boolean);
  }

  function createNewsPill(text, className = '') {
    const pill = document.createElement('span');
    pill.className = `news-pill${className ? ` ${className}` : ''}`;
    pill.textContent = text;
    return pill;
  }

  function createNewsCard(item) {
    const card = document.createElement('article');
    card.className = `news-card${item.important ? ' important' : ''}`;

    const top = document.createElement('div');
    top.className = 'news-card-top';
    top.append(
      createNewsPill(item.source, 'source'),
      createNewsPill(formatRelativeDate(item.timestamp), 'time')
    );
    if (item.important) {
      top.append(createNewsPill('Важно', 'important'));
    }

    const title = document.createElement('a');
    title.className = 'news-title';
    title.href = item.link;
    title.target = '_blank';
    title.rel = 'noopener noreferrer';
    title.textContent = item.title;

    const summary = document.createElement('p');
    summary.className = 'news-desc';
    summary.textContent = item.summary || 'Краткое описание недоступно.';

    const footer = document.createElement('div');
    footer.className = 'news-card-footer';

    const date = document.createElement('span');
    date.className = 'news-date';
    date.textContent = formatAbsoluteDate(item.timestamp);

    const openLink = document.createElement('a');
    openLink.className = 'news-open-link';
    openLink.href = item.link;
    openLink.target = '_blank';
    openLink.rel = 'noopener noreferrer';
    openLink.textContent = 'Открыть источник';

    footer.append(date, openLink);
    card.append(top, title, summary, footer);

    return card;
  }

  function renderNews() {
    const filteredNews = getFilteredNews();

    newsList.replaceChildren();
    setMetrics(filteredNews);

    if (!allNews.length) {
      newsList.appendChild(createEmptyState(
        'Лента пока пуста',
        'Нажми «Обновить ленту», чтобы собрать новости из доступных источников.'
      ));
      setStatus('Новости ещё не загружены.', 'muted');
      return;
    }

    if (!filteredNews.length) {
      newsList.appendChild(createEmptyState(
        'Совпадений не найдено',
        'Попробуй сменить источник, убрать фильтр важных новостей или очистить поисковый запрос.'
      ));
      setStatus('По текущим фильтрам новостей не найдено.', 'muted');
      return;
    }

    const fragment = document.createDocumentFragment();
    filteredNews.forEach((item) => {
      fragment.appendChild(createNewsCard(item));
    });
    newsList.appendChild(fragment);

    const filtersApplied = newsSourceFilter.value !== 'all'
      || newsImportantOnly.checked
      || Boolean(newsSearchInput.value.trim());
    const importantCount = filteredNews.filter((item) => item.important).length;

    setStatus(
      filtersApplied
        ? `Показано ${filteredNews.length} материалов${importantCount ? `, важных: ${importantCount}` : ''}.`
        : `Загружено ${filteredNews.length} материалов из ${new Set(allNews.map((item) => item.source)).size} источников.`,
      'ready'
    );
  }

  async function fetchSourceNews(source) {
    const rss2jsonUrl = `${NEWS_FEED_PROXY_URL}${encodeURIComponent(source.rssUrl)}`;

    try {
      const response = await fetch(rss2jsonUrl, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`${source.name}: ${response.status}`);
      }

      const data = await response.json();
      const items = Array.isArray(data?.items) ? data.items : [];
      if (items.length) {
        return items
          .map((item) => normalizeNewsItem(item, source))
          .filter(Boolean);
      }
    } catch (error) {
      console.warn(`[news] rss2json недоступен для ${source.name}, пробую fallback RSS`, error);
    }

    const fallbackResponse = await fetch(`${NEWS_RSS_FALLBACK_PROXY_URL}${encodeURIComponent(source.rssUrl)}`, {
      cache: 'no-store'
    });
    if (!fallbackResponse.ok) {
      throw new Error(`${source.name}: fallback RSS ${fallbackResponse.status}`);
    }

    const rssText = await fallbackResponse.text();
    return parseRssXml(rssText, source);
  }

  async function loadAllNews({ force = false } = {}) {
    if (isLoading) return;

    isLoading = true;
    newsRefreshBtn.disabled = true;
    newsRefreshBtn.textContent = 'Обновление...';
    setError('');
    setStatus('Загружаю новости и очищаю дубли…', 'loading');

    const cached = loadNewsCache();

    if (!force && !allNews.length && cached?.items?.length) {
      allNews = cached.items;
      lastLoadedAt = cached.updatedAt;
      updateSourceOptions();
      renderNews();
      setStatus('Показываю сохранённую ленту, параллельно обновляю данные…', 'loading');
    }

    try {
      const results = await Promise.allSettled(NEWS_SOURCES.map((source) => fetchSourceNews(source)));
      const failedSources = [];
      const collectedItems = [];

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          collectedItems.push(...result.value);
        } else {
          failedSources.push(NEWS_SOURCES[index].name);
        }
      });

      const freshItems = dedupeNews(collectedItems)
        .filter((item) => Date.now() - item.timestamp <= NEWS_MAX_AGE_MS);

      if (freshItems.length) {
        allNews = freshItems;
        lastLoadedAt = new Date();
        hasLoadedOnce = true;
        updateSourceOptions();
        saveNewsCache();
        renderNews();
        setError(failedSources.length ? `Часть источников сейчас недоступна: ${failedSources.join(', ')}.` : '');
      } else if (cached?.items?.length) {
        allNews = cached.items;
        lastLoadedAt = cached.updatedAt;
        hasLoadedOnce = true;
        updateSourceOptions();
        renderNews();
        setError('Свежую ленту получить не удалось, поэтому показаны последние сохранённые материалы.');
        setStatus('Показаны сохранённые новости. Попробуй обновить позже.', 'muted');
      } else {
        allNews = [];
        updateSourceOptions();
        renderNews();
        setError(failedSources.length
          ? `Не удалось получить новости из источников: ${failedSources.join(', ')}.`
          : 'Источники не вернули ни одной новости.');
      }
    } catch (error) {
      if (cached?.items?.length) {
        allNews = cached.items;
        lastLoadedAt = cached.updatedAt;
        hasLoadedOnce = true;
        updateSourceOptions();
        renderNews();
        setError('Ошибка обновления ленты. Показаны последние сохранённые новости.');
      } else {
        allNews = [];
        updateSourceOptions();
        renderNews();
        setError(`Ошибка загрузки новостей: ${error.message || error}`);
      }
    } finally {
      isLoading = false;
      newsRefreshBtn.disabled = false;
      newsRefreshBtn.textContent = 'Обновить ленту';
    }
  }

  function maybeRefreshNews() {
    const isStale = !lastLoadedAt || (Date.now() - lastLoadedAt.getTime() > NEWS_AUTO_REFRESH_MS);
    if (!hasLoadedOnce || isStale) {
      loadAllNews();
    } else {
      renderNews();
    }
  }

  newsSourceFilter.addEventListener('change', renderNews);
  newsSearchInput.addEventListener('input', renderNews);
  newsImportantOnly.addEventListener('change', renderNews);
  newsRefreshBtn.addEventListener('click', () => loadAllNews({ force: true }));

  document.addEventListener('app:tab-changed', (event) => {
    if (event.detail?.tabId === 'news') {
      maybeRefreshNews();
    }
  });

  if (tabContent.classList.contains('active')) {
    maybeRefreshNews();
  }
})();

// === Вкладка "Ликвидации" ===
(function() {
  const tabContent = document.getElementById('liquidations-tab');
  if (!tabContent) return;

  const symbolSelect = document.getElementById('liquidationSymbolSelect');
  const windowSelect = document.getElementById('liquidationWindowSelect');
  const refreshBtn = document.getElementById('liquidationRefreshBtn');
  const eventsCountEl = document.getElementById('liquidationEventsCount');
  const totalBreakdownEl = document.getElementById('liquidationTotalBreakdown');
  const longValueEl = document.getElementById('liquidationLongValue');
  const shortValueEl = document.getElementById('liquidationShortValue');
  const openInterestEl = document.getElementById('liquidationOpenInterest');
  const openInterestBreakdownEl = document.getElementById('liquidationOpenInterestBreakdown');
  const longShortRatioEl = document.getElementById('liquidationLongShortRatio');
  const longShortBreakdownEl = document.getElementById('liquidationLongShortBreakdown');
  const fundingRateEl = document.getElementById('liquidationFundingRate');
  const fundingBreakdownEl = document.getElementById('liquidationFundingBreakdown');
  const takerRatioEl = document.getElementById('liquidationTakerRatio');
  const takerBreakdownEl = document.getElementById('liquidationTakerBreakdown');
  const dominantSideEl = document.getElementById('liquidationDominantSide');
  const sourceStatusEl = document.getElementById('liquidationSourceStatus');
  const updatedAtEl = document.getElementById('liquidationUpdatedAt');
  const errorEl = document.getElementById('liquidationError');
  const statusEl = document.getElementById('liquidationStatus');
  const feedBody = document.getElementById('liquidationFeedBody');
  const moneyGridEl = document.getElementById('liquidationMoneyGrid');
  const exchangeGridEl = document.getElementById('liquidationExchangeGrid');
  const metricHelpButtons = [...tabContent.querySelectorAll('.liquidation-metric-help')];
  if (
    !symbolSelect ||
    !windowSelect ||
    !refreshBtn ||
    !eventsCountEl ||
    !totalBreakdownEl ||
    !longValueEl ||
    !shortValueEl ||
    !openInterestEl ||
    !openInterestBreakdownEl ||
    !longShortRatioEl ||
    !longShortBreakdownEl ||
    !fundingRateEl ||
    !fundingBreakdownEl ||
    !takerRatioEl ||
    !takerBreakdownEl ||
    !dominantSideEl ||
    !sourceStatusEl ||
    !updatedAtEl ||
    !errorEl ||
    !statusEl ||
    !feedBody ||
    !moneyGridEl ||
    !exchangeGridEl
  ) return;

  const LIQUIDATION_SETTINGS_KEY = 'liquidation_widget_settings_v1';
  const LIQUIDATION_CACHE_KEY = 'liquidation_widget_events_v1';
  const MAX_LIQUIDATION_EVENTS = 6000;
  const SNAPSHOT_REFRESH_MS = 60 * 1000;
  const LIQUIDATION_MONEY_WINDOWS = [
    { label: '5м', minutes: 5 },
    { label: '15м', minutes: 15 },
    { label: '1ч', minutes: 60 },
    { label: '4ч', minutes: 240 },
    { label: '24ч', minutes: 1440 }
  ];
  const BINANCE_FUTURES_BASES = [
    'https://fapi.binance.com',
    'https://fapi1.binance.com',
    'https://fapi2.binance.com'
  ];
  const BINANCE_LIQUIDATION_WS_URL = 'wss://fstream.binance.com/ws/!forceOrder@arr';
  const BYBIT_LIQUIDATION_WS_URL = 'wss://stream.bybit.com/v5/public/linear';
  const BYBIT_API_BASE = 'https://api.bybit.com';
  const EXCHANGE_ORDER = ['Aggregated', 'Binance', 'Bybit'];
  const SUPPORTED_SYMBOLS = new Set([...symbolSelect.options].map((option) => option.value));

  let selectedSymbol = symbolSelect.value || 'ETHUSDT';
  let selectedWindowMinutes = Number(windowSelect.value) || 60;
  let liquidationEvents = loadLiquidationEvents();
  let snapshotState = createEmptySnapshotState();
  let isInitialized = false;
  let snapshotRequestId = 0;
  let binanceWs = null;
  let bybitWs = null;
  let snapshotIntervalId = null;
  let binanceReconnectTimer = null;
  let bybitReconnectTimer = null;
  let lastStatusTone = 'neutral';
  let sourceStates = {
    binance: { state: 'idle', message: 'ожидание' },
    bybit: { state: 'idle', message: 'ожидание' }
  };

  function createEmptySnapshotState() {
    return {
      openInterestBinanceUsd: null,
      openInterestBybitUsd: null,
      openInterestUsd: null,
      longShortRatioPosition: null,
      longShortRatioAccount: null,
      longAccount: null,
      shortAccount: null,
      fundingBinance: null,
      fundingBybit: null,
      fundingAverage: null,
      takerBuySellRatio: null,
      takerBuyVol: null,
      takerSellVol: null,
      updatedAt: null
    };
  }

  function closeMetricTooltips() {
    metricHelpButtons.forEach((button) => {
      button.setAttribute('aria-expanded', 'false');
      const tooltip = button.parentElement?.querySelector('.liquidation-metric-tooltip');
      if (tooltip) {
        tooltip.hidden = true;
      }
    });
  }

  function toggleMetricTooltip(button) {
    const tooltip = button?.parentElement?.querySelector('.liquidation-metric-tooltip');
    if (!button || !tooltip) return;

    const willOpen = button.getAttribute('aria-expanded') !== 'true';
    closeMetricTooltips();
    button.setAttribute('aria-expanded', String(willOpen));
    tooltip.hidden = !willOpen;
  }

  function setStatus(message, tone = 'neutral') {
    statusEl.textContent = message;
    statusEl.dataset.tone = tone;
    lastStatusTone = tone;
  }

  function setError(message = '') {
    errorEl.hidden = !message;
    errorEl.textContent = message;
  }

  function saveSettings() {
    try {
      localStorage.setItem(LIQUIDATION_SETTINGS_KEY, JSON.stringify({
        symbol: selectedSymbol,
        windowMinutes: selectedWindowMinutes
      }));
    } catch (error) {}
  }

  function restoreSettings() {
    try {
      const raw = localStorage.getItem(LIQUIDATION_SETTINGS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.symbol && SUPPORTED_SYMBOLS.has(parsed.symbol)) {
        selectedSymbol = parsed.symbol;
      }
      if (Number(parsed?.windowMinutes) > 0) {
        selectedWindowMinutes = Number(parsed.windowMinutes);
      }
    } catch (error) {}
  }

  function saveLiquidationEvents() {
    try {
      localStorage.setItem(LIQUIDATION_CACHE_KEY, JSON.stringify({
        savedAt: Date.now(),
        items: liquidationEvents.slice(0, MAX_LIQUIDATION_EVENTS)
      }));
    } catch (error) {}
  }

  function loadLiquidationEvents() {
    try {
      const raw = localStorage.getItem(LIQUIDATION_CACHE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed?.items) ? parsed.items : [];
      return items
        .map((item) => ({
          id: String(item?.id || ''),
          source: String(item?.source || ''),
          symbol: String(item?.symbol || ''),
          liquidationSide: item?.liquidationSide === 'short' ? 'short' : 'long',
          price: Number(item?.price) || 0,
          size: Number(item?.size) || 0,
          usdValue: Number(item?.usdValue) || 0,
          timestamp: Number(item?.timestamp) || 0
        }))
        .filter((item) => item.id && item.symbol && item.timestamp > 0);
    } catch (error) {
      return [];
    }
  }

  function updateSourcePill(sourceKey, message, state = 'idle') {
    const pill = sourceStatusEl.querySelector(`[data-source="${sourceKey}"]`);
    if (!pill) return;
    sourceStates[sourceKey] = { state, message };
    pill.dataset.state = state;
    const labelMap = {
      binance: 'Binance',
      bybit: 'Bybit'
    };
    const label = labelMap[sourceKey] || sourceKey;
    pill.textContent = `${label}: ${message}`;
  }

  function renderSourcePillSummary() {
    const labelMap = {
      binance: 'Binance',
      bybit: 'Bybit'
    };
    const currentWindowEvents = getFilteredLiquidationEvents();

    Object.entries(sourceStates).forEach(([sourceKey, meta]) => {
      const pill = sourceStatusEl.querySelector(`[data-source="${sourceKey}"]`);
      if (!pill) return;
      const label = labelMap[sourceKey] || sourceKey;
      const count = currentWindowEvents.filter((item) => item.source === label).length;
      let suffix = '';

      if (meta.state === 'live') {
        suffix = count > 0 ? ` • ${count} в окне` : ' • 0 в окне';
      }

      pill.dataset.state = meta.state;
      pill.textContent = `${label}: ${meta.message}${suffix}`;
    });
  }

  function formatUpdatedAt(date) {
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  }

  function formatUsd(value) {
    const amount = Number(value) || 0;
    if (!Number.isFinite(amount)) return '-';
    if (Math.abs(amount) >= 1e9) return `${(amount / 1e9).toFixed(2)}B $`;
    if (Math.abs(amount) >= 1e6) return `${(amount / 1e6).toFixed(2)}M $`;
    if (Math.abs(amount) >= 1e3) return `${(amount / 1e3).toFixed(2)}K $`;
    return `${amount.toFixed(2)} $`;
  }

  function formatPrice(value) {
    const price = Number(value);
    if (!Number.isFinite(price) || price <= 0) return '-';
    if (price >= 100) return `${price.toFixed(2)} $`;
    if (price >= 1) return `${price.toFixed(3)} $`;
    return `${price.toFixed(4)} $`;
  }

  function formatSize(value) {
    const size = Number(value);
    if (!Number.isFinite(size) || size <= 0) return '-';
    if (size >= 1000) return size.toFixed(0);
    if (size >= 10) return size.toFixed(2);
    return size.toFixed(4);
  }

  function formatEventTime(timestamp) {
    return new Intl.DateTimeFormat('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(new Date(timestamp));
  }

  function formatSourceValue(label, value) {
    return `${label}: ${Number.isFinite(value) ? formatUsd(value) : '-'}`;
  }

  function formatRatio(value) {
    return Number.isFinite(value) ? value.toFixed(2) : '-';
  }

  function formatPercent(value, digits = 4) {
    return Number.isFinite(value) ? `${value.toFixed(digits)}%` : '-';
  }

  function buildEventId(source, symbol, timestamp, price, size, side) {
    return `${source}_${symbol}_${timestamp}_${price}_${size}_${side}`;
  }

  function getLiquidationLabel(symbol) {
    const option = [...symbolSelect.options].find((item) => item.value === symbol);
    return option?.textContent?.trim() || symbol;
  }

  function normalizeBinanceLiquidation(message) {
    const order = message?.o;
    const symbol = order?.s;
    if (!symbol || !SUPPORTED_SYMBOLS.has(symbol)) return null;
    const side = order?.S;
    const liquidationSide = side === 'SELL' ? 'long' : side === 'BUY' ? 'short' : null;
    const price = Number(order?.ap || order?.p);
    const size = Number(order?.z || order?.l || order?.q);
    const timestamp = Number(order?.T || message?.E || Date.now());
    if (!liquidationSide || !Number.isFinite(price) || !Number.isFinite(size) || size <= 0) return null;

    return {
      id: buildEventId('binance', symbol, timestamp, price, size, liquidationSide),
      source: 'Binance',
      symbol,
      liquidationSide,
      price,
      size,
      usdValue: price * size,
      timestamp
    };
  }

  function normalizeBybitLiquidation(item) {
    const symbol = item?.s || item?.symbol;
    if (!symbol || !SUPPORTED_SYMBOLS.has(symbol)) return null;
    const side = item?.S || item?.side;
    const liquidationSide = side === 'Buy' ? 'long' : side === 'Sell' ? 'short' : null;
    const price = Number(item?.p || item?.price);
    const size = Number(item?.v || item?.qty || item?.size);
    const timestamp = Number(item?.T || item?.updatedTime || item?.ts || Date.now());
    if (!liquidationSide || !Number.isFinite(price) || !Number.isFinite(size) || size <= 0) return null;

    return {
      id: buildEventId('bybit', symbol, timestamp, price, size, liquidationSide),
      source: 'Bybit',
      symbol,
      liquidationSide,
      price,
      size,
      usdValue: price * size,
      timestamp
    };
  }

  function pushLiquidationEvents(items) {
    if (!Array.isArray(items) || !items.length) return;

    const nextEvents = [...liquidationEvents];
    const existingIds = new Set(nextEvents.map((item) => item.id));
    let hasChanges = false;

    items.forEach((item) => {
      if (!item || existingIds.has(item.id)) return;
      nextEvents.unshift(item);
      existingIds.add(item.id);
      hasChanges = true;
    });

    if (!hasChanges) return;

    liquidationEvents = nextEvents
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, MAX_LIQUIDATION_EVENTS);
    saveLiquidationEvents();
    renderLiquidationWidget();
  }

  function getFilteredLiquidationEvents() {
    const windowMs = selectedWindowMinutes * 60 * 1000;
    const cutoff = Date.now() - windowMs;
    return liquidationEvents.filter((item) => item.symbol === selectedSymbol && item.timestamp >= cutoff);
  }

  function getSymbolLiquidationEvents(windowMinutes) {
    const windowMs = windowMinutes * 60 * 1000;
    const cutoff = Date.now() - windowMs;
    return liquidationEvents.filter((item) => item.symbol === selectedSymbol && item.timestamp >= cutoff);
  }

  function summarizeLiquidationEvents(events) {
    const longUsd = events
      .filter((item) => item.liquidationSide === 'long')
      .reduce((sum, item) => sum + item.usdValue, 0);
    const shortUsd = events
      .filter((item) => item.liquidationSide === 'short')
      .reduce((sum, item) => sum + item.usdValue, 0);
    const largestEvent = events.reduce((maxItem, item) => {
      if (!maxItem || item.usdValue > maxItem.usdValue) return item;
      return maxItem;
    }, null);

    return {
      count: events.length,
      longUsd,
      shortUsd,
      totalUsd: longUsd + shortUsd,
      largestEvent
    };
  }

  function summarizeByExchange(events) {
    const exchangeSummaries = new Map();
    EXCHANGE_ORDER.forEach((name) => {
      if (name !== 'Aggregated') {
        exchangeSummaries.set(name, summarizeLiquidationEvents(events.filter((item) => item.source === name)));
      }
    });
    exchangeSummaries.set('Aggregated', summarizeLiquidationEvents(events));
    return exchangeSummaries;
  }

  function renderMoneyBreakdown() {
    moneyGridEl.replaceChildren();

    const fragment = document.createDocumentFragment();
    LIQUIDATION_MONEY_WINDOWS.forEach((windowConfig) => {
      const summary = summarizeLiquidationEvents(getSymbolLiquidationEvents(windowConfig.minutes));
      const card = document.createElement('article');
      card.className = 'liquidation-money-card';
      card.innerHTML = `
        <div class="liquidation-money-topline">
          <span class="liquidation-money-window">${windowConfig.label}</span>
          <span class="liquidation-money-count">${summary.count} событ.</span>
        </div>
        <strong class="liquidation-money-total">${formatUsd(summary.totalUsd)}</strong>
        <div class="liquidation-money-rows">
          <div class="liquidation-money-row">
            <span>LONG</span>
            <strong class="long">${formatUsd(summary.longUsd)}</strong>
          </div>
          <div class="liquidation-money-row">
            <span>SHORT</span>
            <strong class="short">${formatUsd(summary.shortUsd)}</strong>
          </div>
          <div class="liquidation-money-row">
            <span>Крупнейшая</span>
            <strong>${summary.largestEvent ? formatUsd(summary.largestEvent.usdValue) : '-'}</strong>
          </div>
        </div>
      `;
      fragment.appendChild(card);
    });

    moneyGridEl.appendChild(fragment);
  }

  function renderExchangeBreakdown(events) {
    exchangeGridEl.replaceChildren();

    const fragment = document.createDocumentFragment();
    const exchangeSummaries = summarizeByExchange(events);

    EXCHANGE_ORDER.forEach((exchangeName) => {
      const summary = exchangeSummaries.get(exchangeName);
      const card = document.createElement('article');
      card.className = `liquidation-exchange-card${exchangeName === 'Aggregated' ? ' aggregated' : ''}`;
      const countLabel = `${summary.count} событ.`;
      card.innerHTML = `
        <div class="liquidation-money-topline">
          <span class="liquidation-money-window">${exchangeName}</span>
          <span class="liquidation-money-count">${countLabel}</span>
        </div>
        <strong class="liquidation-money-total">${formatUsd(summary.totalUsd)}</strong>
        <div class="liquidation-money-rows">
          <div class="liquidation-money-row">
            <span>LONG</span>
            <strong class="long">${formatUsd(summary.longUsd)}</strong>
          </div>
          <div class="liquidation-money-row">
            <span>SHORT</span>
            <strong class="short">${formatUsd(summary.shortUsd)}</strong>
          </div>
          <div class="liquidation-money-row">
            <span>Крупнейшая</span>
            <strong>${summary.largestEvent ? formatUsd(summary.largestEvent.usdValue) : '-'}</strong>
          </div>
        </div>
      `;
      fragment.appendChild(card);
    });

    exchangeGridEl.appendChild(fragment);
  }

  function renderFeed(events) {
    feedBody.replaceChildren();

    if (!events.length) {
      const row = document.createElement('tr');
      row.innerHTML = `<td colspan="7" class="liquidation-empty">Пока нет событий по ${getLiquidationLabel(selectedSymbol)} в выбранном окне. Как только придут новые ликвидации, они появятся здесь автоматически.</td>`;
      feedBody.appendChild(row);
      return;
    }

    const fragment = document.createDocumentFragment();
    events.slice(0, 40).forEach((item) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${formatEventTime(item.timestamp)}</td>
        <td><span class="liquidation-source-badge">${item.source}</span></td>
        <td>${item.symbol.replace('USDT', '')}</td>
        <td><span class="liquidation-side-pill ${item.liquidationSide}">${item.liquidationSide === 'long' ? 'LONG' : 'SHORT'}</span></td>
        <td>${formatPrice(item.price)}</td>
        <td>${formatSize(item.size)}</td>
        <td>${formatUsd(item.usdValue)}</td>
      `;
      fragment.appendChild(row);
    });
    feedBody.appendChild(fragment);
  }

  function renderLiquidationWidget() {
    const filteredEvents = getFilteredLiquidationEvents();
    const summary = summarizeLiquidationEvents(filteredEvents);

    eventsCountEl.textContent = formatUsd(summary.totalUsd);
    totalBreakdownEl.textContent = `Событий: ${summary.count} • Крупнейшая: ${summary.largestEvent ? formatUsd(summary.largestEvent.usdValue) : '-'}`;
    const longLiquidations = summary.longUsd;
    const shortLiquidations = summary.shortUsd;
    longValueEl.textContent = formatUsd(longLiquidations);
    shortValueEl.textContent = formatUsd(shortLiquidations);
    openInterestEl.textContent = snapshotState.openInterestUsd ? formatUsd(snapshotState.openInterestUsd) : '-';
    openInterestBreakdownEl.textContent = [
      formatSourceValue('Binance', snapshotState.openInterestBinanceUsd),
      formatSourceValue('Bybit', snapshotState.openInterestBybitUsd)
    ].join(' • ');
    longShortRatioEl.textContent = formatRatio(snapshotState.longShortRatioPosition);
    longShortBreakdownEl.textContent = [
      `Позиции: ${formatRatio(snapshotState.longShortRatioPosition)}`,
      `Аккаунты: ${formatRatio(snapshotState.longShortRatioAccount)}`
    ].join(' • ');
    fundingRateEl.textContent = formatPercent(snapshotState.fundingAverage);
    fundingBreakdownEl.textContent = [
      `Binance: ${formatPercent(snapshotState.fundingBinance)}`,
      `Bybit: ${formatPercent(snapshotState.fundingBybit)}`
    ].join(' • ');
    takerRatioEl.textContent = formatRatio(snapshotState.takerBuySellRatio);
    takerBreakdownEl.textContent = [
      `Buy: ${formatSize(snapshotState.takerBuyVol)}`,
      `Sell: ${formatSize(snapshotState.takerSellVol)}`
    ].join(' • ');

    if (longLiquidations > shortLiquidations) {
      dominantSideEl.textContent = 'LONG';
      dominantSideEl.style.color = '#dc2626';
    } else if (shortLiquidations > longLiquidations) {
      dominantSideEl.textContent = 'SHORT';
      dominantSideEl.style.color = '#2563eb';
    } else {
      dominantSideEl.textContent = '-';
      dominantSideEl.style.color = '';
    }

    if (summary.count === 0) {
      setStatus(`По ${getLiquidationLabel(selectedSymbol)} пока нет ликвидаций в окне ${selectedWindowMinutes} мин. Потоки подключены и ждут новые события.`, 'ready');
    }

    updatedAtEl.textContent = snapshotState.updatedAt
      ? `Обновление: ${formatUpdatedAt(snapshotState.updatedAt)}`
      : 'Обновление: -';

    renderSourcePillSummary();
    renderMoneyBreakdown();
    renderExchangeBreakdown(filteredEvents);
    renderFeed(filteredEvents);
    syncHomeInsights();
  }

  async function fetchBinanceFuturesJson(path) {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const errors = [];

    for (const baseUrl of BINANCE_FUTURES_BASES) {
      try {
        const response = await fetchWithTimeout(`${baseUrl}${normalizedPath}`, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      } catch (error) {
        errors.push(`${baseUrl}: ${error.message || error}`);
      }
    }

    throw new Error(`Futures API недоступен. ${errors.join(' | ')}`);
  }

  async function fetchBybitPublicJson(path) {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const response = await fetchWithTimeout(`${BYBIT_API_BASE}${normalizedPath}`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    if (Number(payload?.retCode) !== 0) {
      throw new Error(payload?.retMsg || 'Bybit API error');
    }
    return payload;
  }

  async function loadBinanceSnapshot(symbol) {
    const [openInterestResult, premiumIndexResult, topRatioPositionResult, topRatioAccountResult, takerRatioResult] = await Promise.all([
      fetchBinanceFuturesJson(`/fapi/v1/openInterest?symbol=${symbol}`),
      fetchBinanceFuturesJson(`/fapi/v1/premiumIndex?symbol=${symbol}`),
      fetchBinanceFuturesJson(`/futures/data/topLongShortPositionRatio?symbol=${symbol}&period=5m&limit=1`),
      fetchBinanceFuturesJson(`/futures/data/topLongShortAccountRatio?symbol=${symbol}&period=5m&limit=1`),
      fetchBinanceFuturesJson(`/futures/data/takerlongshortRatio?symbol=${symbol}&period=5m&limit=1`)
    ]);

    const openInterest = Number(openInterestResult?.openInterest);
    const markPrice = Number(premiumIndexResult?.markPrice);
    const topRatioPosition = Array.isArray(topRatioPositionResult) ? topRatioPositionResult[0] : null;
    const topRatioAccount = Array.isArray(topRatioAccountResult) ? topRatioAccountResult[0] : null;
    const takerRatio = Array.isArray(takerRatioResult) ? takerRatioResult[0] : null;

    return {
      openInterestBinanceUsd: Number.isFinite(openInterest) && Number.isFinite(markPrice)
        ? openInterest * markPrice
        : null,
      longShortRatioPosition: Number(topRatioPosition?.longShortRatio),
      longShortRatioAccount: Number(topRatioAccount?.longShortRatio),
      longAccount: Number(topRatioAccount?.longAccount),
      shortAccount: Number(topRatioAccount?.shortAccount),
      fundingBinance: Number(premiumIndexResult?.lastFundingRate) * 100,
      takerBuySellRatio: Number(takerRatio?.buySellRatio),
      takerBuyVol: Number(takerRatio?.buyVol),
      takerSellVol: Number(takerRatio?.sellVol)
    };
  }

  async function loadBybitSnapshot(symbol) {
    const [openInterestResult, tickerResult] = await Promise.all([
      fetchBybitPublicJson(`/v5/market/open-interest?category=linear&symbol=${symbol}&intervalTime=5min&limit=1`),
      fetchBybitPublicJson(`/v5/market/tickers?category=linear&symbol=${symbol}`)
    ]);

    const oiRow = Array.isArray(openInterestResult?.result?.list) ? openInterestResult.result.list[0] : null;
    const tickerRow = Array.isArray(tickerResult?.result?.list) ? tickerResult.result.list[0] : null;
    const bybitOpenInterest = Number(oiRow?.openInterest);
    const bybitPrice = Number(tickerRow?.markPrice || tickerRow?.lastPrice || tickerRow?.indexPrice);

    return {
      openInterestBybitUsd: Number.isFinite(bybitOpenInterest) && Number.isFinite(bybitPrice)
        ? bybitOpenInterest * bybitPrice
        : null,
      fundingBybit: Number(tickerRow?.fundingRate) * 100
    };
  }

  async function loadSnapshots(symbol = selectedSymbol) {
    const requestId = ++snapshotRequestId;
    const nextSnapshotState = createEmptySnapshotState();

    const [binanceResult, bybitResult] = await Promise.allSettled([
      loadBinanceSnapshot(symbol),
      loadBybitSnapshot(symbol)
    ]);

    const snapshotErrors = [];
    if (binanceResult.status === 'fulfilled' && binanceResult.value) {
      Object.assign(nextSnapshotState, binanceResult.value);
    }
    if (binanceResult.status === 'rejected') {
      console.error('[liquidations] binance snapshot error', binanceResult.reason);
      snapshotErrors.push(`Binance: ${binanceResult.reason?.message || binanceResult.reason}`);
    }

    if (bybitResult.status === 'fulfilled' && bybitResult.value) {
      Object.assign(nextSnapshotState, bybitResult.value);
    }
    if (bybitResult.status === 'rejected') {
      console.error('[liquidations] bybit snapshot error', bybitResult.reason);
      snapshotErrors.push(`Bybit: ${bybitResult.reason?.message || bybitResult.reason}`);
    }

    const hasOpenInterest = Number.isFinite(nextSnapshotState.openInterestBinanceUsd) || Number.isFinite(nextSnapshotState.openInterestBybitUsd);
    nextSnapshotState.openInterestUsd = (Number.isFinite(nextSnapshotState.openInterestBinanceUsd) ? nextSnapshotState.openInterestBinanceUsd : 0)
      + (Number.isFinite(nextSnapshotState.openInterestBybitUsd) ? nextSnapshotState.openInterestBybitUsd : 0);
    if (!hasOpenInterest) {
      nextSnapshotState.openInterestUsd = null;
    }

    const availableFundingRates = [nextSnapshotState.fundingBinance, nextSnapshotState.fundingBybit].filter((value) => Number.isFinite(value));
    nextSnapshotState.fundingAverage = availableFundingRates.length
      ? availableFundingRates.reduce((sum, value) => sum + value, 0) / availableFundingRates.length
      : null;
    nextSnapshotState.updatedAt = new Date();

    if (requestId !== snapshotRequestId || symbol !== selectedSymbol) {
      return;
    }

    snapshotState = nextSnapshotState;

    if (snapshotErrors.length) {
      setError(`Часть данных не обновилась. ${snapshotErrors.join(' | ')}`);
    } else {
      setError('');
    }

    setStatus(`Живой поток ликвидаций по ${getLiquidationLabel(symbol)} запущен. Сводка собирается из Binance и Bybit.`, 'ready');

    renderLiquidationWidget();
  }

  function scheduleBinanceReconnect() {
    if (!tabContent.classList.contains('active')) return;
    if (binanceReconnectTimer) clearTimeout(binanceReconnectTimer);
    binanceReconnectTimer = setTimeout(() => {
      connectBinanceLiquidations();
    }, 4000);
  }

  function scheduleBybitReconnect() {
    if (!tabContent.classList.contains('active')) return;
    if (bybitReconnectTimer) clearTimeout(bybitReconnectTimer);
    bybitReconnectTimer = setTimeout(() => {
      connectBybitLiquidations();
    }, 5000);
  }

  function connectBinanceLiquidations() {
    if (binanceWs) {
      binanceWs.onopen = null;
      binanceWs.onclose = null;
      binanceWs.onerror = null;
      binanceWs.onmessage = null;
      binanceWs.close();
    }

    updateSourcePill('binance', 'подключение…');
    try {
      binanceWs = new WebSocket(BINANCE_LIQUIDATION_WS_URL);
    } catch (error) {
      sourceStates.binance = 'error';
      updateSourcePill('binance', 'ошибка', 'error');
      scheduleBinanceReconnect();
      return;
    }

    binanceWs.onopen = () => {
      sourceStates.binance = 'live';
      updateSourcePill('binance', 'live', 'live');
    };

    binanceWs.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const messages = Array.isArray(payload) ? payload : [payload];
        pushLiquidationEvents(messages.map(normalizeBinanceLiquidation).filter(Boolean));
      } catch (error) {
        console.error('[liquidations] binance parse error', error);
      }
    };

    binanceWs.onerror = () => {
      sourceStates.binance = 'error';
      updateSourcePill('binance', 'ошибка', 'error');
    };

    binanceWs.onclose = () => {
      sourceStates.binance = 'error';
      updateSourcePill('binance', 'переподключение', 'error');
      scheduleBinanceReconnect();
    };
  }

  function connectBybitLiquidations() {
    if (bybitWs) {
      bybitWs.onopen = null;
      bybitWs.onclose = null;
      bybitWs.onerror = null;
      bybitWs.onmessage = null;
      bybitWs.close();
    }

    updateSourcePill('bybit', `подписка на ${selectedSymbol}…`);
    try {
      bybitWs = new WebSocket(BYBIT_LIQUIDATION_WS_URL);
    } catch (error) {
      sourceStates.bybit = 'error';
      updateSourcePill('bybit', 'ошибка', 'error');
      scheduleBybitReconnect();
      return;
    }

    bybitWs.onopen = () => {
      sourceStates.bybit = 'live';
      updateSourcePill('bybit', `${selectedSymbol.replace('USDT', '')} live`, 'live');
      bybitWs.send(JSON.stringify({
        op: 'subscribe',
        args: [`allLiquidation.${selectedSymbol}`]
      }));
    };

    bybitWs.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.success === false) {
          throw new Error(payload?.ret_msg || 'Bybit subscribe error');
        }
        const items = Array.isArray(payload?.data) ? payload.data : [];
        if (!items.length) return;
        pushLiquidationEvents(items.map(normalizeBybitLiquidation).filter(Boolean));
      } catch (error) {
        console.error('[liquidations] bybit parse error', error);
      }
    };

    bybitWs.onerror = () => {
      sourceStates.bybit = 'error';
      updateSourcePill('bybit', 'ошибка', 'error');
    };

    bybitWs.onclose = () => {
      sourceStates.bybit = 'error';
      updateSourcePill('bybit', 'переподключение', 'error');
      scheduleBybitReconnect();
    };
  }

  function restartLiveConnections() {
    connectBinanceLiquidations();
    connectBybitLiquidations();
  }

  function startLiveConnections() {
    restartLiveConnections();
    if (snapshotIntervalId) clearInterval(snapshotIntervalId);
    snapshotIntervalId = setInterval(loadSnapshots, SNAPSHOT_REFRESH_MS);
  }

  function stopLiveConnections() {
    if (snapshotIntervalId) {
      clearInterval(snapshotIntervalId);
      snapshotIntervalId = null;
    }
    if (binanceReconnectTimer) {
      clearTimeout(binanceReconnectTimer);
      binanceReconnectTimer = null;
    }
    if (bybitReconnectTimer) {
      clearTimeout(bybitReconnectTimer);
      bybitReconnectTimer = null;
    }
    if (binanceWs) {
      binanceWs.onopen = null;
      binanceWs.onclose = null;
      binanceWs.onerror = null;
      binanceWs.onmessage = null;
      binanceWs.close();
      binanceWs = null;
    }
    if (bybitWs) {
      bybitWs.onopen = null;
      bybitWs.onclose = null;
      bybitWs.onerror = null;
      bybitWs.onmessage = null;
      bybitWs.close();
      bybitWs = null;
    }
    updateSourcePill('binance', 'пауза', 'idle');
    updateSourcePill('bybit', 'пауза', 'idle');
  }

  function initializeLiquidations() {
    if (isInitialized) return;
    isInitialized = true;

    restoreSettings();
    symbolSelect.value = selectedSymbol;
    windowSelect.value = String(selectedWindowMinutes);
    renderLiquidationWidget();
    setStatus('Запускаю Binance и Bybit, готовлю сводку ликвидаций…', 'loading');

    startLiveConnections();
    loadSnapshots();
  }

  symbolSelect.addEventListener('change', () => {
    selectedSymbol = symbolSelect.value;
    saveSettings();
    setError('');
    setStatus(`Переключаю ликвидации на ${getLiquidationLabel(selectedSymbol)}…`, 'loading');
    connectBybitLiquidations();
    loadSnapshots();
    renderLiquidationWidget();
  });

  windowSelect.addEventListener('change', () => {
    selectedWindowMinutes = Number(windowSelect.value) || 60;
    saveSettings();
    renderLiquidationWidget();
    setStatus(`Показываю ликвидации по ${getLiquidationLabel(selectedSymbol)} за последние ${selectedWindowMinutes} мин.`, 'ready');
  });

  refreshBtn.addEventListener('click', () => {
    setError('');
    setStatus(`Обновляю OI, L/S ratio и переподключаю источник ${selectedSymbol}…`, 'loading');
    connectBybitLiquidations();
    loadSnapshots();
    renderLiquidationWidget();
  });

  metricHelpButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleMetricTooltip(button);
    });
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.liquidation-metric-card')) {
      closeMetricTooltips();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMetricTooltips();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopLiveConnections();
      return;
    }
    if (tabContent.classList.contains('active') && isInitialized) {
      startLiveConnections();
      loadSnapshots();
    }
  });

  window.addEventListener('beforeunload', () => {
    stopLiveConnections();
  });

  document.addEventListener('app:tab-changed', (event) => {
    if (event.detail?.tabId === 'liquidations') {
      if (!isInitialized) {
        initializeLiquidations();
      } else {
        startLiveConnections();
        loadSnapshots();
        renderLiquidationWidget();
      }
    } else {
      stopLiveConnections();
      closeMetricTooltips();
    }
  });

  if (tabContent.classList.contains('active')) {
    initializeLiquidations();
  }
})();

// === Вкладка "Аналитика" ===
(function() {
  const tabContent = document.getElementById('analytics-tab');
  if (!tabContent) return;
  const symbolSelect = document.getElementById('analyticsSymbolSelect');
  const horizonSelect = document.getElementById('analyticsHorizonSelect');
  const refreshBtn = document.getElementById('analyticsRefreshBtn');
  const snapshotRefreshBtn = document.getElementById('analyticsSnapshotRefreshBtn');
  const statusEl = document.getElementById('analyticsStatus');
  const errorEl = document.getElementById('analyticsError');
  const updatedAtEl = document.getElementById('analyticsUpdatedAt');
  const scenarioEl = document.getElementById('analyticsScenarioValue');
  const scenarioHintEl = document.getElementById('analyticsScenarioHint');
  const scoreEl = document.getElementById('analyticsScoreValue');
  const riskEl = document.getElementById('analyticsRiskValue');
  const probabilitiesEl = document.getElementById('analyticsProbabilitiesValue');
  const dominantPathEl = document.getElementById('analyticsDominantPath');
  const reasonsListEl = document.getElementById('analyticsReasonsList');
  const supportEl = document.getElementById('analyticsSupportValue');
  const resistanceEl = document.getElementById('analyticsResistanceValue');
  const rangeEl = document.getElementById('analyticsRangeValue');
  const currentPriceEl = document.getElementById('analyticsCurrentPriceValue');
  const trendScoreEl = document.getElementById('analyticsTrendScore');
  const trendTextEl = document.getElementById('analyticsTrendText');
  const momentumScoreEl = document.getElementById('analyticsMomentumScore');
  const momentumTextEl = document.getElementById('analyticsMomentumText');
  const futuresScoreEl = document.getElementById('analyticsFuturesScore');
  const futuresTextEl = document.getElementById('analyticsFuturesText');
  const liquidityScoreEl = document.getElementById('analyticsLiquidityScore');
  const liquidityTextEl = document.getElementById('analyticsLiquidityText');
  const liquidationScoreEl = document.getElementById('analyticsLiquidationScore');
  const liquidationTextEl = document.getElementById('analyticsLiquidationText');
  const macroScoreEl = document.getElementById('analyticsMacroScore');
  const macroTextEl = document.getElementById('analyticsMacroText');
  const macroSummaryEl = document.getElementById('analyticsMacroSummary');
  const macroSummaryHintEl = document.getElementById('analyticsMacroSummaryHint');
  const macroNdxValueEl = document.getElementById('analyticsMacroNdxValue');
  const macroNdxTextEl = document.getElementById('analyticsMacroNdxText');
  const macroBrentValueEl = document.getElementById('analyticsMacroBrentValue');
  const macroBrentTextEl = document.getElementById('analyticsMacroBrentText');
  const macroCpiValueEl = document.getElementById('analyticsMacroCpiValue');
  const macroCpiTextEl = document.getElementById('analyticsMacroCpiText');
  const contributionBarsEl = document.getElementById('analyticsContributionBars');
  const regimeLabelEl = document.getElementById('analyticsRegimeLabel');
  const helpButtons = [...tabContent.querySelectorAll('.analytics-help-btn')];

  if (
    !symbolSelect ||
    !horizonSelect ||
    !refreshBtn ||
    !statusEl ||
    !errorEl ||
    !updatedAtEl ||
    !scenarioEl ||
    !scenarioHintEl ||
    !scoreEl ||
    !riskEl ||
    !probabilitiesEl ||
    !dominantPathEl ||
    !reasonsListEl ||
    !supportEl ||
    !resistanceEl ||
    !rangeEl ||
    !currentPriceEl ||
    !trendScoreEl ||
    !trendTextEl ||
    !momentumScoreEl ||
    !momentumTextEl ||
    !futuresScoreEl ||
    !futuresTextEl ||
    !liquidityScoreEl ||
    !liquidityTextEl ||
    !liquidationScoreEl ||
    !liquidationTextEl ||
    !macroScoreEl ||
    !macroTextEl ||
    !macroSummaryEl ||
    !macroSummaryHintEl ||
    !macroNdxValueEl ||
    !macroNdxTextEl ||
    !macroBrentValueEl ||
    !macroBrentTextEl ||
    !macroCpiValueEl ||
    !macroCpiTextEl ||
    !contributionBarsEl ||
    !regimeLabelEl
  ) return;

  const ANALYTICS_CACHE_TTL_MS = 5 * 60 * 1000;
  const ANALYTICS_LIQUIDATION_CACHE_KEY = 'liquidation_widget_events_v1';
  const ANALYTICS_CALIBRATION_KEY = 'analytics_calibration_v1';
  const ANALYTICS_CALIBRATION_LIMIT = 500;
  const ANALYTICS_CALIBRATION_LOOKBACK = 120;
  const HORIZON_WINDOW_MINUTES = {
    '15m': 15,
    '1h': 60,
    '4h': 240,
    '1d': 1440
  };
  const ANALYTICS_FUTURES_PERIOD_BY_HORIZON = {
    '15m': '15m',
    '1h': '1h',
    '4h': '4h',
    '1d': '1d'
  };
  const ANALYTICS_BYBIT_INTERVAL_BY_HORIZON = {
    '15m': '15min',
    '1h': '1h',
    '4h': '4h',
    '1d': '1d'
  };
  const ANALYTICS_BYBIT_RATIO_PERIOD_BY_HORIZON = {
    '15m': '15min',
    '1h': '1h',
    '4h': '4h',
    '1d': '1d'
  };
  const MACRO_HORIZON_WEIGHT = {
    '15m': 0.15,
    '1h': 0.35,
    '4h': 0.7,
    '1d': 1
  };
  const ANALYTICS_MACRO_SNAPSHOT_KEY = 'analytics_macro_snapshot_v2';
  const ANALYTICS_MACRO_SNAPSHOT_FILE_URL = 'macro-snapshot.json';
  const ANALYTICS_MACRO_GITHUB_CONFIG_KEY = 'analytics_macro_github_dispatch_v1';
  const MACRO_LIVE_DISABLE_MS = 6 * 60 * 60 * 1000;
  const MACRO_STALE_WARN_HOURS = 36;
  const MACRO_STALE_HARD_HOURS = 120;
  const SIGNAL_ABS_RANGES = {
    trend: 25,
    momentum: 20,
    volatility: 15,
    futures: 12,
    liquidity: 10,
    liquidation: 15,
    macro: 12
  };
  const FRED_GRAPH_BASE = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=';
  const MACRO_FALLBACK_SERIES = {
    ndx: [
      { date: '2026-02-26', value: 25034.37 }, { date: '2026-02-27', value: 24960.04 }, { date: '2026-03-02', value: 24992.6 },
      { date: '2026-03-03', value: 24720.08 }, { date: '2026-03-04', value: 25093.68 }, { date: '2026-03-05', value: 25020.41 },
      { date: '2026-03-06', value: 24643.01 }, { date: '2026-03-09', value: 24967.25 }, { date: '2026-03-10', value: 24956.47 },
      { date: '2026-03-11', value: 24965.01 }, { date: '2026-03-12', value: 24533.58 }, { date: '2026-03-13', value: 24380.73 },
      { date: '2026-03-16', value: 24655.34 }, { date: '2026-03-17', value: 24780.42 }, { date: '2026-03-18', value: 24425.09 },
      { date: '2026-03-19', value: 24355.28 }, { date: '2026-03-20', value: 23898.15 }, { date: '2026-03-23', value: 24188.59 },
      { date: '2026-03-24', value: 24002.45 }, { date: '2026-03-25', value: 24162.98 }, { date: '2026-03-26', value: 23586.99 },
      { date: '2026-03-27', value: 23132.77 }, { date: '2026-03-30', value: 22953.38 }, { date: '2026-03-31', value: 23740.19 },
      { date: '2026-04-01', value: 24019.99 }, { date: '2026-04-02', value: 24045.53 }, { date: '2026-04-06', value: 24192.17 },
      { date: '2026-04-07', value: 24202.37 }, { date: '2026-04-08', value: 24903.17 }, { date: '2026-04-09', value: 25082.09 }
    ],
    brent: [
      { date: '2026-02-20', value: 72.75 }, { date: '2026-02-23', value: 71.9 }, { date: '2026-02-24', value: 71.21 },
      { date: '2026-02-25', value: 70.69 }, { date: '2026-02-26', value: 71.66 }, { date: '2026-02-27', value: 71.32 },
      { date: '2026-03-02', value: 77.24 }, { date: '2026-03-03', value: 83.28 }, { date: '2026-03-04', value: 81.56 },
      { date: '2026-03-05', value: 88.59 }, { date: '2026-03-06', value: 95.74 }, { date: '2026-03-09', value: 94.35 },
      { date: '2026-03-10', value: 89.84 }, { date: '2026-03-11', value: 90.98 }, { date: '2026-03-12', value: 102.38 },
      { date: '2026-03-13', value: 103.23 }, { date: '2026-03-16', value: 101.04 }, { date: '2026-03-17', value: 108.39 },
      { date: '2026-03-18', value: 118.09 }, { date: '2026-03-19', value: 111.05 }, { date: '2026-03-20', value: 118.42 },
      { date: '2026-03-23', value: 103.79 }, { date: '2026-03-24', value: 108.42 }, { date: '2026-03-25', value: 109.14 },
      { date: '2026-03-26', value: 113.39 }, { date: '2026-03-27', value: 121.47 }, { date: '2026-03-30', value: 121.88 },
      { date: '2026-03-31', value: 126.69 }, { date: '2026-04-01', value: 119.56 }, { date: '2026-04-02', value: 127.61 }
    ],
    cpi: [
      { date: '2024-03-01', value: 312.345 }, { date: '2024-04-01', value: 313.023 }, { date: '2024-05-01', value: 313.175 },
      { date: '2024-06-01', value: 313.044 }, { date: '2024-07-01', value: 313.569 }, { date: '2024-08-01', value: 314.062 },
      { date: '2024-09-01', value: 314.732 }, { date: '2024-10-01', value: 315.631 }, { date: '2024-11-01', value: 316.528 },
      { date: '2024-12-01', value: 317.604 }, { date: '2025-01-01', value: 318.961 }, { date: '2025-02-01', value: 319.679 },
      { date: '2025-03-01', value: 319.785 }, { date: '2025-04-01', value: 320.302 }, { date: '2025-05-01', value: 320.62 },
      { date: '2025-06-01', value: 321.435 }, { date: '2025-07-01', value: 322.169 }, { date: '2025-08-01', value: 323.291 },
      { date: '2025-09-01', value: 324.245 }, { date: '2025-11-01', value: 325.063 }, { date: '2025-12-01', value: 326.031 },
      { date: '2026-01-01', value: 326.588 }, { date: '2026-02-01', value: 327.46 }, { date: '2026-03-01', value: 330.293 }
    ]
  };
  const IS_LOCAL_OR_FILE_RUNTIME = (
    (typeof window !== 'undefined' && window?.location?.protocol === 'file:') ||
    (typeof window !== 'undefined' && ['localhost', '127.0.0.1', '::1'].includes(window?.location?.hostname || ''))
  );

  let analyticsRequestId = 0;
  let analyticsLoadedOnce = false;
  let macroLiveDisabledUntil = IS_LOCAL_OR_FILE_RUNTIME ? Number.POSITIVE_INFINITY : 0;
  let macroLiveDisabledReason = IS_LOCAL_OR_FILE_RUNTIME
    ? 'Локальный режим: live-макро отключен из-за CORS, используется snapshot.'
    : '';
  let macroSnapshotSeries = null;
  let macroSnapshotMeta = null;
  let macroGithubSessionToken = '';
  let snapshotDispatchInFlight = false;

  class AnalyticsCache {
    constructor() {
      this.cache = new Map();
      this.timers = new Map();
    }

    set(key, value, ttlMs = ANALYTICS_CACHE_TTL_MS) {
      if (this.timers.has(key)) clearTimeout(this.timers.get(key));
      this.cache.set(key, value);
      const timer = setTimeout(() => {
        this.cache.delete(key);
        this.timers.delete(key);
      }, ttlMs);
      this.timers.set(key, timer);
    }

    get(key) {
      return this.cache.get(key) || null;
    }

    has(key) {
      return this.cache.has(key);
    }

    clear() {
      this.timers.forEach((timer) => clearTimeout(timer));
      this.cache.clear();
      this.timers.clear();
    }
  }

  class SignalCalculator {
    calculateEma(values, period) {
      if (values.length < period) return Array(values.length).fill(null);
      const ema = [];
      const k = 2 / (period + 1);
      let sma = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
      for (let i = 0; i < values.length; i++) {
        if (i < period - 1) ema.push(null);
        else if (i === period - 1) ema.push(sma);
        else {
          sma = values[i] * k + sma * (1 - k);
          ema.push(sma);
        }
      }
      return ema;
    }

    calculateRsi(values, period = 14) {
      if (values.length < period + 1) return null;
      let gains = 0;
      let losses = 0;
      for (let i = 1; i <= period; i++) {
        const diff = values[i] - values[i - 1];
        if (diff > 0) gains += diff;
        else losses -= diff;
      }
      let avgGain = gains / period;
      let avgLoss = losses / period;
      for (let i = period + 1; i < values.length; i++) {
        const diff = values[i] - values[i - 1];
        if (diff > 0) {
          avgGain = (avgGain * (period - 1) + diff) / period;
          avgLoss = (avgLoss * (period - 1)) / period;
        } else {
          avgGain = (avgGain * (period - 1)) / period;
          avgLoss = (avgLoss * (period - 1) + (-diff)) / period;
        }
      }
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      return 100 - (100 / (1 + rs));
    }

    calculateSma(values, period) {
      if (!Array.isArray(values) || values.length < period) return null;
      const slice = values.slice(-period).filter((value) => Number.isFinite(value));
      if (slice.length < period) return null;
      return slice.reduce((sum, value) => sum + value, 0) / period;
    }

    calculateStd(values, period) {
      if (!Array.isArray(values) || values.length < period) return null;
      const slice = values.slice(-period).filter((value) => Number.isFinite(value));
      if (slice.length < period) return null;
      const mean = slice.reduce((sum, value) => sum + value, 0) / period;
      const variance = slice.reduce((sum, value) => sum + ((value - mean) * (value - mean)), 0) / period;
      return Math.sqrt(variance);
    }

    calculateMacd(values) {
      if (!Array.isArray(values) || values.length < 35) return { macd: null, signal: null, histogram: null };
      const ema12 = this.calculateEma(values, 12);
      const ema26 = this.calculateEma(values, 26);
      const macdLine = values.map((_, index) => {
        const fast = ema12[index];
        const slow = ema26[index];
        return Number.isFinite(fast) && Number.isFinite(slow) ? fast - slow : null;
      });
      const compactMacd = macdLine.filter((value) => Number.isFinite(value));
      if (compactMacd.length < 9) return { macd: null, signal: null, histogram: null };
      const signalLineCompact = this.calculateEma(compactMacd, 9);
      const signalValue = signalLineCompact.at(-1);
      const macdValue = compactMacd.at(-1);
      return {
        macd: Number.isFinite(macdValue) ? macdValue : null,
        signal: Number.isFinite(signalValue) ? signalValue : null,
        histogram: Number.isFinite(macdValue) && Number.isFinite(signalValue) ? macdValue - signalValue : null
      };
    }

    calculateAdx(klines, period = 14) {
      if (!Array.isArray(klines) || klines.length < (period * 2) + 2) return null;
      const highs = klines.map((item) => Number(item.high));
      const lows = klines.map((item) => Number(item.low));
      const closes = klines.map((item) => Number(item.close));
      const plusDm = [];
      const minusDm = [];
      const tr = [];

      for (let i = 1; i < klines.length; i++) {
        const upMove = highs[i] - highs[i - 1];
        const downMove = lows[i - 1] - lows[i];
        plusDm.push(upMove > downMove && upMove > 0 ? upMove : 0);
        minusDm.push(downMove > upMove && downMove > 0 ? downMove : 0);
        tr.push(Math.max(
          highs[i] - lows[i],
          Math.abs(highs[i] - closes[i - 1]),
          Math.abs(lows[i] - closes[i - 1])
        ));
      }

      const smoothSeries = (values) => {
        if (values.length < period) return [];
        let rolling = values.slice(0, period).reduce((sum, value) => sum + value, 0);
        const out = [rolling];
        for (let i = period; i < values.length; i++) {
          rolling = rolling - (rolling / period) + values[i];
          out.push(rolling);
        }
        return out;
      };

      const trSmooth = smoothSeries(tr);
      const plusSmooth = smoothSeries(plusDm);
      const minusSmooth = smoothSeries(minusDm);
      const minLength = Math.min(trSmooth.length, plusSmooth.length, minusSmooth.length);
      if (!minLength) return null;

      const dx = [];
      for (let i = 0; i < minLength; i++) {
        const trValue = trSmooth[i];
        if (!Number.isFinite(trValue) || trValue <= 0) continue;
        const plusDi = (plusSmooth[i] / trValue) * 100;
        const minusDi = (minusSmooth[i] / trValue) * 100;
        const denominator = plusDi + minusDi;
        if (denominator <= 0) continue;
        dx.push((Math.abs(plusDi - minusDi) / denominator) * 100);
      }

      if (dx.length < period) return null;
      let adx = dx.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
      for (let i = period; i < dx.length; i++) {
        adx = ((adx * (period - 1)) + dx[i]) / period;
      }
      return Number.isFinite(adx) ? adx : null;
    }

    calculateStochRsi(values, rsiPeriod = 14, stochPeriod = 14, smoothK = 3, smoothD = 3) {
      if (!Array.isArray(values) || values.length < rsiPeriod + stochPeriod + smoothK + smoothD) {
        return { k: null, d: null };
      }

      const rsiSeries = [];
      let gains = 0;
      let losses = 0;
      for (let i = 1; i <= rsiPeriod; i++) {
        const diff = values[i] - values[i - 1];
        if (diff > 0) gains += diff;
        else losses -= diff;
      }
      let avgGain = gains / rsiPeriod;
      let avgLoss = losses / rsiPeriod;
      rsiSeries.push(avgLoss === 0 ? 100 : 100 - (100 / (1 + (avgGain / avgLoss))));

      for (let i = rsiPeriod + 1; i < values.length; i++) {
        const diff = values[i] - values[i - 1];
        if (diff > 0) {
          avgGain = ((avgGain * (rsiPeriod - 1)) + diff) / rsiPeriod;
          avgLoss = (avgLoss * (rsiPeriod - 1)) / rsiPeriod;
        } else {
          avgGain = (avgGain * (rsiPeriod - 1)) / rsiPeriod;
          avgLoss = ((avgLoss * (rsiPeriod - 1)) + (-diff)) / rsiPeriod;
        }
        rsiSeries.push(avgLoss === 0 ? 100 : 100 - (100 / (1 + (avgGain / avgLoss))));
      }

      const stochSeries = [];
      for (let i = stochPeriod - 1; i < rsiSeries.length; i++) {
        const window = rsiSeries.slice(i - stochPeriod + 1, i + 1);
        const minRsi = Math.min(...window);
        const maxRsi = Math.max(...window);
        const currentRsi = rsiSeries[i];
        const stoch = maxRsi > minRsi ? ((currentRsi - minRsi) / (maxRsi - minRsi)) * 100 : 50;
        stochSeries.push(stoch);
      }
      if (stochSeries.length < smoothK + smoothD) return { k: null, d: null };

      const kSeries = [];
      for (let i = smoothK - 1; i < stochSeries.length; i++) {
        const slice = stochSeries.slice(i - smoothK + 1, i + 1);
        kSeries.push(slice.reduce((sum, value) => sum + value, 0) / slice.length);
      }
      if (kSeries.length < smoothD) return { k: null, d: null };

      const dSeries = [];
      for (let i = smoothD - 1; i < kSeries.length; i++) {
        const slice = kSeries.slice(i - smoothD + 1, i + 1);
        dSeries.push(slice.reduce((sum, value) => sum + value, 0) / slice.length);
      }

      return {
        k: Number.isFinite(kSeries.at(-1)) ? kSeries.at(-1) : null,
        d: Number.isFinite(dSeries.at(-1)) ? dSeries.at(-1) : null
      };
    }

    calculateVwap(klines, period = 64) {
      if (!Array.isArray(klines) || !klines.length) return null;
      const slice = klines.slice(-period);
      let pv = 0;
      let vv = 0;
      slice.forEach((item) => {
        const high = Number(item?.high);
        const low = Number(item?.low);
        const close = Number(item?.close);
        const volume = Number(item?.volume);
        if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close) || !Number.isFinite(volume)) return;
        const typical = (high + low + close) / 3;
        pv += typical * volume;
        vv += volume;
      });
      return vv > 0 ? pv / vv : null;
    }

    calculateObvSeries(klines) {
      if (!Array.isArray(klines) || !klines.length) return [];
      const out = [];
      let obv = 0;
      out.push(obv);
      for (let i = 1; i < klines.length; i++) {
        const prevClose = Number(klines[i - 1]?.close);
        const close = Number(klines[i]?.close);
        const vol = Number(klines[i]?.volume);
        if (!Number.isFinite(prevClose) || !Number.isFinite(close) || !Number.isFinite(vol)) {
          out.push(obv);
          continue;
        }
        if (close > prevClose) obv += vol;
        else if (close < prevClose) obv -= vol;
        out.push(obv);
      }
      return out;
    }

    calculateSupertrend(klines, period = 10, multiplier = 3) {
      if (!Array.isArray(klines) || klines.length < period + 5) {
        return { direction: null, value: null };
      }

      const highs = klines.map((item) => Number(item.high));
      const lows = klines.map((item) => Number(item.low));
      const closes = klines.map((item) => Number(item.close));
      const tr = [];
      for (let i = 0; i < klines.length; i++) {
        const high = highs[i];
        const low = lows[i];
        const prevClose = i > 0 ? closes[i - 1] : closes[i];
        tr.push(Math.max(
          high - low,
          Math.abs(high - prevClose),
          Math.abs(low - prevClose)
        ));
      }

      const atr = [];
      let atrSum = 0;
      for (let i = 0; i < tr.length; i++) {
        if (i < period) {
          atrSum += tr[i];
          atr.push(null);
          continue;
        }
        if (i === period) {
          const seed = atrSum / period;
          atr.push(seed);
          continue;
        }
        const prevAtr = atr[i - 1];
        atr.push(((prevAtr * (period - 1)) + tr[i]) / period);
      }

      const finalUpper = [];
      const finalLower = [];
      const direction = [];
      const supertrend = [];

      for (let i = 0; i < klines.length; i++) {
        const currentAtr = atr[i];
        if (!Number.isFinite(currentAtr)) {
          finalUpper.push(null);
          finalLower.push(null);
          direction.push(1);
          supertrend.push(null);
          continue;
        }

        const hl2 = (highs[i] + lows[i]) / 2;
        const basicUpper = hl2 + (multiplier * currentAtr);
        const basicLower = hl2 - (multiplier * currentAtr);

        if (i === 0 || !Number.isFinite(finalUpper[i - 1])) {
          finalUpper.push(basicUpper);
          finalLower.push(basicLower);
          direction.push(closes[i] >= basicLower ? 1 : -1);
          supertrend.push(direction[i] === 1 ? basicLower : basicUpper);
          continue;
        }

        const prevUpper = finalUpper[i - 1];
        const prevLower = finalLower[i - 1];
        const prevClose = closes[i - 1];
        const nextUpper = (basicUpper < prevUpper || prevClose > prevUpper) ? basicUpper : prevUpper;
        const nextLower = (basicLower > prevLower || prevClose < prevLower) ? basicLower : prevLower;
        finalUpper.push(nextUpper);
        finalLower.push(nextLower);

        const prevDirection = direction[i - 1];
        let nextDirection = prevDirection;
        if (closes[i] > nextUpper) nextDirection = 1;
        else if (closes[i] < nextLower) nextDirection = -1;
        direction.push(nextDirection);
        supertrend.push(nextDirection === 1 ? nextLower : nextUpper);
      }

      return {
        direction: direction.at(-1) || null,
        value: supertrend.at(-1) || null
      };
    }

    buildTrendSignal(klines) {
      const closes = klines.map((item) => item.close);
      const ema20 = this.calculateEma(closes, 20);
      const ema50 = this.calculateEma(closes, 50);
      const ema200 = this.calculateEma(closes, 200);
      const adx = this.calculateAdx(klines, 14);
      const supertrend = this.calculateSupertrend(klines, 10, 3);
      const price = closes.at(-1) || 0;
      const val20 = ema20.at(-1) || 0;
      const val50 = ema50.at(-1) || 0;
      const val200 = ema200.at(-1) || 0;

      let score = 0;
      if (price > val20) score += 5;
      else score -= 5;
      if (price > val50) score += 8;
      else score -= 8;
      if (price > val200) score += 8;
      else score -= 8;
      if (val20 > val50 && val50 > val200) score += 4;
      if (val20 < val50 && val50 < val200) score -= 4;
      if (Number.isFinite(adx)) {
        if (adx >= 25) score += 3;
        else if (adx <= 16) score -= 2;
      }
      if (supertrend.direction === 1) score += 4;
      else if (supertrend.direction === -1) score -= 4;

      return {
        score: clamp(score, -25, 25),
        adx,
        supertrendDirection: supertrend.direction,
        supertrendValue: supertrend.value,
        text: price >= val50
          ? `Цена выше EMA50, ADX ${Number.isFinite(adx) ? adx.toFixed(1) : '-'}, Supertrend ${supertrend.direction === 1 ? 'UP' : supertrend.direction === -1 ? 'DOWN' : '-'}, EMA20 ${formatAnalyticsPrice(val20, price)}`
          : `Цена ниже EMA50, ADX ${Number.isFinite(adx) ? adx.toFixed(1) : '-'}, Supertrend ${supertrend.direction === 1 ? 'UP' : supertrend.direction === -1 ? 'DOWN' : '-'}, EMA20 ${formatAnalyticsPrice(val20, price)}`
      };
    }

    buildMomentumSignal(klines) {
      const closes = klines.map((item) => item.close);
      const volumes = klines.map((item) => item.volume);
      const price = closes.at(-1) || 0;
      const prev = closes.at(-5) || closes.at(0) || price;
      const movePct = prev ? ((price - prev) / prev) * 100 : 0;
      const rsi = this.calculateRsi(closes, 14);
      const vol5 = volumes.slice(-5);
      const vol30 = volumes.slice(-30);
      const avgVol5 = vol5.length ? vol5.reduce((sum, value) => sum + value, 0) / vol5.length : 0;
      const avgVol30 = vol30.length ? vol30.reduce((sum, value) => sum + value, 0) / vol30.length : 0;
      const volRatio = avgVol30 > 0 ? avgVol5 / avgVol30 : 1;
      const macd = this.calculateMacd(closes);
      const bbMid = this.calculateSma(closes, 20);
      const bbStd = this.calculateStd(closes, 20);
      const stochRsi = this.calculateStochRsi(closes, 14, 14, 3, 3);
      const vwap = this.calculateVwap(klines, 64);
      const vwapDevPct = Number.isFinite(vwap) && vwap > 0 ? ((price - vwap) / vwap) * 100 : null;
      const obvSeries = this.calculateObvSeries(klines);
      const obvNow = obvSeries.at(-1);
      const obvPrev = obvSeries.length > 10 ? obvSeries.at(-11) : null;
      const obvTrend = Number.isFinite(obvNow) && Number.isFinite(obvPrev)
        ? obvNow - obvPrev
        : null;
      const upperBand = Number.isFinite(bbMid) && Number.isFinite(bbStd) ? bbMid + (2 * bbStd) : null;
      const lowerBand = Number.isFinite(bbMid) && Number.isFinite(bbStd) ? bbMid - (2 * bbStd) : null;
      const bandSpan = Number.isFinite(upperBand) && Number.isFinite(lowerBand) ? upperBand - lowerBand : null;
      const bbPos = Number.isFinite(bandSpan) && bandSpan > 0 ? (price - lowerBand) / bandSpan : null;

      let score = 0;
      if (movePct > 1) score += 7;
      else if (movePct < -1) score -= 7;

      if (Number.isFinite(rsi)) {
        if (rsi > 58 && rsi < 75) score += 7;
        else if (rsi < 42 && rsi > 25) score -= 7;
        else if (rsi >= 75) score -= 3;
        else if (rsi <= 25) score += 3;
      }

      if (volRatio > 1.2 && movePct > 0) score += 2;
      if (volRatio > 1.2 && movePct < 0) score -= 2;
      if (Number.isFinite(macd.histogram)) {
        if (macd.histogram > 0) score += 3;
        else if (macd.histogram < 0) score -= 3;
      }
      if (Number.isFinite(bbPos)) {
        if (bbPos >= 0.8) score += 2;
        else if (bbPos <= 0.2) score -= 2;
      }
      if (Number.isFinite(stochRsi.k) && Number.isFinite(stochRsi.d)) {
        if (stochRsi.k > stochRsi.d && stochRsi.k < 85) score += 2;
        else if (stochRsi.k < stochRsi.d && stochRsi.k > 15) score -= 2;
        if (stochRsi.k >= 90) score -= 2;
        if (stochRsi.k <= 10) score += 2;
      }
      if (Number.isFinite(vwapDevPct)) {
        if (vwapDevPct > 1.2 && movePct > 0) score += 2;
        else if (vwapDevPct < -1.2 && movePct < 0) score -= 2;
        if (Math.abs(vwapDevPct) > 3.8) score += vwapDevPct > 0 ? -2 : 2;
      }
      if (Number.isFinite(obvTrend)) {
        if (obvTrend > 0) score += 2;
        else if (obvTrend < 0) score -= 2;
      }

      return {
        score: clamp(score, -20, 20),
        movePct,
        rsi,
        macdHistogram: macd.histogram,
        bbPos,
        stochRsiK: stochRsi.k,
        stochRsiD: stochRsi.d,
        vwapDevPct,
        obvTrend,
        volumeRatio: volRatio,
        text: `RSI ${Number.isFinite(rsi) ? rsi.toFixed(1) : '-'}, StochRSI ${Number.isFinite(stochRsi.k) ? stochRsi.k.toFixed(1) : '-'} / ${Number.isFinite(stochRsi.d) ? stochRsi.d.toFixed(1) : '-'}, MACD ${Number.isFinite(macd.histogram) ? macd.histogram.toFixed(2) : '-'}, VWAP dev ${Number.isFinite(vwapDevPct) ? `${vwapDevPct > 0 ? '+' : ''}${vwapDevPct.toFixed(2)}%` : '-'}, BB ${Number.isFinite(bbPos) ? bbPos.toFixed(2) : '-'}, OBV ${Number.isFinite(obvTrend) ? (obvTrend > 0 ? 'up' : obvTrend < 0 ? 'down' : 'flat') : '-'}, импульс ${movePct.toFixed(1)}%, объем ${volRatio.toFixed(2)}x`
      };
    }

    buildVolatilitySignal(klines) {
      const closes = klines.map((item) => item.close);
      const highs = klines.map((item) => item.high);
      const lows = klines.map((item) => item.low);
      const tr = [];

      for (let i = 0; i < closes.length; i++) {
        let currentRange = highs[i] - lows[i];
        if (i > 0) {
          currentRange = Math.max(
            currentRange,
            Math.abs(highs[i] - closes[i - 1]),
            Math.abs(lows[i] - closes[i - 1])
          );
        }
        tr.push(currentRange);
      }

      const atrWindow = tr.slice(-14);
      const atr = atrWindow.length ? atrWindow.reduce((sum, value) => sum + value, 0) / atrWindow.length : 0;
      const atrPct = (atr / (closes.at(-1) || 1)) * 100;

      let score = 0;
      if (atrPct < 1) score += 8;
      else if (atrPct < 2) score += 4;
      else if (atrPct > 5) score -= 8;
      else if (atrPct > 3) score -= 4;

      return {
        score: clamp(score, -15, 15),
        atrPct,
        text: `ATR ${atrPct.toFixed(2)}%: ${atrPct < 1.5 ? 'низкая волатильность' : atrPct < 3 ? 'умеренный режим' : 'высокий риск выбросов'}`
      };
    }

    buildFuturesSignal(futuresData = {}, momentumSignal = {}, context = {}) {
      const fundingPct = Number(futuresData.fundingRate) * 100;
      const openInterest = Number(futuresData.openInterest);
      const oiDeltaPct = Number(futuresData.oiDeltaPct);
      const oiZScore = Number(futuresData.oiZScore);
      const fundingMomentumPct = Number(futuresData.fundingMomentum) * 100;
      const futuresMarkPrice = Number(futuresData.markPrice);
      const positionRatio = Number(futuresData.topPositionRatio);
      const accountRatio = Number(futuresData.topAccountRatio);
      const longAccount = Number(futuresData.longAccount);
      const shortAccount = Number(futuresData.shortAccount);
      const sourceBinance = futuresData.sources?.binance || {};
      const sourceBybit = futuresData.sources?.bybit || {};
      const movePct = Number(momentumSignal.movePct);
      const spotPrice = Number(context.spotPrice);
      const basisFromPrices = Number.isFinite(futuresMarkPrice) && Number.isFinite(spotPrice) && spotPrice > 0
        ? ((futuresMarkPrice - spotPrice) / spotPrice) * 100
        : null;
      const basisPct = Number.isFinite(Number(futuresData.basisPct)) ? Number(futuresData.basisPct) : basisFromPrices;
      let score = 0;

      if (Number.isFinite(fundingPct)) {
        if (fundingPct >= 0.03) score -= 6;
        else if (fundingPct >= 0.015) score -= 3;
        else if (fundingPct <= -0.03) score += 6;
        else if (fundingPct <= -0.015) score += 3;
      }

      if (Number.isFinite(oiDeltaPct)) {
        if (oiDeltaPct >= 2 && movePct > 0) score += 5;
        else if (oiDeltaPct >= 2 && movePct < 0) score -= 5;
        else if (oiDeltaPct <= -2 && movePct > 0) score -= 2;
        else if (oiDeltaPct <= -2 && movePct < 0) score += 2;
      }

      const averageTopRatio = [positionRatio, accountRatio]
        .filter((value) => Number.isFinite(value) && value > 0)
        .reduce((sum, value, _, arr) => sum + (value / arr.length), 0);
      if (Number.isFinite(averageTopRatio) && averageTopRatio > 0) {
        if (averageTopRatio >= 1.35) score += 5;
        else if (averageTopRatio >= 1.12) score += 3;
        else if (averageTopRatio <= 0.74) score -= 5;
        else if (averageTopRatio <= 0.9) score -= 3;
      }

      if (Number.isFinite(longAccount) && Number.isFinite(shortAccount)) {
        if (longAccount >= 0.62 && fundingPct >= 0.02) score -= 2;
        if (shortAccount >= 0.62 && fundingPct <= -0.02) score += 2;
      }
      if (Number.isFinite(basisPct)) {
        if (basisPct > 0.2 && basisPct < 1.2) score += 2;
        else if (basisPct < -0.2) score -= 3;
        else if (basisPct > 2.2) score -= 2;
      }
      if (Number.isFinite(oiZScore)) {
        if (oiZScore >= 1.2 && movePct >= 0) score += 3;
        else if (oiZScore >= 1.2 && movePct < 0) score -= 3;
        else if (oiZScore <= -1.2) score -= 1;
      }
      if (Number.isFinite(fundingMomentumPct)) {
        if (fundingMomentumPct > 0.008 && fundingPct > 0) score -= 2;
        if (fundingMomentumPct < -0.008 && fundingPct < 0) score += 2;
      }

      const formatPercentValue = (value) => (Number.isFinite(value) ? `${value.toFixed(4)}%` : '-');
      const formatSignedPercent = (value) => (Number.isFinite(value) ? `${value > 0 ? '+' : ''}${value.toFixed(2)}%` : '-');
      const formatTopRatio = (position, account) => {
        const pos = Number(position);
        const acc = Number(account);
        if (!Number.isFinite(pos) && !Number.isFinite(acc)) return '-/-';
        return `${Number.isFinite(pos) ? pos.toFixed(2) : '-'}/${Number.isFinite(acc) ? acc.toFixed(2) : '-'}`;
      };
      const formatSignedCompact = (value, digits = 3) => (Number.isFinite(value) ? `${value > 0 ? '+' : ''}${value.toFixed(digits)}%` : '-');

      return {
        score: clamp(score, -12, 12),
        basisPct,
        oiZScore,
        fundingMomentumPct,
        text: [
          `Funding agg ${formatPercentValue(fundingPct)} (B ${formatPercentValue(Number(sourceBinance.fundingPct))} • Y ${formatPercentValue(Number(sourceBybit.fundingPct))})`,
          `OI agg ${Number.isFinite(openInterest) && openInterest > 0 ? formatCompactNumber(openInterest) : '-'} (B ${Number.isFinite(Number(sourceBinance.openInterest)) ? formatCompactNumber(Number(sourceBinance.openInterest)) : '-'} • Y ${Number.isFinite(Number(sourceBybit.openInterest)) ? formatCompactNumber(Number(sourceBybit.openInterest)) : '-'})`,
          `OI delta agg ${formatSignedPercent(oiDeltaPct)} (B ${formatSignedPercent(Number(sourceBinance.oiDeltaPct))} • Y ${formatSignedPercent(Number(sourceBybit.oiDeltaPct))})`,
          `Top L/S agg ${formatTopRatio(positionRatio, accountRatio)} (B ${formatTopRatio(Number(sourceBinance.topPositionRatio), Number(sourceBinance.topAccountRatio))} • Y ${formatTopRatio(Number(sourceBybit.topPositionRatio), Number(sourceBybit.topAccountRatio))})`,
          `Basis ${formatSignedCompact(basisPct)} vs spot ${Number.isFinite(spotPrice) ? formatAnalyticsPrice(spotPrice, spotPrice) : '-'}`,
          `OI z-score ${Number.isFinite(oiZScore) ? oiZScore.toFixed(2) : '-'}, funding momentum ${formatSignedCompact(fundingMomentumPct, 4)}`
        ].join(' • ')
      };
    }

    buildLiquiditySignal(depth = {}) {
      const bidWall = (depth.bids || [])
        .slice(0, 5)
        .reduce((sum, item) => sum + Number(item?.[1] || 0), 0);
      const askWall = (depth.asks || [])
        .slice(0, 5)
        .reduce((sum, item) => sum + Number(item?.[1] || 0), 0);
      const ratio = askWall > 0 ? bidWall / askWall : 1;

      let score = 0;
      if (ratio > 1.3) score = 8;
      else if (ratio < 0.7) score = -8;
      else if (ratio > 1.1) score = 4;
      else if (ratio < 0.9) score = -4;

      return {
        score: clamp(score, -10, 10),
        ratio,
        text: `Bid/Ask ${Number.isFinite(ratio) ? ratio.toFixed(2) : '-'}x по верхним 5 уровням`
      };
    }

    buildLevels(klines) {
      const recentWindow = klines.slice(-24);
      const highs = recentWindow.map((item) => item.high);
      const lows = recentWindow.map((item) => item.low);
      const support = lows.length ? Math.min(...lows) : null;
      const resistance = highs.length ? Math.max(...highs) : null;
      const currentPrice = klines.at(-1)?.close || null;
      const rangePct = support && resistance && currentPrice
        ? ((resistance - support) / currentPrice) * 100
        : null;

      return {
        support,
        resistance,
        currentPrice,
        rangePct
      };
    }
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function formatCompactNumber(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return '-';
    if (Math.abs(amount) >= 1e9) return `${(amount / 1e9).toFixed(2)}B`;
    if (Math.abs(amount) >= 1e6) return `${(amount / 1e6).toFixed(2)}M`;
    if (Math.abs(amount) >= 1e3) return `${(amount / 1e3).toFixed(2)}K`;
    return amount.toFixed(0);
  }

  function formatAnalyticsPrice(value, referencePrice = value) {
    const price = Number(value);
    const reference = Number(referencePrice);
    if (!Number.isFinite(price) || price <= 0) return '-';
    if (reference >= 100) return `${price.toFixed(2)} $`;
    if (reference >= 1) return `${price.toFixed(3)} $`;
    return `${price.toFixed(4)} $`;
  }

  function formatUpdatedAt(date) {
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  }

  function setStatus(message, tone = 'neutral') {
    statusEl.textContent = message;
    statusEl.dataset.tone = tone;
  }

  function setError(message = '') {
    errorEl.hidden = !message;
    errorEl.textContent = message;
  }

  function closeHelpTooltips() {
    helpButtons.forEach((button) => {
      button.setAttribute('aria-expanded', 'false');
      const tooltip = button.parentElement?.querySelector('.analytics-help-tooltip');
      if (tooltip) {
        tooltip.hidden = true;
      }
    });
  }

  function toggleHelpTooltip(button) {
    if (!button) return;
    const tooltip = button.parentElement?.querySelector('.analytics-help-tooltip');
    if (!tooltip) return;

    const willOpen = button.getAttribute('aria-expanded') !== 'true';
    closeHelpTooltips();
    button.setAttribute('aria-expanded', String(willOpen));
    tooltip.hidden = !willOpen;
  }

  function getAnalyticsHorizonLabel(horizon) {
    const labels = {
      '15m': '15 минут',
      '1h': '1 час',
      '4h': '4 часа',
      '1d': '24 часа'
    };
    return labels[horizon] || horizon;
  }

  function detectGitHubPagesRepoHint() {
    if (typeof window === 'undefined') return null;
    const hostname = String(window.location.hostname || '').toLowerCase();
    const pathSegments = String(window.location.pathname || '')
      .split('/')
      .map((part) => part.trim())
      .filter(Boolean);

    if (!hostname.endsWith('.github.io') || !pathSegments.length) {
      return null;
    }

    return {
      owner: hostname.replace('.github.io', ''),
      repo: pathSegments[0],
      ref: 'main'
    };
  }

  function loadMacroGithubConfig() {
    const repoHint = detectGitHubPagesRepoHint();
    try {
      const raw = localStorage.getItem(ANALYTICS_MACRO_GITHUB_CONFIG_KEY);
      if (!raw) return repoHint;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return repoHint;
      const sanitized = {
        owner: String(parsed.owner || repoHint?.owner || '').trim(),
        repo: String(parsed.repo || repoHint?.repo || '').trim(),
        ref: String(parsed.ref || repoHint?.ref || 'main').trim()
      };
      if (Object.prototype.hasOwnProperty.call(parsed, 'token')) {
        try {
          localStorage.setItem(ANALYTICS_MACRO_GITHUB_CONFIG_KEY, JSON.stringify(sanitized));
        } catch (error) {}
      }
      return sanitized;
    } catch (error) {
      return repoHint;
    }
  }

  function saveMacroGithubConfig(config = {}) {
    const payload = {
      owner: String(config.owner || '').trim(),
      repo: String(config.repo || '').trim(),
      ref: String(config.ref || 'main').trim() || 'main'
    };
    try {
      localStorage.setItem(ANALYTICS_MACRO_GITHUB_CONFIG_KEY, JSON.stringify(payload));
    } catch (error) {}
    return payload;
  }

  function askRequiredInput(label, fallbackValue = '', secret = false) {
    const value = window.prompt(label, fallbackValue || '');
    if (value === null) {
      throw new Error('Запуск обновления snapshot отменен.');
    }
    const cleanValue = String(value).trim();
    if (!cleanValue) {
      throw new Error('Поле не заполнено, запуск snapshot отменен.');
    }
    if (secret && cleanValue.length < 20) {
      throw new Error('Токен выглядит слишком коротким. Проверь GitHub token и повтори.');
    }
    return cleanValue;
  }

  function ensureMacroGithubConfig({ reconfigure = false } = {}) {
    const config = loadMacroGithubConfig() || {};
    const owner = reconfigure
      ? askRequiredInput('GitHub owner (например: твой-username)', config.owner || '')
      : (config.owner || askRequiredInput('GitHub owner (например: твой-username)'));
    const repo = reconfigure
      ? askRequiredInput('GitHub repo (например: Trading-Platform-v.1.1-main)', config.repo || '')
      : (config.repo || askRequiredInput('GitHub repo (например: Trading-Platform-v.1.1-main)'));
    const ref = reconfigure
      ? askRequiredInput('Git branch/ref для workflow', config.ref || 'main')
      : (config.ref || askRequiredInput('Git branch/ref для workflow', 'main'));
    const token = reconfigure || !macroGithubSessionToken
      ? askRequiredInput(
        'GitHub token (scope: workflow + repo). Токен НЕ сохраняется в localStorage, только в памяти этой вкладки.',
        '',
        true
      )
      : macroGithubSessionToken;
    macroGithubSessionToken = token;
    const saved = saveMacroGithubConfig({ owner, repo, ref });
    return {
      ...saved,
      token
    };
  }

  async function dispatchMacroSnapshotWorkflow(config) {
    const response = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/actions/workflows/update-macro-snapshot.yml/dispatches`,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${config.token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ref: config.ref })
      }
    );

    if (response.status === 204) return;

    let details = '';
    const responseText = await response.text();
    try {
      const payload = responseText ? JSON.parse(responseText) : null;
      details = payload?.message || payload?.error || responseText || '';
    } catch (error) {
      details = responseText || '';
    }
    throw new Error(`GitHub Actions не запустился (HTTP ${response.status}). ${details}`.trim());
  }

  async function waitForSnapshotRenew(previousUpdatedAt, maxWaitMs = 180000) {
    const startMs = Date.now();
    const previousMs = Date.parse(previousUpdatedAt || '');

    while (Date.now() - startMs < maxWaitMs) {
      await sleep(7000);
      try {
        const payload = await fetchMacroSnapshotFile();
        const nextMs = Date.parse(payload?.meta?.updatedAt || '');
        if (!Number.isFinite(previousMs) && Number.isFinite(nextMs)) {
          return payload;
        }
        if (Number.isFinite(previousMs) && Number.isFinite(nextMs) && nextMs > previousMs) {
          return payload;
        }
      } catch (error) {}
    }

    return null;
  }

  async function fetchJsonWithRetry(url, { signal, timeoutMs = 10000, maxAttempts = 3 } = {}) {
    let lastError = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(new Error('Timeout exceeded')), timeoutMs);
      let abortHandler = null;

      try {
        if (signal) {
          if (signal.aborted) {
            throw new DOMException('Aborted', 'AbortError');
          }
          abortHandler = () => controller.abort(new DOMException('Aborted', 'AbortError'));
          signal.addEventListener('abort', abortHandler, { once: true });
        }

        const response = await fetch(url, {
          cache: 'no-store',
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = await response.json();
        if (
          payload &&
          typeof payload === 'object' &&
          !Array.isArray(payload) &&
          Object.prototype.hasOwnProperty.call(payload, 'code') &&
          Number(payload.code) !== 0
        ) {
          throw new Error(payload.msg || `API error ${payload.code}`);
        }

        return payload;
      } catch (error) {
        lastError = error;
        if (error?.name === 'AbortError') {
          throw error;
        }
        if (attempt < maxAttempts - 1) {
          await sleep(Math.pow(2, attempt) * 500);
        }
      } finally {
        clearTimeout(timeoutId);
        if (signal && abortHandler) {
          signal.removeEventListener('abort', abortHandler);
        }
      }
    }

    throw lastError || new Error('Не удалось получить данные аналитики');
  }

  async function fetchTextWithRetry(url, { signal, timeoutMs = 10000, maxAttempts = 3 } = {}) {
    let lastError = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(new Error('Timeout exceeded')), timeoutMs);
      let abortHandler = null;

      try {
        if (signal) {
          if (signal.aborted) {
            throw new DOMException('Aborted', 'AbortError');
          }
          abortHandler = () => controller.abort(new DOMException('Aborted', 'AbortError'));
          signal.addEventListener('abort', abortHandler, { once: true });
        }

        const response = await fetch(url, {
          cache: 'no-store',
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        return response.text();
      } catch (error) {
        lastError = error;
        if (error?.name === 'AbortError') {
          throw error;
        }
        if (attempt < maxAttempts - 1) {
          await sleep(Math.pow(2, attempt) * 500);
        }
      } finally {
        clearTimeout(timeoutId);
        if (signal && abortHandler) {
          signal.removeEventListener('abort', abortHandler);
        }
      }
    }

    throw lastError || new Error('Не удалось получить текстовые данные аналитики');
  }

  function parseFredCsv(csvText) {
    const lines = String(csvText || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) return [];

    return lines
      .slice(1)
      .map((line) => {
        const [dateRaw, valueRaw] = line.split(',');
        const value = Number(valueRaw);
        return {
          date: dateRaw,
          value
        };
      })
      .filter((item) => item.date && Number.isFinite(item.value));
  }

  function normalizeMacroSeries(series) {
    if (!Array.isArray(series)) return [];
    return series
      .map((item) => ({
        date: String(item?.date || ''),
        value: Number(item?.value)
      }))
      .filter((item) => item.date && Number.isFinite(item.value));
  }

  function normalizeMacroBundle(payload) {
    const source = payload && typeof payload === 'object' && payload.data && typeof payload.data === 'object'
      ? payload.data
      : payload;
    const normalized = {
      ndx: normalizeMacroSeries(source?.ndx),
      brent: normalizeMacroSeries(source?.brent),
      cpi: normalizeMacroSeries(source?.cpi)
    };

    if (!normalized.ndx.length && !normalized.brent.length && !normalized.cpi.length) {
      return {
        ndx: normalizeMacroSeries(MACRO_FALLBACK_SERIES.ndx),
        brent: normalizeMacroSeries(MACRO_FALLBACK_SERIES.brent),
        cpi: normalizeMacroSeries(MACRO_FALLBACK_SERIES.cpi)
      };
    }

    return normalized;
  }

  function parseMacroMeta(payload, fallbackSource = 'snapshot') {
    const sourceValue = String(
      payload?.source ||
      payload?.meta?.source ||
      fallbackSource ||
      'snapshot'
    ).trim();
    const source = sourceValue || 'snapshot';

    const updatedAtRaw = payload?.updatedAt || payload?.meta?.updatedAt || null;
    const cachedAtRaw = payload?.cachedAt || payload?.meta?.cachedAt || null;
    const updatedAtMs = Date.parse(updatedAtRaw || '');
    const cachedAtMs = Date.parse(cachedAtRaw || '');

    return {
      source,
      updatedAt: Number.isFinite(updatedAtMs) ? new Date(updatedAtMs).toISOString() : null,
      cachedAt: Number.isFinite(cachedAtMs) ? new Date(cachedAtMs).toISOString() : null
    };
  }

  function loadMacroSnapshot() {
    try {
      const raw = localStorage.getItem(ANALYTICS_MACRO_SNAPSHOT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        macroSnapshotMeta = parseMacroMeta(parsed, 'snapshot-local');
        return normalizeMacroBundle(parsed?.data || parsed);
      }
    } catch (error) {}

    macroSnapshotMeta = parseMacroMeta({ source: 'fallback' }, 'fallback');
    return normalizeMacroBundle(MACRO_FALLBACK_SERIES);
  }

  function saveMacroSnapshot(payload, meta = null) {
    const normalized = normalizeMacroBundle(payload);
    const nowIso = new Date().toISOString();
    const normalizedMeta = parseMacroMeta({
      source: meta?.source || 'snapshot',
      updatedAt: meta?.updatedAt || nowIso,
      cachedAt: nowIso
    }, meta?.source || 'snapshot');

    macroSnapshotSeries = normalized;
    macroSnapshotMeta = normalizedMeta;
    try {
      localStorage.setItem(ANALYTICS_MACRO_SNAPSHOT_KEY, JSON.stringify({
        updatedAt: normalizedMeta.updatedAt,
        cachedAt: normalizedMeta.cachedAt,
        source: normalizedMeta.source,
        data: normalized
      }));
    } catch (error) {}
    return normalized;
  }

  function getMacroSnapshot() {
    if (!macroSnapshotSeries) {
      macroSnapshotSeries = loadMacroSnapshot();
    }
    return macroSnapshotSeries;
  }

  function getMacroSnapshotMeta() {
    if (!macroSnapshotSeries) {
      macroSnapshotSeries = loadMacroSnapshot();
    } else if (!macroSnapshotMeta) {
      macroSnapshotMeta = parseMacroMeta({ source: 'snapshot' }, 'snapshot');
    }
    return macroSnapshotMeta;
  }

  function getLatestMacroSeriesDate(macroData = {}) {
    const dateValues = ['ndx', 'brent', 'cpi']
      .flatMap((key) => (Array.isArray(macroData?.[key]) ? macroData[key] : []))
      .map((row) => Date.parse(row?.date || ''))
      .filter((value) => Number.isFinite(value));
    if (!dateValues.length) return null;
    return new Date(Math.max(...dateValues));
  }

  function getMacroFreshness(meta = {}, macroData = {}) {
    const updatedAtMs = Date.parse(meta?.updatedAt || '');
    if (!Number.isFinite(updatedAtMs)) {
      const latestSeriesDate = getLatestMacroSeriesDate(macroData);
      if (!latestSeriesDate) {
        return {
          state: 'unknown',
          label: 'дата обновления не указана'
        };
      }
      return {
        state: 'unknown',
        label: `последняя дата в наборе: ${formatMacroDate(latestSeriesDate.toISOString())}`
      };
    }

    const ageHours = Math.max(0, (Date.now() - updatedAtMs) / (60 * 60 * 1000));
    if (ageHours >= MACRO_STALE_HARD_HOURS) {
      return {
        state: 'hard',
        label: `снимок устарел (${Math.round(ageHours)}ч)`
      };
    }
    if (ageHours >= MACRO_STALE_WARN_HOURS) {
      return {
        state: 'warn',
        label: `снимок не свежий (${Math.round(ageHours)}ч)`
      };
    }
    return {
      state: 'fresh',
      label: `обновлено ${formatUpdatedAt(new Date(updatedAtMs))}`
    };
  }

  function getMacroSourceLabel(sourceMode = 'snapshot', meta = {}) {
    const sourceRaw = String(meta?.source || sourceMode || 'snapshot').toLowerCase();
    if (sourceMode === 'live' || sourceRaw.includes('live')) return 'live';
    if (sourceRaw.includes('fred')) return 'snapshot/fred';
    if (sourceRaw.includes('local')) return 'snapshot/local';
    if (sourceRaw.includes('fallback')) return 'snapshot/fallback';
    return 'snapshot';
  }

  function getSeriesPoint(series, fromEndIndex) {
    const index = series.length - 1 - fromEndIndex;
    return index >= 0 ? series[index] : null;
  }

  function getPctChange(current, previous) {
    const currentValue = Number(current?.value);
    const previousValue = Number(previous?.value);
    if (!Number.isFinite(currentValue) || !Number.isFinite(previousValue) || previousValue === 0) {
      return null;
    }
    return ((currentValue - previousValue) / previousValue) * 100;
  }

  function formatMacroDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    }).format(date);
  }

  function isLikelyCorsNetworkError(error) {
    const message = String(error?.message || '').toLowerCase();
    return (
      message.includes('failed to fetch') ||
      message.includes('networkerror') ||
      message.includes('load failed') ||
      message.includes('cors') ||
      message.includes('http 0')
    );
  }

  async function fetchMacroSnapshotFile(signal) {
    const cacheBust = Date.now();
    const payload = await fetchJsonWithRetry(`${ANALYTICS_MACRO_SNAPSHOT_FILE_URL}?v=${cacheBust}`, {
      signal,
      timeoutMs: 8000,
      maxAttempts: 1
    });
    return {
      series: normalizeMacroBundle(payload),
      meta: parseMacroMeta(payload, 'snapshot-file')
    };
  }

  async function fetchMacroFromFred(signal) {
    if (Date.now() < macroLiveDisabledUntil) {
      throw new Error(macroLiveDisabledReason || 'Live-макро временно отключен, используется snapshot.');
    }

    const loadSeries = (seriesId) => fetchTextWithRetry(`${FRED_GRAPH_BASE}${seriesId}`, {
      signal,
      timeoutMs: 6000,
      maxAttempts: 1
    });

    let ndxCsv;
    let brentCsv;
    let cpiCsv;
    try {
      ndxCsv = await loadSeries('NASDAQ100');
      brentCsv = await loadSeries('DCOILBRENTEU');
      cpiCsv = await loadSeries('CPIAUCSL');
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw error;
      }
      if (isLikelyCorsNetworkError(error)) {
        macroLiveDisabledUntil = Date.now() + MACRO_LIVE_DISABLE_MS;
        macroLiveDisabledReason = 'FRED недоступен из браузера (CORS), использую snapshot.';
      }
      throw error;
    }

    return {
      series: normalizeMacroBundle({
        ndx: parseFredCsv(ndxCsv),
        brent: parseFredCsv(brentCsv),
        cpi: parseFredCsv(cpiCsv)
      }),
      meta: parseMacroMeta({
        source: 'fred-live',
        updatedAt: new Date().toISOString(),
        cachedAt: new Date().toISOString()
      }, 'fred-live')
    };
  }

  async function fetchMacroData(signal) {
    if (IS_LOCAL_OR_FILE_RUNTIME) {
      try {
        const snapshotPayload = await fetchMacroSnapshotFile(signal);
        return {
          series: snapshotPayload.series,
          sourceMode: 'snapshot',
          meta: snapshotPayload.meta
        };
      } catch (snapshotError) {
        if (snapshotError?.name === 'AbortError') {
          throw snapshotError;
        }
        return {
          series: getMacroSnapshot(),
          sourceMode: 'snapshot',
          meta: getMacroSnapshotMeta()
        };
      }
    }

    if (Date.now() < macroLiveDisabledUntil) {
      try {
        const snapshotPayload = await fetchMacroSnapshotFile(signal);
        return {
          series: snapshotPayload.series,
          sourceMode: 'snapshot',
          meta: snapshotPayload.meta
        };
      } catch (snapshotError) {
        if (snapshotError?.name === 'AbortError') {
          throw snapshotError;
        }
        return {
          series: getMacroSnapshot(),
          sourceMode: 'snapshot',
          meta: getMacroSnapshotMeta()
        };
      }
    }

    try {
      const livePayload = await fetchMacroFromFred(signal);
      return {
        series: livePayload.series,
        sourceMode: 'live',
        meta: livePayload.meta
      };
    } catch (liveError) {
      if (liveError?.name === 'AbortError') {
        throw liveError;
      }
      try {
        const snapshotPayload = await fetchMacroSnapshotFile(signal);
        return {
          series: snapshotPayload.series,
          sourceMode: 'snapshot',
          meta: snapshotPayload.meta
        };
      } catch (snapshotError) {
        if (snapshotError?.name === 'AbortError') {
          throw snapshotError;
        }
        return {
          series: getMacroSnapshot(),
          sourceMode: 'snapshot',
          meta: getMacroSnapshotMeta()
        };
      }
    }
  }

  function buildMacroSignal(macroData = {}, horizon = '1h', sourceMode = 'live', meta = null) {
    const ndxSeries = Array.isArray(macroData.ndx) ? macroData.ndx : [];
    const brentSeries = Array.isArray(macroData.brent) ? macroData.brent : [];
    const cpiSeries = Array.isArray(macroData.cpi) ? macroData.cpi : [];
    const sourceLabel = getMacroSourceLabel(sourceMode, meta || {});
    const freshness = getMacroFreshness(meta || {}, macroData);

    const ndxCurrent = getSeriesPoint(ndxSeries, 0);
    const ndx5Ago = getSeriesPoint(ndxSeries, 5);
    const ndx20Ago = getSeriesPoint(ndxSeries, 20);
    const ndx5d = getPctChange(ndxCurrent, ndx5Ago);
    const ndx20d = getPctChange(ndxCurrent, ndx20Ago);

    const brentCurrent = getSeriesPoint(brentSeries, 0);
    const brent5Ago = getSeriesPoint(brentSeries, 5);
    const brent5d = getPctChange(brentCurrent, brent5Ago);

    const cpiCurrent = getSeriesPoint(cpiSeries, 0);
    const cpiPrev = getSeriesPoint(cpiSeries, 1);
    const cpiYearAgo = getSeriesPoint(cpiSeries, 12);
    const cpiPrevYearAgo = getSeriesPoint(cpiSeries, 13);
    const cpiYoY = getPctChange(cpiCurrent, cpiYearAgo);
    const cpiPrevYoY = getPctChange(cpiPrev, cpiPrevYearAgo);

    let baseScore = 0;

    if (Number.isFinite(ndx5d)) {
      if (ndx5d >= 2) baseScore += 3;
      else if (ndx5d <= -2) baseScore -= 3;
    }
    if (Number.isFinite(ndx20d)) {
      if (ndx20d >= 5) baseScore += 3;
      else if (ndx20d <= -5) baseScore -= 3;
    }

    if (Number.isFinite(brent5d)) {
      if (brent5d >= 5) baseScore -= 2;
      else if (brent5d <= -5) baseScore += 2;
    }

    if (Number.isFinite(cpiYoY)) {
      if (cpiYoY >= 4) baseScore -= 2;
      else if (cpiYoY <= 3) baseScore += 1;
    }
    if (Number.isFinite(cpiYoY) && Number.isFinite(cpiPrevYoY)) {
      if (cpiYoY <= cpiPrevYoY - 0.15) baseScore += 2;
      else if (cpiYoY >= cpiPrevYoY + 0.15) baseScore -= 2;
    }

    const weightedScore = clamp(Math.round(baseScore * (MACRO_HORIZON_WEIGHT[horizon] || 1)), -12, 12);

    let regime = sourceMode === 'snapshot' ? `Macro: ${sourceLabel}` : 'Macro: live';
    let summary = sourceMode === 'snapshot'
      ? `Макро-фон собран из ${sourceLabel}: ${freshness.label}.`
      : 'Макро-фон нейтральный: внешние индикаторы не дают сильного перекоса.';
    if (weightedScore >= 5) {
      regime = sourceMode === 'snapshot' ? `Macro: ${sourceLabel} risk-on` : 'Macro: risk-on';
      summary = sourceMode === 'snapshot'
        ? `Макро-снимок (${sourceLabel}) поддерживает risk-on: ${freshness.label}.`
        : 'Макро-фон поддерживает risk-on: NDX помогает, CPI не усиливает давление, Brent не мешает.';
    } else if (weightedScore <= -5) {
      regime = sourceMode === 'snapshot' ? `Macro: ${sourceLabel} risk-off` : 'Macro: risk-off';
      summary = sourceMode === 'snapshot'
        ? `Макро-снимок (${sourceLabel}) уходит в risk-off: ${freshness.label}.`
        : 'Макро-фон уходит в risk-off: рост Brent или слабость NDX ухудшают общий режим.';
    }

    return {
      score: weightedScore,
      text: `NDX ${Number.isFinite(ndx5d) ? `${ndx5d.toFixed(2)}%` : '-'} 5д • Brent ${Number.isFinite(brent5d) ? `${brent5d.toFixed(2)}%` : '-'} 5д • CPI ${Number.isFinite(cpiYoY) ? `${cpiYoY.toFixed(2)}% YoY` : '-'}`,
      summary,
      badge: regime,
      ndx: {
        value: Number.isFinite(ndxCurrent?.value) ? ndxCurrent.value.toFixed(2) : '-',
        text: `5д ${Number.isFinite(ndx5d) ? `${ndx5d.toFixed(2)}%` : '-'} • 20д ${Number.isFinite(ndx20d) ? `${ndx20d.toFixed(2)}%` : '-'} • ${formatMacroDate(ndxCurrent?.date)}`
      },
      brent: {
        value: Number.isFinite(brentCurrent?.value) ? `${brentCurrent.value.toFixed(2)} $` : '-',
        text: `5д ${Number.isFinite(brent5d) ? `${brent5d.toFixed(2)}%` : '-'} • ${formatMacroDate(brentCurrent?.date)}`
      },
      cpi: {
        value: Number.isFinite(cpiYoY) ? `${cpiYoY.toFixed(2)}% YoY` : '-',
        text: `Пред. ${Number.isFinite(cpiPrevYoY) ? `${cpiPrevYoY.toFixed(2)}%` : '-'} • ${formatMacroDate(cpiCurrent?.date)}`
      },
      meta: {
        sourceLabel,
        freshness: freshness.state,
        freshnessText: freshness.label
      }
    };
  }

  async function fetchBinanceData(symbol, horizon, signal) {
    const [klines, depth] = await Promise.all([
      fetchJsonWithRetry(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${horizon}&limit=240`, { signal }),
      fetchJsonWithRetry(`https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=20`, { signal })
    ]);

    return {
      klines: Array.isArray(klines) ? klines : [],
      depth: depth && typeof depth === 'object' ? depth : { asks: [], bids: [] }
    };
  }

  async function fetchFuturesData(symbol, horizon, signal) {
    const period = ANALYTICS_FUTURES_PERIOD_BY_HORIZON[horizon] || '1h';
    const bybitInterval = ANALYTICS_BYBIT_INTERVAL_BY_HORIZON[horizon] || '1h';
    const bybitRatioPeriod = ANALYTICS_BYBIT_RATIO_PERIOD_BY_HORIZON[horizon] || '1h';
    const sourceErrors = [];

    const unwrapBybitPayload = (payload, endpointName) => {
      if (!payload || Number(payload.retCode) !== 0) {
        throw new Error(payload?.retMsg || `Bybit ${endpointName} error`);
      }
      return payload.result || {};
    };

    const loadBinanceFutures = async () => {
      const [openInterest, premiumIndex, openInterestHistory, topPositionRatio, topAccountRatio, fundingHistoryRaw] = await Promise.all([
        fetchJsonWithRetry(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${symbol}`, { signal }),
        fetchJsonWithRetry(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`, { signal }),
        fetchJsonWithRetry(`https://fapi.binance.com/futures/data/openInterestHist?symbol=${symbol}&period=${period}&limit=48`, { signal }),
        fetchJsonWithRetry(`https://fapi.binance.com/futures/data/topLongShortPositionRatio?symbol=${symbol}&period=${period}&limit=1`, { signal }),
        fetchJsonWithRetry(`https://fapi.binance.com/futures/data/topLongShortAccountRatio?symbol=${symbol}&period=${period}&limit=1`, { signal }),
        fetchJsonWithRetry(`https://fapi.binance.com/fapi/v1/fundingRate?symbol=${symbol}&limit=16`, { signal })
      ]);

      const oiHistory = (Array.isArray(openInterestHistory) ? openInterestHistory : [])
        .map((row) => ({
          timestamp: Number(row?.timestamp),
          value: Number(row?.sumOpenInterestValue || row?.sumOpenInterest || row?.openInterest)
        }))
        .filter((row) => Number.isFinite(row.timestamp))
        .sort((a, b) => a.timestamp - b.timestamp);
      const latestOi = oiHistory.at(-1)?.value;
      const previousOi = oiHistory.length > 1 ? oiHistory.at(-2)?.value : null;
      const oiDeltaPct = Number.isFinite(latestOi) && Number.isFinite(previousOi) && previousOi > 0
        ? ((latestOi - previousOi) / previousOi) * 100
        : null;
      const markPrice = Number(premiumIndex?.markPrice);
      const openInterestContracts = Number(openInterest?.openInterest);
      const topPositionRow = Array.isArray(topPositionRatio) ? topPositionRatio[0] : null;
      const topAccountRow = Array.isArray(topAccountRatio) ? topAccountRatio[0] : null;
      const fundingRateHistory = (Array.isArray(fundingHistoryRaw) ? fundingHistoryRaw : [])
        .map((row) => Number(row?.fundingRate))
        .filter((value) => Number.isFinite(value));
      const oiHistoryUsd = oiHistory
        .map((row) => row.value)
        .filter((value) => Number.isFinite(value) && value > 0);

      return {
        openInterest: Number.isFinite(openInterestContracts) && Number.isFinite(markPrice)
          ? openInterestContracts * markPrice
          : null,
        markPrice,
        fundingRate: Number(premiumIndex?.lastFundingRate),
        fundingRateHistory,
        oiHistoryUsd,
        oiDeltaPct,
        topPositionRatio: Number(topPositionRow?.longShortRatio),
        topAccountRatio: Number(topAccountRow?.longShortRatio),
        longAccount: Number(topAccountRow?.longAccount),
        shortAccount: Number(topAccountRow?.shortAccount)
      };
    };

    const loadBybitFutures = async () => {
      const [openInterestRaw, tickersRaw, accountRatioRaw, fundingHistoryRaw] = await Promise.all([
        fetchJsonWithRetry(`https://api.bybit.com/v5/market/open-interest?category=linear&symbol=${symbol}&intervalTime=${bybitInterval}&limit=48`, { signal }),
        fetchJsonWithRetry(`https://api.bybit.com/v5/market/tickers?category=linear&symbol=${symbol}`, { signal }),
        fetchJsonWithRetry(`https://api.bybit.com/v5/market/account-ratio?category=linear&symbol=${symbol}&period=${bybitRatioPeriod}&limit=1`, { signal }),
        fetchJsonWithRetry(`https://api.bybit.com/v5/market/funding/history?category=linear&symbol=${symbol}&limit=16`, { signal })
      ]);

      const openInterestResult = unwrapBybitPayload(openInterestRaw, 'open-interest');
      const tickersResult = unwrapBybitPayload(tickersRaw, 'tickers');
      const accountRatioResult = unwrapBybitPayload(accountRatioRaw, 'account-ratio');
      const fundingHistoryResult = unwrapBybitPayload(fundingHistoryRaw, 'funding-history');

      const oiRows = Array.isArray(openInterestResult?.list)
        ? openInterestResult.list
            .map((row) => ({
              timestamp: Number(row?.timestamp),
              openInterest: Number(row?.openInterest)
            }))
            .filter((row) => Number.isFinite(row.timestamp))
            .sort((a, b) => a.timestamp - b.timestamp)
        : [];
      const latestOiRow = oiRows.at(-1) || null;
      const previousOiRow = oiRows.length > 1 ? oiRows.at(-2) : null;
      const oiDeltaPct = Number.isFinite(latestOiRow?.openInterest) && Number.isFinite(previousOiRow?.openInterest) && previousOiRow.openInterest > 0
        ? ((latestOiRow.openInterest - previousOiRow.openInterest) / previousOiRow.openInterest) * 100
        : null;

      const tickerRow = Array.isArray(tickersResult?.list) ? (tickersResult.list[0] || null) : null;
      const markPrice = Number(tickerRow?.markPrice || tickerRow?.lastPrice || tickerRow?.indexPrice);
      const tickerOiUsd = Number(tickerRow?.openInterestValue);
      const openInterest = Number.isFinite(tickerOiUsd) && tickerOiUsd > 0
        ? tickerOiUsd
        : Number.isFinite(latestOiRow?.openInterest) && Number.isFinite(markPrice)
          ? latestOiRow.openInterest * markPrice
          : null;

      const accountRow = Array.isArray(accountRatioResult?.list) ? (accountRatioResult.list[0] || null) : null;
      const buyRatio = Number(accountRow?.buyRatio);
      const sellRatio = Number(accountRow?.sellRatio);
      const topAccountRatio = Number.isFinite(buyRatio) && Number.isFinite(sellRatio) && sellRatio > 0
        ? buyRatio / sellRatio
        : null;
      const sideSum = buyRatio + sellRatio;
      const longAccount = Number.isFinite(sideSum) && sideSum > 0 ? buyRatio / sideSum : null;
      const shortAccount = Number.isFinite(sideSum) && sideSum > 0 ? sellRatio / sideSum : null;
      const oiHistoryUsd = oiRows
        .map((row) => (Number.isFinite(markPrice) ? row.openInterest * markPrice : NaN))
        .filter((value) => Number.isFinite(value) && value > 0);
      const fundingRateHistory = (Array.isArray(fundingHistoryResult?.list) ? fundingHistoryResult.list : [])
        .map((row) => Number(row?.fundingRate))
        .filter((value) => Number.isFinite(value));

      return {
        openInterest,
        markPrice,
        fundingRate: Number(tickerRow?.fundingRate),
        fundingRateHistory,
        oiHistoryUsd,
        oiDeltaPct,
        topPositionRatio: null,
        topAccountRatio,
        longAccount,
        shortAccount
      };
    };

    const [binanceResult, bybitResult] = await Promise.allSettled([
      loadBinanceFutures(),
      loadBybitFutures()
    ]);

    const binance = binanceResult.status === 'fulfilled' ? binanceResult.value : {};
    const bybit = bybitResult.status === 'fulfilled' ? bybitResult.value : {};

    if (binanceResult.status !== 'fulfilled') {
      sourceErrors.push(`Binance: ${binanceResult.reason?.message || binanceResult.reason}`);
    }
    if (bybitResult.status !== 'fulfilled') {
      sourceErrors.push(`Bybit: ${bybitResult.reason?.message || bybitResult.reason}`);
    }

    if (!Number.isFinite(binance.openInterest) && !Number.isFinite(bybit.openInterest)) {
      throw new Error(`Не удалось получить фьючерсные данные. ${sourceErrors.join(' | ')}`);
    }

    const weightedByOi = (binanceValue, bybitValue) => {
      const bVal = Number(binanceValue);
      const yVal = Number(bybitValue);
      const bWeight = Number(binance.openInterest);
      const yWeight = Number(bybit.openInterest);
      let weightedSum = 0;
      let totalWeight = 0;

      if (Number.isFinite(bVal) && Number.isFinite(bWeight) && bWeight > 0) {
        weightedSum += bVal * bWeight;
        totalWeight += bWeight;
      }
      if (Number.isFinite(yVal) && Number.isFinite(yWeight) && yWeight > 0) {
        weightedSum += yVal * yWeight;
        totalWeight += yWeight;
      }
      if (totalWeight > 0) return weightedSum / totalWeight;

      const values = [bVal, yVal].filter((value) => Number.isFinite(value));
      if (!values.length) return null;
      return values.reduce((sum, value) => sum + value, 0) / values.length;
    };

    const averageValues = (...values) => {
      const normalized = values.map((value) => Number(value)).filter((value) => Number.isFinite(value));
      if (!normalized.length) return null;
      return normalized.reduce((sum, value) => sum + value, 0) / normalized.length;
    };

    const calculateZScore = (series) => {
      const values = (Array.isArray(series) ? series : []).filter((value) => Number.isFinite(value));
      if (values.length < 6) return null;
      const latest = values.at(-1);
      const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
      const variance = values.reduce((sum, value) => sum + ((value - mean) * (value - mean)), 0) / values.length;
      const std = Math.sqrt(variance);
      if (!Number.isFinite(std) || std <= 0) return null;
      return (latest - mean) / std;
    };

    const toPctSeries = (series) => {
      const values = (Array.isArray(series) ? series : []).filter((value) => Number.isFinite(value) && value > 0);
      if (values.length < 3) return [];
      const out = [];
      for (let i = 1; i < values.length; i++) {
        out.push(((values[i] - values[i - 1]) / values[i - 1]) * 100);
      }
      return out;
    };

    const oiZBinance = calculateZScore(toPctSeries(binance.oiHistoryUsd));
    const oiZBybit = calculateZScore(toPctSeries(bybit.oiHistoryUsd));
    const markPrice = weightedByOi(binance.markPrice, bybit.markPrice);
    const averageTail = (series, size = 4) => {
      const values = (Array.isArray(series) ? series : []).filter((value) => Number.isFinite(value));
      if (!values.length) return null;
      const slice = values.slice(-size);
      return slice.reduce((sum, value) => sum + value, 0) / slice.length;
    };
    const fundingHistoryBaseline = averageValues(
      averageTail(binance.fundingRateHistory, 4),
      averageTail(bybit.fundingRateHistory, 4)
    );
    const fundingRate = weightedByOi(binance.fundingRate, bybit.fundingRate);

    return {
      openInterest: (Number.isFinite(binance.openInterest) ? binance.openInterest : 0)
        + (Number.isFinite(bybit.openInterest) ? bybit.openInterest : 0),
      markPrice,
      fundingRate,
      fundingMomentum: Number.isFinite(fundingRate) && Number.isFinite(fundingHistoryBaseline)
        ? fundingRate - fundingHistoryBaseline
        : null,
      oiDeltaPct: weightedByOi(binance.oiDeltaPct, bybit.oiDeltaPct),
      oiZScore: averageValues(oiZBinance, oiZBybit),
      topPositionRatio: averageValues(binance.topPositionRatio, bybit.topPositionRatio),
      topAccountRatio: averageValues(binance.topAccountRatio, bybit.topAccountRatio),
      longAccount: averageValues(binance.longAccount, bybit.longAccount),
      shortAccount: averageValues(binance.shortAccount, bybit.shortAccount),
      sourceErrors,
      sources: {
        binance,
        bybit
      }
    };
  }

  function loadLiquidationBias(symbol, horizon) {
    try {
      const raw = localStorage.getItem(ANALYTICS_LIQUIDATION_CACHE_KEY);
      if (!raw) {
        return {
          score: 0,
          text: 'Нет свежих ликвидаций для выбранной монеты.',
          longUsd: 0,
          shortUsd: 0,
          totalUsd: 0
        };
      }

      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed?.items) ? parsed.items : [];
      const cutoff = Date.now() - ((HORIZON_WINDOW_MINUTES[horizon] || 60) * 60 * 1000);
      const filtered = items.filter((item) => item?.symbol === symbol && Number(item?.timestamp) >= cutoff);

      const longUsd = filtered
        .filter((item) => item?.liquidationSide === 'long')
        .reduce((sum, item) => sum + Number(item?.usdValue || 0), 0);
      const shortUsd = filtered
        .filter((item) => item?.liquidationSide === 'short')
        .reduce((sum, item) => sum + Number(item?.usdValue || 0), 0);
      const totalUsd = longUsd + shortUsd;
      const clusterWindowMs = 5 * 60 * 1000;
      const clusterBuckets = new Map();
      filtered.forEach((item) => {
        const ts = Number(item?.timestamp);
        const usd = Number(item?.usdValue || 0);
        if (!Number.isFinite(ts) || !Number.isFinite(usd)) return;
        const bucket = Math.floor(ts / clusterWindowMs) * clusterWindowMs;
        if (!clusterBuckets.has(bucket)) {
          clusterBuckets.set(bucket, {
            totalUsd: 0,
            events: 0,
            longUsd: 0,
            shortUsd: 0
          });
        }
        const current = clusterBuckets.get(bucket);
        current.totalUsd += usd;
        current.events += 1;
        if (item?.liquidationSide === 'long') current.longUsd += usd;
        if (item?.liquidationSide === 'short') current.shortUsd += usd;
      });
      const clusters = [...clusterBuckets.values()]
        .filter((bucket) => bucket.events >= 3 || bucket.totalUsd >= 250000);
      const clusterCount = clusters.length;
      const clusterTotalUsd = clusters.reduce((sum, cluster) => sum + cluster.totalUsd, 0);
      const clusterLongUsd = clusters.reduce((sum, cluster) => sum + cluster.longUsd, 0);
      const clusterShortUsd = clusters.reduce((sum, cluster) => sum + cluster.shortUsd, 0);
      const clusterDominant = clusterShortUsd > clusterLongUsd ? 'SHORT' : clusterLongUsd > clusterShortUsd ? 'LONG' : 'MIX';

      if (!totalUsd) {
        return {
          score: 0,
          text: 'В кэше нет ликвидаций за выбранное окно.',
          longUsd,
          shortUsd,
          totalUsd,
          clusterCount,
          clusterTotalUsd,
          clusterDominant
        };
      }

      const imbalance = (shortUsd - longUsd) / totalUsd;
      const volumeBoost = totalUsd >= 250000 ? 1.2 : totalUsd >= 100000 ? 1 : 0.7;
      const clusterBoost = clusterCount >= 3 ? 1.2 : clusterCount >= 1 ? 1.1 : 1;
      const score = clamp(Math.round(imbalance * 10 * volumeBoost * clusterBoost), -15, 15);
      const dominant = shortUsd > longUsd
        ? 'Преобладают SHORT-ликвидации: рынок выбивает шортистов.'
        : longUsd > shortUsd
          ? 'Преобладают LONG-ликвидации: давление идет сверху вниз.'
          : 'Ликвидации сбалансированы.';
      const clusterText = clusterCount
        ? ` Кластеры ${clusterCount}, объем ${formatCompactNumber(clusterTotalUsd)} $, доминирует ${clusterDominant}.`
        : '';

      return {
        score,
        text: `${dominant} Объем ${formatCompactNumber(totalUsd)} $.${clusterText}`,
        longUsd,
        shortUsd,
        totalUsd,
        clusterCount,
        clusterTotalUsd,
        clusterDominant
      };
    } catch (error) {
      return {
        score: 0,
        text: 'Не удалось прочитать локальный кэш ликвидаций.',
        longUsd: 0,
        shortUsd: 0,
        totalUsd: 0,
        clusterCount: 0,
        clusterTotalUsd: 0,
        clusterDominant: 'MIX'
      };
    }
  }

  function getScenarioMeta(totalScore, maxRange = 1) {
    const ratio = maxRange > 0 ? totalScore / maxRange : 0;
    if (ratio >= 0.42) {
      return {
        label: 'STRONG BULLISH',
        hint: 'Преобладает сильный бычий сценарий, но за ним стоит идти только с учетом риска отката.',
        color: '#16a34a'
      };
    }
    if (ratio >= 0.14) {
      return {
        label: 'BULLISH',
        hint: 'Сигналы смещены вверх, но движение еще требует подтверждения.',
        color: '#22c55e'
      };
    }
    if (ratio <= -0.42) {
      return {
        label: 'STRONG BEARISH',
        hint: 'Доминирует давление вниз, рынок выглядит агрессивно слабым.',
        color: '#dc2626'
      };
    }
    if (ratio <= -0.14) {
      return {
        label: 'BEARISH',
        hint: 'Сигналы склоняются вниз, но без явного импульсного обвала.',
        color: '#ef4444'
      };
    }
    return {
      label: 'NEUTRAL',
      hint: 'Сигналы смешанные, рынок пока без явного перекоса.',
      color: '#f59e0b'
    };
  }

  function getRiskLabel(volatilitySignal, totalScore, maxRange = 1) {
    const ratio = maxRange > 0 ? Math.abs(totalScore / maxRange) : 0;
    if ((volatilitySignal?.atrPct || 0) >= 3.5) return 'Риск: высокий';
    if (ratio >= 0.42) return 'Риск: средний';
    return 'Риск: умеренный';
  }

  function buildProbabilities(totalScore, maxRange = 1) {
    const ratio = maxRange > 0 ? totalScore / maxRange : 0;
    const strength = clamp(Math.abs(ratio) * 100, 0, 70);
    const neutral = clamp(40 - (strength * 0.45), 10, 40);
    let bullish = (100 - neutral) / 2;
    let bearish = bullish;

    if (ratio > 0) {
      bullish += strength * 0.35;
      bearish -= strength * 0.35;
    } else if (ratio < 0) {
      bearish += strength * 0.35;
      bullish -= strength * 0.35;
    }

    bullish = clamp(bullish, 5, 90);
    bearish = clamp(bearish, 5, 90);
    let adjustedNeutral = clamp(100 - bullish - bearish, 5, 60);
    const total = bullish + bearish + adjustedNeutral;
    if (total !== 100) {
      const scale = 100 / total;
      bullish *= scale;
      bearish *= scale;
      adjustedNeutral *= scale;
    }

    const bullishRounded = Math.round(bullish);
    const bearishRounded = Math.round(bearish);
    let neutralRounded = Math.round(adjustedNeutral);
    const drift = 100 - (bullishRounded + bearishRounded + neutralRounded);
    neutralRounded = Math.max(0, neutralRounded + drift);

    return {
      bullish: bullishRounded,
      bearish: bearishRounded,
      neutral: neutralRounded
    };
  }

  function getAdaptiveWeights(signals) {
    const trendScore = Math.abs(Number(signals?.trend?.score || 0));
    const atrPct = Number(signals?.volatility?.atrPct || 0);

    if (atrPct >= 3.5) {
      return {
        regime: 'high-vol',
        label: 'Режим: высокая волатильность',
        weights: {
          trend: 0.85,
          momentum: 0.9,
          volatility: 1.35,
          futures: 1.2,
          liquidity: 1.2,
          liquidation: 1.25,
          macro: 0.8
        }
      };
    }

    if (trendScore >= 18 && atrPct <= 2.2) {
      return {
        regime: 'trend',
        label: 'Режим: трендовый',
        weights: {
          trend: 1.35,
          momentum: 1.15,
          volatility: 0.75,
          futures: 1.1,
          liquidity: 0.9,
          liquidation: 0.9,
          macro: 0.85
        }
      };
    }

    return {
      regime: 'flat',
      label: 'Режим: флэт/баланс',
      weights: {
        trend: 0.9,
        momentum: 0.95,
        volatility: 1,
        futures: 1.2,
        liquidity: 1.25,
        liquidation: 1.05,
        macro: 1.15
      }
    };
  }

  function calculateWeightedScore(signals) {
    const adaptive = getAdaptiveWeights(signals);
    const keys = Object.keys(SIGNAL_ABS_RANGES);
    const contributions = keys.map((key) => {
      const raw = Number(signals?.[key]?.score || 0);
      const weight = Number(adaptive.weights?.[key] || 1);
      const weighted = raw * weight;
      return {
        key,
        raw,
        weight,
        weighted
      };
    });
    const totalScore = contributions.reduce((sum, item) => sum + item.weighted, 0);
    const maxRange = contributions.reduce((sum, item) => sum + ((SIGNAL_ABS_RANGES[item.key] || 0) * item.weight), 0);
    const clampedTotal = clamp(totalScore, -maxRange, maxRange);
    const confidence = maxRange > 0
      ? Math.round(((clampedTotal + maxRange) / (maxRange * 2)) * 100)
      : 50;

    return {
      adaptive,
      contributions,
      totalScore: clampedTotal,
      maxRange,
      confidence
    };
  }

  function renderContributionBars(contributions = [], regimeLabel = '') {
    contributionBarsEl.replaceChildren();
    regimeLabelEl.textContent = regimeLabel || 'Режим: neutral';
    if (!contributions.length) {
      contributionBarsEl.innerHTML = '<div class="analytics-empty">Диаграмма вклада появится после расчета.</div>';
      return;
    }

    const labels = {
      trend: 'Тренд',
      momentum: 'Импульс',
      futures: 'Фьючерсы',
      liquidity: 'Ликвидность',
      liquidation: 'Ликвидации',
      macro: 'Макро',
      volatility: 'Волатильность'
    };
    const maxAbs = contributions.reduce((max, item) => Math.max(max, Math.abs(item.weighted)), 0) || 1;
    const fragment = document.createDocumentFragment();

    contributions
      .slice()
      .sort((a, b) => Math.abs(b.weighted) - Math.abs(a.weighted))
      .forEach((item) => {
        const tone = item.weighted > 0 ? 'positive' : item.weighted < 0 ? 'negative' : 'neutral';
        const width = Math.max(6, Math.round((Math.abs(item.weighted) / maxAbs) * 100));
        const row = document.createElement('div');
        row.className = 'analytics-contrib-item';
        row.innerHTML = `
          <span class="analytics-contrib-label">${labels[item.key] || item.key}</span>
          <span class="analytics-contrib-track"><span class="analytics-contrib-fill ${tone}" style="width:${width}%"></span></span>
          <span class="analytics-contrib-value">${item.weighted > 0 ? '+' : ''}${item.weighted.toFixed(1)}</span>
        `;
        fragment.appendChild(row);
      });

    contributionBarsEl.appendChild(fragment);
  }

  function loadCalibrationState() {
    try {
      const raw = localStorage.getItem(ANALYTICS_CALIBRATION_KEY);
      if (!raw) return { records: [] };
      const parsed = JSON.parse(raw);
      return { records: Array.isArray(parsed?.records) ? parsed.records : [] };
    } catch (error) {
      return { records: [] };
    }
  }

  function saveCalibrationState(state) {
    try {
      localStorage.setItem(ANALYTICS_CALIBRATION_KEY, JSON.stringify(state));
    } catch (error) {}
  }

  function evaluateScenarioHit(label, returnPct) {
    if (!Number.isFinite(returnPct)) return false;
    if (label === 'STRONG BULLISH' || label === 'BULLISH') return returnPct >= 0.2;
    if (label === 'STRONG BEARISH' || label === 'BEARISH') return returnPct <= -0.2;
    if (label === 'NEUTRAL') return Math.abs(returnPct) <= 0.6;
    return false;
  }

  function updateCalibration({
    symbol,
    horizon,
    scenarioLabel,
    entryPrice,
    currentPrice,
    trackPrediction = false
  }) {
    const now = Date.now();
    const horizonMs = (HORIZON_WINDOW_MINUTES[horizon] || 60) * 60 * 1000;
    const state = loadCalibrationState();
    const records = Array.isArray(state.records) ? state.records : [];

    records.forEach((item) => {
      if (item?.resolvedAt) return;
      if (item?.symbol !== symbol || item?.horizon !== horizon) return;
      if ((now - Number(item.createdAt || 0)) < horizonMs) return;
      const basePrice = Number(item.entryPrice);
      if (!Number.isFinite(basePrice) || basePrice <= 0 || !Number.isFinite(currentPrice)) return;
      const returnPct = ((currentPrice - basePrice) / basePrice) * 100;
      item.resolvedAt = now;
      item.returnPct = returnPct;
      item.hit = evaluateScenarioHit(item.scenarioLabel, returnPct);
    });

    if (trackPrediction && Number.isFinite(entryPrice) && entryPrice > 0) {
      const lastSame = [...records]
        .reverse()
        .find((item) => item?.symbol === symbol && item?.horizon === horizon);
      const shouldAdd = !lastSame || (now - Number(lastSame.createdAt || 0)) >= Math.max(10 * 60 * 1000, Math.floor(horizonMs / 3));
      if (shouldAdd) {
        records.push({
          symbol,
          horizon,
          scenarioLabel,
          entryPrice,
          createdAt: now,
          resolvedAt: null,
          hit: null,
          returnPct: null
        });
      }
    }

    const trimmedRecords = records.slice(-ANALYTICS_CALIBRATION_LIMIT);
    saveCalibrationState({ records: trimmedRecords });
    const resolved = trimmedRecords
      .filter((item) => Number.isFinite(item?.resolvedAt) && typeof item?.hit === 'boolean')
      .slice(-ANALYTICS_CALIBRATION_LOOKBACK);
    const hitCount = resolved.filter((item) => item.hit).length;
    const hitRate = resolved.length ? Math.round((hitCount / resolved.length) * 100) : null;

    return {
      hitRate,
      sample: resolved.length
    };
  }

  function buildReasons(signals) {
    const allSignals = [
      { title: 'Тренд', signal: signals.trend },
      { title: 'Импульс', signal: signals.momentum },
      { title: 'Фьючерсы', signal: signals.futures },
      { title: 'Ликвидность', signal: signals.liquidity },
      { title: 'Ликвидации', signal: signals.liquidation },
      { title: 'Макро-фон', signal: signals.macro },
      { title: 'Волатильность', signal: signals.volatility }
    ]
      .filter((item) => item.signal)
      .sort((a, b) => Math.abs(b.signal.score || 0) - Math.abs(a.signal.score || 0))
      .slice(0, 4);

    return allSignals.map((item) => ({
      tone: item.signal.score > 1 ? 'positive' : item.signal.score < -1 ? 'negative' : 'neutral',
      score: item.signal.score,
      title: item.title,
      text: item.signal.text
    }));
  }

  function renderReasons(reasons) {
    reasonsListEl.replaceChildren();
    if (!reasons.length) {
      reasonsListEl.innerHTML = '<div class="analytics-empty">Недостаточно данных, чтобы объяснить сценарий.</div>';
      return;
    }

    const fragment = document.createDocumentFragment();
    reasons.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'analytics-reason-item';
      row.innerHTML = `
        <span class="analytics-reason-tone ${item.tone}">${item.score > 0 ? '+' : ''}${item.score}</span>
        <div class="analytics-reason-text">
          <strong>${item.title}</strong>
          <span>${item.text}</span>
        </div>
      `;
      fragment.appendChild(row);
    });
    reasonsListEl.appendChild(fragment);
  }

  function applySignalCell(element, signal) {
    if (!element) return;
    element.textContent = `${signal.score > 0 ? '+' : ''}${signal.score}`;
    element.style.color = signal.score > 0 ? '#16a34a' : signal.score < 0 ? '#dc2626' : '#f59e0b';
  }

  function renderAnalytics(payload, sourceLabel = 'fresh') {
    const { symbol, horizon, signals, levels, fetchedAt } = payload;
    const weighted = calculateWeightedScore(signals);
    const totalScore = weighted.totalScore;
    const maxRange = weighted.maxRange;
    const confidence = weighted.confidence;
    const scenario = getScenarioMeta(totalScore, maxRange);
    const probabilities = buildProbabilities(totalScore, maxRange);
    const calibration = updateCalibration({
      symbol,
      horizon,
      scenarioLabel: scenario.label,
      entryPrice: Number(levels?.currentPrice),
      currentPrice: Number(levels?.currentPrice),
      trackPrediction: payload?.meta?.trackPrediction === true && sourceLabel === 'fresh'
    });
    const dominantPath = probabilities.bullish >= probabilities.bearish && probabilities.bullish >= probabilities.neutral
      ? 'Доминирует: сценарий продолжения вверх'
      : probabilities.bearish >= probabilities.bullish && probabilities.bearish >= probabilities.neutral
        ? 'Доминирует: сценарий продолжения вниз'
        : 'Доминирует: нейтральный сценарий / консолидация';

    scenarioEl.textContent = scenario.label;
    scenarioEl.style.color = scenario.color;
    scenarioHintEl.textContent = scenario.hint;
    scoreEl.textContent = `${confidence} / 100`;
    scoreEl.style.color = scenario.color;
    riskEl.textContent = `${getRiskLabel(signals.volatility, totalScore, maxRange)} • hit-rate ${Number.isFinite(calibration.hitRate) ? `${calibration.hitRate}% (${calibration.sample})` : 'недостаточно данных'}`;
    probabilitiesEl.textContent = `${probabilities.bullish}% / ${probabilities.bearish}% / ${probabilities.neutral}%`;
    dominantPathEl.textContent = dominantPath;

    applySignalCell(trendScoreEl, signals.trend);
    trendTextEl.textContent = signals.trend?.text || 'Нет данных';
    applySignalCell(momentumScoreEl, signals.momentum);
    momentumTextEl.textContent = signals.momentum?.text || 'Нет данных';
    applySignalCell(futuresScoreEl, signals.futures);
    futuresTextEl.textContent = signals.futures?.text || 'Нет данных';
    applySignalCell(liquidityScoreEl, signals.liquidity);
    liquidityTextEl.textContent = signals.liquidity?.text || 'Нет данных';
    applySignalCell(liquidationScoreEl, signals.liquidation);
    liquidationTextEl.textContent = signals.liquidation?.text || 'Нет данных';
    applySignalCell(macroScoreEl, signals.macro);
    macroTextEl.textContent = signals.macro?.text || 'Нет данных';

    macroSummaryEl.textContent = signals.macro?.summary || 'Макро-данные не загружены.';
    macroSummaryHintEl.textContent = signals.macro?.badge || 'Macro: neutral';
    if ((signals.macro?.score || 0) >= 3) {
      macroSummaryHintEl.style.color = '#166534';
      macroSummaryHintEl.style.borderColor = 'rgba(34, 197, 94, 0.24)';
      macroSummaryHintEl.style.background = 'rgba(34, 197, 94, 0.10)';
    } else if ((signals.macro?.score || 0) <= -3) {
      macroSummaryHintEl.style.color = '#991b1b';
      macroSummaryHintEl.style.borderColor = 'rgba(239, 68, 68, 0.24)';
      macroSummaryHintEl.style.background = 'rgba(239, 68, 68, 0.10)';
    } else {
      macroSummaryHintEl.style.color = '';
      macroSummaryHintEl.style.borderColor = '';
      macroSummaryHintEl.style.background = '';
    }
    macroNdxValueEl.textContent = signals.macro?.ndx?.value || '-';
    macroNdxTextEl.textContent = signals.macro?.ndx?.text || 'Нет данных';
    macroBrentValueEl.textContent = signals.macro?.brent?.value || '-';
    macroBrentTextEl.textContent = signals.macro?.brent?.text || 'Нет данных';
    macroCpiValueEl.textContent = signals.macro?.cpi?.value || '-';
    macroCpiTextEl.textContent = signals.macro?.cpi?.text || 'Нет данных';

    renderContributionBars(weighted.contributions, weighted.adaptive.label);
    renderReasons(buildReasons(signals));

    supportEl.textContent = formatAnalyticsPrice(levels.support, levels.currentPrice);
    resistanceEl.textContent = formatAnalyticsPrice(levels.resistance, levels.currentPrice);
    rangeEl.textContent = Number.isFinite(levels.rangePct) ? `${levels.rangePct.toFixed(2)}%` : '-';
    currentPriceEl.textContent = formatAnalyticsPrice(levels.currentPrice, levels.currentPrice);

    updatedAtEl.textContent = fetchedAt ? `Обновление: ${formatUpdatedAt(fetchedAt)}` : 'Обновление: -';
    setStatus(
      sourceLabel === 'cache'
        ? `Показана аналитика из кэша для ${symbol.replace('USDT', '')} на горизонте ${getAnalyticsHorizonLabel(horizon)}.`
        : `Аналитика обновлена для ${symbol.replace('USDT', '')} на горизонте ${getAnalyticsHorizonLabel(horizon)} (${weighted.adaptive.label.toLowerCase()}).`,
      'ready'
    );
    setError('');
    syncHomeInsights();
  }

  function getCacheKey(symbol = symbolSelect.value, horizon = horizonSelect.value) {
    return `${symbol || 'ETHUSDT'}_${horizon || '1h'}`;
  }

  const cache = new AnalyticsCache();
  const calc = new SignalCalculator();
  macroSnapshotSeries = loadMacroSnapshot();

  async function updateAnalytics({ force = false } = {}) {
    const symbol = symbolSelect.value || 'ETHUSDT';
    const horizon = horizonSelect.value || '1h';
    const cacheKey = getCacheKey(symbol, horizon);
    const requestId = ++analyticsRequestId;
    setError('');
    setStatus(`Собираю аналитику по ${symbol.replace('USDT', '')} на горизонте ${getAnalyticsHorizonLabel(horizon)}...`, 'loading');
    refreshBtn.disabled = true;
    refreshBtn.textContent = 'Считаю...';

    if (!force && cache.has(cacheKey)) {
      const cached = cache.get(cacheKey);
      if (requestId === analyticsRequestId) {
        renderAnalytics(cached, 'cache');
        analyticsLoadedOnce = true;
        refreshBtn.disabled = false;
        refreshBtn.textContent = 'Обновить аналитику';
      }
      return;
    }

    const controller = new AbortController();

    try {
      const [spotData, futuresData, macroResult] = await Promise.all([
        fetchBinanceData(symbol, horizon, controller.signal),
        fetchFuturesData(symbol, horizon, controller.signal),
        fetchMacroData(controller.signal)
          .then((data) => ({ ok: true, data }))
          .catch((error) => ({ ok: false, error }))
      ]);

      if (requestId !== analyticsRequestId) {
        controller.abort();
        return;
      }

      if (!Array.isArray(spotData.klines) || !spotData.klines.length) {
        throw new Error('Биржа не вернула свечи для выбранной монеты.');
      }

      const klines = spotData.klines
        .map((row) => ({
          open: Number(row?.[1]),
          high: Number(row?.[2]),
          low: Number(row?.[3]),
          close: Number(row?.[4]),
          volume: Number(row?.[7] || row?.[5])
        }))
        .filter((item) => Number.isFinite(item.close) && Number.isFinite(item.high) && Number.isFinite(item.low));

      if (klines.length < 30) {
        throw new Error('Недостаточно свечей для расчета аналитики.');
      }

      const trendSignal = calc.buildTrendSignal(klines);
      const momentumSignal = calc.buildMomentumSignal(klines);
      const volatilitySignal = calc.buildVolatilitySignal(klines);
      if (macroResult.ok) {
        saveMacroSnapshot(macroResult.data.series, macroResult.data.meta);
      }
      const signals = {
        trend: trendSignal,
        momentum: momentumSignal,
        volatility: volatilitySignal,
        futures: calc.buildFuturesSignal(futuresData, momentumSignal, { spotPrice: klines.at(-1)?.close }),
        liquidity: calc.buildLiquiditySignal(spotData.depth),
        liquidation: loadLiquidationBias(symbol, horizon),
        macro: macroResult.ok
          ? buildMacroSignal(macroResult.data.series, horizon, macroResult.data.sourceMode, macroResult.data.meta)
          : buildMacroSignal(getMacroSnapshot(), horizon, 'snapshot', getMacroSnapshotMeta())
      };
      const levels = calc.buildLevels(klines);
      const payload = {
        symbol,
        horizon,
        signals,
        levels,
        fetchedAt: new Date(),
        meta: {
          trackPrediction: force
        }
      };

      cache.set(cacheKey, payload, ANALYTICS_CACHE_TTL_MS);

      if (requestId !== analyticsRequestId) {
        return;
      }

      renderAnalytics(payload, 'fresh');
      analyticsLoadedOnce = true;
    } catch (error) {
      if (requestId !== analyticsRequestId || error?.name === 'AbortError') {
        return;
      }

      console.error('[analytics] update error', error);
      setStatus(`Не удалось обновить аналитику по ${symbol.replace('USDT', '')} на горизонте ${getAnalyticsHorizonLabel(horizon)}.`, 'ready');
      setError(error?.message || 'Ошибка загрузки аналитики.');
    } finally {
      if (requestId === analyticsRequestId) {
        refreshBtn.disabled = false;
        refreshBtn.textContent = 'Обновить аналитику';
      }
    }
  }

  function setSnapshotRefreshButtonLoading(isLoading = false) {
    if (!snapshotRefreshBtn) return;
    snapshotRefreshBtn.disabled = isLoading;
    snapshotRefreshBtn.textContent = isLoading ? 'Обновляю snapshot...' : 'Обновить macro snapshot';
  }

  async function updateMacroSnapshotFromGithub({ reconfigure = false } = {}) {
    if (!snapshotRefreshBtn || snapshotDispatchInFlight) return;
    snapshotDispatchInFlight = true;
    setSnapshotRefreshButtonLoading(true);
    setError('');

    const previousUpdatedAt = getMacroSnapshotMeta()?.updatedAt || '';

    try {
      setStatus('Запускаю GitHub Actions для macro snapshot...', 'loading');
      const config = ensureMacroGithubConfig({ reconfigure });
      await dispatchMacroSnapshotWorkflow(config);

      setStatus('Workflow запущен. Жду обновленный snapshot (до 3 минут)...', 'loading');
      const renewed = await waitForSnapshotRenew(previousUpdatedAt, 180000);

      if (!renewed || !renewed.series) {
        setStatus('Workflow запущен. Snapshot обновится чуть позже, затем нажми "Обновить аналитику".', 'ready');
        return;
      }

      saveMacroSnapshot(renewed.series, renewed.meta);
      cache.clear();
      setStatus('Snapshot обновлен. Пересчитываю аналитику...', 'loading');
      await updateAnalytics({ force: true });
    } catch (error) {
      console.error('[analytics] snapshot dispatch error', error);
      setStatus('Не удалось обновить macro snapshot через GitHub Actions.', 'ready');
      setError(error?.message || 'Ошибка запуска GitHub Actions.');
    } finally {
      snapshotDispatchInFlight = false;
      setSnapshotRefreshButtonLoading(false);
    }
  }

  function maybeRefreshAnalytics({ force = false } = {}) {
    const cacheKey = getCacheKey();
    if (!force && cache.has(cacheKey)) {
      renderAnalytics(cache.get(cacheKey), 'cache');
      analyticsLoadedOnce = true;
      return;
    }
    updateAnalytics({ force });
  }

  symbolSelect.addEventListener('change', () => updateAnalytics());
  horizonSelect.addEventListener('change', () => updateAnalytics());
  refreshBtn.addEventListener('click', () => updateAnalytics({ force: true }));
  if (snapshotRefreshBtn) {
    snapshotRefreshBtn.addEventListener('click', (event) => {
      updateMacroSnapshotFromGithub({ reconfigure: Boolean(event?.shiftKey) });
    });
  }
  helpButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleHelpTooltip(button);
    });
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.analytics-help-btn') && !event.target.closest('.analytics-help-tooltip')) {
      closeHelpTooltips();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeHelpTooltips();
    }
  });

  document.addEventListener('app:tab-changed', (event) => {
    if (event.detail?.tabId === 'analytics') {
      maybeRefreshAnalytics();
    } else {
      closeHelpTooltips();
    }
  });

  if (tabContent.classList.contains('active')) {
    maybeRefreshAnalytics();
  } else {
    setStatus('Открой вкладку или нажми обновление, чтобы посчитать аналитику.', 'neutral');
  }
})();
