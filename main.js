const colors = {
  AMD: "#1f77b4",
  INTEL: "#2ca02c",
  NVIDIA: "#d62728"
};

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
  const data = raw.map(d => ({
    date: parseDate(d.date),
    ticker: d.ticker,
    price: +d.price
  })).filter(d => d.date instanceof Date && !isNaN(d.date) && !isNaN(d.price));

  const byTicker = d3.group(data, d => d.ticker);
  const tickers = ["AMD", "INTEL", "NVIDIA"]; // enforce order

  // Panel 1 -> Panel 2 visibility selection
  let visibleTickers = ["AMD", "INTEL", "NVIDIA"];

  // ---------- SCALES ----------
  const x = d3.scaleTime()
    .domain(d3.extent(data, d => d.date))
    .range([margin.left, width - margin.right]);

  const y = d3.scaleLinear()
    .domain(d3.extent(data, d => d.price))
    .nice()
    .range([height - margin.bottom, margin.top]);

  currentDomain = x.domain();

  const line = d3.line()
    .x(d => x(d.date))
    .y(d => y(d.price));

  // =========================
  // 1) OVERVIEW PANEL + CONTROLS (Panel 1)
  // =========================
  const overview = d3.select("#overview")
    .attr("viewBox", `0 0 ${width} ${height}`);

  // Brush (define once, used inside drawOverview)
  const brush = d3.brushX()
    .extent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]])
    .on("brush end", brushed);

  function drawOverview() {
    overview.selectAll("*").remove();

    // Title inside SVG
    overview.append("text")
      .attr("x", width / 2)
      .attr("y", 16)
      .attr("text-anchor", "middle")
      .attr("font-size", 12)
      .attr("font-weight", "600")
      .text("Stock Prices Over Time (Brush to Select Period)");

    // Axes
    overview.append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x));

    overview.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y));

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
      .text("Adjusted Close Price (USD)");

    // Lines (ONLY visibleTickers)
    visibleTickers.forEach(t => {
      overview.append("path")
        .datum(byTicker.get(t))
        .attr("fill", "none")
        .attr("stroke", colors[t] || "#444")
        .attr("stroke-width", 1.5)
        .attr("opacity", 0.7)
        .attr("d", line);
    });

    // Legend (ONLY visibleTickers)
    addLegend(overview, visibleTickers, width - 150, margin.top + 8);

    // Re-attach brush after redraw
    overview.append("g").call(brush);
  }

  // =========================
  // 2) DETAIL PANEL (linked to Panel 1 selection)
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
      .text("Detailed View (Linked to Selection)");

    const xDetail = x.copy().domain([x0, x1]);
    const filtered = data.filter(d => d.date >= x0 && d.date <= x1);

    const yDetail = d3.scaleLinear()
      .domain(d3.extent(filtered.filter(d => visibleTickers.includes(d.ticker)), d => d.price))
      .nice()
      .range([height - margin.bottom, margin.top]);

    const lineDetail = d3.line()
      .x(d => xDetail(d.date))
      .y(d => yDetail(d.price));

    // Axes
    detail.append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(xDetail));

    detail.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(yDetail));

    // Axis labels
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
      .text("Adjusted Close Price (USD)");

    // Lines (ONLY visibleTickers)
    visibleTickers.forEach(t => {
      detail.append("path")
        .datum(filtered.filter(d => d.ticker === t))
        .attr("fill", "none")
        .attr("stroke", colors[t] || "#444")
        .attr("stroke-width", 2)
        .attr("opacity", 0.9)
        .attr("d", lineDetail);
    });

    addLegend(detail, visibleTickers, width - 150, margin.top + 8);
  }

  // =========================
  // 3) MODEL PANEL (Actual vs Fitted) — Panel 3
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
      .text("Adjusted Close (Actual vs Fitted) — Selection");

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
      .text("Adjusted Close Price (USD)");

    const byT = d3.group(filtered, d => d.ticker);

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
    updateModelPlot(currentDomain, sel);
  });

  // =========================
  // 4) SCATTER PANEL (Panel 4)
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
        xVal: v.find(d => d.ticker === xTicker)?.price,
        yVal: v.find(d => d.ticker === yTicker)?.price
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
      .attr("fill", "steelblue")
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
      .attr("stroke", "red")
      .attr("stroke-width", 2);

    scatterSvg.append("text")
      .attr("x", scatterW / 2)
      .attr("y", scatterH - 8)
      .attr("text-anchor", "middle")
      .attr("font-size", 11)
      .text(`${xTicker} Price (USD)`);

    scatterSvg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -scatterH / 2)
      .attr("y", 15)
      .attr("text-anchor", "middle")
      .attr("font-size", 11)
      .text(`${yTicker} Price (USD)`);

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

    updateDetail(currentDomain);
    updateScatter(currentDomain, selectedPair);
    updateModelPlot(currentDomain, getModelChecked());
  }

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
    updateScatter(currentDomain, selectedPair);
  });

  // =========================
  // Panel 1 controls (NEW): show/hide lines + refresh -> affects Panel 2
  // =========================
  const oAmd = document.getElementById("o-amd");
  const oIntel = document.getElementById("o-intel");
  const oNvidia = document.getElementById("o-nvidia");
  const oRefresh = document.getElementById("o-refresh");
  const oWarn = document.getElementById("o-warning");

  function getOverviewChecked() {
    const out = [];
    if (oAmd?.checked) out.push("AMD");
    if (oIntel?.checked) out.push("INTEL");
    if (oNvidia?.checked) out.push("NVIDIA");
    return out;
  }

  oRefresh?.addEventListener("click", () => {
    const sel = getOverviewChecked();
    if (sel.length === 0) {
      oWarn.textContent = "Select at least one stock.";
      return;
    }
    oWarn.textContent = "";
    visibleTickers = sel;

    // redraw Panel 1 + Panel 2 with same brush domain
    drawOverview();
    updateDetail(currentDomain);
  });

  // =========================
  // Initialize
  // =========================
  drawOverview();                               // Panel 1
  updateDetail(x.domain());                      // Panel 2
  updateModelPlot(x.domain(), getModelChecked()); // Panel 3 (starts 2016 inside)
  updateScatter(x.domain(), selectedPair);        // Panel 4
});
