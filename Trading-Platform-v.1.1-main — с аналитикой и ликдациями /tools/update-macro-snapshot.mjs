import { writeFile } from 'node:fs/promises';

const SERIES = {
  ndx: 'NASDAQ100',
  brent: 'DCOILBRENTEU',
  cpi: 'CPIAUCSL'
};

const MAX_ROWS = {
  ndx: 260,
  brent: 260,
  cpi: 180
};

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

async function fetchFredSeries(seriesId) {
  const response = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}`, {
    headers: {
      'User-Agent': 'Trading-Platform-MacroSnapshot/1.0'
    }
  });
  if (!response.ok) {
    throw new Error(`FRED ${seriesId} HTTP ${response.status}`);
  }
  return response.text();
}

async function main() {
  const [ndxCsv, brentCsv, cpiCsv] = await Promise.all([
    fetchFredSeries(SERIES.ndx),
    fetchFredSeries(SERIES.brent),
    fetchFredSeries(SERIES.cpi)
  ]);

  const ndx = parseFredCsv(ndxCsv).slice(-MAX_ROWS.ndx);
  const brent = parseFredCsv(brentCsv).slice(-MAX_ROWS.brent);
  const cpi = parseFredCsv(cpiCsv).slice(-MAX_ROWS.cpi);

  if (!ndx.length || !brent.length || !cpi.length) {
    throw new Error('One or more FRED series are empty');
  }

  const payload = {
    updatedAt: new Date().toISOString(),
    source: 'fred',
    data: {
      ndx,
      brent,
      cpi
    }
  };

  await writeFile(new URL('../macro-snapshot.json', import.meta.url), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Updated macro-snapshot.json (${ndx.length}/${brent.length}/${cpi.length})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
