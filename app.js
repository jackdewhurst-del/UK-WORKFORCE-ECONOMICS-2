(() => {
  "use strict";

  // -----------------------------
  // 1) Data (edit these anytime)
  // -----------------------------
  // NOTE: These are demo baselines. You can replace with sourced stats later.
  // Each industry: turnover %, costToReplaceMultiplier, timeToHireDays, productivityLossVacancy %, hiringDifficulty (0-100)
  const INDUSTRY_BASELINES = {
    "Hospitality":              { turnover: 45, replaceMult: 0.30, tth: 35, vacancyLoss: 35, hiringDifficulty: 72 },
    "Retail":                   { turnover: 35, replaceMult: 0.25, tth: 32, vacancyLoss: 30, hiringDifficulty: 68 },
    "Healthcare":               { turnover: 22, replaceMult: 0.45, tth: 55, vacancyLoss: 45, hiringDifficulty: 78 },
    "Professional Services":    { turnover: 18, replaceMult: 0.50, tth: 60, vacancyLoss: 50, hiringDifficulty: 70 },
    "Construction":             { turnover: 28, replaceMult: 0.40, tth: 50, vacancyLoss: 40, hiringDifficulty: 74 },
    "Manufacturing":            { turnover: 20, replaceMult: 0.35, tth: 45, vacancyLoss: 35, hiringDifficulty: 62 },
    "Education":                { turnover: 14, replaceMult: 0.40, tth: 55, vacancyLoss: 40, hiringDifficulty: 60 },
    "Technology":               { turnover: 16, replaceMult: 0.55, tth: 65, vacancyLoss: 55, hiringDifficulty: 76 },
    "Financial Services":       { turnover: 12, replaceMult: 0.60, tth: 70, vacancyLoss: 55, hiringDifficulty: 66 },
    "Logistics & Transport":    { turnover: 26, replaceMult: 0.30, tth: 40, vacancyLoss: 35, hiringDifficulty: 64 },
    "Public Sector":            { turnover: 10, replaceMult: 0.35, tth: 60, vacancyLoss: 35, hiringDifficulty: 52 },
    "Charity / Non-profit":     { turnover: 13, replaceMult: 0.30, tth: 55, vacancyLoss: 35, hiringDifficulty: 50 }
  };

  const REGIONS = ["UK (All)", "London", "South East", "Midlands", "North", "Scotland", "Wales", "Northern Ireland"];

  // News sources (RSS). Some will be blocked by CORS in-browser; we handle failures gracefully.
  const NEWS_RSS = [
    { name: "BBC Business", url: "https://feeds.bbci.co.uk/news/business/rss.xml" },
    { name: "GOV.UK News", url: "https://www.gov.uk/government/announcements.atom" },
    { name: "ONS News", url: "https://www.ons.gov.uk/news/feeds/latest" }
  ];

  // Keywords to score news “impact” (very simple)
  const NEWS_KEYWORDS = ["national insurance", "pension", "employment", "wage", "inflation", "benefit", "tax", "salary", "recruitment", "redundancy"];

  // -----------------------------
  // 2) State + helpers
  // -----------------------------
  const qs = (id) => document.getElementById(id);
  const has = (id) => !!qs(id);

  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const toNum = (v, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  const fmtGBP = (n) => {
    const val = Number.isFinite(n) ? n : 0;
    return val.toLocaleString("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });
  };

  const fmtPct = (n) => `${(Number.isFinite(n) ? n : 0).toFixed(1)}%`;
  const fmtInt = (n) => `${Math.round(Number.isFinite(n) ? n : 0).toLocaleString("en-GB")}`;

  const STORAGE_KEY = "wel_state_v1";

  const defaultState = () => ({
    industry: Object.keys(INDUSTRY_BASELINES)[0],
    region: REGIONS[0],
    companyName: "",
    companyLogoDataUrl: "",
    // Retention inputs
    headcount: 500,
    avgSalary: 35000,
    turnoverRate: null, // if null, use baseline
    retentionImprovement: 2,
    // Attraction inputs
    openRoles: 10,
    avgSalaryAttraction: 35000,
    timeToHireDays: null, // if null, use baseline
    productivityLossPct: null, // if null, use baseline
    attractionImprovement: 5,
    // Economics inputs
    econHeadcount: 500,
    econAvgSalary: 35000,
    niDeltaPct: 1.0,
    participationPct: 30
  });

  const loadState = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return { ...defaultState(), ...parsed };
    } catch {
      return defaultState();
    }
  };

  const saveState = (s) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
  };

  const parseUrlState = () => {
    const params = new URLSearchParams(window.location.search);
    if (![...params.keys()].length) return null;
    const s = {};
    if (params.get("industry")) s.industry = params.get("industry");
    if (params.get("region")) s.region = params.get("region");
    if (params.get("company")) s.companyName = params.get("company");
    // numeric params (optional)
    const numericKeys = [
      "headcount","avgSalary","turnoverRate","retentionImprovement",
      "openRoles","avgSalaryAttraction","timeToHireDays","productivityLossPct","attractionImprovement",
      "econHeadcount","econAvgSalary","niDeltaPct","participationPct"
    ];
    for (const k of numericKeys) {
      if (params.get(k) !== null) s[k] = toNum(params.get(k));
    }
    return s;
  };

  let state = loadState();
  const urlState = parseUrlState();
  if (urlState) state = { ...state, ...urlState };
  // Validate industry
  if (!INDUSTRY_BASELINES[state.industry]) state.industry = Object.keys(INDUSTRY_BASELINES)[0];
  if (!REGIONS.includes(state.region)) state.region = REGIONS[0];

  // -----------------------------
  // 3) Rendering / calculations
  // -----------------------------
  function getBaseline() {
    return INDUSTRY_BASELINES[state.industry];
  }

  function calcEngagementScore() {
    // Simple scoring model: higher turnover + higher hiring difficulty reduces score
    const b = getBaseline();
    const turnover = state.turnoverRate === null ? b.turnover : state.turnoverRate;
    const tth = state.timeToHireDays === null ? b.tth : state.timeToHireDays;
    const diff = b.hiringDifficulty;

    // Normalize
    const turnoverPenalty = clamp((turnover - 10) * 1.2, 0, 60); // 10% -> 0, 60% -> ~60
    const tthPenalty = clamp((tth - 30) * 0.8, 0, 40);          // 30d -> 0, 80d -> 40
    const diffPenalty = clamp((diff - 40) * 0.6, 0, 36);         // 40 -> 0, 100 -> 36

    const raw = 100 - (turnoverPenalty * 0.5 + tthPenalty * 0.3 + diffPenalty * 0.2);
    return clamp(raw, 0, 100);
  }

  function calcRetention() {
    const b = getBaseline();
    const headcount = toNum(state.headcount, 0);
    const avgSalary = toNum(state.avgSalary, 0);

    const baselineTurnover = state.turnoverRate === null ? b.turnover : clamp(toNum(state.turnoverRate, b.turnover), 0, 100);
    const improvement = clamp(toNum(state.retentionImprovement, 0), 0, 100);

    const improvedTurnover = clamp(baselineTurnover - improvement, 0, 100);

    const leavers = headcount * (baselineTurnover / 100);
    const improvedLeavers = headcount * (improvedTurnover / 100);

    const costToReplace = avgSalary * b.replaceMult; // conservative: fraction of salary
    const churnCost = leavers * costToReplace;
    const improvedCost = improvedLeavers * costToReplace;

    return {
      baselineTurnover,
      improvedTurnover,
      leavers,
      churnCost,
      saving: Math.max(0, churnCost - improvedCost)
    };
  }

  function calcAttraction() {
    const b = getBaseline();
    const openRoles = toNum(state.openRoles, 0);
    const avgSalary = toNum(state.avgSalaryAttraction, 0);

    const tth = state.timeToHireDays === null ? b.tth : clamp(toNum(state.timeToHireDays, b.tth), 0, 365);
    const lossPct = state.productivityLossPct === null ? b.vacancyLoss : clamp(toNum(state.productivityLossPct, b.vacancyLoss), 0, 100);
    const fasterDays = clamp(toNum(state.attractionImprovement, 0), 0, 365);

    const salaryPerDay = avgSalary / 260; // working days
    const vacancyCost = openRoles * tth * salaryPerDay * (lossPct / 100);
    const improvedCost = openRoles * Math.max(0, tth - fasterDays) * salaryPerDay * (lossPct / 100);

    return {
      hiringDifficulty: b.hiringDifficulty,
      tthBaseline: tth,
      vacancyCost,
      saving: Math.max(0, vacancyCost - improvedCost)
    };
  }

  function calcEconomics() {
    const headcount = toNum(state.econHeadcount, 0);
    const avgSalary = toNum(state.econAvgSalary, 0);
    const niDelta = toNum(state.niDeltaPct, 0) / 100;
    const part = clamp(toNum(state.participationPct, 0), 0, 100) / 100;

    // Directional: NI pressure = payroll * delta
    const payroll = headcount * avgSalary;
    const pressure = payroll * niDelta;

    // Directional offset: assume only participating payroll portion influenced
    const offset = pressure * part * 0.6; // conservative “offset factor”
    return { pressure, offset };
  }

  // -----------------------------
  // 4) DOM binding
  // -----------------------------
  function fillSelect(selectEl, options, selected) {
    if (!selectEl) return;
    selectEl.innerHTML = "";
    for (const opt of options) {
      const o = document.createElement("option");
      o.value = opt;
      o.textContent = opt;
      if (opt === selected) o.selected = true;
      selectEl.appendChild(o);
    }
  }

  function setInputValue(id, value) {
    const el = qs(id);
    if (!el) return;
    if (value === null || value === undefined) return;
    el.value = value;
  }

  function readInputsIntoState() {
    // global selects
    if (has("industrySelect")) state.industry = qs("industrySelect").value;
    if (has("regionSelect")) state.region = qs("regionSelect").value;

    // company
    if (has("companyName")) state.companyName = qs("companyName").value || "";

    // retention
    if (has("headcount")) state.headcount = toNum(qs("headcount").value, state.headcount);
    if (has("avgSalary")) state.avgSalary = toNum(qs("avgSalary").value, state.avgSalary);
    if (has("turnoverRate")) state.turnoverRate = toNum(qs("turnoverRate").value, 0);
    if (has("retentionImprovement")) state.retentionImprovement = toNum(qs("retentionImprovement").value, state.retentionImprovement);

    // attraction
    if (has("openRoles")) state.openRoles = toNum(qs("openRoles").value, state.openRoles);
    if (has("avgSalaryAttraction")) state.avgSalaryAttraction = toNum(qs("avgSalaryAttraction").value, state.avgSalaryAttraction);
    if (has("timeToHireDays")) state.timeToHireDays = toNum(qs("timeToHireDays").value, 0);
    if (has("productivityLossPct")) state.productivityLossPct = toNum(qs("productivityLossPct").value, 0);
    if (has("attractionImprovement")) state.attractionImprovement = toNum(qs("attractionImprovement").value, state.attractionImprovement);

    // economics
    if (has("econHeadcount")) state.econHeadcount = toNum(qs("econHeadcount").value, state.econHeadcount);
    if (has("econAvgSalary")) state.econAvgSalary = toNum(qs("econAvgSalary").value, state.econAvgSalary);
    if (has("niDeltaPct")) state.niDeltaPct = toNum(qs("niDeltaPct").value, state.niDeltaPct);
    if (has("participationPct")) state.participationPct = toNum(qs("participationPct").value, state.participationPct);

    // Special: turnoverRate/timeToHire/productivityLoss should default to baseline on industry change.
    // We handle that in onIndustryChange.
  }

  function writeStateToInputs() {
    fillSelect(qs("industrySelect"), Object.keys(INDUSTRY_BASELINES), state.industry);
    fillSelect(qs("regionSelect"), REGIONS, state.region);

    setInputValue("companyName", state.companyName);

    // retention inputs
    setInputValue("headcount", state.headcount);
    setInputValue("avgSalary", state.avgSalary);

    // attraction inputs
    setInputValue("openRoles", state.openRoles);
    setInputValue("avgSalaryAttraction", state.avgSalaryAttraction);
    setInputValue("attractionImprovement", state.attractionImprovement);

    // economics inputs
    setInputValue("econHeadcount", state.econHeadcount);
    setInputValue("econAvgSalary", state.econAvgSalary);
    setInputValue("niDeltaPct", state.niDeltaPct);
    setInputValue("participationPct", state.participationPct);

    // Set baseline-driven defaults into inputs if present
    const b = getBaseline();
    if (has("turnoverRate")) qs("turnoverRate").value = (state.turnoverRate === null ? b.turnover : state.turnoverRate);
    if (has("timeToHireDays")) qs("timeToHireDays").value = (state.timeToHireDays === null ? b.tth : state.timeToHireDays);
    if (has("productivityLossPct")) qs("productivityLossPct").value = (state.productivityLossPct === null ? b.vacancyLoss : state.productivityLossPct);

    // logo in print area
    setReportHeader();
  }

  function setText(id, txt) {
    const el = qs(id);
    if (!el) return;
    el.textContent = txt;
  }

  function setReportHeader() {
    const company = (state.companyName || "Company").trim();
    setText("reportCompany", company);
    setText("reportIndustry", `${state.industry} • ${state.region}`);

    const img = qs("reportLogo");
    if (img) {
      if (state.companyLogoDataUrl) {
        img.src = state.companyLogoDataUrl;
        img.style.display = "block";
      } else {
        img.removeAttribute("src");
        img.style.display = "none";
      }
    }
  }

  function renderAll() {
    // Snapshot KPIs on any page
    const engagement = calcEngagementScore();
    setText("kpiEngagement", fmtInt(engagement));

    const b = getBaseline();
    setText("kpiTurnoverBaseline", fmtPct(b.turnover));
    setText("kpiHiringDifficulty", fmtInt(b.hiringDifficulty));

    // Retention page KPIs
    const r = calcRetention();
    setText("kpiLeavers", fmtInt(r.leavers));
    setText("kpiChurnCost", fmtGBP(r.churnCost));
    setText("kpiSaving", fmtGBP(r.saving));
    setText("kpiTurnoverImproved", fmtPct(r.improvedTurnover));

    // overview example saving
    setText("kpiRetentionExampleSaving", fmtGBP(r.saving));

    // Attraction page KPIs
    const a = calcAttraction();
    setText("kpiTTHBaseline", `${fmtInt(a.tthBaseline)} days`);
    setText("kpiVacancyCost", fmtGBP(a.vacancyCost));
    setText("kpiVacancySaving", fmtGBP(a.saving));

    // Economics page KPIs
    const e = calcEconomics();
    setText("kpiNIPressure", fmtGBP(e.pressure));
    setText("kpiNIOffset", fmtGBP(e.offset));

    setReportHeader();
    saveState(state);
  }

  function onIndustryChange() {
    // When industry changes, reset baseline-driven fields to baseline (unless user later overrides)
    state.turnoverRate = null;
    state.timeToHireDays = null;
    state.productivityLossPct = null;

    writeStateToInputs();
    renderAll();
  }

  function hookInputs() {
    const rerender = () => {
      readInputsIntoState();
      renderAll();
    };

    // Industry select
    const ind = qs("industrySelect");
    if (ind) {
      ind.addEventListener("change", () => {
        state.industry = ind.value;
        onIndustryChange();
      });
    }

    const region = qs("regionSelect");
    if (region) region.addEventListener("change", rerender);

    const company = qs("companyName");
    if (company) company.addEventListener("input", rerender);

    // Generic input listeners (safe: no loops)
    const ids = [
      "headcount","avgSalary","turnoverRate","retentionImprovement",
      "openRoles","avgSalaryAttraction","timeToHireDays","productivityLossPct","attractionImprovement",
      "econHeadcount","econAvgSalary","niDeltaPct","participationPct"
    ];
    for (const id of ids) {
      const el = qs(id);
      if (!el) continue;
      el.addEventListener("input", rerender);
      el.addEventListener("change", rerender);
    }

    // Logo upload
    const logo = qs("companyLogo");
    if (logo) {
      logo.addEventListener("change", async () => {
        const file = logo.files && logo.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          state.companyLogoDataUrl = String(reader.result || "");
          renderAll();
        };
        reader.readAsDataURL(file);
      });
    }

    // Share link
    const btnShare = qs("btnShare");
    if (btnShare) {
      btnShare.addEventListener("click", async () => {
        readInputsIntoState();
        const params = new URLSearchParams();
        params.set("industry", state.industry);
        params.set("region", state.region);
        if (state.companyName) params.set("company", state.companyName);

        // include only a few high-signal numbers
        params.set("headcount", String(state.headcount));
        params.set("avgSalary", String(state.avgSalary));
        params.set("retentionImprovement", String(state.retentionImprovement));
        params.set("openRoles", String(state.openRoles));
        params.set("attractionImprovement", String(state.attractionImprovement));

        const url = `${location.origin}${location.pathname}?${params.toString()}`;
        try {
          await navigator.clipboard.writeText(url);
          btnShare.textContent = "Copied ✅";
          setTimeout(() => (btnShare.textContent = "Copy share link"), 900);
        } catch {
          prompt("Copy this link:", url);
        }
      });
    }

    // Print
    const btnPrint = qs("btnPrint");
    if (btnPrint) btnPrint.addEventListener("click", () => window.print());

    // News refresh
    const btnNews = qs("btnNewsRefresh");
    if (btnNews) btnNews.addEventListener("click", () => loadNews());
  }

  // -----------------------------
  // 5) News (best-effort)
  // -----------------------------
  async function fetchRss(url) {
    // Best effort: many RSS feeds block CORS. We'll catch and skip.
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error("Fetch failed");
    const text = await res.text();
    const doc = new DOMParser().parseFromString(text, "text/xml");
    const items = [...doc.querySelectorAll("item")].slice(0, 6).map((it) => ({
      title: it.querySelector("title")?.textContent?.trim() || "Untitled",
      link: it.querySelector("link")?.textContent?.trim() || "",
      date: it.querySelector("pubDate")?.textContent?.trim() || ""
    }));
    // Atom fallback
    if (!items.length) {
      const entries = [...doc.querySelectorAll("entry")].slice(0, 6).map((e) => ({
        title: e.querySelector("title")?.textContent?.trim() || "Untitled",
        link: e.querySelector("link")?.getAttribute("href") || "",
        date: e.querySelector("updated")?.textContent?.trim() || ""
      }));
      return entries;
    }
    return items;
  }

  function scoreHeadline(title) {
    const t = (title || "").toLowerCase();
    let score = 0;
    for (const k of NEWS_KEYWORDS) if (t.includes(k)) score += 1;
    return score;
  }

  async function loadNews() {
    const list = qs("newsList");
    if (!list) return;

    list.innerHTML = `<div class="muted">Loading…</div>`;

    const results = [];
    for (const src of NEWS_RSS) {
      try {
        const items = await fetchRss(src.url);
        for (const it of items) results.push({ ...it, source: src.name, score: scoreHeadline(it.title) });
      } catch {
        // skip blocked feeds
      }
    }

    results.sort((a, b) => (b.score - a.score));

    if (!results.length) {
      list.innerHTML = `<div class="muted">No feeds loaded (some sources block browser requests). Try later or swap RSS sources in app.js.</div>`;
      return;
    }

    list.innerHTML = "";
    for (const it of results.slice(0, 10)) {
      const div = document.createElement("div");
      div.className = "newsitem";
      div.innerHTML = `
        <div class="newsitem__title">${escapeHtml(it.title)}</div>
        <div class="newsitem__meta">${escapeHtml(it.source)} • ${escapeHtml(it.date || "")}</div>
        ${it.link ? `<a class="newsitem__link" href="${it.link}" target="_blank" rel="noreferrer">Open</a>` : ""}
      `;
      list.appendChild(div);
    }
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (m) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[m]));
  }

  // -----------------------------
  // 6) Boot
  // -----------------------------
  writeStateToInputs();
  hookInputs();
  renderAll();
  loadNews();

})();
