const colors = {
  AMD: "#009E73",
  INTEL: "#0072B2",
  NVIDIA: "#D55E00"
};

const NVIDIA_SPLITS = [
  new Date("2002-07-31"),
  new Date("2004-08-06"),
  new Date("2008-07-03")
];

let selectedPair = ["AMD", "NVIDIA"];   // Panel 4 (scatter) pair
let currentDomain = null;
const MODEL_START_DATE = new Date("2016-01-01");

function pearsonCorr(xs, ys) {
  const n = xs.length;
  const meanX = d3.mean(xs), meanY = d3.mean(ys);
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  return num / Math.sqrt(denX * denY);
}

function linearFit(xs, ys) {
  const meanX = d3.mean(xs), meanY = d3.mean(ys);
  let num = 0, den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) * (xs[i] - meanX);
  }
  const slope = num / den;
  const intercept = meanY - slope * meanX;
  return { slope, intercept };
}

function rSquared(actuals, fits) {
  const meanA = d3.mean(actuals);
  const ssTot = d3.sum(actuals, a => (a - meanA) ** 2);
  const ssRes = d3.sum(actuals.map((a, i) => (a - fits[i]) ** 2));
  return (ssTot === 0) ? NaN : (1 - ssRes / ssTot);
}

const margin = { top: 26, right: 20, bottom: 46, left: 60 };
const width = 900;
const height = 250;
const parseDate = d3.isoParse;

function addLegend(svg, tickers, xPos, yPos) {
  const legend = svg.append("g")
    .attr("transform", `translate(${xPos}, ${yPos})`);

  tickers.forEach((t, i) => {
    const row = legend.append("g")
      .attr("transform", `translate(0, ${i * 18})`);

    row.append("rect")
      .attr("width", 10)
      .attr("height", 10)
      .attr("fill", colors[t] || "#444");

    row.append("text")
      .attr("x", 16)
      .attr("y", 9)
      .attr("font-size", 11)
      .text(t);
  });
}

Promise.all([d3.csv("data.csv"), d3.csv("data_model.csv")]).then(([raw, rawModel]) => {

  // =========================
  // DATA (Panel 1/2 + Scatter)
  // date,ticker,close,adj_close,volume
  // =========================
  const data = raw.map(d => ({
    date: parseDate(d.date),
    ticker: d.ticker,
    close: +d.close,
    adj: +d.adj_close,
    volume: +d.volume
  })).filter(d =>
    d.date instanceof Date &&
    !isNaN(d.date) &&
    d.ticker &&
    !isNaN(d.close) &&
    !isNaN(d.adj) // keep adj for detail/scatter
  );

  const nvidiaData = data
    .filter(d => d.ticker === "NVIDIA")
    .sort((a, b) => a.date - b.date);

  // ---------- X scale (full data range) ----------
// NVIDIA-specific time domain
const x = d3.scaleTime()
  .domain(d3.extent(nvidiaData, d => d.date))
  .range([margin.left, width - margin.right]);


  currentDomain = x.domain();

  // =========================
  // 1) OVERVIEW PANEL — NVIDIA CLOSE + VOLUME + SPLITS + BRUSH
  // =========================
  const overview = d3.select("#overview")
    .attr("viewBox", `0 0 ${width} ${height}`);

  overview.append("text")
    .attr("x", width / 2)
    .attr("y", 16)
    .attr("text-anchor", "middle")
    .attr("font-size", 12)
    .attr("font-weight", "600")
    .text("NVIDIA Close Price & Volume");

  // Price scale (left) — RAW CLOSE
  const yPrice = d3.scaleLinear()
    .domain(d3.extent(nvidiaData, d => d.close))
    .nice()
    .range([height - margin.bottom, margin.top]);

  // Volume scale (right)
  const hasVolume = nvidiaData.some(d => !isNaN(d.volume));
  const yVolume = d3.scaleLinear()
    .domain(hasVolume ? d3.extent(nvidiaData.filter(d => !isNaN(d.volume)), d => d.volume) : [0, 1])
    .nice()
    .range([height - margin.bottom, height / 2]);

  overview.append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x));

  overview.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(yPrice));

overview.append("g")
  .attr("transform", `translate(${width - margin.right},0)`)
  .call(
    d3.axisRight(yVolume)
      .ticks(3) // fewer labels = less clutter
      .tickFormat(d3.format(".2s")) // 200M, 1B, etc.
  );


  // Axis labels
  overview.append("text")
    .attr("x", width / 2)
    .attr("y", height - 8)
    .attr("text-anchor", "middle")
    .attr("font-size", 11)
    .text("Year");

  overview.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", 15)
    .attr("text-anchor", "middle")
    .attr("font-size", 11)
    .text("Close Price (USD)");

  overview.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", width + 24)
    .attr("text-anchor", "middle")
    .attr("font-size", 11)
    .text("Volume");


  // Volume bars
  if (hasVolume) {
    const barW = Math.max(
      1,
      (x(nvidiaData[Math.min(1, nvidiaData.length - 1)].date) - x(nvidiaData[0].date)) * 0.9
    );

    overview.append("g")
      .selectAll("rect")
      .data(nvidiaData.filter(d => !isNaN(d.volume)))
      .enter()
      .append("rect")
      .attr("x", d => x(d.date) - barW / 2)
      .attr("y", d => yVolume(d.volume))
      .attr("width", barW)
      .attr("height", d => height - margin.bottom - yVolume(d.volume))
      .attr("fill", "#bbb")
      .attr("opacity", 0.55);
  }

    // Price line
  overview.append("path")
    .datum(nvidiaData)
    .attr("fill", "none")
    .attr("stroke", colors.NVIDIA)
    .attr("stroke-width", 2)
    .attr("d", d3.line()
      .x(d => x(d.date))
      .y(d => yPrice(d.close))
    );

  // Split lines (blue dashed)
  NVIDIA_SPLITS.forEach(sd => {
    const [xmin, xmax] = x.domain();
    if (sd >= xmin && sd <= xmax) {
      overview.append("line")
        .attr("x1", x(sd))
        .attr("x2", x(sd))
        .attr("y1", margin.top)
        .attr("y2", height - margin.bottom)
        .attr("stroke", "blue")
        .attr("stroke-dasharray", "4,4")
        .attr("stroke-width", 1.5)
        .attr("opacity", 0.7);
    }
  });

  // =========================
  // 2) DETAIL PANEL — NVIDIA ONLY (Adjusted Close)
  // =========================
 const detail = d3.select("#detail")
  .attr("viewBox", `0 0 ${width} ${height}`);

function updateDetail([x0, x1]) {
  detail.selectAll("*").remove();

  detail.append("text")
    .attr("x", width / 2)
    .attr("y", 16)
    .attr("text-anchor", "middle")
    .attr("font-size", 12)
    .attr("font-weight", "600")
    .text("NVIDIA Detailed View");

  const xDetail = x.copy().domain([x0, x1]);
  const filteredNvda = nvidiaData.filter(d => d.date >= x0 && d.date <= x1);

  if (filteredNvda.length === 0) {
    detail.append("text")
      .attr("x", margin.left)
      .attr("y", margin.top + 30)
      .attr("font-size", 12)
      .text("No NVIDIA data in this selected range.");
    return;
  }

  // --- Scales ---
  const yPrice = d3.scaleLinear()
    .domain(d3.extent(filteredNvda, d => d.close))
    .nice()
    .range([height - margin.bottom, margin.top]);

  const hasVolume = filteredNvda.some(d => !isNaN(d.volume));
  const yVol = d3.scaleLinear()
    .domain(
      hasVolume
        ? d3.extent(filteredNvda.filter(d => !isNaN(d.volume)), d => d.volume)
        : [0, 1]
    )
    .nice()
    .range([height - margin.bottom, height / 2]);

  const linePrice = d3.line()
    .x(d => xDetail(d.date))
    .y(d => yPrice(d.close));

  // --- Axes ---
  detail.append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(xDetail));

  detail.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(yPrice));

  detail.append("g")
    .attr("transform", `translate(${width - margin.right},0)`)
    .call(
       d3.axisRight(yVol)
      .ticks(2)
      .tickFormat(d3.format(".2s"))
      .tickPadding(8)   // <-- key fix
  );


  // --- Axis labels ---
  detail.append("text")
    .attr("x", width / 2)
    .attr("y", height - 8)
    .attr("text-anchor", "middle")
    .attr("font-size", 11)
    .text("Year");

  detail.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", 15)
    .attr("text-anchor", "middle")
    .attr("font-size", 11)
    .text("Close Price (USD)");

  detail.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", width + 32)
    .attr("text-anchor", "middle")
    .attr("font-size", 11)
    .text("Volume");

  // --- Volume bars (draw first so price line is on top) ---
  if (hasVolume) {
    const barW = Math.max(
      1,
      (xDetail(filteredNvda[Math.min(1, filteredNvda.length - 1)].date) - xDetail(filteredNvda[0].date)) * 0.9
    );

    detail.append("g")
      .selectAll("rect")
      .data(filteredNvda.filter(d => !isNaN(d.volume)))
      .enter()
      .append("rect")
      .attr("x", d => xDetail(d.date) - barW / 2)
      .attr("y", d => yVol(d.volume))
      .attr("width", barW)
      .attr("height", d => height - margin.bottom - yVol(d.volume))
      .attr("fill", "#bbb")
      .attr("opacity", 0.9);
  }

  // --- Split markers (blue dashed) ---
  NVIDIA_SPLITS.forEach(sd => {
    const [d0, d1] = xDetail.domain();
    if (sd >= d0 && sd <= d1) {
      detail.append("line")
        .attr("x1", xDetail(sd))
        .attr("x2", xDetail(sd))
        .attr("y1", margin.top)
        .attr("y2", height - margin.bottom)
        .attr("stroke", "blue")
        .attr("stroke-dasharray", "4,4")
        .attr("stroke-width", 1.5)
        .attr("opacity", 0.35);
    }
  });

  // --- Close price line ---
  detail.append("path")
    .datum(filteredNvda)
    .attr("fill", "none")
    .attr("stroke", colors.NVIDIA)
    .attr("stroke-width", 2)
    .attr("opacity", 0.95)
    .attr("d", linePrice);

 // addLegend(detail, ["NVIDIA"], width - 150, margin.top + 8);
}

  // =========================
  // 3) MODEL PANEL
  // =========================
  const modelData = rawModel.map(d => ({
    date: parseDate(d.date),
    ticker: d.ticker,
    actual: +d.actual_price,
    fitted: +d.fitted_price
  })).filter(d =>
    d.date instanceof Date && !isNaN(d.date) &&
    !isNaN(d.actual) && !isNaN(d.fitted)
  );

  // =========================
// Fixed domains (no brushing)
// =========================

// Panel 3: fixed to AI era (2016 → latest model date)
const modelMaxDate = d3.max(modelData, d => d.date);
const modelDomainFixed = [MODEL_START_DATE, modelMaxDate];

// Panel 4: fixed to full dataset range
const scatterDomainFixed = x.domain();


  const modelW = width;
  const modelH = 360;

  const modelSvg = d3.select("#modelPlot")
    .attr("viewBox", `0 0 ${modelW} ${modelH}`);

  function updateModelPlot(domain, selectedTickers) {
    modelSvg.selectAll("*").remove();

    const x0 = d3.max([domain[0], MODEL_START_DATE]);
    const x1 = domain[1];

    const filtered = modelData
      .filter(d => d.date >= x0 && d.date <= x1)
      .filter(d => selectedTickers.includes(d.ticker));

    if (filtered.length === 0) {
      modelSvg.append("text")
        .attr("x", margin.left)
        .attr("y", margin.top + 20)
        .text("No data to display. Check selection or date range.");
      return;
    }

    const xM = d3.scaleTime()
      .domain([x0, x1])
      .range([margin.left, modelW - margin.right]);

    const yExtent = d3.extent(filtered.flatMap(d => [d.actual, d.fitted]));
    const yM = d3.scaleLinear()
      .domain(yExtent).nice()
      .range([modelH - margin.bottom, margin.top]);

    modelSvg.append("text")
      .attr("x", modelW / 2)
      .attr("y", 16)
      .attr("text-anchor", "middle")
      .attr("font-size", 12)
      .attr("font-weight", "600")
      .text("Stock Price Regression: Actual Prices vs. Model Fits");

    modelSvg.append("g")
      .attr("transform", `translate(0,${modelH - margin.bottom})`)
      .call(d3.axisBottom(xM));

    modelSvg.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(yM));

    modelSvg.append("text")
      .attr("x", modelW / 2)
      .attr("y", modelH - 8)
      .attr("text-anchor", "middle")
      .attr("font-size", 11)
      .text("Year");

    modelSvg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -modelH / 2)
      .attr("y", 15)
      .attr("text-anchor", "middle")
      .attr("font-size", 11)
      .text("Close Price (USD)");

    const byT = d3.group(filtered, d => d.ticker);

    // R^2 box
    const r2ByTicker = new Map();
    for (const [tkr, series] of byT.entries()) {
      const s = series.slice().sort((a, b) => a.date - b.date);
      const actuals = s.map(d => d.actual);
      const fits = s.map(d => d.fitted);
      r2ByTicker.set(tkr, rSquared(actuals, fits));
    }

    const r2Lines = selectedTickers.map(t => {
      const v = r2ByTicker.get(t);
      const txt = (v == null || isNaN(v)) ? "R²: n/a" : `R² = ${v.toFixed(3)}`;
      return `${t}: ${txt}`;
    });

    const boxX = margin.left + 15;
    const boxY = margin.top + 32;
    const boxW = 140;
    const boxH = 16 * r2Lines.length + 6;

    modelSvg.append("rect")
      .attr("x", boxX - 5)
      .attr("y", boxY - 14)
      .attr("width", boxW)
      .attr("height", boxH)
      .attr("fill", "white")
      .attr("opacity", 0.95)
      .attr("stroke", "#ddd");

    modelSvg.append("g")
      .selectAll("text.r2line")
      .data(r2Lines)
      .enter()
      .append("text")
      .attr("class", "r2line")
      .attr("x", boxX)
      .attr("y", (d, i) => boxY + i * 16)
      .attr("font-size", 12)
      .attr("fill", "#111")
      .text(d => d);

    const lineActual = d3.line()
      .x(d => xM(d.date))
      .y(d => yM(d.actual));

    const lineFitted = d3.line()
      .x(d => xM(d.date))
      .y(d => yM(d.fitted));

    for (const [tkr, series] of byT.entries()) {
      const s = series.slice().sort((a, b) => a.date - b.date);

      modelSvg.append("path")
        .datum(s)
        .attr("fill", "none")
        .attr("stroke", colors[tkr] || "#444")
        .attr("stroke-width", 1.2)
        .attr("opacity", 0.35)
        .attr("d", lineActual);

      modelSvg.append("path")
        .datum(s)
        .attr("fill", "none")
        .attr("stroke", colors[tkr] || "#444")
        .attr("stroke-width", 2.4)
        .attr("opacity", 0.95)
        .attr("d", lineFitted);
    }

    addLegend(modelSvg, selectedTickers, modelW - 150, margin.top + 8);
  }

  // Panel 3 controls
  const mAmd = document.getElementById("m-amd");
  const mIntel = document.getElementById("m-intel");
  const mNvidia = document.getElementById("m-nvidia");
  const mRefresh = document.getElementById("m-refresh");
  const mWarn = document.getElementById("m-warning");

  function getModelChecked() {
    const out = [];
    if (mAmd?.checked) out.push("AMD");
    if (mIntel?.checked) out.push("INTEL");
    if (mNvidia?.checked) out.push("NVIDIA");
    return out;
  }

  mRefresh?.addEventListener("click", () => {
    const sel = getModelChecked();
    if (sel.length === 0) {
      mWarn.textContent = "Select at least one stock.";
      return;
    }
    mWarn.textContent = "";
    updateModelPlot(modelDomainFixed, sel);
  });

  // =========================
  // 4) SCATTER PANEL (uses ADJ prices)
  // =========================
  const scatterW = width;
  const scatterH = 320;

  const scatterSvg = d3.select("#scatter")
    .attr("viewBox", `0 0 ${scatterW} ${scatterH}`);

  function updateScatter([x0, x1], pair) {
    scatterSvg.selectAll("*").remove();

    const [xTicker, yTicker] = pair;
    const filtered = data.filter(d => d.date >= x0 && d.date <= x1);

    const byDate = d3.rollup(
      filtered,
      v => ({
        xVal: v.find(d => d.ticker === xTicker)?.adj,
        yVal: v.find(d => d.ticker === yTicker)?.adj
      }),
      d => +d.date
    );

    const points = [];
    for (const v of byDate.values()) {
      if (v.xVal != null && v.yVal != null && !isNaN(v.xVal) && !isNaN(v.yVal)) {
        points.push({ xVal: v.xVal, yVal: v.yVal });
      }
    }

    if (points.length < 5) {
      scatterSvg.append("text")
        .attr("x", margin.left)
        .attr("y", margin.top + 20)
        .text("Not enough data in selection for scatter plot.");
      return;
    }

    const xs = points.map(d => d.xVal);
    const ys = points.map(d => d.yVal);

    const corr = pearsonCorr(xs, ys);
    const fit = linearFit(xs, ys);

    const xScale = d3.scaleLinear()
      .domain(d3.extent(xs)).nice()
      .range([margin.left, scatterW - margin.right]);

    const yScale = d3.scaleLinear()
      .domain(d3.extent(ys)).nice()
      .range([scatterH - margin.bottom, margin.top]);

    scatterSvg.append("g")
      .attr("transform", `translate(0,${scatterH - margin.bottom})`)
      .call(d3.axisBottom(xScale));

    scatterSvg.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(yScale));

    scatterSvg.append("g")
      .selectAll("circle")
      .data(points)
      .enter()
      .append("circle")
      .attr("cx", d => xScale(d.xVal))
      .attr("cy", d => yScale(d.yVal))
      .attr("r", 3)
      .attr("fill", "#0072B2")
      .attr("opacity", 0.6);

    const xMin = d3.min(xs);
    const xMax = d3.max(xs);
    const yMin = fit.slope * xMin + fit.intercept;
    const yMax = fit.slope * xMax + fit.intercept;

    scatterSvg.append("line")
      .attr("x1", xScale(xMin))
      .attr("y1", yScale(yMin))
      .attr("x2", xScale(xMax))
      .attr("y2", yScale(yMax))
      .attr("stroke", "#D55E00")
      .attr("stroke-width", 3);

    scatterSvg.append("text")
      .attr("x", scatterW / 2)
      .attr("y", scatterH - 8)
      .attr("text-anchor", "middle")
      .attr("font-size", 11)
      .text(`${xTicker} Adjusted Close (USD)`);

    scatterSvg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -scatterH / 2)
      .attr("y", 15)
      .attr("text-anchor", "middle")
      .attr("font-size", 11)
      .text(`${yTicker} Adjusted Close (USD)`);

    const label = `Correlation = ${corr.toFixed(3)}`;
    scatterSvg.append("rect")
      .attr("x", margin.left + 6)
      .attr("y", margin.top + 2)
      .attr("width", 200)
      .attr("height", 22)
      .attr("fill", "white")
      .attr("opacity", 0.85);

    scatterSvg.append("text")
      .attr("x", margin.left + 12)
      .attr("y", margin.top + 18)
      .attr("font-size", 16)
      .attr("fill", "black")
      .text(label);
  }

  // =========================
  // Brush handler (links Panel 2, 3, 4)
  // =========================
function brushed(event) {
  if (!event.selection) return;
  currentDomain = event.selection.map(x.invert);

  // Brush affects ONLY Panel 2
  updateDetail(currentDomain);
}

  const brush = d3.brushX()
    .extent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]])
    .on("brush end", brushed);

  overview.append("g").call(brush);

  // =========================
  // Panel 4 controls (exactly 2 stocks)
  // =========================
  const cbAmd = document.getElementById("cb-amd");
  const cbIntel = document.getElementById("cb-intel");
  const cbNvidia = document.getElementById("cb-nvidia");
  const btnRefresh = document.getElementById("btn-refresh");
  const warn = document.getElementById("pair-warning");

  function getCheckedPair() {
    const checked = [];
    if (cbAmd.checked) checked.push("AMD");
    if (cbIntel.checked) checked.push("INTEL");
    if (cbNvidia.checked) checked.push("NVIDIA");
    return checked;
  }

  function enforceTwo(e) {
    const checked = getCheckedPair();
    if (checked.length > 2) e.target.checked = false;

    const now = getCheckedPair();
    warn.textContent = (now.length === 2) ? "" : "Please select exactly 2 stocks.";
    if (now.length === 2) selectedPair = now;
  }

  cbAmd.addEventListener("change", enforceTwo);
  cbIntel.addEventListener("change", enforceTwo);
  cbNvidia.addEventListener("change", enforceTwo);

  btnRefresh.addEventListener("click", () => {
    const now = getCheckedPair();
    if (now.length !== 2) {
      warn.textContent = "Please select exactly 2 stocks.";
      return;
    }
    warn.textContent = "";
    selectedPair = now;
    updateScatter(scatterDomainFixed, selectedPair);
  });

  // =========================
  // Initialize
  // =========================
  updateDetail(x.domain());
  updateModelPlot(modelDomainFixed, getModelChecked());
  updateScatter(scatterDomainFixed, selectedPair);
});
