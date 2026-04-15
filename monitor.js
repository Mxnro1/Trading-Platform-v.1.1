// Класс для управления монитором
async function fetchMonitorBinanceJson(path, options = {}) {
    if (typeof window.fetchBinanceJson === 'function') {
        return window.fetchBinanceJson(path, options);
    }

    const response = await fetch(`https://api.binance.com${path}`, {
        cache: 'no-store',
        ...options
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
}

class Monitor {
    constructor() {
        this.symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'TRXUSDT', 'ADAUSDT', 'DOGEUSDT', 'XRPUSDT', 'SOLUSDT', 'DOTUSDT', 'MATICUSDT', 'LINKUSDT', 'AVAXUSDT', 'SUIUSDT'];
        this.interval = '1m';
        this.refreshTimer = null;
        this.isRunning = false;

        this.initControls();
        this.bindTabEvents();
        this.bindVisibilityEvents();
        if (this.isMonitorVisible() && !document.hidden) {
            this.startUpdates();
        }
    }

    initControls() {
        const refreshBtn = document.getElementById('refreshMonitor');
        const intervalSelect = document.getElementById('monitorInterval');

        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.updateMonitorTable());
        }

        if (intervalSelect) {
            intervalSelect.addEventListener('change', (e) => {
                this.interval = e.target.value;
                this.updateMonitorTable();
            });
        }
    }

    bindTabEvents() {
        document.addEventListener('app:tab-changed', (event) => {
            if (event.detail?.tabId === 'monitor') {
                if (!document.hidden) {
                    this.startUpdates();
                }
            } else {
                this.stopUpdates();
            }
        });
    }

    bindVisibilityEvents() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.stopUpdates();
                return;
            }
            if (this.isMonitorVisible()) {
                this.startUpdates();
            }
        });
    }

    startUpdates() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.updateMonitorTable();
        this.refreshTimer = setInterval(() => this.updateMonitorTable(), 60000);
    }

    stopUpdates() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
        this.isRunning = false;
    }

    isMonitorVisible() {
        const tab = document.getElementById('monitor-tab');
        return !!tab && tab.classList.contains('active');
    }

    async updateMonitorTable() {
        const tbody = document.getElementById('monitorTableBody');
        if (!tbody) return;

        tbody.replaceChildren();

        const rows = await Promise.allSettled(
            this.symbols.map((symbol) => this.buildRowData(symbol))
        );

        let successCount = 0;

        rows.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value) {
                tbody.appendChild(this.createTableRow(result.value));
                successCount += 1;
            } else {
                tbody.appendChild(this.createErrorRow(this.symbols[index]));
                console.warn('[monitor] Ошибка загрузки данных для', this.symbols[index], result.reason || 'unknown error');
            }
        });

        if (!successCount) {
            tbody.replaceChildren(this.createStatusRow('Не удалось загрузить данные монитора. Проверьте соединение или лимиты API Binance.', 9));
        }
    }

    createStatusRow(text, colspan = 1) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = colspan;
        cell.textContent = text;
        row.appendChild(cell);
        return row;
    }

    createErrorRow(symbol) {
        const row = document.createElement('tr');
        const pair = document.createElement('td');
        pair.textContent = symbol.replace('USDT', ' / USDT');
        row.appendChild(pair);

        const errorCell = document.createElement('td');
        errorCell.colSpan = 8;
        errorCell.textContent = 'Ошибка загрузки данных';
        row.appendChild(errorCell);
        return row;
    }

    async buildRowData(symbol) {
        const [ticker, klines] = await Promise.all([
            this.fetchTicker(symbol),
            this.fetchKlines(symbol, this.interval, 100)
        ]);

        const rsi = this.calculateRSI(klines, 14);
        const lastRSI = rsi.length ? rsi[rsi.length - 1].value : null;
        const trend = this.calculateTrend(klines);

        let trendText = '-';
        let trendIcon = '';
        let trendClass = '';

        if (trend === 'Вверх') {
            trendText = 'Восходящий';
            trendIcon = '↑';
            trendClass = 'price-up';
        } else if (trend === 'Вниз') {
            trendText = 'Нисходящий';
            trendIcon = '↓';
            trendClass = 'price-down';
        } else if (trend === 'Боковик') {
            trendText = 'Боковик';
            trendIcon = '→';
            trendClass = 'price-neutral';
        }

        const priceChange = parseFloat(ticker.priceChangePercent);
        const priceClass = priceChange > 0 ? 'price-up' : (priceChange < 0 ? 'price-down' : '');
        const closes = klines.map((k) => k.close);
        const mean = closes.reduce((a, b) => a + b, 0) / closes.length;
        const variance = closes.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / closes.length;
        const volatility = Math.sqrt(variance) / mean * 100;
        const base = symbol.replace('USDT', '').replace('USD', '');
        const quote = symbol.endsWith('USDT') ? 'USDT' : symbol.slice(-3);

        return {
            pairText: `${base} - ${quote}`,
            link: `https://www.tradingview.com/symbols/${symbol}/`,
            lastPrice: parseFloat(ticker.lastPrice).toFixed(2),
            priceChange: `${priceChange.toFixed(2)}%`,
            priceClass,
            quoteVolume: parseFloat(ticker.quoteVolume).toFixed(2),
            highPrice: parseFloat(ticker.highPrice).toFixed(2),
            lowPrice: parseFloat(ticker.lowPrice).toFixed(2),
            rsi: lastRSI !== null ? lastRSI.toFixed(2) : '-',
            trendClass,
            trendText: `${trendIcon ? trendIcon + ' ' : ''}${trendText}`,
            volatility: `${volatility.toFixed(2)}%`
        };
    }

    createTableRow(data) {
        const row = document.createElement('tr');

        const pairCell = document.createElement('td');
        const link = document.createElement('a');
        link.href = data.link;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.title = 'TradingView';
        link.style.textDecoration = 'none';
        link.style.color = 'inherit';
        link.textContent = data.pairText;
        pairCell.appendChild(link);
        row.appendChild(pairCell);

        row.appendChild(this.createCell(data.lastPrice));
        row.appendChild(this.createCell(data.priceChange, data.priceClass));
        row.appendChild(this.createCell(data.quoteVolume));
        row.appendChild(this.createCell(data.highPrice));
        row.appendChild(this.createCell(data.lowPrice));
        row.appendChild(this.createCell(data.rsi));
        row.appendChild(this.createCell(data.trendText, data.trendClass));
        row.appendChild(this.createCell(data.volatility));

        return row;
    }

    createCell(text, className = '') {
        const cell = document.createElement('td');
        if (className) cell.className = className;
        cell.textContent = text;
        return cell;
    }

    async fetchTicker(symbol) {
        return await fetchMonitorBinanceJson(`/api/v3/ticker/24hr?symbol=${symbol}`);
    }

    async fetchKlines(symbol, interval, limit = 100) {
        const data = await fetchMonitorBinanceJson(`/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
        return data.map(item => ({
            time: item[0],
            open: parseFloat(item[1]),
            high: parseFloat(item[2]),
            low: parseFloat(item[3]),
            close: parseFloat(item[4]),
            volume: parseFloat(item[5])
        }));
    }

    calculateRSI(data, period = 14) {
        if (!data || data.length < period + 1) return [];
        let gains = 0, losses = 0;
        for (let i = 1; i <= period; i++) {
            const diff = data[i].close - data[i - 1].close;
            if (diff >= 0) gains += diff; else losses -= diff;
        }
        gains /= period;
        losses /= period;
        const result = [];
        for (let i = period + 1; i < data.length; i++) {
            const diff = data[i].close - data[i - 1].close;
            if (diff >= 0) {
                gains = (gains * (period - 1) + diff) / period;
                losses = (losses * (period - 1)) / period;
            } else {
                gains = (gains * (period - 1)) / period;
                losses = (losses * (period - 1) - diff) / period;
            }
            const rs = losses === 0 ? 100 : gains / losses;
            const rsi = 100 - (100 / (1 + rs));
            result.push({ time: data[i].time, value: rsi });
        }
        return result;
    }

    calculateTrend(data) {
        if (!data || data.length < 2) return '-';
        const first = data[0].close;
        const last = data[data.length - 1].close;
        if (last > first) return 'Вверх';
        if (last < first) return 'Вниз';
        return 'Боковик';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new Monitor();
});
