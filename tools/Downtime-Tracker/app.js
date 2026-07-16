const input = document.getElementById('dataInput');
const drawButton = document.getElementById('drawButton');
const clearButton = document.getElementById('clearButton');
const message = document.getElementById('message');
const summary = document.getElementById('summary');
const chart = document.getElementById('paretoChart');
const resultsTable = document.querySelector('#resultsTable tbody');

const sampleData = [
  '45 Machine jam',
  '30 Power outage',
  '20 Material shortage',
  '15 Machine jam',
  '10 Setup delay',
  '5 Material shortage',
  '8 Quality check',
  '12 Power outage'
].join('\n');

function normalizeText(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function parseLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const commaSplit = trimmed.split(',');
  let amountText = null;
  let reasonText = null;

  if (commaSplit.length === 2) {
    const [part1, part2] = commaSplit.map(s => s.trim());
    if (/^-?\d+(\.\d+)?$/.test(part1)) {
      amountText = part1;
      reasonText = part2;
    } else if (/^-?\d+(\.\d+)?$/.test(part2)) {
      amountText = part2;
      reasonText = part1;
    } else {
      reasonText = `${part1} ${part2}`;
    }
  }

  if (!amountText) {
    const colonMatch = trimmed.match(/^(.+?):\s*(\d+(?:\.\d+)?)$/);
    if (colonMatch) {
      reasonText = colonMatch[1].trim();
      amountText = colonMatch[2];
    }
  }

  if (!amountText) {
    const tokens = trimmed.split(/\s+/);
    if (tokens.length > 1) {
      const first = tokens[0];
      const last = tokens[tokens.length - 1];
      if (/^-?\d+(\.\d+)?$/.test(first)) {
        amountText = first;
        reasonText = tokens.slice(1).join(' ');
      } else if (/^-?\d+(\.\d+)?$/.test(last)) {
        amountText = last;
        reasonText = tokens.slice(0, -1).join(' ');
      }
    }
  }

  if (!amountText) {
    return { error: 'Unable to parse duration', line };
  }

  const amount = parseFloat(amountText);
  if (Number.isNaN(amount) || amount < 0) {
    return { error: 'Invalid duration', line };
  }

  reasonText = reasonText ? normalizeText(reasonText) : 'Unknown reason';
  if (!reasonText) {
    reasonText = 'Unknown reason';
  }

  return { minutes: amount, reason: reasonText };
}

function parseInput(text) {
  const lines = text.split(/\r?\n/);
  const entries = [];
  const invalid = [];

  lines.forEach(line => {
    const cleaned = line.trim();
    if (!cleaned) return;
    const parsed = parseLine(cleaned);
    if (!parsed) return;
    if (parsed.error) {
      invalid.push({ line: cleaned, reason: parsed.error });
    } else {
      entries.push(parsed);
    }
  });

  return { entries, invalid };
}

function aggregate(entries) {
  const totals = new Map();
  entries.forEach(({ reason, minutes }) => {
    const key = normalizeText(reason);
    totals.set(key, (totals.get(key) || 0) + minutes);
  });

  const data = Array.from(totals.entries())
    .map(([reason, minutes]) => ({ reason, minutes }))
    .sort((a, b) => b.minutes - a.minutes);

  const totalMinutes = data.reduce((sum, item) => sum + item.minutes, 0);
  let cumulative = 0;

  return data.map(item => {
    cumulative += item.minutes;
    return {
      ...item,
      percent: totalMinutes > 0 ? (item.minutes / totalMinutes) * 100 : 0,
      cumulativePercent: totalMinutes > 0 ? (cumulative / totalMinutes) * 100 : 0
    };
  });
}

function formatNumber(value, decimals = 1) {
  return value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function renderSummary(data) {
  const totalMinutes = data.reduce((sum, item) => sum + item.minutes, 0);
  const distinctReasons = data.length;
  const topReason = data[0];

  summary.innerHTML = '';
  const cards = [
    { title: 'Total Minutes', value: formatNumber(totalMinutes, 0) },
    { title: 'Distinct Reasons', value: distinctReasons },
    { title: 'Top Reason', value: topReason ? `${topReason.reason} (${formatNumber(topReason.minutes, 0)}m)` : '—' }
  ];

  cards.forEach(card => {
    const wrapper = document.createElement('div');
    wrapper.className = 'card';
    wrapper.innerHTML = `<h3>${card.title}</h3><p>${card.value}</p>`;
    summary.appendChild(wrapper);
  });
}

function renderTable(data) {
  resultsTable.innerHTML = '';
  data.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.reason}</td>
      <td>${formatNumber(row.minutes, 0)}</td>
      <td class="percent">${formatNumber(row.percent, 1)}%</td>
      <td class="cumulative">${formatNumber(row.cumulativePercent, 1)}%</td>
    `;
    resultsTable.appendChild(tr);
  });
}

function renderChart(data) {
  const width = 800;
  const height = 420;
  const margin = { top: 36, right: 76, bottom: 90, left: 110 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const maxMinutes = Math.max(...data.map(item => item.minutes), 0);
  const yMax = Math.max(maxMinutes, 1);
  const barSpacing = 14;
  const barWidth = Math.max(30, (chartWidth - (data.length - 1) * barSpacing) / data.length);
  const cumulativePoints = data.map((row, index) => {
    const x = margin.left + index * (barWidth + barSpacing) + barWidth / 2;
    const y = margin.top + chartHeight - (chartHeight * row.cumulativePercent) / 100;
    return { x, y };
  });

  const lines = [];
  lines.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff" />`);
  lines.push(`<g stroke="#cbd5e1" stroke-width="1">`);
  for (let i = 0; i <= 5; i += 1) {
    const y = margin.top + (chartHeight * i) / 5;
    const value = formatNumber(yMax - (yMax * i) / 5, 0);
    lines.push(`<line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" />`);
    lines.push(`<text x="${margin.left - 10}" y="${y + 4}" text-anchor="end" fill="#475569" font-size="12">${value}</text>`);
  }
  lines.push(`</g>`);
  lines.push(`<text x="${margin.left}" y="${margin.top - 10}" fill="#111827" font-size="14" font-weight="700">Minutes by Reason</text>`);
  lines.push(`<text x="${width - margin.right}" y="${margin.top - 10}" text-anchor="end" fill="#111827" font-size="14" font-weight="700">Cumulative %</text>`);
  lines.push(`<g fill="#2563eb" stroke="none">`);

  data.forEach((row, index) => {
    const x = margin.left + index * (barWidth + barSpacing);
    const barHeight = (chartHeight * row.minutes) / yMax;
    const y = margin.top + chartHeight - barHeight;
    lines.push(`<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="8" />`);
    lines.push(`<text x="${x + barWidth / 2}" y="${y - 8}" text-anchor="middle" fill="#1f2937" font-size="12">${formatNumber(row.minutes, 0)}</text>`);
  });

  lines.push(`</g>`);

  const linePath = cumulativePoints.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ');
  lines.push(`<path d="${linePath}" fill="none" stroke="#f97316" stroke-width="3" />`);
  lines.push(`<g fill="#f97316">`);
  cumulativePoints.forEach(({ x, y }) => {
    lines.push(`<circle cx="${x}" cy="${y}" r="5" />`);
  });
  lines.push(`</g>`);

  lines.push(`<g fill="#475569" font-size="12">`);
  data.forEach((row, index) => {
    const x = margin.left + index * (barWidth + barSpacing) + barWidth / 2;
    const label = row.reason.length > 18 ? `${row.reason.slice(0, 18)}…` : row.reason;
    lines.push(`<text x="${x}" y="${height - margin.bottom + 20}" text-anchor="middle">${label}</text>`);
    lines.push(`<text x="${x}" y="${height - margin.bottom + 36}" text-anchor="middle" fill="#6b7280">${formatNumber(row.percent, 0)}%</text>`);
  });
  lines.push(`</g>`);

  lines.push(`<line x1="${margin.left}" y1="${margin.top + chartHeight}" x2="${width - margin.right}" y2="${margin.top + chartHeight}" stroke="#94a3b8" stroke-width="1" />`);
  lines.push(`<line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + chartHeight}" stroke="#94a3b8" stroke-width="1" />`);
  lines.push(`<text x="${margin.left - 10}" y="${margin.top + chartHeight + 24}" text-anchor="end" fill="#475569" font-size="12">0</text>`);
  lines.push(`<text x="${width - margin.right + 10}" y="${margin.top + 4}" fill="#475569" font-size="12" text-anchor="start">100%</text>`);

  chart.innerHTML = lines.join('');
}

function displayResults(data) {
  renderSummary(data);
  renderTable(data);
  renderChart(data);
}

function showMessage(text, isError = true) {
  message.textContent = text;
  message.style.color = isError ? '#dc2626' : '#15803d';
}

function processInput() {
  const raw = input.value.trim();
  if (!raw) {
    showMessage('Paste your downtime data before generating the Pareto chart.');
    return;
  }

  const { entries, invalid } = parseInput(raw);
  if (entries.length === 0) {
    showMessage('No valid downtime records found. Check your input formatting.');
    return;
  }

  if (invalid.length > 0) {
    const details = invalid.slice(0, 3).map(item => `"${item.line}"`).join(', ');
    showMessage(`Some lines could not be parsed: ${details}. They were skipped.`);
  } else {
    showMessage(`Loaded ${entries.length} records.`, false);
  }

  const aggregated = aggregate(entries);
  displayResults(aggregated);
}

drawButton.addEventListener('click', processInput);
clearButton.addEventListener('click', () => {
  input.value = '';
  message.textContent = '';
  summary.innerHTML = '';
  resultsTable.innerHTML = '';
  chart.innerHTML = '';
});

window.addEventListener('DOMContentLoaded', () => {
  input.value = sampleData;
  processInput();
});
