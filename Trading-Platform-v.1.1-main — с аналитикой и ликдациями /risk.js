
(function(){
const root = document.getElementById("risk-tab");
if (!root) return;

const entry = document.getElementById("entry");
const deposit = document.getElementById("deposit");
const leverage = document.getElementById("leverage");
const side = document.getElementById("side");
const positionMode = document.getElementById("positionMode");

const size = document.getElementById("size");
const liq = document.getElementById("liq");
const levValue = document.getElementById("levValue");

const maxPrice = document.getElementById("maxPrice");
const maxPriceAutoHint = document.getElementById("maxPriceAutoHint");
const requiredCollateral = document.getElementById("requiredCollateral");
const requiredProtection = document.getElementById("requiredProtection");
const singleModeInfo = document.getElementById("singleModeInfo");
const singleCrossFields = document.getElementById("singleCrossFields");
const singleStatsGrid = document.getElementById("singleStatsGrid");
const singleSummaryTitle = document.getElementById("singleSummaryTitle");
const crossOnlyElements = root.querySelectorAll("[data-cross-only]");
let lastSuggestedRiskPrice = "";

const MM_RATE = 0.005;

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

const RISK_TAB_KEY = "risk_active_tab";
const RISK_FORM_KEY = "risk_form_state_v1";
const ORDERS_DASHBOARD_COLLAPSED_KEY = "risk_orders_dashboard_collapsed_v1";
const LADDER_STATE_STORAGE_KEY = "risk_ladder_state_v3";
const LADDER_BOOKS_STORAGE_KEY = "risk_ladder_books_v1";
const ACTIVE_LADDER_JOURNALS_STORAGE_KEY = "risk_ladder_active_journals_v1";
const LADDER_INTERVAL = "5m";
const LADDER_INTERVAL_MS = 5 * 60 * 1000;
const LADDER_DEFAULT_LOOKBACK_DAYS = 7;
const RISK_PANEL_ANIMATION_CLASS = "risk-panel-animating";
let riskPanelAnimationTimer = null;
let ladderState = loadLadderState();
let ladderBooks = loadLadderBooks();
let activeLadderJournalIds = loadActiveLadderJournalIds();
let ladderCandles = [];
let ladderCandlesKey = "";
let ladderHistoryRequestId = 0;
let draggedLadderRowId = null;

async function fetchRiskBinanceJson(path, options = {}) {
    if (typeof window.fetchBinanceJson === "function") {
        return window.fetchBinanceJson(path, options);
    }

    const response = await fetch(`https://api.binance.com${path}`, {
        cache: "no-store",
        ...options
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
}

function saveRiskState() {
    try {
        const state = {
            positionMode: document.getElementById("positionMode")?.value || "isolated",
            side: document.getElementById("side")?.value || "long",
            entry: document.getElementById("entry")?.value || "",
            deposit: document.getElementById("deposit")?.value || "",
            leverage: document.getElementById("leverage")?.value || "",
            maxPrice: document.getElementById("maxPrice")?.value || "",
            orderSide: document.getElementById("orderSide")?.value || "long",
            orderEntry: document.getElementById("orderEntry")?.value || "",
            orderExit: document.getElementById("orderExit")?.value || "",
            orderLeverage: document.getElementById("orderLeverage")?.value || "",
            orderDeposit: document.getElementById("orderDeposit")?.value || "",
            orderNote: document.getElementById("orderNote")?.value || ""
        };
        localStorage.setItem(RISK_FORM_KEY, JSON.stringify(state));
    } catch (e) {}
}

function restoreRiskState() {
    try {
        const raw = localStorage.getItem(RISK_FORM_KEY);
        if (!raw) return;
        const state = JSON.parse(raw);
        Object.entries(state).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el && value !== undefined && value !== null && value !== "") el.value = value;
        });
    } catch (e) {}
}

function setOrdersDashboardCollapsed(isCollapsed) {
    const panel = document.getElementById("ordersDashboardPanel");
    const content = document.getElementById("ordersDashboardContent");
    const toggleBtn = document.getElementById("toggleOrdersDashboardBtn");
    if (!panel || !content || !toggleBtn) return;

    panel.classList.toggle("is-collapsed", isCollapsed);
    content.hidden = isCollapsed;
    toggleBtn.setAttribute("aria-expanded", String(!isCollapsed));
    toggleBtn.innerText = isCollapsed ? "Показать дашборд" : "Скрыть дашборд";
}

function setupOrdersDashboardToggle() {
    const toggleBtn = document.getElementById("toggleOrdersDashboardBtn");
    if (!toggleBtn) return;

    let isCollapsed = false;
    try {
        isCollapsed = localStorage.getItem(ORDERS_DASHBOARD_COLLAPSED_KEY) === "true";
    } catch (error) {}

    setOrdersDashboardCollapsed(isCollapsed);

    toggleBtn.addEventListener("click", () => {
        const nextCollapsed = toggleBtn.getAttribute("aria-expanded") === "true";
        setOrdersDashboardCollapsed(nextCollapsed);
        try {
            localStorage.setItem(ORDERS_DASHBOARD_COLLAPSED_KEY, String(nextCollapsed));
        } catch (error) {}
    });
}

function initRiskTabs() {
    const tabButtons = root.querySelectorAll(".risk-tab-btn");
    const tabPanels = root.querySelectorAll(".risk-tab-panel");
    const moreToggle = document.getElementById("riskMoreToggle");
    const moreMenu = document.getElementById("riskMoreMenu");

    function setMoreMenuState(isOpen) {
        if (!moreToggle || !moreMenu) return;
        moreToggle.setAttribute("aria-expanded", String(isOpen));
        moreMenu.hidden = !isOpen;
    }

    function syncMoreToggleState(activeTab) {
        if (!moreToggle) return;
        moreToggle.classList.toggle("active", activeTab === "ladder");
    }

    function animateRiskPanel(panel) {
        if (!panel) return;

        tabPanels.forEach((item) => item.classList.remove(RISK_PANEL_ANIMATION_CLASS));

        if (riskPanelAnimationTimer) {
            clearTimeout(riskPanelAnimationTimer);
            riskPanelAnimationTimer = null;
        }

        requestAnimationFrame(() => {
            panel.classList.add(RISK_PANEL_ANIMATION_CLASS);
            riskPanelAnimationTimer = setTimeout(() => {
                panel.classList.remove(RISK_PANEL_ANIMATION_CLASS);
            }, 550);
        });
    }

    tabButtons.forEach(button => {
        button.addEventListener("click", () => {
            const target = button.dataset.riskTab;
            if (!target) return;

            tabButtons.forEach(btn => btn.classList.remove("active"));
            tabPanels.forEach(panel => panel.classList.remove("active"));

            button.classList.add("active");
            const targetPanel = document.getElementById(`risk-${target}-panel`);
            if (targetPanel) {
                targetPanel.classList.add("active");
                animateRiskPanel(targetPanel);
            }
            syncMoreToggleState(target);
            setMoreMenuState(false);
            try { localStorage.setItem(RISK_TAB_KEY, target); } catch (e) {}
        });
    });

    if (moreToggle && moreMenu) {
        moreToggle.addEventListener("click", (event) => {
            event.stopPropagation();
            const isOpen = moreToggle.getAttribute("aria-expanded") === "true";
            setMoreMenuState(!isOpen);
        });

        document.addEventListener("click", (event) => {
            if (!moreMenu.hidden && !event.target.closest(".risk-more-wrap")) {
                setMoreMenuState(false);
            }
        });
    }

    try {
        let savedRiskTab = localStorage.getItem(RISK_TAB_KEY);
        if (savedRiskTab === "cross") savedRiskTab = "single";
        if (savedRiskTab) {
            const savedBtn = root.querySelector(`.risk-tab-btn[data-risk-tab="${savedRiskTab}"]`);
            if (savedBtn) savedBtn.click();
        } else {
            syncMoreToggleState("single");
        }
    } catch (e) {}
}

function updateSingleCalculatorMode() {
    const isCross = positionMode?.value === "cross";

    if (singleCrossFields) {
        singleCrossFields.hidden = !isCross;
        singleCrossFields.style.display = isCross ? "block" : "none";
    }

    crossOnlyElements.forEach((element) => {
        element.hidden = !isCross;
        element.style.display = isCross ? "flex" : "none";
    });

    if (singleStatsGrid) {
        singleStatsGrid.classList.toggle("four", isCross);
        singleStatsGrid.classList.toggle("two", !isCross);
    }

    if (singleSummaryTitle) {
        singleSummaryTitle.innerText = isCross ? "Итог позиции · Кросс" : "Итог позиции";
    }

    if (singleModeInfo) {
        singleModeInfo.innerHTML = isCross
            ? `<div class="risk-mode-badge cross">Режим: КРОСС</div><div class="risk-mode-desc">Показываем не только ликвидацию позиции, но и сколько дополнительной защиты нужно, чтобы выдержать движение до заданной цены риска.</div>`
            : `<div class="risk-mode-badge isolated">Режим: БЕЗ КРОССА</div><div class="risk-mode-desc">Позиция считается как отдельная изолированная сделка: видно номинал и ориентировочную ликвидацию без общей защиты кросс-маржой.</div>`;
    }

    if (!isCross && maxPriceAutoHint) {
        maxPriceAutoHint.innerHTML = "";
    }
}

function syncSuggestedRiskPrice(liqPrice, isCross) {
    if (!maxPrice || !Number.isFinite(liqPrice)) return;

    const suggested = liqPrice.toFixed(2);
    lastSuggestedRiskPrice = suggested;

    if (maxPriceAutoHint) {
        maxPriceAutoHint.innerHTML = isCross
            ? `Текущая ликвидация: <strong>${suggested}</strong> <button type="button" id="applySuggestedRiskPriceBtn">Подставить</button>`
            : "";
    }
}

function calculate() {
    const e = parseFloat(entry?.value);
    const d = parseFloat(deposit?.value);
    const lev = parseFloat(leverage?.value);
    const isCross = positionMode?.value === "cross";

    if (isNaN(e) || isNaN(d) || isNaN(lev) || lev <= 0) {
        if (size) size.innerText = "-";
        if (liq) liq.innerText = "-";
        if (requiredCollateral) requiredCollateral.innerText = "-";
        if (requiredProtection) requiredProtection.innerText = "-";
        if (maxPriceAutoHint) maxPriceAutoHint.innerHTML = "";
        return;
    }

    if (levValue) levValue.innerText = "Плечо: " + lev + "x";

    const nominal = d * lev;
    if (size) size.innerText = nominal.toFixed(0);

    let liqPrice;
    if (side.value === "long") {
        liqPrice = e * (1 - (1 / lev) + MM_RATE);
    } else {
        liqPrice = e * (1 + (1 / lev) - MM_RATE);
    }

    if (liq) liq.innerText = liqPrice.toFixed(2);
    syncSuggestedRiskPrice(liqPrice, isCross);

    if (!isCross) {
        if (requiredCollateral) requiredCollateral.innerText = "-";
        if (requiredProtection) requiredProtection.innerText = "-";
        saveRiskState();
        return;
    }

    const riskPrice = parseFloat(maxPrice?.value);

    if (!isNaN(riskPrice) && riskPrice > 0 && riskPrice !== e) {
        let moveAgainst = 0;

        if (side.value === "long") {
            moveAgainst = (e - riskPrice) / e;
        } else {
            moveAgainst = (riskPrice - e) / e;
        }

        if (moveAgainst <= 0) {
            if (requiredCollateral) requiredCollateral.innerText = "0";
            if (requiredProtection) requiredProtection.innerText = d.toFixed(0);
            return;
        }

        const totalProtectionNeeded = nominal * moveAgainst;
        const collateralNeeded = Math.max(0, totalProtectionNeeded - d);

        if (requiredCollateral) requiredCollateral.innerText = collateralNeeded.toFixed(0);
        if (requiredProtection) requiredProtection.innerText = totalProtectionNeeded.toFixed(0);
    } else {
        if (requiredCollateral) requiredCollateral.innerText = "-";
        if (requiredProtection) requiredProtection.innerText = "-";
    }

    saveRiskState();
}

function formatDateInputValue(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function createShiftedDate(daysOffset) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + daysOffset);
    return date;
}

function generateLadderRowId() {
    return `ladder_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeLadderLeverageValue(value) {
    const parsed = parseLadderNumber(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return "";
    return String(Math.round(parsed));
}

function normalizeLadderBudgetValue(value) {
    const parsed = parseLadderNumber(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return "";
    return parsed.toFixed(2);
}

function createLadderRow(seed = {}) {
    const startValue = parseLadderNumber(seed.start);
    const sellValue = parseLadderNumber(seed.sell);
    const inferredDirection = Number.isFinite(startValue) && Number.isFinite(sellValue)
        ? (sellValue >= startValue ? "long" : "short")
        : "short";

    return {
        id: typeof seed.id === "string" && seed.id ? seed.id : generateLadderRowId(),
        direction: seed.direction === "long" ? "long" : (seed.direction === "short" ? "short" : inferredDirection),
        start: seed.start !== undefined && seed.start !== null ? String(seed.start) : "",
        sell: seed.sell !== undefined && seed.sell !== null ? String(seed.sell) : "",
        budget: normalizeLadderBudgetValue(seed.budget),
        leverage: normalizeLadderLeverageValue(seed.leverage),
        note: seed.note !== undefined && seed.note !== null ? String(seed.note) : ""
    };
}

function generateLadderJournalId(symbol) {
    return `${String(symbol || "ladder").toLowerCase()}_ladder_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function buildDefaultLadderJournal(symbol, index = 1, rows = []) {
    return {
        id: generateLadderJournalId(symbol),
        name: `Журнал ${index}`,
        rows: rows.map(createLadderRow)
    };
}

function normalizeLadderJournal(symbol, journal, index) {
    if (!journal || typeof journal !== "object") return buildDefaultLadderJournal(symbol, index + 1, []);
    const fallback = buildDefaultLadderJournal(symbol, index + 1, []);
    return {
        id: typeof journal.id === "string" && journal.id ? journal.id : fallback.id,
        name: typeof journal.name === "string" && journal.name.trim() ? journal.name.trim() : fallback.name,
        rows: Array.isArray(journal.rows) && journal.rows.length ? journal.rows.map(createLadderRow) : []
    };
}

function createEmptyLadderBook() {
    return {
        ETHUSDT: [buildDefaultLadderJournal("ETHUSDT", 1, [])],
        BTCUSDT: [buildDefaultLadderJournal("BTCUSDT", 1, [])],
        SOLUSDT: [buildDefaultLadderJournal("SOLUSDT", 1, [])],
        XRPUSDT: [buildDefaultLadderJournal("XRPUSDT", 1, [])],
        TRXUSDT: [buildDefaultLadderJournal("TRXUSDT", 1, [])]
    };
}

function buildDefaultLadderState() {
    return {
        symbol: "ETHUSDT",
        startDate: formatDateInputValue(createShiftedDate(-LADDER_DEFAULT_LOOKBACK_DAYS)),
        startTime: "00:00",
        endDate: formatDateInputValue(createShiftedDate(0)),
        rows: [createLadderRow()]
    };
}

function normalizeLadderState(rawState) {
    const defaults = buildDefaultLadderState();
    if (!rawState || typeof rawState !== "object") return defaults;
    return {
        symbol: typeof rawState.symbol === "string" && rawState.symbol ? rawState.symbol : defaults.symbol,
        startDate: typeof rawState.startDate === "string" && rawState.startDate ? rawState.startDate : defaults.startDate,
        startTime: typeof rawState.startTime === "string" && rawState.startTime ? rawState.startTime : defaults.startTime,
        endDate: typeof rawState.endDate === "string" && rawState.endDate ? rawState.endDate : defaults.endDate,
        rows: Array.isArray(rawState.rows) && rawState.rows.length
            ? rawState.rows.map(createLadderRow)
            : defaults.rows
    };
}

function loadLadderState() {
    try {
        const raw = localStorage.getItem(LADDER_STATE_STORAGE_KEY);
        if (!raw) return buildDefaultLadderState();
        return normalizeLadderState(JSON.parse(raw));
    } catch (error) {
        return buildDefaultLadderState();
    }
}

function loadLadderBooks() {
    const emptyBook = createEmptyLadderBook();
    try {
        const raw = localStorage.getItem(LADDER_BOOKS_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                Object.keys(emptyBook).forEach((symbol) => {
                    const journalItems = Array.isArray(parsed[symbol]) ? parsed[symbol] : [];
                    emptyBook[symbol] = journalItems.length
                        ? journalItems.map((journal, index) => normalizeLadderJournal(symbol, journal, index))
                        : [buildDefaultLadderJournal(symbol, 1, [])];
                });
                return emptyBook;
            }
        }
    } catch (error) {
        console.error("Ошибка чтения журналов лестницы:", error);
    }

    if (Array.isArray(ladderState.rows) && ladderState.rows.length) {
        const migratedBook = createEmptyLadderBook();
        const symbol = typeof ladderState.symbol === "string" && migratedBook[ladderState.symbol] ? ladderState.symbol : "ETHUSDT";
        migratedBook[symbol] = [buildDefaultLadderJournal(symbol, 1, ladderState.rows)];
        try {
            localStorage.setItem(LADDER_BOOKS_STORAGE_KEY, JSON.stringify(migratedBook));
        } catch (error) {}
        return migratedBook;
    }

    return emptyBook;
}

function saveLadderBooks() {
    try {
        localStorage.setItem(LADDER_BOOKS_STORAGE_KEY, JSON.stringify(ladderBooks));
    } catch (error) {}
}

function getLadderJournals(symbol = ladderState.symbol) {
    const books = ladderBooks && typeof ladderBooks === "object" ? ladderBooks : {};
    const journals = Array.isArray(books[symbol]) ? books[symbol] : [];
    if (journals.length) return journals;
    const defaultJournal = buildDefaultLadderJournal(symbol, 1, []);
    ladderBooks[symbol] = [defaultJournal];
    saveLadderBooks();
    return ladderBooks[symbol];
}

function findLadderJournal(symbol, journalId) {
    return getLadderJournals(symbol).find((journal) => journal.id === journalId) || null;
}

function loadActiveLadderJournalIds() {
    const result = {};
    const symbols = Object.keys(createEmptyLadderBook());
    try {
        const raw = localStorage.getItem(ACTIVE_LADDER_JOURNALS_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        symbols.forEach((symbol) => {
            const journals = getLadderJournals(symbol);
            const storedId = parsed?.[symbol];
            result[symbol] = journals.some((journal) => journal.id === storedId) ? storedId : journals[0]?.id || null;
        });
    } catch (error) {
        symbols.forEach((symbol) => {
            result[symbol] = getLadderJournals(symbol)[0]?.id || null;
        });
    }
    return result;
}

function saveActiveLadderJournalIds() {
    try {
        localStorage.setItem(ACTIVE_LADDER_JOURNALS_STORAGE_KEY, JSON.stringify(activeLadderJournalIds));
    } catch (error) {}
}

function getActiveLadderJournalId(symbol = ladderState.symbol) {
    const journals = getLadderJournals(symbol);
    const storedId = activeLadderJournalIds?.[symbol];
    if (storedId && journals.some((journal) => journal.id === storedId)) return storedId;
    return journals[0]?.id || null;
}

function getActiveLadderJournal(symbol = ladderState.symbol) {
    const activeJournalId = getActiveLadderJournalId(symbol);
    return activeJournalId ? findLadderJournal(symbol, activeJournalId) : null;
}

function saveLadderState() {
    try {
        localStorage.setItem(LADDER_STATE_STORAGE_KEY, JSON.stringify(ladderState));
    } catch (error) {}
}

function parseLadderNumber(value) {
    if (value === null || value === undefined) return NaN;
    const normalized = String(value).trim().replace(",", ".");
    if (!normalized) return NaN;
    const parsed = parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : NaN;
}

function formatLadderMoney(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return "0.00 $";
    return `${amount.toFixed(2)} $`;
}

function formatLadderInteger(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return "0";
    return Math.round(amount).toString();
}

function formatLadderFraction(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return "-";
    return amount.toFixed(5);
}

function setLadderStatus(message, tone = "") {
    const statusEl = document.getElementById("ladderStatus");
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.classList.remove("is-loading", "is-error", "is-success");
    if (tone) statusEl.classList.add(`is-${tone}`);
}

function getLadderSymbolLabel(symbol = ladderState.symbol) {
    const symbolEl = document.getElementById("ladderSymbol");
    if (symbolEl) {
        const option = Array.from(symbolEl.options).find((item) => item.value === symbol);
        if (option) return option.textContent?.trim() || symbol;
    }
    return symbol;
}

function updateLadderUiText() {
    const symbolLabel = getLadderSymbolLabel();
    const activeJournal = getActiveLadderJournal();
    const journalsCount = getLadderJournals().length;
    const journalName = activeJournal?.name || "Журнал 1";
    const journalTabsTitleEl = document.getElementById("ladderJournalTabsTitle");
    const journalTabsMetaEl = document.getElementById("ladderJournalTabsMeta");
    const tableTitleEl = document.getElementById("ladderTableTitle");

    if (journalTabsTitleEl) journalTabsTitleEl.innerText = `Журналы ${symbolLabel}`;
    if (journalTabsMetaEl) journalTabsMetaEl.innerText = `Внутри ${symbolLabel} можно вести несколько отдельных журналов лестницы. Сейчас активен: ${journalName}. Всего журналов: ${journalsCount}. Нажми на активный журнал, чтобы переименовать его.`;
    if (tableTitleEl) tableTitleEl.innerText = `Таблица ордеров · ${journalName}`;
}

function syncLadderControlsFromState() {
    const symbolEl = document.getElementById("ladderSymbol");
    const startEl = document.getElementById("ladderDateStart");
    const startTimeEl = document.getElementById("ladderTimeStart");
    const endEl = document.getElementById("ladderDateEnd");
    if (symbolEl) symbolEl.value = ladderState.symbol;
    if (startEl) startEl.value = ladderState.startDate;
    if (startTimeEl) startTimeEl.value = ladderState.startTime || "00:00";
    if (endEl) endEl.value = ladderState.endDate;
}

function readLadderControlsToState() {
    const symbolEl = document.getElementById("ladderSymbol");
    const startEl = document.getElementById("ladderDateStart");
    const startTimeEl = document.getElementById("ladderTimeStart");
    const endEl = document.getElementById("ladderDateEnd");
    if (symbolEl?.value) ladderState.symbol = symbolEl.value;
    if (startEl?.value) ladderState.startDate = startEl.value;
    if (startTimeEl) ladderState.startTime = startTimeEl.value || "00:00";
    if (endEl?.value) ladderState.endDate = endEl.value;
}

function getLadderDateBoundaryTimestamp(dateString, endOfDay = false, timeString = "") {
    if (!dateString) return NaN;
    const suffix = endOfDay
        ? "T23:59:59.999"
        : `T${timeString && /^\d{2}:\d{2}$/.test(timeString) ? `${timeString}:00.000` : "00:00:00.000"}`;
    const date = new Date(`${dateString}${suffix}`);
    return date.getTime();
}

function formatLadderDateLabel(dateString, timeString = "") {
    if (!dateString) return "-";
    const date = new Date(`${dateString}T00:00:00`);
    if (Number.isNaN(date.getTime())) return dateString;
    const dateLabel = date.toLocaleDateString("ru-RU");
    if (timeString && /^\d{2}:\d{2}$/.test(timeString)) return `${dateLabel} ${timeString}`;
    return dateLabel;
}

function buildLadderHistoryKey() {
    return `${ladderState.symbol}_${ladderState.startDate}_${ladderState.startTime || "00:00"}_${ladderState.endDate}_${LADDER_INTERVAL}`;
}

async function fetchLadderCandles(symbol, startDate, endDate) {
    const startTime = getLadderDateBoundaryTimestamp(startDate, false, ladderState.startTime);
    const endTime = getLadderDateBoundaryTimestamp(endDate, true);
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime < startTime) return [];

    const candles = [];
    const limit = 1000;
    let requestStart = startTime;
    let guard = 0;

    while (requestStart <= endTime && guard < 80) {
        const path = `/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${LADDER_INTERVAL}&limit=${limit}&startTime=${requestStart}&endTime=${endTime}`;
        const batch = await fetchRiskBinanceJson(path);
        if (!Array.isArray(batch) || !batch.length) break;

        batch.forEach((item) => {
            candles.push({
                openTime: Number(item[0]),
                high: Number(item[2]),
                low: Number(item[3]),
                closeTime: Number(item[6])
            });
        });

        if (batch.length < limit) break;
        requestStart = Number(batch[batch.length - 1][0]) + LADDER_INTERVAL_MS;
        guard += 1;
    }

    return candles;
}

function countLadderTriggers(candles, direction, startPrice, sellPrice) {
    if (!Array.isArray(candles) || !candles.length) return 0;
    if (!Number.isFinite(startPrice) || !Number.isFinite(sellPrice) || startPrice <= 0 || sellPrice <= 0 || startPrice === sellPrice) return 0;

    const isShortCycle = direction === "short";
    let armed = false;
    let count = 0;

    candles.forEach((candle) => {
        const high = Number(candle.high);
        const low = Number(candle.low);
        if (!Number.isFinite(high) || !Number.isFinite(low)) return;

        if (isShortCycle) {
            if (!armed && high >= startPrice) armed = true;
            if (armed && low <= sellPrice) {
                count += 1;
                armed = false;
            }
            return;
        }

        if (!armed && low <= startPrice) armed = true;
        if (armed && high >= sellPrice) {
            count += 1;
            armed = false;
        }
    });

    return count;
}

function computeLadderRowMetrics(row) {
    const direction = row.direction === "long" ? "long" : "short";
    const startPrice = parseLadderNumber(row.start);
    const sellPrice = parseLadderNumber(row.sell);
    const budget = parseLadderNumber(row.budget);
    const leverage = Math.round(parseLadderNumber(row.leverage));
    const isDirectionValid = direction === "long" ? sellPrice > startPrice : sellPrice < startPrice;
    const isValid = Number.isFinite(startPrice) && startPrice > 0
        && Number.isFinite(sellPrice) && sellPrice > 0
        && Number.isFinite(budget) && budget > 0
        && Number.isFinite(leverage) && leverage > 0
        && startPrice !== sellPrice
        && isDirectionValid;

    if (!isValid) {
        return {
            percentFraction: NaN,
            cycleProfit: 0,
            triggers: 0,
            totalProfit: 0,
            isValid: false,
            directionHint: direction === "long"
                ? "Для LONG продажа должна быть выше старта."
                : "Для SHORT продажа должна быть ниже старта."
        };
    }

    const percentFraction = Math.abs(sellPrice - startPrice) / startPrice;
    const cycleProfit = budget * leverage * percentFraction;
    const triggers = countLadderTriggers(ladderCandles, direction, startPrice, sellPrice);

    return {
        percentFraction,
        cycleProfit,
        triggers,
        totalProfit: cycleProfit * triggers,
        isValid: true,
        directionHint: ""
    };
}

function updateLadderSummary() {
    const rowsValueEl = document.getElementById("ladderSummaryRows");
    const budgetValueEl = document.getElementById("ladderSummaryBudget");
    const cycleProfitValueEl = document.getElementById("ladderSummaryCycleProfit");
    const triggersValueEl = document.getElementById("ladderSummaryTriggers");
    const totalProfitValueEl = document.getElementById("ladderSummaryTotalProfit");

    let totalBudget = 0;
    let totalCycleProfit = 0;
    let totalTriggers = 0;
    let totalProfit = 0;
    const rows = getActiveLadderJournal()?.rows || [];

    rows.forEach((row) => {
        const budget = parseLadderNumber(row.budget);
        const metrics = computeLadderRowMetrics(row);
        if (Number.isFinite(budget) && budget > 0) totalBudget += budget;
        totalCycleProfit += metrics.cycleProfit;
        totalTriggers += metrics.triggers;
        totalProfit += metrics.totalProfit;
    });

    if (rowsValueEl) rowsValueEl.textContent = String(rows.length);
    if (budgetValueEl) budgetValueEl.textContent = formatLadderMoney(totalBudget);
    if (cycleProfitValueEl) cycleProfitValueEl.textContent = formatLadderMoney(totalCycleProfit);
    if (triggersValueEl) triggersValueEl.textContent = formatLadderInteger(totalTriggers);
    if (totalProfitValueEl) totalProfitValueEl.textContent = formatLadderMoney(totalProfit);

    const totalBudgetCell = document.getElementById("ladderTotalBudgetCell");
    const totalCycleCell = document.getElementById("ladderTotalCycleProfitCell");
    const totalTriggersCell = document.getElementById("ladderTotalTriggersCell");
    const totalProfitCell = document.getElementById("ladderTotalProfitCell");
    if (totalBudgetCell) totalBudgetCell.textContent = formatLadderMoney(totalBudget);
    if (totalCycleCell) totalCycleCell.textContent = formatLadderMoney(totalCycleProfit);
    if (totalTriggersCell) totalTriggersCell.textContent = formatLadderInteger(totalTriggers);
    if (totalProfitCell) totalProfitCell.textContent = formatLadderMoney(totalProfit);
}

function updateLadderComputedCells() {
    const rows = getActiveLadderJournal()?.rows || [];
    rows.forEach((row) => {
        const metrics = computeLadderRowMetrics(row);
        const percentEl = document.querySelector(`[data-ladder-output="percent"][data-row-id="${row.id}"]`);
        const cycleEl = document.querySelector(`[data-ladder-output="cycleProfit"][data-row-id="${row.id}"]`);
        const triggersEl = document.querySelector(`[data-ladder-output="triggers"][data-row-id="${row.id}"]`);
        const totalEl = document.querySelector(`[data-ladder-output="totalProfit"][data-row-id="${row.id}"]`);

        if (percentEl) percentEl.textContent = metrics.isValid ? formatLadderFraction(metrics.percentFraction) : "-";
        if (cycleEl) cycleEl.textContent = formatLadderMoney(metrics.cycleProfit);
        if (triggersEl) triggersEl.textContent = formatLadderInteger(metrics.triggers);
        if (totalEl) totalEl.textContent = formatLadderMoney(metrics.totalProfit);
    });

    updateLadderSummary();
}

function renderLadderTable() {
    const resultEl = document.getElementById("ladderResult");
    if (!resultEl) return;
    const activeJournal = getActiveLadderJournal();
    const rows = activeJournal?.rows || [];
    updateLadderUiText();

    if (!activeJournal) {
        resultEl.innerHTML = '<div class="risk-empty-state">Журнал не найден. Создай новый журнал для этой монеты.</div>';
        updateLadderSummary();
        return;
    }

    if (!rows.length) {
        resultEl.innerHTML = `<div class="risk-empty-state">Пока нет строк в ${escapeHtml(activeJournal.name)}. Нажми "Добавить ордер", чтобы создать первую строку.</div>`;
        updateLadderSummary();
        return;
    }

    let html = '<div class="risk-ladder-table-wrap"><table class="risk-ladder-table"><thead><tr><th></th><th>№</th><th>Направление</th><th>Старт</th><th>Продажа</th><th>Бюджет</th><th>%</th><th>Плечо</th><th>Прибыль за круг</th><th>Сработал</th><th>Прибыль общая</th><th>Комментарий</th><th></th></tr></thead><tbody>';

    rows.forEach((row, index) => {
        const metrics = computeLadderRowMetrics(row);
        html += `
            <tr class="risk-draggable-row" data-ladder-row-id="${row.id}">
              <td class="risk-drag-cell" draggable="true" data-ladder-drag-handle="true" title="Перетащи, чтобы изменить порядок">⋮⋮</td>
              <td class="risk-ladder-index">${index + 1}</td>
              <td>
                <select data-row-id="${row.id}" data-ladder-field="direction">
                  <option value="long" ${row.direction === "long" ? "selected" : ""}>LONG</option>
                  <option value="short" ${row.direction === "short" ? "selected" : ""}>SHORT</option>
                </select>
              </td>
              <td><input type="number" step="0.0001" min="0" data-row-id="${row.id}" data-ladder-field="start" value="${escapeHtml(row.start)}" placeholder="2089"></td>
              <td><input type="number" step="0.0001" min="0" data-row-id="${row.id}" data-ladder-field="sell" value="${escapeHtml(row.sell)}" placeholder="2081"></td>
              <td><input type="number" step="0.01" min="0" data-row-id="${row.id}" data-ladder-field="budget" value="${escapeHtml(normalizeLadderBudgetValue(row.budget))}" placeholder="2000.00"></td>
              <td class="risk-ladder-metric" title="${escapeHtml(metrics.directionHint)}"><span data-ladder-output="percent" data-row-id="${row.id}">${metrics.isValid ? formatLadderFraction(metrics.percentFraction) : "-"}</span></td>
              <td><input type="number" step="1" min="1" data-row-id="${row.id}" data-ladder-field="leverage" value="${escapeHtml(normalizeLadderLeverageValue(row.leverage))}" placeholder="20"></td>
              <td class="risk-ladder-metric"><span data-ladder-output="cycleProfit" data-row-id="${row.id}">${formatLadderMoney(metrics.cycleProfit)}</span></td>
              <td class="risk-ladder-metric"><span data-ladder-output="triggers" data-row-id="${row.id}">${formatLadderInteger(metrics.triggers)}</span></td>
              <td class="risk-ladder-metric"><span data-ladder-output="totalProfit" data-row-id="${row.id}">${formatLadderMoney(metrics.totalProfit)}</span></td>
              <td class="risk-ladder-comment-cell"><input type="text" data-row-id="${row.id}" data-ladder-field="note" value="${escapeHtml(row.note)}" placeholder="Комментарий"></td>
              <td class="risk-actions-cell"><button type="button" class="risk-small-btn risk-danger-btn" data-ladder-action="delete" data-row-id="${row.id}">Удалить</button></td>
            </tr>
        `;
    });

    html += `</tbody><tfoot><tr class="risk-total-row"><td></td><td colspan="4"><strong>ИТОГО</strong></td><td id="ladderTotalBudgetCell">${formatLadderMoney(0)}</td><td>-</td><td>-</td><td id="ladderTotalCycleProfitCell">${formatLadderMoney(0)}</td><td id="ladderTotalTriggersCell">0</td><td id="ladderTotalProfitCell">${formatLadderMoney(0)}</td><td colspan="2">По всем строкам</td></tr></tfoot></table></div>`;
    resultEl.innerHTML = html;
    updateLadderComputedCells();
}

function setActiveLadderJournal(journalId) {
    const targetJournal = findLadderJournal(ladderState.symbol, journalId);
    if (!targetJournal) return;
    activeLadderJournalIds[ladderState.symbol] = journalId;
    saveActiveLadderJournalIds();
    renderLadderJournalTabs();
    renderLadderTable();
}

function renameLadderJournal(journalId) {
    const targetJournal = findLadderJournal(ladderState.symbol, journalId);
    if (!targetJournal) return;
    const nextName = prompt(`Новое название для журнала ${getLadderSymbolLabel()}:`, targetJournal.name);
    if (nextName === null) return;
    const trimmedName = nextName.trim();
    if (!trimmedName) {
        alert("Название журнала не должно быть пустым.");
        return;
    }
    targetJournal.name = trimmedName;
    saveLadderBooks();
    renderLadderJournalTabs();
    renderLadderTable();
}

function renderLadderJournalTabs() {
    const tabsWrap = document.getElementById("ladderJournalTabs");
    if (!tabsWrap) return;
    const journals = getLadderJournals();
    const activeJournalId = getActiveLadderJournalId();

    tabsWrap.innerHTML = journals.map((journal) => `
        <button
            type="button"
            class="risk-strategy-btn${journal.id === activeJournalId ? " active" : ""}"
            data-ladder-journal="${journal.id}"
            title="${journal.id === activeJournalId ? "Нажми, чтобы переименовать текущий журнал" : "Нажми, чтобы открыть журнал"}"
        >${escapeHtml(journal.name)} (${journal.rows.length})</button>
    `).join("");

    tabsWrap.querySelectorAll("[data-ladder-journal]").forEach((button) => {
        button.addEventListener("click", () => {
            const journalId = button.getAttribute("data-ladder-journal");
            if (!journalId) return;
            if (journalId === activeJournalId) {
                renameLadderJournal(journalId);
                return;
            }
            setActiveLadderJournal(journalId);
        });
    });

    updateLadderUiText();
}

function addLadderJournal() {
    const journals = getLadderJournals();
    const newJournal = buildDefaultLadderJournal(ladderState.symbol, journals.length + 1, []);
    ladderBooks[ladderState.symbol] = [...journals, newJournal];
    activeLadderJournalIds[ladderState.symbol] = newJournal.id;
    saveLadderBooks();
    saveActiveLadderJournalIds();
    renderLadderJournalTabs();
    renderLadderTable();
    setLadderStatus(`Создан ${newJournal.name}. Теперь можно заполнять новую лестницу.`, "");
}

function clearLadderDragState() {
    draggedLadderRowId = null;
    const resultEl = document.getElementById("ladderResult");
    if (!resultEl) return;
    resultEl.querySelectorAll(".dragging, .drag-over").forEach((row) => {
        row.classList.remove("dragging");
        row.classList.remove("drag-over");
    });
}

function moveLadderRow(fromRowId, toRowId) {
    const activeJournal = getActiveLadderJournal();
    if (!activeJournal || !fromRowId || !toRowId || fromRowId === toRowId) return false;

    const rows = [...activeJournal.rows];
    const fromIndex = rows.findIndex((row) => row.id === fromRowId);
    const toIndex = rows.findIndex((row) => row.id === toRowId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return false;

    const [movedRow] = rows.splice(fromIndex, 1);
    rows.splice(toIndex, 0, movedRow);
    activeJournal.rows = rows;
    saveLadderBooks();
    renderLadderJournalTabs();
    renderLadderTable();
    setLadderStatus("Порядок ордеров обновлен.", "");
    return true;
}

function deleteActiveLadderJournal() {
    const journals = getLadderJournals();
    const activeJournalId = getActiveLadderJournalId();
    const activeJournalIndex = journals.findIndex((journal) => journal.id === activeJournalId);
    const activeJournal = activeJournalIndex >= 0 ? journals[activeJournalIndex] : null;

    if (!activeJournal) return;
    if (journals.length <= 1) {
        alert("Нужно оставить хотя бы один журнал для этой монеты.");
        return;
    }
    if (!confirm(`Удалить ${activeJournal.name} у ${getLadderSymbolLabel()}? Все строки внутри этого журнала будут удалены.`)) return;

    const nextJournals = journals.filter((journal) => journal.id !== activeJournal.id);
    ladderBooks[ladderState.symbol] = nextJournals;
    const nextActiveJournal = nextJournals[Math.max(0, activeJournalIndex - 1)] || nextJournals[0];
    activeLadderJournalIds[ladderState.symbol] = nextActiveJournal.id;
    saveLadderBooks();
    saveActiveLadderJournalIds();
    renderLadderJournalTabs();
    renderLadderTable();
    setLadderStatus(`Удален ${activeJournal.name}. Активен ${nextActiveJournal.name}.`, "");
}

async function refreshLadderHistory(force = false) {
    readLadderControlsToState();
    saveLadderState();

    const startTime = getLadderDateBoundaryTimestamp(ladderState.startDate, false, ladderState.startTime);
    const endTime = getLadderDateBoundaryTimestamp(ladderState.endDate, true);
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) {
        ladderCandles = [];
        ladderCandlesKey = "";
        setLadderStatus("Выбери корректный диапазон дат для подсчета срабатываний.", "error");
        updateLadderComputedCells();
        return;
    }

    if (endTime < startTime) {
        ladderCandles = [];
        ladderCandlesKey = "";
        setLadderStatus("Дата конца должна быть позже даты начала.", "error");
        updateLadderComputedCells();
        return;
    }

    const nextKey = buildLadderHistoryKey();
    if (!force && ladderCandlesKey === nextKey && ladderCandles.length) {
        setLadderStatus(`История ${ladderState.symbol} уже загружена: ${ladderCandles.length} свечей Binance ${LADDER_INTERVAL} за ${formatLadderDateLabel(ladderState.startDate, ladderState.startTime)} - ${formatLadderDateLabel(ladderState.endDate)}.`, "success");
        updateLadderComputedCells();
        return;
    }

    const requestId = ++ladderHistoryRequestId;
    setLadderStatus(`Загружаю срабатывания по ${ladderState.symbol} за ${formatLadderDateLabel(ladderState.startDate, ladderState.startTime)} - ${formatLadderDateLabel(ladderState.endDate)}...`, "loading");

    try {
        const candles = await fetchLadderCandles(ladderState.symbol, ladderState.startDate, ladderState.endDate);
        if (requestId !== ladderHistoryRequestId) return;

        ladderCandles = candles;
        ladderCandlesKey = nextKey;
        updateLadderComputedCells();

        if (candles.length) {
            setLadderStatus(`Загружено ${candles.length} свечей Binance ${LADDER_INTERVAL}. Срабатывания в таблице пересчитаны автоматически.`, "success");
        } else {
            setLadderStatus(`За ${formatLadderDateLabel(ladderState.startDate, ladderState.startTime)} - ${formatLadderDateLabel(ladderState.endDate)} нет свечей для ${ladderState.symbol}.`, "error");
        }
    } catch (error) {
        if (requestId !== ladderHistoryRequestId) return;
        ladderCandles = [];
        ladderCandlesKey = "";
        updateLadderComputedCells();
        setLadderStatus("Не удалось загрузить историю Binance. Пока оставил таблицу без срабатываний.", "error");
        console.error("Ошибка загрузки лестницы:", error);
    }
}

function setupLadderTableEvents() {
    const resultEl = document.getElementById("ladderResult");
    const addBtn = document.getElementById("ladderAddRowBtn");
    const refreshBtn = document.getElementById("ladderRefreshBtn");
    const addJournalBtn = document.getElementById("addLadderJournalBtn");
    const deleteJournalBtn = document.getElementById("deleteLadderJournalBtn");
    const symbolEl = document.getElementById("ladderSymbol");
    const startEl = document.getElementById("ladderDateStart");
    const startTimeEl = document.getElementById("ladderTimeStart");
    const endEl = document.getElementById("ladderDateEnd");

    if (addBtn) {
        addBtn.addEventListener("click", () => {
            readLadderControlsToState();
            const activeJournal = getActiveLadderJournal();
            if (!activeJournal) return;
            activeJournal.rows.push(createLadderRow());
            saveLadderBooks();
            renderLadderTable();
            setLadderStatus("Добавил новую строку. Заполни уровни старта и продажи.", "");
        });
    }

    if (refreshBtn) {
        refreshBtn.addEventListener("click", () => {
            refreshLadderHistory(true);
        });
    }

    [symbolEl, startEl, startTimeEl, endEl].forEach((control) => {
        if (!control) return;
        control.addEventListener("change", () => {
            readLadderControlsToState();
            saveLadderState();
            ladderCandles = [];
            ladderCandlesKey = "";
            renderLadderJournalTabs();
            renderLadderTable();
            refreshLadderHistory(true);
        });
    });

    if (addJournalBtn) addJournalBtn.addEventListener("click", addLadderJournal);
    if (deleteJournalBtn) deleteJournalBtn.addEventListener("click", deleteActiveLadderJournal);

    if (!resultEl) return;

    resultEl.addEventListener("input", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLSelectElement)) return;
        const rowId = target.dataset.rowId;
        const field = target.dataset.ladderField;
        if (!rowId || !field) return;

        const row = getActiveLadderJournal()?.rows.find((item) => item.id === rowId);
        if (!row) return;

        if (field === "leverage") {
            const normalizedValue = normalizeLadderLeverageValue(target.value);
            row[field] = normalizedValue;
            target.value = normalizedValue;
        } else if (field === "budget") {
            row[field] = target.value;
        } else {
            row[field] = target.value;
        }

        saveLadderBooks();
        updateLadderComputedCells();
    });

    resultEl.addEventListener("change", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLSelectElement)) return;
        const rowId = target.dataset.rowId;
        const field = target.dataset.ladderField;
        if (!rowId || !field) return;

        const row = getActiveLadderJournal()?.rows.find((item) => item.id === rowId);
        if (!row) return;

        if (field === "budget") {
            const normalizedValue = normalizeLadderBudgetValue(target.value);
            row[field] = normalizedValue;
            target.value = normalizedValue;
            saveLadderBooks();
            updateLadderComputedCells();
            return;
        }

        if (field === "leverage") {
            const normalizedValue = normalizeLadderLeverageValue(target.value);
            row[field] = normalizedValue;
            target.value = normalizedValue;
            saveLadderBooks();
            updateLadderComputedCells();
        }
    });

    resultEl.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (target.dataset.ladderAction !== "delete") return;

        const rowId = target.dataset.rowId;
        const activeJournal = getActiveLadderJournal();
        if (!activeJournal) return;
        activeJournal.rows = activeJournal.rows.filter((row) => row.id !== rowId);
        saveLadderBooks();
        renderLadderJournalTabs();
        renderLadderTable();
        if (activeJournal.rows.length) {
            setLadderStatus("Строка удалена. Таблица пересчитана.", "");
        } else {
            setLadderStatus("Все строки удалены. Нажми \"Добавить ордер\", чтобы начать заново.", "");
        }
    });

    resultEl.addEventListener("dragstart", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (!target.closest("[data-ladder-drag-handle]")) return;

        const rowEl = target.closest("[data-ladder-row-id]");
        if (!(rowEl instanceof HTMLElement)) return;

        draggedLadderRowId = rowEl.dataset.ladderRowId || null;
        rowEl.classList.add("dragging");
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", draggedLadderRowId || "");
        }
    });

    resultEl.addEventListener("dragover", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement) || !draggedLadderRowId) return;
        const rowEl = target.closest("[data-ladder-row-id]");
        if (!(rowEl instanceof HTMLElement) || rowEl.dataset.ladderRowId === draggedLadderRowId) return;

        event.preventDefault();
        resultEl.querySelectorAll(".drag-over").forEach((row) => {
            if (row !== rowEl) row.classList.remove("drag-over");
        });
        rowEl.classList.add("drag-over");
        if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    });

    resultEl.addEventListener("dragleave", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const rowEl = target.closest("[data-ladder-row-id]");
        if (!(rowEl instanceof HTMLElement)) return;
        rowEl.classList.remove("drag-over");
    });

    resultEl.addEventListener("drop", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement) || !draggedLadderRowId) return;
        const rowEl = target.closest("[data-ladder-row-id]");
        if (!(rowEl instanceof HTMLElement)) return;

        event.preventDefault();
        const fromRowId = draggedLadderRowId;
        const targetRowId = rowEl.dataset.ladderRowId || "";
        clearLadderDragState();
        moveLadderRow(fromRowId, targetRowId);
    });

    resultEl.addEventListener("dragend", () => {
        clearLadderDragState();
    });
}

function calcLadder() {
    syncLadderControlsFromState();
    if (ladderCandlesKey !== buildLadderHistoryKey()) {
        ladderCandles = [];
    }
    renderLadderJournalTabs();
    renderLadderTable();
    if (!ladderCandles.length || ladderCandlesKey !== buildLadderHistoryKey()) {
        refreshLadderHistory(false);
        return;
    }
    updateLadderComputedCells();
}

if (entry) entry.oninput = calculate;
if (deposit) deposit.oninput = calculate;
if (leverage) leverage.oninput = calculate;
if (maxPrice) {
    maxPrice.addEventListener("input", () => {
        calculate();
    });
}
if (side) side.onchange = calculate;
if (positionMode) {
    positionMode.addEventListener("change", () => {
        updateSingleCalculatorMode();
        calculate();
    });
}

restoreRiskState();
updateSingleCalculatorMode();

root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.id === "applySuggestedRiskPriceBtn" && maxPrice && lastSuggestedRiskPrice) {
        maxPrice.value = lastSuggestedRiskPrice;
        calculate();
    }
});
setupLadderTableEvents();

/* STRATEGY ORDERS */
const ORDER_STRATEGIES = [
    { key: "ETH", label: "ETH", symbol: "ETHUSDT", defaultEntry: 1900 },
    { key: "BTC", label: "BTC", symbol: "BTCUSDT", defaultEntry: 65000 },
    { key: "SOL", label: "SOL", symbol: "SOLUSDT", defaultEntry: 150 },
    { key: "XRP", label: "XRP", symbol: "XRPUSDT", defaultEntry: 0.7 },
    { key: "TRX", label: "TRX", symbol: "TRXUSDT", defaultEntry: 0.12 }
];
const ORDER_STRATEGY_MAP = ORDER_STRATEGIES.reduce((acc, strategy) => {
    acc[strategy.key] = strategy;
    return acc;
}, {});
const TICKER_API_PATH = "/api/v3/ticker/price?symbol=";
const STRATEGY_BOOKS_STORAGE_KEY = "risk_terminal_strategy_books_v2";
const LEGACY_STRATEGY_ORDERS_STORAGE_KEY = "risk_terminal_strategy_orders_v1";
const STRATEGY_DRAFTS_STORAGE_KEY = "risk_terminal_strategy_drafts_v2";
const ACTIVE_STRATEGY_STORAGE_KEY = "risk_terminal_active_strategy_v1";
const ACTIVE_JOURNALS_STORAGE_KEY = "risk_terminal_active_journals_v1";
const LEGACY_ETH_ORDERS_STORAGE_KEY = "risk_terminal_eth_orders_v2";

let strategyPrices = ORDER_STRATEGIES.reduce((acc, strategy) => {
    acc[strategy.key] = { price: null, updatedAt: null, hasError: false };
    return acc;
}, {});
let strategyBooks = loadStrategyBooks();
let orderDrafts = loadOrderDrafts();
let activeOrderStrategyKey = loadActiveStrategyKey();
let activeJournalIds = loadActiveJournalIds();
let editingOrderId = null;
let strategyPriceIntervalId = null;
let strategyPriceRequestInFlight = false;
let draggedOrderId = null;

function generateOrderId() {
    return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function generateJournalId(strategyKey) {
    return `${strategyKey.toLowerCase()}_journal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function isClosedOrder(order) {
    return order.exit !== null && order.exit !== undefined && !Number.isNaN(order.exit);
}

function formatMoney(value) {
    const amount = Number(value) || 0;
    const sign = amount > 0 ? "+" : "";
    return `${sign}${amount.toFixed(2)} $`;
}

function formatPercent(value) {
    const amount = Number(value) || 0;
    const sign = amount > 0 ? "+" : "";
    return `${sign}${amount.toFixed(2)}%`;
}

function formatDisplayPrice(value) {
    const price = Number(value);
    if (!Number.isFinite(price) || price <= 0) return "-";
    if (price >= 100) return price.toFixed(2);
    if (price >= 1) return price.toFixed(3);
    return price.toFixed(4);
}

function formatInputPrice(value) {
    const price = Number(value);
    if (!Number.isFinite(price) || price <= 0) return "";
    if (price >= 100) return price.toFixed(2);
    if (price >= 1) return price.toFixed(3);
    return price.toFixed(4);
}

function getToneClass(value) {
    if (value > 0) return "safe";
    if (value < 0) return "danger";
    return "";
}

function setSignedMetricValue(element, value) {
    if (!element) return;
    element.innerText = formatMoney(value);
    element.className = getToneClass(value);
}

function normalizeOrder(order) {
    if (!order || typeof order !== "object") return null;
    const entryValue = parseFloat(order.entry);
    const leverageValue = parseFloat(order.leverage);
    const depositValue = parseFloat(order.deposit);
    const exitValue = order.exit === null || order.exit === undefined || order.exit === ""
        ? null
        : parseFloat(order.exit);
    if (!Number.isFinite(entryValue) || entryValue <= 0 || !Number.isFinite(leverageValue) || leverageValue <= 0 || !Number.isFinite(depositValue) || depositValue <= 0) {
        return null;
    }
    if (exitValue !== null && (!Number.isFinite(exitValue) || exitValue <= 0)) return null;
    return {
        id: typeof order.id === "string" && order.id ? order.id : generateOrderId(),
        side: order.side === "short" ? "short" : "long",
        entry: entryValue,
        exit: exitValue,
        leverage: leverageValue,
        deposit: depositValue,
        note: typeof order.note === "string" ? order.note : ""
    };
}

function buildDefaultJournal(strategyKey, index = 1, orders = []) {
    return {
        id: generateJournalId(strategyKey),
        name: `Журнал ${index}`,
        orders: orders.map(normalizeOrder).filter(Boolean)
    };
}

function normalizeJournal(strategyKey, journal, index) {
    if (!journal || typeof journal !== "object") return buildDefaultJournal(strategyKey, index + 1);
    const fallback = buildDefaultJournal(strategyKey, index + 1);
    return {
        id: typeof journal.id === "string" && journal.id ? journal.id : fallback.id,
        name: typeof journal.name === "string" && journal.name.trim() ? journal.name.trim() : fallback.name,
        orders: Array.isArray(journal.orders) ? journal.orders.map(normalizeOrder).filter(Boolean) : []
    };
}

function buildDefaultOrderDraft(strategyKey) {
    const strategy = ORDER_STRATEGY_MAP[strategyKey] || ORDER_STRATEGIES[0];
    const currentPrice = strategyPrices[strategy.key]?.price;
    return {
        side: "long",
        entry: currentPrice ? formatInputPrice(currentPrice) : String(strategy.defaultEntry),
        exit: "",
        leverage: "10",
        deposit: "1000",
        note: ""
    };
}

function createEmptyStrategyBook() {
    return ORDER_STRATEGIES.reduce((acc, strategy) => {
        acc[strategy.key] = [buildDefaultJournal(strategy.key, 1, [])];
        return acc;
    }, {});
}

function normalizeDraft(strategyKey, draft) {
    const defaults = buildDefaultOrderDraft(strategyKey);
    if (!draft || typeof draft !== "object") return defaults;
    return {
        side: draft.side === "short" ? "short" : "long",
        entry: draft.entry !== undefined && draft.entry !== null ? String(draft.entry) : defaults.entry,
        exit: draft.exit !== undefined && draft.exit !== null ? String(draft.exit) : defaults.exit,
        leverage: draft.leverage !== undefined && draft.leverage !== null ? String(draft.leverage) : defaults.leverage,
        deposit: draft.deposit !== undefined && draft.deposit !== null ? String(draft.deposit) : defaults.deposit,
        note: draft.note !== undefined && draft.note !== null ? String(draft.note) : defaults.note
    };
}

function loadStrategyBooks() {
    const emptyBook = createEmptyStrategyBook();
    try {
        const raw = localStorage.getItem(STRATEGY_BOOKS_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                ORDER_STRATEGIES.forEach(({ key }) => {
                    const journalItems = Array.isArray(parsed[key]) ? parsed[key] : [];
                    emptyBook[key] = journalItems.length
                        ? journalItems.map((journal, index) => normalizeJournal(key, journal, index))
                        : [buildDefaultJournal(key, 1, [])];
                });
                return emptyBook;
            }
        }
    } catch (error) {
        console.error("Ошибка чтения журналов стратегий:", error);
    }

    try {
        const raw = localStorage.getItem(LEGACY_STRATEGY_ORDERS_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                ORDER_STRATEGIES.forEach(({ key }) => {
                    const strategyItems = Array.isArray(parsed[key]) ? parsed[key] : [];
                    emptyBook[key] = [buildDefaultJournal(key, 1, strategyItems)];
                });
                localStorage.setItem(STRATEGY_BOOKS_STORAGE_KEY, JSON.stringify(emptyBook));
                return emptyBook;
            }
        }
    } catch (error) {
        console.error("Ошибка миграции стратегии в журналы:", error);
    }

    try {
        const legacyRaw = localStorage.getItem(LEGACY_ETH_ORDERS_STORAGE_KEY);
        if (legacyRaw) {
            const parsed = JSON.parse(legacyRaw);
            emptyBook.ETH = [buildDefaultJournal("ETH", 1, Array.isArray(parsed) ? parsed : [])];
            localStorage.setItem(STRATEGY_BOOKS_STORAGE_KEY, JSON.stringify(emptyBook));
        }
    } catch (error) {
        console.error("Ошибка миграции старого журнала ETH:", error);
    }

    return emptyBook;
}

function saveStrategyBooks() {
    localStorage.setItem(STRATEGY_BOOKS_STORAGE_KEY, JSON.stringify(strategyBooks));
}

function loadOrderDrafts() {
    const emptyDrafts = {};
    ORDER_STRATEGIES.forEach(({ key }) => {
        emptyDrafts[key] = {};
        (strategyBooks[key] || []).forEach(journal => {
            emptyDrafts[key][journal.id] = buildDefaultOrderDraft(key);
        });
    });

    try {
        const raw = localStorage.getItem(STRATEGY_DRAFTS_STORAGE_KEY);
        if (!raw) return emptyDrafts;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return emptyDrafts;
        ORDER_STRATEGIES.forEach(({ key }) => {
            (strategyBooks[key] || []).forEach(journal => {
                emptyDrafts[key][journal.id] = normalizeDraft(key, parsed[key]?.[journal.id]);
            });
        });
    } catch (error) {
        console.error("Ошибка чтения черновиков стратегий:", error);
    }
    return emptyDrafts;
}

function saveOrderDrafts() {
    localStorage.setItem(STRATEGY_DRAFTS_STORAGE_KEY, JSON.stringify(orderDrafts));
}

function loadActiveStrategyKey() {
    try {
        const stored = localStorage.getItem(ACTIVE_STRATEGY_STORAGE_KEY);
        if (stored && ORDER_STRATEGY_MAP[stored]) return stored;
    } catch (error) {}
    return "ETH";
}

function getActiveStrategy() {
    return ORDER_STRATEGY_MAP[activeOrderStrategyKey] || ORDER_STRATEGIES[0];
}

function getStrategyJournals(strategyKey) {
    const journals = Array.isArray(strategyBooks[strategyKey]) ? strategyBooks[strategyKey] : [];
    if (journals.length) return journals;
    const defaultJournal = buildDefaultJournal(strategyKey, 1, []);
    strategyBooks[strategyKey] = [defaultJournal];
    saveStrategyBooks();
    return strategyBooks[strategyKey];
}

function findJournal(strategyKey, journalId) {
    return getStrategyJournals(strategyKey).find(journal => journal.id === journalId) || null;
}

function getActiveJournalId(strategyKey) {
    const journals = getStrategyJournals(strategyKey);
    const storedId = activeJournalIds?.[strategyKey];
    if (storedId && journals.some(journal => journal.id === storedId)) return storedId;
    return journals[0]?.id || null;
}

function getActiveJournal(strategyKey = activeOrderStrategyKey) {
    const activeJournalId = getActiveJournalId(strategyKey);
    return activeJournalId ? findJournal(strategyKey, activeJournalId) : null;
}

function getJournalOrders(strategyKey, journalId) {
    return findJournal(strategyKey, journalId)?.orders || [];
}

function loadActiveJournalIds() {
    const result = {};
    try {
        const raw = localStorage.getItem(ACTIVE_JOURNALS_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        ORDER_STRATEGIES.forEach(({ key }) => {
            const journals = getStrategyJournals(key);
            const storedId = parsed?.[key];
            result[key] = journals.some(journal => journal.id === storedId) ? storedId : journals[0]?.id || null;
        });
    } catch (error) {
        ORDER_STRATEGIES.forEach(({ key }) => {
            result[key] = getStrategyJournals(key)[0]?.id || null;
        });
    }
    return result;
}

function saveActiveJournalIds() {
    localStorage.setItem(ACTIVE_JOURNALS_STORAGE_KEY, JSON.stringify(activeJournalIds));
}

function getStrategyPriceState(strategyKey) {
    return strategyPrices[strategyKey] || { price: null, updatedAt: null, hasError: false };
}

function getOrderEffectivePrice(order, strategyKey) {
    return isClosedOrder(order) ? order.exit : getStrategyPriceState(strategyKey).price;
}

function calcOrderPnl(order, strategyKey) {
    const price = getOrderEffectivePrice(order, strategyKey);
    if (!price || !order.entry || !order.deposit || !order.leverage) return null;
    const nominal = order.deposit * order.leverage;
    const move = order.side === "long"
        ? (price - order.entry) / order.entry
        : (order.entry - price) / order.entry;
    const pnl = nominal * move;
    const roi = order.deposit > 0 ? (pnl / order.deposit) * 100 : 0;
    return { price, nominal, pnl, roi };
}

function summarizeStrategy(strategyKey) {
    const strategy = ORDER_STRATEGY_MAP[strategyKey];
    const priceState = getStrategyPriceState(strategyKey);
    const journals = getStrategyJournals(strategyKey);
    let openCount = 0;
    let openPnl = 0;
    let closedPnl = 0;
    let totalOrders = 0;

    journals.forEach(journal => {
        totalOrders += journal.orders.length;
        journal.orders.forEach(order => {
            const isClosed = isClosedOrder(order);
            if (!isClosed) openCount += 1;
            const calc = calcOrderPnl(order, strategyKey);
            if (!calc) return;
            if (isClosed) closedPnl += calc.pnl;
            else openPnl += calc.pnl;
        });
    });

    return {
        key: strategy.key,
        label: strategy.label,
        journalCount: journals.length,
        totalOrders,
        openCount,
        openPnl,
        closedPnl,
        totalPnl: openPnl + closedPnl,
        price: priceState.price,
        updatedAt: priceState.updatedAt,
        hasError: priceState.hasError
    };
}

function getAllStrategySummaries() {
    return ORDER_STRATEGIES.map(strategy => summarizeStrategy(strategy.key));
}

function summarizeJournal(strategyKey, journal) {
    if (!journal) return null;
    const strategy = ORDER_STRATEGY_MAP[strategyKey];
    const priceState = getStrategyPriceState(strategyKey);
    let openCount = 0;
    let openPnl = 0;
    let closedPnl = 0;
    journal.orders.forEach(order => {
        const isClosed = isClosedOrder(order);
        if (!isClosed) openCount += 1;
        const calc = calcOrderPnl(order, strategyKey);
        if (!calc) return;
        if (isClosed) closedPnl += calc.pnl;
        else openPnl += calc.pnl;
    });
    return {
        id: journal.id,
        name: journal.name,
        label: strategy.label,
        totalOrders: journal.orders.length,
        openCount,
        openPnl,
        closedPnl,
        totalPnl: openPnl + closedPnl,
        price: priceState.price,
        updatedAt: priceState.updatedAt,
        hasError: priceState.hasError
    };
}

function readOrderFormValues() {
    return {
        side: document.getElementById("orderSide")?.value || "long",
        entry: document.getElementById("orderEntry")?.value || "",
        exit: document.getElementById("orderExit")?.value || "",
        leverage: document.getElementById("orderLeverage")?.value || "",
        deposit: document.getElementById("orderDeposit")?.value || "",
        note: document.getElementById("orderNote")?.value || ""
    };
}

function ensureDraftBucket(strategyKey) {
    if (!orderDrafts[strategyKey] || typeof orderDrafts[strategyKey] !== "object") {
        orderDrafts[strategyKey] = {};
    }
    return orderDrafts[strategyKey];
}

function getJournalDraft(strategyKey, journalId) {
    const bucket = ensureDraftBucket(strategyKey);
    bucket[journalId] = normalizeDraft(strategyKey, bucket[journalId]);
    return bucket[journalId];
}

function setJournalDraft(strategyKey, journalId, draft) {
    const bucket = ensureDraftBucket(strategyKey);
    bucket[journalId] = normalizeDraft(strategyKey, draft);
    saveOrderDrafts();
}

function applyDraftToOrderForm(strategyKey, journalId) {
    const draft = getJournalDraft(strategyKey, journalId);
    const sideEl = document.getElementById("orderSide");
    const entryEl = document.getElementById("orderEntry");
    const exitEl = document.getElementById("orderExit");
    const levEl = document.getElementById("orderLeverage");
    const depositEl = document.getElementById("orderDeposit");
    const noteEl = document.getElementById("orderNote");
    if (sideEl) sideEl.value = draft.side;
    if (entryEl) entryEl.value = draft.entry;
    if (exitEl) exitEl.value = draft.exit;
    if (levEl) levEl.value = draft.leverage;
    if (depositEl) depositEl.value = draft.deposit;
    if (noteEl) noteEl.value = draft.note;
    saveRiskState();
}

function updateOrderUiText() {
    const strategy = getActiveStrategy();
    const activeJournal = getActiveJournal();
    const titleEl = document.getElementById("orderFormTitle");
    const addBtn = document.getElementById("addOrderBtn");
    const cancelBtn = document.getElementById("cancelEditOrderBtn");
    const formNoteEl = document.getElementById("ordersFormNote");
    const summaryTitleEl = document.getElementById("strategySummaryTitle");
    const currentPriceLabelEl = document.getElementById("strategyCurrentPriceLabel");
    const journalTitleEl = document.getElementById("ordersJournalTitle");
    const journalTabsTitleEl = document.getElementById("journalTabsTitle");
    const journalTabsMetaEl = document.getElementById("journalTabsMeta");
    const journalName = activeJournal?.name || "Журнал 1";
    const journalsCount = getStrategyJournals(strategy.key).length;

    if (titleEl) titleEl.innerText = `${editingOrderId ? "Редактирование ордера" : "Новый ордер"} · ${strategy.label} · ${journalName}`;
    if (addBtn) addBtn.innerText = editingOrderId ? "Сохранить изменения" : "Добавить ордер";
    if (cancelBtn) cancelBtn.style.display = editingOrderId ? "inline-block" : "none";
    if (formNoteEl) formNoteEl.innerText = `Если точка выхода пустая, ордер считается открытым и PnL считается от текущего курса ${strategy.label}. Если точка выхода заполнена, ордер считается закрытым и PnL фиксируется по цене выхода.`;
    if (summaryTitleEl) summaryTitleEl.innerText = `Сводка по ${strategy.label} · ${journalName}`;
    if (currentPriceLabelEl) currentPriceLabelEl.innerText = `Текущий курс ${strategy.label}`;
    if (journalTitleEl) journalTitleEl.innerText = `Журнал ордеров ${strategy.label} · ${journalName}`;
    if (journalTabsTitleEl) journalTabsTitleEl.innerText = `Журналы ${strategy.label}`;
    if (journalTabsMetaEl) journalTabsMetaEl.innerText = `Внутри ${strategy.label} можно вести несколько отдельных журналов. Сейчас активен: ${journalName}. Всего журналов: ${journalsCount}. Нажми на активный журнал, чтобы переименовать его.`;
}

function resetOrderForm() {
    editingOrderId = null;
    const activeJournal = getActiveJournal();
    if (!activeJournal) return;
    setJournalDraft(activeOrderStrategyKey, activeJournal.id, buildDefaultOrderDraft(activeOrderStrategyKey));
    applyDraftToOrderForm(activeOrderStrategyKey, activeJournal.id);
    updateOrderUiText();
}

function fillOrderForm(order) {
    const sideEl = document.getElementById("orderSide");
    const entryEl = document.getElementById("orderEntry");
    const exitEl = document.getElementById("orderExit");
    const levEl = document.getElementById("orderLeverage");
    const depositEl = document.getElementById("orderDeposit");
    const noteEl = document.getElementById("orderNote");
    editingOrderId = order.id;
    if (sideEl) sideEl.value = order.side;
    if (entryEl) entryEl.value = order.entry;
    if (exitEl) exitEl.value = order.exit ?? "";
    if (levEl) levEl.value = order.leverage;
    if (depositEl) depositEl.value = order.deposit;
    if (noteEl) noteEl.value = order.note || "";
    updateOrderUiText();
    root.scrollIntoView({ behavior: "smooth", block: "start" });
}

function saveActiveOrderDraft() {
    if (editingOrderId) return;
    const activeJournal = getActiveJournal();
    if (!activeJournal) return;
    setJournalDraft(activeOrderStrategyKey, activeJournal.id, readOrderFormValues());
    saveRiskState();
}

function setActiveOrderStrategy(strategyKey) {
    if (!ORDER_STRATEGY_MAP[strategyKey]) return;
    activeOrderStrategyKey = strategyKey;
    editingOrderId = null;
    try { localStorage.setItem(ACTIVE_STRATEGY_STORAGE_KEY, strategyKey); } catch (error) {}
    const activeJournal = getActiveJournal(strategyKey);
    if (activeJournal) applyDraftToOrderForm(strategyKey, activeJournal.id);
    renderOrders();
}

function setActiveJournal(strategyKey, journalId) {
    const targetJournal = findJournal(strategyKey, journalId);
    if (!targetJournal) return;
    activeJournalIds[strategyKey] = journalId;
    editingOrderId = null;
    saveActiveJournalIds();
    applyDraftToOrderForm(strategyKey, journalId);
    renderOrders();
}

function renameJournal(strategyKey, journalId) {
    const targetJournal = findJournal(strategyKey, journalId);
    const strategy = ORDER_STRATEGY_MAP[strategyKey];
    if (!targetJournal || !strategy) return;
    const nextName = prompt(`Новое название для журнала ${strategy.label}:`, targetJournal.name);
    if (nextName === null) return;
    const trimmedName = nextName.trim();
    if (!trimmedName) {
        alert("Название журнала не должно быть пустым.");
        return;
    }
    targetJournal.name = trimmedName;
    saveStrategyBooks();
    renderOrders();
}

function renderStrategyTabs() {
    const tabsWrap = document.getElementById("ordersStrategyTabs");
    if (!tabsWrap) return;
    tabsWrap.innerHTML = ORDER_STRATEGIES.map(strategy => `
        <button
            type="button"
            class="risk-strategy-btn${strategy.key === activeOrderStrategyKey ? " active" : ""}"
            data-order-strategy="${strategy.key}"
        >${strategy.label}</button>
    `).join("");
    tabsWrap.querySelectorAll("[data-order-strategy]").forEach(button => {
        button.addEventListener("click", () => setActiveOrderStrategy(button.getAttribute("data-order-strategy")));
    });
}

function renderJournalTabs() {
    const tabsWrap = document.getElementById("ordersJournalTabs");
    if (!tabsWrap) return;
    const journals = getStrategyJournals(activeOrderStrategyKey);
    const activeJournalId = getActiveJournalId(activeOrderStrategyKey);
    tabsWrap.innerHTML = journals.map(journal => `
        <button
            type="button"
            class="risk-strategy-btn${journal.id === activeJournalId ? " active" : ""}"
            data-order-journal="${journal.id}"
            title="${journal.id === activeJournalId ? "Нажми, чтобы переименовать текущий журнал" : "Нажми, чтобы открыть журнал"}"
        >${escapeHtml(journal.name)} (${journal.orders.length})</button>
    `).join("");
    tabsWrap.querySelectorAll("[data-order-journal]").forEach(button => {
        button.addEventListener("click", () => {
            const journalId = button.getAttribute("data-order-journal");
            if (!journalId) return;
            if (journalId === activeJournalId) {
                renameJournal(activeOrderStrategyKey, journalId);
                return;
            }
            setActiveJournal(activeOrderStrategyKey, journalId);
        });
    });
}

function renderOrdersDashboard(summaries) {
    const strategiesActiveEl = document.getElementById("ordersStrategiesActive");
    const totalOpenCountEl = document.getElementById("ordersTotalOpenCount");
    const totalOpenPnlEl = document.getElementById("ordersTotalOpenPnl");
    const totalClosedPnlEl = document.getElementById("ordersTotalClosedPnl");
    const summaryWrap = document.getElementById("ordersStrategiesSummary");

    const strategiesWithOrders = summaries.filter(summary => summary.totalOrders > 0).length;
    const totalOpenCount = summaries.reduce((sum, summary) => sum + summary.openCount, 0);
    const totalOpenPnl = summaries.reduce((sum, summary) => sum + summary.openPnl, 0);
    const totalClosedPnl = summaries.reduce((sum, summary) => sum + summary.closedPnl, 0);
    const grandTotalPnl = totalOpenPnl + totalClosedPnl;

    if (strategiesActiveEl) strategiesActiveEl.innerText = String(strategiesWithOrders);
    if (totalOpenCountEl) totalOpenCountEl.innerText = String(totalOpenCount);
    setSignedMetricValue(totalOpenPnlEl, totalOpenPnl);
    setSignedMetricValue(totalClosedPnlEl, totalClosedPnl);

    if (!summaryWrap) return;

    let html = `
        <table class="risk-summary-table">
            <thead>
                <tr>
                    <th>Стратегия</th>
                    <th>Курс</th>
                    <th>Журналов</th>
                    <th>Всего ордеров</th>
                    <th>Открытых</th>
                    <th>Нереализованный PnL</th>
                    <th>Реализованный PnL</th>
                    <th>Итог</th>
                </tr>
            </thead>
            <tbody>
    `;

    summaries.forEach(summary => {
        html += `
            <tr class="${summary.key === activeOrderStrategyKey ? "risk-active-strategy-row" : ""}">
                <td><button type="button" class="risk-summary-strategy-btn" data-switch-strategy="${summary.key}">${summary.label}</button></td>
                <td>${summary.price ? `${formatDisplayPrice(summary.price)} $` : "-"}</td>
                <td>${summary.journalCount}</td>
                <td>${summary.totalOrders}</td>
                <td>${summary.openCount}</td>
                <td class="${getToneClass(summary.openPnl)}">${formatMoney(summary.openPnl)}</td>
                <td class="${getToneClass(summary.closedPnl)}">${formatMoney(summary.closedPnl)}</td>
                <td class="${getToneClass(summary.totalPnl)}">${formatMoney(summary.totalPnl)}</td>
            </tr>
        `;
    });

    html += `
            <tr class="risk-total-row">
                <td><strong>ИТОГО</strong></td>
                <td>-</td>
                <td><strong>${summaries.reduce((sum, summary) => sum + summary.journalCount, 0)}</strong></td>
                <td><strong>${summaries.reduce((sum, summary) => sum + summary.totalOrders, 0)}</strong></td>
                <td><strong>${totalOpenCount}</strong></td>
                <td class="${getToneClass(totalOpenPnl)}"><strong>${formatMoney(totalOpenPnl)}</strong></td>
                <td class="${getToneClass(totalClosedPnl)}"><strong>${formatMoney(totalClosedPnl)}</strong></td>
                <td class="${getToneClass(grandTotalPnl)}"><strong>${formatMoney(grandTotalPnl)}</strong></td>
            </tr>
            </tbody>
        </table>
    `;

    summaryWrap.innerHTML = html;
    summaryWrap.querySelectorAll("[data-switch-strategy]").forEach(button => {
        button.addEventListener("click", () => setActiveOrderStrategy(button.getAttribute("data-switch-strategy")));
    });
}

function renderActiveJournalSummary(summary) {
    const currentPriceEl = document.getElementById("strategyCurrentPrice");
    const openCountEl = document.getElementById("ordersOpenCount");
    const openPnlEl = document.getElementById("ordersOpenPnl");
    const closedPnlEl = document.getElementById("ordersClosedPnl");
    const priceStatusEl = document.getElementById("ordersPriceStatus");

    if (!summary) return;
    if (currentPriceEl) currentPriceEl.innerText = summary.price ? `${formatDisplayPrice(summary.price)} $` : "-";
    if (openCountEl) openCountEl.innerText = String(summary.openCount);
    setSignedMetricValue(openPnlEl, summary.openPnl);
    setSignedMetricValue(closedPnlEl, summary.closedPnl);

    if (!priceStatusEl) return;
    if (summary.price) {
        const updatedText = summary.updatedAt ? ` Обновлено: ${summary.updatedAt.toLocaleTimeString()}.` : "";
        priceStatusEl.innerText = `Текущий курс ${summary.label} обновляется автоматически. Для открытых ордеров PnL считается от ${formatDisplayPrice(summary.price)} $.${updatedText}`;
    } else {
        priceStatusEl.innerText = `Не удалось подтянуть текущий курс ${summary.label}. Закрытые ордера считаются, открытые будут ждать цену.`;
    }
}

function clearDropIndicators() {
    const wrap = document.getElementById("ordersTableWrap");
    if (!wrap) return;
    wrap.querySelectorAll(".drag-over").forEach(row => row.classList.remove("drag-over"));
}

function clearDragState() {
    const wrap = document.getElementById("ordersTableWrap");
    if (!wrap) return;
    wrap.querySelectorAll(".dragging, .drag-over").forEach(row => {
        row.classList.remove("dragging");
        row.classList.remove("drag-over");
    });
}

function moveOrderInJournal(strategyKey, journalId, fromIndex, toIndex) {
    const currentOrders = [...getJournalOrders(strategyKey, journalId)];
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= currentOrders.length) return false;
    const targetIndex = Math.max(0, Math.min(toIndex, currentOrders.length));
    const [movedOrder] = currentOrders.splice(fromIndex, 1);
    currentOrders.splice(targetIndex, 0, movedOrder);
    const journal = findJournal(strategyKey, journalId);
    if (!journal) return false;
    journal.orders = currentOrders;
    saveStrategyBooks();
    return true;
}

function handleRowDragStart(event) {
    const row = event.currentTarget;
    draggedOrderId = row.getAttribute("data-order-id");
    row.classList.add("dragging");
    if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", draggedOrderId || "");
    }
}

function handleRowDragOver(event) {
    event.preventDefault();
    const row = event.currentTarget;
    if (row.getAttribute("data-order-id") === draggedOrderId) return;
    clearDropIndicators();
    row.classList.add("drag-over");
}

function handleRowDragLeave(event) {
    event.currentTarget.classList.remove("drag-over");
}

function handleRowDrop(event) {
    event.preventDefault();
    const row = event.currentTarget;
    const targetId = row.getAttribute("data-order-id");
    if (!draggedOrderId || !targetId || draggedOrderId === targetId) {
        clearDragState();
        draggedOrderId = null;
        return;
    }
    const activeJournal = getActiveJournal();
    if (!activeJournal) {
        clearDragState();
        draggedOrderId = null;
        return;
    }
    const currentOrders = getJournalOrders(activeOrderStrategyKey, activeJournal.id);
    const fromIndex = currentOrders.findIndex(order => order.id === draggedOrderId);
    const targetIndex = currentOrders.findIndex(order => order.id === targetId);
    if (fromIndex === -1 || targetIndex === -1) {
        clearDragState();
        draggedOrderId = null;
        return;
    }
    const rect = row.getBoundingClientRect();
    const insertAfter = event.clientY > rect.top + rect.height / 2;
    let nextIndex = targetIndex + (insertAfter ? 1 : 0);
    if (fromIndex < nextIndex) nextIndex -= 1;
    if (moveOrderInJournal(activeOrderStrategyKey, activeJournal.id, fromIndex, nextIndex)) renderOrders();
    clearDragState();
    draggedOrderId = null;
}

function handleRowDragEnd() {
    clearDragState();
    draggedOrderId = null;
}

function attachOrderTableListeners(strategyKey, journalId) {
    const wrap = document.getElementById("ordersTableWrap");
    if (!wrap) return;

    wrap.querySelectorAll("[data-edit-order]").forEach(button => {
        button.addEventListener("click", () => {
            const order = getJournalOrders(strategyKey, journalId).find(item => item.id === button.getAttribute("data-edit-order"));
            if (order) fillOrderForm(order);
        });
    });

    wrap.querySelectorAll("[data-close-order]").forEach(button => {
        button.addEventListener("click", () => {
            const order = getJournalOrders(strategyKey, journalId).find(item => item.id === button.getAttribute("data-close-order"));
            if (!order) return;
            const strategy = ORDER_STRATEGY_MAP[strategyKey];
            const currentPrice = getStrategyPriceState(strategyKey).price;
            const defaultValue = currentPrice ? formatInputPrice(currentPrice) : "";
            const value = prompt(`Укажи точку выхода для закрытия ордера ${strategy.label}:`, defaultValue);
            if (value === null) return;
            const exitPrice = parseFloat(String(value).replace(",", "."));
            if (Number.isNaN(exitPrice) || exitPrice <= 0) {
                alert("Точка выхода должна быть больше нуля.");
                return;
            }
            order.exit = exitPrice;
            saveStrategyBooks();
            resetOrderForm();
            renderOrders();
        });
    });

    wrap.querySelectorAll("[data-delete-order]").forEach(button => {
        button.addEventListener("click", () => {
            const orderId = button.getAttribute("data-delete-order");
            const journal = findJournal(strategyKey, journalId);
            if (!journal) return;
            journal.orders = journal.orders.filter(order => order.id !== orderId);
            if (editingOrderId === orderId) resetOrderForm();
            saveStrategyBooks();
            renderOrders();
        });
    });

    wrap.querySelectorAll("[data-order-id]").forEach(row => {
        row.addEventListener("dragstart", handleRowDragStart);
        row.addEventListener("dragover", handleRowDragOver);
        row.addEventListener("dragleave", handleRowDragLeave);
        row.addEventListener("drop", handleRowDrop);
        row.addEventListener("dragend", handleRowDragEnd);
    });
}

function renderOrdersTable(strategyKey, journalId) {
    const wrap = document.getElementById("ordersTableWrap");
    const strategy = ORDER_STRATEGY_MAP[strategyKey];
    const journal = findJournal(strategyKey, journalId);
    const orders = journal?.orders || [];
    if (!wrap) return;

    if (!journal) {
        wrap.innerHTML = `<div class="risk-empty-state">Для ${strategy.label} пока не найден активный журнал.</div>`;
        return;
    }

    if (!orders.length) {
        wrap.innerHTML = `<div class="risk-empty-state">Пока нет записанных ордеров ${strategy.label} в ${escapeHtml(journal.name)}. Добавь первый ордер или создай еще один журнал.</div>`;
        return;
    }

    let html = `
        <table>
            <thead>
                <tr>
                    <th></th>
                    <th>#</th>
                    <th>Статус</th>
                    <th>Направление</th>
                    <th>Вход</th>
                    <th>Выход / текущая</th>
                    <th>Плечо</th>
                    <th>Маржа</th>
                    <th>Номинал</th>
                    <th>PnL</th>
                    <th>ROI</th>
                    <th>Комментарий</th>
                    <th>Действия</th>
                </tr>
            </thead>
            <tbody>
    `;

    orders.forEach((order, index) => {
        const calc = calcOrderPnl(order, strategyKey);
        const isClosed = isClosedOrder(order);
        const statusText = isClosed ? "Закрыт" : "Открыт";
        const priceText = calc ? `${formatDisplayPrice(calc.price)} $` : "-";
        const pnlText = calc ? formatMoney(calc.pnl) : "-";
        const roiText = calc ? formatPercent(calc.roi) : "-";
        const pnlClass = calc ? getToneClass(calc.pnl) : "";
        html += `
            <tr class="risk-draggable-row" data-order-id="${order.id}" draggable="true">
                <td class="risk-drag-cell" title="Перетащи строку для смены порядка">⋮⋮</td>
                <td>${index + 1}</td>
                <td>${statusText}</td>
                <td class="${order.side === "long" ? "safe" : "danger"}">${order.side.toUpperCase()}</td>
                <td>${formatDisplayPrice(order.entry)}</td>
                <td>${priceText}</td>
                <td>${order.leverage.toFixed(2)}x</td>
                <td>${order.deposit.toFixed(2)} $</td>
                <td>${(order.deposit * order.leverage).toFixed(2)} $</td>
                <td class="${pnlClass}">${pnlText}</td>
                <td class="${pnlClass}">${roiText}</td>
                <td>${order.note ? escapeHtml(order.note) : "-"}</td>
                <td class="risk-actions-cell">
                    <button type="button" class="risk-small-btn" data-edit-order="${order.id}">Изменить</button>
                    ${isClosed ? "" : `<button type="button" class="risk-ghost-btn risk-small-btn" data-close-order="${order.id}">Поставить выход</button>`}
                    <button type="button" class="risk-danger-btn risk-small-btn" data-delete-order="${order.id}">✕</button>
                </td>
            </tr>
        `;
    });

    html += "</tbody></table>";
    wrap.innerHTML = html;
    attachOrderTableListeners(strategyKey, journalId);
}

function renderOrders() {
    const summaries = getAllStrategySummaries();
    const activeJournal = getActiveJournal();
    const activeJournalSummary = summarizeJournal(activeOrderStrategyKey, activeJournal);
    updateOrderUiText();
    renderStrategyTabs();
    renderJournalTabs();
    renderOrdersDashboard(summaries);
    renderActiveJournalSummary(activeJournalSummary);
    renderOrdersTable(activeOrderStrategyKey, activeJournal?.id);
}

async function fetchAllStrategyPrices(forceRender = true) {
    if (strategyPriceRequestInFlight) return;
    strategyPriceRequestInFlight = true;
    try {
        await Promise.all(ORDER_STRATEGIES.map(async strategy => {
            try {
                const data = await fetchRiskBinanceJson(`${TICKER_API_PATH}${strategy.symbol}`, { method: "GET" });
                const price = parseFloat(data.price);
                if (!Number.isFinite(price) || price <= 0) throw new Error("Invalid price");
                strategyPrices[strategy.key] = { price, updatedAt: new Date(), hasError: false };
            } catch (error) {
                strategyPrices[strategy.key] = {
                    ...strategyPrices[strategy.key],
                    hasError: true
                };
                console.error(`Ошибка загрузки курса ${strategy.label}:`, error);
            }
        }));
    } finally {
        strategyPriceRequestInFlight = false;
        if (forceRender) renderOrders();
    }
}

function startStrategyAutoRefresh() {
    if (strategyPriceIntervalId) clearInterval(strategyPriceIntervalId);
    fetchAllStrategyPrices(true);
    strategyPriceIntervalId = setInterval(() => fetchAllStrategyPrices(true), 5000);
}

function addOrder() {
    const sideEl = document.getElementById("orderSide");
    const entryEl = document.getElementById("orderEntry");
    const exitEl = document.getElementById("orderExit");
    const levEl = document.getElementById("orderLeverage");
    const depositEl = document.getElementById("orderDeposit");
    const noteEl = document.getElementById("orderNote");
    if (!sideEl || !entryEl || !levEl || !depositEl || !noteEl) return;

    const orderData = {
        side: sideEl.value,
        entry: parseFloat(String(entryEl.value).replace(",", ".")),
        exit: exitEl && exitEl.value !== "" ? parseFloat(String(exitEl.value).replace(",", ".")) : null,
        leverage: parseFloat(String(levEl.value).replace(",", ".")),
        deposit: parseFloat(String(depositEl.value).replace(",", ".")),
        note: noteEl.value.trim()
    };

    if (!Number.isFinite(orderData.entry) || orderData.entry <= 0 || !Number.isFinite(orderData.leverage) || orderData.leverage <= 0 || !Number.isFinite(orderData.deposit) || orderData.deposit <= 0 || (orderData.exit !== null && (!Number.isFinite(orderData.exit) || orderData.exit <= 0))) {
        alert("Проверь поля ордера: вход, плечо и депозит должны быть больше нуля.");
        return;
    }

    const activeJournal = getActiveJournal();
    if (!activeJournal) return;
    const currentOrders = [...activeJournal.orders];
    if (editingOrderId) {
        activeJournal.orders = currentOrders.map(order => order.id === editingOrderId ? { ...order, ...orderData } : order);
    } else {
        activeJournal.orders = [{ id: generateOrderId(), ...orderData }, ...currentOrders];
    }
    saveStrategyBooks();
    resetOrderForm();
    renderOrders();
}

function addJournal() {
    const strategyKey = activeOrderStrategyKey;
    const journals = getStrategyJournals(strategyKey);
    const newJournal = buildDefaultJournal(strategyKey, journals.length + 1, []);
    strategyBooks[strategyKey] = [...journals, newJournal];
    activeJournalIds[strategyKey] = newJournal.id;
    ensureDraftBucket(strategyKey)[newJournal.id] = buildDefaultOrderDraft(strategyKey);
    saveStrategyBooks();
    saveOrderDrafts();
    saveActiveJournalIds();
    editingOrderId = null;
    applyDraftToOrderForm(strategyKey, newJournal.id);
    renderOrders();
}

function deleteActiveJournal() {
    const strategyKey = activeOrderStrategyKey;
    const journals = getStrategyJournals(strategyKey);
    const activeJournalId = getActiveJournalId(strategyKey);
    const activeJournalIndex = journals.findIndex(journal => journal.id === activeJournalId);
    const activeJournal = activeJournalIndex >= 0 ? journals[activeJournalIndex] : null;
    const strategy = getActiveStrategy();

    if (!activeJournal) return;
    if (journals.length <= 1) {
        alert(`Нельзя удалить последний журнал ${strategy.label}. Сначала создай еще один журнал, если хочешь перераспределить ордера.`);
        return;
    }
    if (!confirm(`Удалить ${activeJournal.name} по ${strategy.label}? Все ордера внутри этого журнала будут удалены.`)) return;

    const nextJournals = journals.filter(journal => journal.id !== activeJournal.id);
    strategyBooks[strategyKey] = nextJournals;

    if (orderDrafts[strategyKey] && orderDrafts[strategyKey][activeJournal.id]) {
        delete orderDrafts[strategyKey][activeJournal.id];
    }

    const nextActiveJournal = nextJournals[Math.max(0, activeJournalIndex - 1)] || nextJournals[0];
    activeJournalIds[strategyKey] = nextActiveJournal.id;
    editingOrderId = null;

    saveStrategyBooks();
    saveOrderDrafts();
    saveActiveJournalIds();
    applyDraftToOrderForm(strategyKey, nextActiveJournal.id);
    renderOrders();
}

function setupOrdersTab() {
    const addBtn = document.getElementById("addOrderBtn");
    const clearBtn = document.getElementById("clearOrdersBtn");
    const cancelBtn = document.getElementById("cancelEditOrderBtn");
    const addJournalBtn = document.getElementById("addJournalBtn");
    const deleteJournalBtn = document.getElementById("deleteJournalBtn");

    if (addBtn) addBtn.addEventListener("click", addOrder);
    if (cancelBtn) cancelBtn.addEventListener("click", resetOrderForm);
    if (addJournalBtn) addJournalBtn.addEventListener("click", addJournal);
    if (deleteJournalBtn) deleteJournalBtn.addEventListener("click", deleteActiveJournal);
    setupOrdersDashboardToggle();
    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            const strategy = getActiveStrategy();
            const activeJournal = getActiveJournal();
            if (!activeJournal) return;
            if (!confirm(`Очистить ${activeJournal.name} по ${strategy.label}?`)) return;
            activeJournal.orders = [];
            saveStrategyBooks();
            resetOrderForm();
            renderOrders();
        });
    }

    ["orderSide", "orderEntry", "orderExit", "orderLeverage", "orderDeposit", "orderNote"].forEach(id => {
        const element = document.getElementById(id);
        if (!element) return;
        element.addEventListener("input", saveActiveOrderDraft);
        element.addEventListener("change", saveActiveOrderDraft);
    });

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) fetchAllStrategyPrices(true);
    });
    window.addEventListener("focus", () => fetchAllStrategyPrices(true));

    const activeJournal = getActiveJournal();
    if (activeJournal) applyDraftToOrderForm(activeOrderStrategyKey, activeJournal.id);
    renderOrders();
    startStrategyAutoRefresh();
}

document.addEventListener("app:tab-changed", (event) => {
  const activeTab = event.detail?.tabId;
  if (activeTab === "risk") {
    calculate();
    calcLadder();
    renderOrders();
  }
});

initRiskTabs();
calculate();
calcLadder();
setupOrdersTab();
})();
