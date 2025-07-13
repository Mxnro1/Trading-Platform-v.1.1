// Весь функционал, связанный с арбитражем, полностью удалён

// Функция для форматирования чисел
function formatNumber(number, decimals = 2) {
    return number.toFixed(decimals);
}

// Функция для экспорта результатов в CSV
function exportArbitrageToCSV(result) {
    const headers = [
        'Параметр',
        'Значение',
        'Процент изменения'
    ];
    
    const rows = [
        ['Начальная инвестиция', result.initialUsdt, ''],
        ['BTC получено (Цикл 1)', result.cycle1.btcAmount, ''],
        ['USDT после BTC (Цикл 1)', result.cycle1.usdtAfterBtc, result.cycle1.pnlPercent],
        ['TRON получено (Цикл 2)', result.cycle2.tronAmount, ''],
        ['USDT после TRON (Цикл 2)', result.cycle2.usdtAfterTron, result.cycle2.pnlPercent],
        ['BTC получено (Цикл 3)', result.cycle3.btcAmount, ''],
        ['Финальный USDT', result.cycle3.usdtFinal, result.cycle3.pnlPercent],
        ['Общая прибыль', result.totalPnl, result.totalPnlPercent],
        ['Мин. курс TRON', result.minTronPrice, '']
    ];
    
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `arbitrage_results_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Функция для создания модального окна редактирования
function createEditModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'editArbitrageModal';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close">&times;</span>
            <h3>Редактирование параметров арбитража</h3>
            <form id="editArbitrageForm">
                <div class="form-group">
                    <label for="investment">Начальная инвестиция (USDT):</label>
                    <input type="number" id="investment" name="investment" min="1000" step="1000" required>
                </div>
                
                <h4>Настройки BTC</h4>
                <div class="form-group">
                    <label for="btcBuyPrice">Желаемый курс покупки BTC:</label>
                    <input type="number" id="btcBuyPrice" name="btcBuyPrice" step="100" required>
                </div>
                <div class="form-group">
                    <label for="btcSellPrice">Желаемый курс продажи BTC:</label>
                    <input type="number" id="btcSellPrice" name="btcSellPrice" step="100" required>
                </div>
                
                <h4>Настройки TRON</h4>
                <div class="form-group">
                    <label for="tronBuyPrice">Желаемый курс покупки TRON:</label>
                    <input type="number" id="tronBuyPrice" name="tronBuyPrice" step="0.001" required>
                </div>
                <div class="form-group">
                    <label for="tronSellPrice">Желаемый курс продажи TRON:</label>
                    <input type="number" id="tronSellPrice" name="tronSellPrice" step="0.001" required>
                </div>
                <div class="form-group">
                    <label for="tronSpread">Спред TRON (%):</label>
                    <input type="number" id="tronSpread" name="tronSpread" min="0.1" max="1" step="0.1" required>
                </div>
                <button type="submit" class="btn">Сохранить</button>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Обработчики событий
    const closeBtn = modal.querySelector('.close');
    const form = modal.querySelector('form');
    
    closeBtn.onclick = () => modal.style.display = 'none';
    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };
    
    form.onsubmit = (e) => {
        e.preventDefault();
        const investment = parseFloat(document.getElementById('investment').value);
        const btcBuyPrice = parseFloat(document.getElementById('btcBuyPrice').value);
        const btcSellPrice = parseFloat(document.getElementById('btcSellPrice').value);
        const tronBuyPrice = parseFloat(document.getElementById('tronBuyPrice').value);
        const tronSellPrice = parseFloat(document.getElementById('tronSellPrice').value);
        const tronSpread = parseFloat(document.getElementById('tronSpread').value) / 100;
        
        // Сохраняем параметры в localStorage
        localStorage.setItem('arbitrageParams', JSON.stringify({
            investment,
            btcBuyPrice,
            btcSellPrice,
            tronBuyPrice,
            tronSellPrice,
            tronSpread
        }));
        
        // Пересчитываем арбитраж с новыми параметрами
        updateArbitrageResults(btcBuyPrice, tronBuyPrice);
        
        modal.style.display = 'none';
        return false;
    };
    
    return modal;
}

// Функция для загрузки параметров
function loadArbitrageParams() {
    const defaultParams = {
        investment: 87500,
        btcBuyPrice: 85000,
        btcSellPrice: 87500,
        tronBuyPrice: 0.240,
        tronSellPrice: 0.238,
        tronSpread: 0.001
    };
    
    const savedParams = localStorage.getItem('arbitrageParams');
    return savedParams ? JSON.parse(savedParams) : defaultParams;
}

// Обновляем функцию updateArbitrageResults
function updateArbitrageResults(btcPrice, tronPrice) {
    // Проверяем входные данные
    if (!btcPrice || !tronPrice || isNaN(btcPrice) || isNaN(tronPrice)) {
        console.error('Некорректные входные данные:', { btcPrice, tronPrice });
        return;
    }

    const params = loadArbitrageParams();
    
    // Используем заданные цены из параметров
    const btcLowPrice = params.btcBuyPrice;
    const btcHighPrice = params.btcSellPrice;
    const tronBuyPrice = params.tronBuyPrice;
    const tronSellPrice = params.tronSellPrice;
    
    // Добавляем информацию о текущих ценах
    const currentPrices = {
        btcCurrent: btcPrice,
        tronCurrent: tronPrice,
        btcDiff: ((btcPrice - btcLowPrice) / btcLowPrice) * 100,
        tronDiff: ((tronPrice - tronSellPrice) / tronSellPrice) * 100
    };
    
    const result = calculateArbitrage(params.investment, btcLowPrice, btcHighPrice, tronBuyPrice, tronSellPrice);
    
    // Функция для форматирования процентов с цветом
    const formatPercent = (value) => {
        if (isNaN(value)) return '<span class="profit-negative">0.00%</span>';
        const formattedValue = formatNumber(value);
        const className = value >= 0 ? 'profit-positive' : 'profit-negative';
        return `<span class="${className}">${formattedValue}%</span>`;
    };

    // Функция для безопасного форматирования чисел
    const safeFormatNumber = (number, decimals = 2) => {
        if (isNaN(number)) return '0.00';
        return formatNumber(number, decimals);
    };

    // Обновляем информацию на странице
    const arbitrageInfo = document.getElementById('arbitrageInfo');
    if (arbitrageInfo) {
        arbitrageInfo.innerHTML = `
            <div class="arbitrage-result">
                <div class="arbitrage-header">
                    <h3>Результаты арбитража:</h3>
                    <div class="arbitrage-controls">
                        <button class="btn" onclick="showEditModal()">Редактировать</button>
                        <button class="btn" onclick="exportArbitrageToCSV(${JSON.stringify(result)})">Экспорт CSV</button>
                    </div>
                </div>
                
                <div class="current-prices">
                    <h4>Текущие цены:</h4>
                    <p>BTC: ${safeFormatNumber(currentPrices.btcCurrent)} USDT ${formatPercent(currentPrices.btcDiff)} до цели</p>
                    <p>TRON: ${safeFormatNumber(currentPrices.tronCurrent, 4)} USDT ${formatPercent(currentPrices.tronDiff)} до цели</p>
                </div>
                
                <p>Инвестиция: ${safeFormatNumber(result.initialUsdt)} USDT</p>
                
                <h4>Цикл 1: USDT → BTC → USDT (Цель: ${safeFormatNumber(btcLowPrice)} → ${safeFormatNumber(btcHighPrice)})</h4>
                <p>BTC получено: ${safeFormatNumber(result.cycle1.btcAmount, 8)} BTC</p>
                <p>USDT после продажи: ${safeFormatNumber(result.cycle1.usdtAfterBtc)} USDT ${formatPercent(result.cycle1.pnlPercent)}</p>
                
                <h4>Цикл 2: USDT → TRON → USDT (Цель: ${safeFormatNumber(tronBuyPrice, 4)} → ${safeFormatNumber(tronSellPrice, 4)})</h4>
                <p>TRON получено: ${safeFormatNumber(result.cycle2.tronAmount)} TRON</p>
                <p>USDT после продажи: ${safeFormatNumber(result.cycle2.usdtAfterTron)} USDT ${formatPercent(result.cycle2.pnlPercent)}</p>
                
                <h4>Цикл 3: USDT → BTC → USDT (Цель: ${safeFormatNumber(btcLowPrice)} → ${safeFormatNumber(btcHighPrice)})</h4>
                <p>BTC получено: ${safeFormatNumber(result.cycle3.btcAmount, 8)} BTC</p>
                <p>USDT после продажи: ${safeFormatNumber(result.cycle3.usdtFinal)} USDT ${formatPercent(result.cycle3.pnlPercent)}</p>
                
                <h4>Итоговый результат:</h4>
                <p>Прибыль: ${safeFormatNumber(result.totalPnl)} USDT ${formatPercent(result.totalPnlPercent)}</p>
                <p>Мин. курс TRON для безубыточности: ${safeFormatNumber(result.minTronPrice, 4)}</p>
                
                ${result.minTronPrice && tronSellPrice < result.minTronPrice ? `
                    <p class="warning-text">⚠️ Внимание: Целевой курс продажи TRON (${safeFormatNumber(tronSellPrice, 4)}) 
                    ниже минимального необходимого (${safeFormatNumber(result.minTronPrice, 4)})</p>
                ` : ''}
            </div>
        `;
    }
    
    return result;
}

// Функция для показа модального окна редактирования
function showEditModal() {
    const modal = document.getElementById('editArbitrageModal') || createEditModal();
    const params = loadArbitrageParams();
    
    // Заполняем форму текущими значениями
    document.getElementById('investment').value = params.investment;
    document.getElementById('btcBuyPrice').value = params.btcBuyPrice;
    document.getElementById('btcSellPrice').value = params.btcSellPrice;
    document.getElementById('tronBuyPrice').value = params.tronBuyPrice;
    document.getElementById('tronSellPrice').value = params.tronSellPrice;
    document.getElementById('tronSpread').value = params.tronSpread * 100;
    
    modal.style.display = 'block';
} 