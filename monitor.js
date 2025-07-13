// Класс для управления монитором
class Monitor {
    constructor() {
        this.symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'TRXUSDT', 'ADAUSDT', 'DOGEUSDT', 'XRPUSDT', 'SOLUSDT', 'DOTUSDT', 'MATICUSDT', 'LINKUSDT', 'AVAXUSDT', 'SUIUSDT'];
        this.interval = '1m';
        this.stats = {};
        
        // Инициализация элементов управления
        this.initControls();
        // Инициализация обработчиков вкладок
        this.initTabs();
        // Запуск обновления данных
        this.startUpdates();
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

    initTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                tabButtons.forEach(btn => btn.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                button.classList.add('active');
                const tabId = button.getAttribute('data-tab');
                const tabContent = document.getElementById(`${tabId}-tab`);
                tabContent.classList.add('active');
                if (tabId === 'monitor') {
                    this.updateMonitorTable();
                }
            });
        });
    }

    async startUpdates() {
        await this.updateMonitorTable();
        setInterval(() => this.updateMonitorTable(), 60000);
    }

    async updateMonitorTable() {
        const tbody = document.getElementById('monitorTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        for (const symbol of this.symbols) {
            try {
                const [ticker, klines] = await Promise.all([
                    this.fetchTicker(symbol),
                    this.fetchKlines(symbol, this.interval, 100)
                ]);
                // RSI
                const rsi = this.calculateRSI(klines, 14);
                const lastRSI = rsi.length ? rsi[rsi.length - 1].value : null;
                // Тренд
                const trend = this.calculateTrend(klines);
                let trendText = '-';
                let trendIcon = '';
                let trendClass = '';
                if (trend === 'Вверх') { trendText = 'Восходящий'; trendIcon = '↑'; trendClass = 'price-up'; }
                else if (trend === 'Вниз') { trendText = 'Нисходящий'; trendIcon = '↓'; trendClass = 'price-down'; }
                else if (trend === 'Боковик') { trendText = 'Боковик'; trendIcon = '→'; trendClass = 'price-neutral'; }
                // Цвета для изменения
                const priceChange = parseFloat(ticker.priceChangePercent);
                const priceClass = priceChange > 0 ? 'price-up' : (priceChange < 0 ? 'price-down' : '');
                // Волатильность (стандартное отклонение закрытий за 24ч)
                const closes = klines.map(k => k.close);
                const mean = closes.reduce((a, b) => a + b, 0) / closes.length;
                const variance = closes.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / closes.length;
                const volatility = Math.sqrt(variance) / mean * 100;
                // Ссылка на TradingView (иконка)
                const tvSymbol = symbol.replace('USDT', 'USDT');
                const link = `https://www.tradingview.com/symbols/${tvSymbol}/`;
                // Формат монеты
                const base = symbol.replace('USDT', '').replace('USD', '');
                const quote = symbol.endsWith('USDT') ? 'USDT' : symbol.slice(-3);
                const pairText = `${base} - ${quote}`;
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><a href="${link}" target="_blank" rel="noopener" title="TradingView" style="text-decoration:none;color:inherit;">${pairText}</a></td>
                    <td>${parseFloat(ticker.lastPrice).toFixed(2)}</td>
                    <td class="${priceClass}">${priceChange.toFixed(2)}%</td>
                    <td>${parseFloat(ticker.quoteVolume).toFixed(2)}</td>
                    <td>${parseFloat(ticker.highPrice).toFixed(2)}</td>
                    <td>${parseFloat(ticker.lowPrice).toFixed(2)}</td>
                    <td>${lastRSI !== null ? lastRSI.toFixed(2) : '-'}</td>
                    <td class="${trendClass}">${trendIcon ? trendIcon + ' ' : ''}${trendText}</td>
                    <td>${volatility.toFixed(2)}%</td>
                `;
                tbody.appendChild(row);
            } catch (e) {
                // Если ошибка — просто пропускаем строку
            }
        }
    }

    async fetchTicker(symbol) {
        const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
        if (!res.ok) throw new Error('Ошибка API');
        return await res.json();
    }

    async fetchKlines(symbol, interval, limit = 100) {
        const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
        if (!res.ok) throw new Error('Ошибка API');
        const data = await res.json();
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

// Инициализация монитора при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    new Monitor();
}); 