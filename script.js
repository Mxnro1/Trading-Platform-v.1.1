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

// Текущая выбранная криптовалюта
let currentSymbol = 'BTCUSDT';

// Инициализация графиков
let charts = {};

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

// Глобальные переменные для режима рисования
let isDrawingMode = false;
let currentLine = null;
let startPoint = null;

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
        const startTime = new Date(config.startDate + 'T00:00:00.000Z');
        const endTime = new Date(config.endDate + 'T23:59:59.999Z');

        const startTimestamp = startTime.getTime();
        const endTimestamp = endTime.getTime();
        
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
            endTime.setTime(nowTimestamp);
            console.log('[fetchHistoricalData] Конечная дата установлена на текущий момент');
        }

        const maxCandles = 1000;
        const intervalInMs = getIntervalInMs(config.defaultInterval);
        const totalCandles = Math.ceil((endTimestamp - startTimestamp) / intervalInMs);
        
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

            const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${config.defaultInterval}&startTime=${chunkStartTime}&endTime=${chunkEndTime}&limit=${maxCandles}`;
            
            try {
                const response = await fetch(url);
                
                if (response.status === 429) {
                    const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
                    console.warn(`[fetchHistoricalData] Превышен лимит запросов. Ожидание ${retryAfter} секунд...`);
                    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                    i--; // Повторяем тот же чанк
                    continue;
                }
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                if (data && data.length > 0) {
                    allCandles = allCandles.concat(data);
                }
                
                // Небольшая пауза между запросами
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                console.error(`[fetchHistoricalData] Ошибка при загрузке чанка данных:`, error);
                await new Promise(resolve => setTimeout(resolve, 5000));
                i--; // Повторяем тот же чанк
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
    const changes = data.map((candle, index) => {
        if (index === 0) return 0;
        return candle.close - data[index - 1].close;
    });

    const gains = changes.map(change => change > 0 ? change : 0);
    const losses = changes.map(change => change < 0 ? -change : 0);

    const avgGain = gains.slice(0, period).reduce((a, b) => a + b) / period;
    const avgLoss = losses.slice(0, period).reduce((a, b) => a + b) / period;

    return data.map((candle, index) => {
        if (index < period) return null;
        
        const rs = avgGain / avgLoss;
        const rsi = 100 - (100 / (1 + rs));

        return {
            time: candle.time,
            value: rsi
        };
    }).filter(item => item !== null);
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

// Функция форматирования времени
function formatDateTime(timestamp) {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Функция инициализации обработчиков событий
function initEventHandlers() {
    try {
        console.log('[initEventHandlers] Начало инициализации обработчиков событий');
        
        const elements = {
            cryptoSymbol: document.getElementById('cryptoSymbol'),
            startDate: document.getElementById('startDate'),
            endDate: document.getElementById('endDate'),
            themeToggle: document.getElementById('themeToggle'),
            intervalButtons: document.querySelectorAll('.interval-btn'),
            forecastButtons: document.querySelectorAll('.forecast-btn'),
            calculateButton: document.getElementById('calculateGrid'),
            clearButton: document.getElementById('clearChart'),
            clearLevelsButton: document.getElementById('clearLevels')
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
        currentSymbol = e.target.value;
                    
                    // Пересоздаем график для новой криптовалюты
                    const container = document.querySelector('.chart-container');
                    if (!container) {
                        throw new Error('Контейнер графика не найден');
                    }
                    
                    // Очищаем контейнер
                    container.innerHTML = '';
                    
                    // Создаем новый график
                    charts[currentSymbol] = createChart(container);
                    if (!charts[currentSymbol]) {
                        throw new Error('Не удалось создать график');
                    }
                    
                    // Загружаем данные
        await loadData(currentSymbol);
                    
                    // Устанавливаем WebSocket соединение для новой криптовалюты
                    setupWebSocket(currentSymbol);
                    
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
            await loadData(currentSymbol);
                } catch (error) {
                    console.error('[initEventHandlers] Ошибка при обновлении дат:', error);
                }
            };

            elements.startDate.addEventListener('change', updateDates);
            elements.endDate.addEventListener('change', updateDates);
        }

        // Обработчик переключения темы
        if (elements.themeToggle) {
            elements.themeToggle.addEventListener('click', toggleTheme);
        }

        // Обработчики кнопок интервала
        if (elements.intervalButtons) {
            // Устанавливаем активную кнопку по умолчанию
            let activeInterval = config.defaultInterval;
            elements.intervalButtons.forEach(button => {
                if (button.dataset.interval === activeInterval) {
                    button.classList.add('active');
                } else {
                    button.classList.remove('active');
                }
            });
            elements.intervalButtons.forEach(button => {
                button.addEventListener('click', async () => {
                    try {
                        const interval = button.dataset.interval;
                        // Снимаем класс active со всех кнопок
                        elements.intervalButtons.forEach(btn => btn.classList.remove('active'));
                        // Добавляем класс active только на выбранную
                        button.classList.add('active');
                        console.log(`[initEventHandlers] Изменение интервала на ${interval}`);
                        await updateInterval(interval);
                    } catch (error) {
                        console.error('[initEventHandlers] Ошибка при изменении интервала:', error);
                    }
                });
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
                    const buyPriceInput = document.getElementById('buyPrice');
                    const sellPriceInput = document.getElementById('sellPrice');
                    
                    if (!buyPriceInput || !sellPriceInput) {
                         throw new Error('Не найдены поля ввода цен');
                    }
                    
                    const buyPrice = parseFloat(buyPriceInput.value);
                    const sellPrice = parseFloat(sellPriceInput.value);

                    if (isNaN(buyPrice) || isNaN(sellPrice)) {
                        throw new Error('Введите корректные значения цен');
                    }

                    if (buyPrice <= 0 || sellPrice <= 0) {
                         throw new Error('Цены должны быть положительными');
                    }
                    
                    if (buyPrice >= sellPrice) {
                        throw new Error('Цена покупки должна быть меньше цены продажи');
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
                    drawPriceLevelLines(buyPrice, sellPrice);

                    const result = calculateGridBot(buyPrice, sellPrice, data);
                    displayGridBotResults(result, buyPrice, sellPrice);
                } catch (error) {
                    console.error('[initEventHandlers] Ошибка при расчете грид-бота:', error);
                    alert(error.message);
        }
    });
}

        // Обработчик кнопки очистки
        if (elements.clearButton) {
            elements.clearButton.addEventListener('click', () => {
                try {
                    console.log('[initEventHandlers] Нажата кнопка очистки');
                    clearAllChartElements();
                    console.log('[initEventHandlers] Очистка выполнена успешно');
                } catch (error) {
                    console.error('[initEventHandlers] Ошибка при очистке:', error);
                    alert('Произошла ошибка при очистке графика');
                }
            });
            console.log('[initEventHandlers] Обработчик кнопки очистки установлен');
        } else {
            console.error('[initEventHandlers] Кнопка очистки не найдена в DOM');
        }

        // Обработчик кнопки очистки уровней
        if (elements.clearLevelsButton) {
            elements.clearLevelsButton.addEventListener('click', () => {
                console.log('[initEventHandlers] Нажата кнопка Очистить уровни');
                clearPriceLevelLines(); // Вызываем функцию очистки
            });
        }

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
        timeScale: {
            borderColor: 'var(--border-color)',
            timeVisible: true,
            secondsVisible: false,
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

    // Создаем объект с расширенными свойствами
    const chartObject = {
        main: chart,
        candlestickSeries: candlestickSeries,
        maSeries: maSeries,
        // Добавляем свойства для работы с уровнями Фибоначчи
        fibonacciLines: [],
        fibonacciLevels: null,
        fibonacciStartTime: null,
        fibonacciEndTime: null
    };

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

        // Очищаем контейнер
        container.innerHTML = '';
        
        // Создаем график
        const chart = createChart(container);
        if (!chart) {
            throw new Error('Не удалось создать график');
        }

        // Сохраняем ссылку на график
        charts[currentSymbol] = chart;

        // Загружаем данные
        const success = await loadData(currentSymbol);
        if (!success) {
            throw new Error('Не удалось загрузить данные');
        }

        console.log('[initCharts] Графики успешно инициализированы');
    } catch (error) {
        console.error('[initCharts] Ошибка при инициализации графиков:', error);
        alert('Ошибка при инициализации графиков: ' + error.message);
    }
}

// Добавляем вызов initCharts при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    // Устанавливаем начальные даты в полях ввода
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    
    if (startDateInput && endDateInput) {
        startDateInput.value = config.startDate;
        endDateInput.value = config.endDate;
        
        // Устанавливаем максимальную дату для обоих полей как текущую
        const today = new Date().toISOString().split('T')[0];
        startDateInput.max = today;
        endDateInput.max = today;
    }

    initCharts();
    initEventHandlers();
});

// Функция загрузки данных
async function loadData(symbol) {
    try {
        console.log(`[loadData] Загрузка данных для ${symbol}...`);
        clearPriceLevelLines(); // Очищаем линии при загрузке новых данных
        
        if (!charts[symbol]) {
            console.error(`[loadData] График для ${symbol} не инициализирован`);
            throw new Error('График не инициализирован');
        }

        const data = await fetchHistoricalData(symbol);
        if (!data || data.length === 0) {
            throw new Error('Нет данных для выбранного периода');
        }
        
        // Получаем даты из конфигурации
        const startDate = new Date(config.startDate);
        const endDate = new Date(config.endDate);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        
        const startTimestamp = startDate.getTime() / 1000;
        const endTimestamp = endDate.getTime() / 1000;
        
        // Фильтруем данные по выбранному периоду
        const filteredData = data.filter(candle => {
            return candle.time >= startTimestamp && candle.time <= endTimestamp;
        });

        if (filteredData.length === 0) {
            throw new Error('Нет данных для выбранного периода');
        }

        // Устанавливаем данные на график
        charts[symbol].candlestickSeries.setData(filteredData);
        
        // Рассчитываем и устанавливаем MA
        if (filteredData.length >= 20) {
            const maData = calculateMA(filteredData, 20);
            charts[symbol].maSeries.setData(maData);
        }

        // Настраиваем видимый диапазон
        if (filteredData.length > 0) { 
            const lastIndex = filteredData.length - 1;
            const firstIndex = Math.max(0, lastIndex - 100); // Показываем последние 100 свечей или меньше
            
            charts[symbol].main.timeScale().setVisibleRange({
                from: filteredData[firstIndex].time, 
                to: endTimestamp
            });
        }

        console.log(`[loadData] Данные успешно загружены для ${symbol}`);
        return true;
    } catch (error) {
        console.error(`[loadData] Ошибка при загрузке данных для ${symbol}:`, error);
        throw error; // Пробрасываем ошибку дальше
    }
}

// WebSocket подключение - РАСКОММЕНТИРОВАНО
function setupWebSocket(symbol) {
    // Закрываем старое соединение, если оно есть
    if (charts[currentSymbol] && charts[currentSymbol].ws) {
        charts[currentSymbol].ws.close();
        console.log(`Закрыто старое WebSocket соединение для ${symbol}`);
    }

    const wsUrl = `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${config.defaultInterval}`;
    console.log(`Подключение к WebSocket: ${wsUrl}`);
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => console.log(`WebSocket подключен для ${symbol}`);
    
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            // console.log("WebSocket message:", data); // Отладка
            if (data.k) { // Убедимся, что это сообщение о свече
                const candle = data.k;
                const newCandle = {
                    time: candle.t / 1000,
                    open: parseFloat(candle.o),
                    high: parseFloat(candle.h),
                    low: parseFloat(candle.l),
                    close: parseFloat(candle.c),
                    volume: parseFloat(candle.v)
                };
                // console.log("Updating chart with WS candle:", newCandle);
                updateChart(symbol, newCandle); 
            }
        } catch (error) {
            console.error(`Ошибка обработки WebSocket данных для ${symbol}:`, error, event.data);
        }
    };
    
    ws.onerror = (error) => {
        console.error(`WebSocket ошибка для ${symbol}:`, error);
        // Попытка переподключения может быть здесь, но аккуратно, чтобы не создавать циклы
    };
    
    ws.onclose = (event) => {
        console.log(`WebSocket закрыт для ${symbol}. Code: ${event.code}, Reason: ${event.reason}`);
        // Простое переподключение через 5 секунд, если закрытие не было чистым
        if (!event.wasClean) {
             console.log("Попытка переподключения WebSocket через 5 секунд...");
            setTimeout(() => setupWebSocket(symbol), 5000);
        }
    };

    // Сохраняем ссылку на WebSocket в объект графика
    if (charts[symbol]) {
        charts[symbol].ws = ws;
    } else {
        console.warn(`Объект charts[${symbol}] не найден при настройке WebSocket`);
    }

    return ws;
}

// Функция обновления графика по данным WebSocket
function updateChart(symbol, newCandle) {
    if (charts[symbol] && charts[symbol].candlestickSeries) {
        charts[symbol].candlestickSeries.update(newCandle);
        
        // Обновляем MA (если нужно)
        if (charts[symbol].maSeries) {
            // Нужно получить текущие данные + новую свечу для пересчета MA
             try {
                const seriesData = charts[symbol].candlestickSeries.data(); // Это может быть затратно
                if (seriesData && seriesData.length > 0) {
                     const maData = calculateMA([...seriesData, newCandle], 20);
                     charts[symbol].maSeries.setData(maData);
                }
             } catch (e) {
                  console.error("Ошибка при получении данных серии для обновления MA:", e);
             }
        }
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
        charts[currentSymbol].main.applyOptions({
            width: chartContainer.clientWidth
        });
    }image.png
});

// Экспорт в CSV
document.getElementById('exportCSV').addEventListener('click', exportToCSV);

// Автообновление данных
setInterval(async () => {
    for (const [key, value] of Object.entries(config.symbols)) {
        const newData = await fetchHistoricalData(value.pair);
        if (newData.length > 0) {
            charts[key].candlestickSeries.setData(newData);
            updateIndicators(key, newData);
        }
    }
}, config.updateInterval);

// Добавляем обработчики для кнопок управления уровнями Фибоначчи
document.getElementById('fibonacciTool').addEventListener('click', () => {
    console.log('[fibonacciTool] Нажата кнопка Фибоначчи');
    try {
        if (!charts[currentSymbol]) {
            console.error('[fibonacciTool] График не найден');
            alert('График не инициализирован');
            return;
        }

        if (!charts[currentSymbol].candlestickSeries) {
            console.error('[fibonacciTool] Серия свечей не найдена');
            alert('Данные графика не загружены');
        return;
    }

    const data = charts[currentSymbol].candlestickSeries.data();
    if (!data || data.length < 2) {
            console.error('[fibonacciTool] Недостаточно данных для построения уровней Фибоначчи');
            alert('Недостаточно данных для построения уровней Фибоначчи');
        return;
    }

    const startPrice = data[0].close;
    const endPrice = data[data.length - 1].close;
    const startTime = data[0].time;
    const endTime = data[data.length - 1].time;

        console.log('[fibonacciTool] Параметры для построения:', {
            startPrice,
            endPrice,
            startTime: new Date(startTime * 1000),
            endTime: new Date(endTime * 1000)
        });

    drawFibonacciLevels(charts[currentSymbol], startPrice, endPrice, startTime, endTime);
    } catch (error) {
        console.error('[fibonacciTool] Ошибка при обработке клика:', error);
        alert('Произошла ошибка при построении уровней Фибоначчи');
    }
});

// Обработчик для кнопки удаления уровней Фибоначчи
document.getElementById('removeFibonacci').addEventListener('click', () => {
    if (charts[currentSymbol]) {
        removeFibonacciLevels(charts[currentSymbol]);
    }
});

// Добавляем обработчики кликов по графикам для определения активного
document.addEventListener('DOMContentLoaded', () => {
    const btcChart = document.querySelector('#chart-btc');
    const trxChart = document.querySelector('#chart-trx');
    
    if (btcChart) {
        btcChart.addEventListener('click', () => {
            btcChart.classList.add('active');
            if (trxChart) trxChart.classList.remove('active');
        });
    }
    
    if (trxChart) {
        trxChart.addEventListener('click', () => {
            trxChart.classList.add('active');
            if (btcChart) btcChart.classList.remove('active');
        });
    }
    
    // По умолчанию активируем график BTC
    if (btcChart) btcChart.classList.add('active');
});

// Загружаем сохраненные уровни при инициализации
for (const [key, chart] of Object.entries(charts)) {
    chart.symbol = key;
    chart.lines = [];
    loadFibonacciLevels(chart, key);
    loadLines(chart, key);
}

function updateChart(symbol, newCandle) {
    if (charts[symbol] && charts[symbol].candlestickSeries) {
        charts[symbol].candlestickSeries.update(newCandle);
        
        // Обновляем MA
        const data = charts[symbol].candlestickSeries.data();
        const maData = calculateMA(data, 20);
        charts[symbol].maSeries.setData(maData);
    }
}

// Функция для сохранения линий
function saveLines(chart, symbol) {
    // Функционал отключен
}

// Функция для загрузки линий
function loadLines(chart, symbol) {
    // Функционал отключен
}

// Добавляем обработчик для кнопки линии
const lineToolBtn = document.getElementById('lineTool');
if (lineToolBtn) {
    lineToolBtn.addEventListener('click', () => {
    console.log('Функция временно недоступна');
});
}

// Функция для отображения лога сделок
function displayTradeLog(tradeLog) {
    const tableBody = document.getElementById('gridTradeLogBody');
    tableBody.innerHTML = ''; // Очищаем таблицу перед заполнением

    if (!tradeLog || tradeLog.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="3">Сделок не найдено.</td></tr>';
        return;
    }

    tradeLog.forEach(log => {
        const row = tableBody.insertRow();
        const dateCell = row.insertCell();
        const typeCell = row.insertCell();
        const priceCell = row.insertCell();

        dateCell.textContent = new Date(log.time * 1000).toLocaleString('ru-RU');
        typeCell.textContent = log.type;
        priceCell.textContent = log.price.toFixed(2); // Форматируем цену

        // Добавляем класс для стилизации
        row.classList.add(log.type === 'Покупка' ? 'buy-log' : 'sell-log');
    });
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
            new Date(candle.time * 1000).toLocaleString('ru-RU'),
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
        await loadData(currentSymbol);
    } catch (error) {
        console.error('[updateInterval] Ошибка при обновлении интервала:', error);
    }
}

async function updateForecast(forecast) {
    try {
        console.log(`[updateForecast] Обновление прогноза на ${forecast}`);
        config.forecastType = forecast;
        await loadData(currentSymbol);
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
                    color: newTheme === 'dark' ? '#2962FF' : '#2962FF',
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
    console.log('[clearPriceLevelLines] Попытка очистки линий...');
    try {
        const series = charts[currentSymbol]?.candlestickSeries; // Получаем серию
        if (!series) {
            console.warn('[clearPriceLevelLines] Серия свечей не найдена!');
            buyLevelLine = null; // Сбрасываем ссылки на всякий случай
            sellLevelLine = null;
            return;
        }
        
        if (buyLevelLine) {
            console.log('[clearPriceLevelLines] Удаление линии покупки...', buyLevelLine);
            series.removePriceLine(buyLevelLine); // Удаляем с серии
            buyLevelLine = null;
            console.log('[clearPriceLevelLines] Линия покупки удалена.');
        } else {
            console.log('[clearPriceLevelLines] Линия покупки не найдена для удаления.');
        }
        if (sellLevelLine) {
            console.log('[clearPriceLevelLines] Удаление линии продажи...', sellLevelLine);
            series.removePriceLine(sellLevelLine); // Удаляем с серии
            sellLevelLine = null;
            console.log('[clearPriceLevelLines] Линия продажи удалена.');
        } else {
            console.log('[clearPriceLevelLines] Линия продажи не найдена для удаления.');
        }
    } catch (e) {
        console.error('[clearPriceLevelLines] Ошибка при удалении линий уровней:', e);
        // Дополнительно сбрасываем ссылки в случае ошибки
        buyLevelLine = null;
        sellLevelLine = null;
    }
}

// Функция для отрисовки линий уровней покупки/продажи
function drawPriceLevelLines(buyPrice, sellPrice) {
    console.log(`[drawPriceLevelLines] Попытка отрисовки линий: Buy=${buyPrice}, Sell=${sellPrice}`);
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
                title: `Buy ${buyPrice.toFixed(2)}`,
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
                title: `Sell ${sellPrice.toFixed(2)}`,
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

function calculateGridBot(buyPrice, sellPrice, data) {
    try {
        console.log('[calculateGridBot] Начало расчета (Новая логика)', { buyPrice, sellPrice, dataLength: data.length });
        
        if (!data || data.length === 0) {
            throw new Error('Нет данных для расчета');
        }

        let totalProfit = 0;
        let totalTrades = 0;
        let totalBuyAmount = 0;
        let totalSellAmount = 0;
        let trades = [];
        
        let state = 'looking_for_buy';
        let lastBuyPrice = 0;
        let lastBuyTime = 0;
        let maxPriceAfterBuy = 0;

        // Проходим по всем свечам
        for (let i = 0; i < data.length; i++) {
            const candle = data[i];
            const candleTime = new Date(candle.time * 1000).toLocaleString();

            // Логика покупки
            if (state === 'looking_for_buy' && candle.low <= buyPrice) {
                lastBuyPrice = buyPrice;
                lastBuyTime = candle.time;
                state = 'looking_for_sell';
                totalBuyAmount++;
                maxPriceAfterBuy = candle.high;
                trades.push({ type: 'buy', price: buyPrice, time: candle.time });
                console.log(`[calculateGridBot] Свеча ${i + 1} (${candleTime}): ПОКУПКА по ${buyPrice} (Low=${candle.low}). Ищем продажу.`);
            }
            // Логика продажи
            else if (state === 'looking_for_sell') {
                // Обновляем максимальную цену после покупки
                maxPriceAfterBuy = Math.max(maxPriceAfterBuy, candle.high);
                
                if (candle.high >= sellPrice) {
                    const profit = sellPrice - lastBuyPrice;
                    totalProfit += profit;
                    totalTrades++;
                    totalSellAmount++;
                    state = 'looking_for_buy';
                    
                    trades.push({ type: 'sell', price: sellPrice, time: candle.time });
                    const buyPositionTime = new Date(lastBuyTime * 1000).toLocaleString();
                    console.log(`[calculateGridBot] Свеча ${i + 1} (${candleTime}): ПРОДАЖА по ${sellPrice} (High=${candle.high}). Закрыта покупка от ${buyPositionTime}. Прибыль: ${profit.toFixed(2)}. Ищем покупку.`);
                    lastBuyPrice = 0;
                    lastBuyTime = 0;
                    maxPriceAfterBuy = 0;
                }
                // Добавляем периодический вывод максимальной достигнутой цены
                else if (i % 10 === 0) { // каждые 10 свечей
                    console.log(`[calculateGridBot] После покупки (${new Date(lastBuyTime * 1000).toLocaleString()}) максимальная цена достигла ${maxPriceAfterBuy} (целевая продажа: ${sellPrice})`);
                }
            }
        }

        // Закрываем позицию в конце периода, если последней была покупка
        if (state === 'looking_for_sell') {
            const lastCandle = data[data.length - 1];
            const lastCandleTime = new Date(lastCandle.time * 1000).toLocaleString();
            const profit = lastCandle.close - lastBuyPrice;
            totalProfit += profit;
            totalSellAmount++;
            
            trades.push({
                type: 'sell',
                price: lastCandle.close,
                time: lastCandle.time
            });
            
            const buyPositionTime = new Date(lastBuyTime * 1000).toLocaleString();
            console.log(`[calculateGridBot] Принудительное закрытие последней покупки (${buyPositionTime}) по цене ${lastCandle.close} (${lastCandleTime}). Прибыль: ${profit.toFixed(2)}`);
            console.log(`[calculateGridBot] Максимальная цена после последней покупки была: ${maxPriceAfterBuy} (целевая продажа: ${sellPrice})`);
        }

        const totalInvestment = buyPrice * totalBuyAmount;
        const profitPercentage = totalInvestment > 0 ? (totalProfit / totalInvestment) * 100 : 0;

        const result = {
            totalProfit,
            totalTrades,
            totalBuyAmount,
            totalSellAmount,
            profitPercentage,
            trades
        };

        console.log('[calculateGridBot] Результаты расчета (Новая логика):', result);
        return result;
    } catch (error) {
        console.error('[calculateGridBot] Ошибка при расчете:', error);
        throw error;
    }
}

function displayGridBotResults(result, buyPrice, sellPrice) {
    try {
        console.log('[displayGridBotResults] Начало отображения результатов');
        const resultDiv = document.getElementById('gridResult');
        const tradeLogBody = document.getElementById('gridTradeLogBody');

        if (!resultDiv || !tradeLogBody) {
            throw new Error('Не найдены элементы для отображения результатов');
        }

        // Очищаем предыдущие результаты
        tradeLogBody.innerHTML = '';
        resultDiv.innerHTML = '';

        // Рассчитываем процентную разницу между введенными ценами
        const priceDifferencePercent = ((sellPrice - buyPrice) / buyPrice) * 100;

        // Отображаем статистику
        const statsHtml = `
            <div class="grid-stats">
                <p>Всего сделок: ${result.totalTrades}</p>
                <p>Покупок: ${result.totalBuyAmount}</p>
                <p>Продаж: ${result.totalSellAmount}</p>
                <p>Разница цен (указанная): ${priceDifferencePercent.toFixed(2)}%</p>
            </div>
        `;
        resultDiv.innerHTML = statsHtml;
        
        // Отображаем лог сделок, если они есть
        if (result.trades && result.trades.length > 0) {
            result.trades.forEach(trade => {
                const row = document.createElement('tr');
                row.className = trade.type === 'buy' ? 'buy-log' : 'sell-log';
                
                const timeCell = document.createElement('td');
                timeCell.textContent = new Date(trade.time * 1000).toLocaleString();
                
                const typeCell = document.createElement('td');
                typeCell.textContent = trade.type === 'buy' ? 'Покупка' : 'Продажа';
                
                const priceCell = document.createElement('td');
                priceCell.textContent = trade.price.toFixed(2);
                
                row.appendChild(timeCell);
                row.appendChild(typeCell);
                row.appendChild(priceCell);
                tradeLogBody.appendChild(row);
            });
        } else {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 3;
            cell.textContent = 'Сделок не было';
            row.appendChild(cell);
            tradeLogBody.appendChild(row);
        }

        console.log('[displayGridBotResults] Результаты успешно отображены');
    } catch (error) {
        console.error('[displayGridBotResults] Ошибка при отображении результатов:', error);
        alert('Ошибка при отображении результатов: ' + error.message);
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
      const res = await fetch(`https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=20`);
      if (!res.ok) {
        errorEl.textContent = `Ошибка API: ${res.status} ${res.statusText}`;
        throw new Error('Ошибка API: ' + res.status);
      }
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

  document.addEventListener('DOMContentLoaded', () => {
    const tabBtn = document.querySelector('.tab-button[data-tab="orderbook"]');
    if (!tabBtn) return;
    tabBtn.addEventListener('click', () => {
      fetchAndRenderOrderbook();
      startAutoUpdate();
    });
    if (orderbookTab.classList.contains('active')) {
      fetchAndRenderOrderbook();
      startAutoUpdate();
    }
  });
})(); 

// === Вкладка "Вероятности движения" ===
(function() {
  const tabBtn = document.querySelector('.tab-button[data-tab="probability"]');
  const tabContent = document.getElementById('probability-tab');
  if (!tabBtn || !tabContent) return;

  tabBtn.addEventListener('click', () => {
    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
    document.querySelectorAll('.tab-button').forEach(tb => tb.classList.remove('active'));
    tabContent.classList.add('active');
    tabBtn.classList.add('active');
  });

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
      const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&startTime=${from}&endTime=${endTime}&limit=${limit}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Ошибка API: ${res.status} ${res.statusText}`);
      const data = await res.json();
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
  const tabBtn = document.querySelector('.tab-button[data-tab="news"]');
  const tabContent = document.getElementById('news-tab');
  if (!tabBtn || !tabContent) return;

  const newsList = document.getElementById('news-list');
  const newsError = document.getElementById('news-error');
  const newsCalendar = document.getElementById('news-calendar');

  let allNews = [];

  async function loadAllNews() {
    newsList.innerHTML = '';
    newsError.textContent = 'Загрузка новостей...';
    allNews = [];
    try {
      const sources = [
        { name: 'Forklog', url: 'https://api.rss2json.com/v1/api.json?rss_url=https://forklog.com/feed' },
        { name: 'Bits.media', url: 'https://api.rss2json.com/v1/api.json?rss_url=https://bits.media/rss/news/' },
        { name: 'LetKnowNews', url: 'https://api.rss2json.com/v1/api.json?rss_url=https://letknow.news/rss/' },
        { name: 'Investing.com', url: 'https://api.rss2json.com/v1/api.json?rss_url=https://ru.investing.com/rss/news_301.rss' }
      ];
      let newsArr = [];
      for (const src of sources) {
        try {
          const res = await fetch(src.url);
          if (!res.ok) continue;
          const data = await res.json();
          if (data && Array.isArray(data.items)) {
            const items = data.items.map(n => ({
              title: n.title,
              date: n.pubDate,
              desc: n.description || '',
              link: n.link,
              source: src.name
            }));
            newsArr = newsArr.concat(items);
          }
        } catch {}
      }
      // Сортируем по дате (новое сверху)
      newsArr = newsArr.filter(n => n.date).sort((a, b) => new Date(b.date) - new Date(a.date));
      allNews = newsArr;
      renderNews();
      newsError.textContent = '';
    } catch (e) {
      newsError.textContent = 'Ошибка загрузки новостей: ' + (e.message || e);
    }
  }

  function renderNews() {
    if (!allNews.length) {
      newsList.innerHTML = '<div style="color:#888;">Нет новостей за последние 3 месяца.</div>';
      return;
    }
    newsList.innerHTML = allNews.map(n => {
      const isImportant = /bitcoin|binance|listing|mainnet|launch|burn|airdrop|token|upgrade|hard fork|partnership|integration|event|conference|release|testnet|migration|merge|halving|ico|ido|ieo|staking|governance|vote|roadmap|update|announcement/i.test((n.title||'')+(n.desc||''));
      // Удаляем картинки из описания
      let desc = (n.desc || '').replace(/<img[^>]*>/gi, '').replace(/<br\s*\/?>/gi, ' ');
      return `<div class="news-card${isImportant ? ' important' : ''}">
        <a class="news-title" href="${n.link}" target="_blank">${n.title || 'Новость'}</a>
        <div class="news-desc">${desc}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
          <span class="news-date">${n.date ? new Date(n.date).toLocaleString('ru-RU') : ''}</span>
          <span class="news-source">${n.source}</span>
        </div>
      </div>`;
    }).join('');
  }

  tabBtn.addEventListener('click', () => {
    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
    document.querySelectorAll('.tab-button').forEach(tb => tb.classList.remove('active'));
    tabContent.classList.add('active');
    tabBtn.classList.add('active');
    if (!allNews.length) loadAllNews();
  });
})();