/* Workforce Economics Lab
   Stable, multi-page, no loops, auto industry baselines.
*/

(function () {
  // --------------------------
  // Helpers
  // --------------------------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function debounce(fn, ms = 80) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  function clamp(n, min, max) {
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
  }

  function parseNumber(x, fallback = 0) {
    if (x === null || x === undefined) return fallback;
    const cleaned = String(x).replace(/[£,%\s,]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : fallback;
  }

  function formatGBP(n) {
    const v = Number.isFinite(n) ? n : 0;
    return v.toLocaleString("en-GB", {
      style: "currency",
      currency: "GBP",
      maximumFractionDigits: 0
    });
  }

  function formatPct(n) {
    const v = Number.isFinite(n) ? n : 0;
    return `${v.toFixed(1)}%`;
  }

  function setText(sel, value) {
    const el = $(sel);
    if (el) el.textContent = value;
  }

  function nowISODate() {
    return new Date().toISOString().slice(0, 10);
  }

  // --------------------------
  // Industry baselines (expandable)
  // turnoverRate = annual %
  // costToReplacePctSalary = % of salary
  // timeToHireDays = days
  // engagementIndex = 0–100
  // --------------------------
  const INDUSTRIES = [
    { key: "hospitality", label: "Hospitality", baselines: { turnoverRate: 35, costToReplacePctSalary: 25, timeToHireDays: 28, engagementIndex: 48 } },
    { key: "retail", label: "Retail", baselines: { turnoverRate: 28, costToReplacePctSalary: 22, timeToHireDays: 30, engagementIndex: 52 } },
    { key: "healthcare", label: "Healthcare", baselines: { turnoverRate: 18, costToReplacePctSalary: 30, timeToHireDays: 45, engagementIndex: 50 } },
    { key: "professional_services", label: "Professional Services", baselines: { turnoverRate: 12, costToReplacePctSalary: 35, timeToHireDays: 50, engagementIndex: 60 } },

    { key: "manufacturing", label: "Manufacturing", baselines: { turnoverRate: 16, costToReplacePctSalary: 28, timeToHireDays: 42, engagementIndex: 56 } },
    { key: "construction", label: "Construction", baselines: { turnoverRate: 20, costToReplacePctSalary: 26, timeToHireDays: 40, engagementIndex: 50 } },
    { key: "logistics", label: "Logistics & Warehousing", baselines: { turnoverRate: 24, costToReplacePctSalary: 22, timeToHireDays: 32, engagementIndex: 49 } },
    { key: "education", label: "Education", baselines: { turnoverRate: 12, costToReplacePctSalary: 30, timeToHireDays: 55, engagementIndex: 57 } },
    { key: "public_sector", label: "Public Sector", baselines: { turnoverRate: 10, costToReplacePctSalary: 28, timeToHireDays: 60, engagementIndex: 58 } },
    { key: "finance", label: "Financial Services", baselines: { turnoverRate: 14, costToReplacePctSalary: 40, timeToHireDays: 55, engagementIndex: 61 } },
    { key: "tech", label: "Technology / SaaS", baselines: { turnoverRate: 16, costToReplacePctSalary: 45, timeToHireDays: 50, engagementIndex: 62 } },
    { key: "care", label: "Care Homes", baselines: { turnoverRate: 32, costToReplacePctSalary: 24, timeToHireDays: 35, engagementIndex: 46 } },
    { key: "hospitality_travel", label: "Travel & Leisure", baselines: { turnoverRate: 30, costToReplacePctSalary: 25, timeToHireDays: 30, engagementIndex: 50 } },
    { key: "utilities", label: "Utilities", baselines: { turnoverRate: 9, costToReplacePctSalary: 28, timeToHireDays: 55, engagementIndex: 60 } },
    { key: "legal", label: "Legal", baselines: { turnoverRate: 12, costToReplacePctSalary: 42, timeToHireDays: 60, engagementIndex: 60 } }
  ];

  function getIndustry(key) {
    return INDUSTRIES.find(i => i.key === key) || INDUSTRIES[0];
  }

  // --------------------------
  // URL + local state
  // --------------------------
  const STORAGE_KEY = "wel_state_v2";

  function readURLState() {
    const p = new URLSearchParams(location.search);
    const obj = {};
    for (const [k, v] of p.entries()) obj[k] = v;
    return obj;
  }

  function writeURLState(partial) {
    const p = new URLSearchParams(location.search);
    Object.entries(partial).forEach(([k, v]) => {
      if (v === null || v === undefined || v === "") p.delete(k);
      else p.set(k, String(v));
    });
    history.replaceState({}, "", `${location.pathname}?${p.toString()}`);
  }

  function loadState() {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return { ...stored, ...readURLState() };
  }

  function saveState(partial) {
    const next = { ...loadState(), ...partial };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    writeURLState(partial);
    return next;
  }

  // --------------------------
  // Apply industry baselines into inputs (auto-populate)
  // --------------------------
  function applyIndustryBaselinesToInputs(industry) {
    // Retention page baseline turnover auto-set
    const turnoverEl = $("#turnoverRate");
    if (turnoverEl) turnoverEl.value = industry.baselines.turnoverRate;

    // Attraction page baseline time-to-hire auto-set
    const tthEl = $("#timeToHire");
    if (tthEl) tthEl.value = industry.baselines.timeToHireDays;

    // (Optional) any other baseline inputs you add later can be wired here
  }

  // --------------------------
  // Header logic
  // --------------------------
  function initTopbar() {
    const industrySelect = $("#industrySelect");
    if (!industrySelect) return;

    const companyName = $("#companyName");
    const companyLogo = $("#companyLogo");
    const btnShare = $("#btnShare");
    const btnPrint = $("#btnPrint");

    industrySelect.innerHTML = INDUSTRIES
      .map(i => `<option value="${i.key}">${i.label}</option>`)
      .join("");

    const state = loadState();
    const startIndustry = state.industry || INDUSTRIES[0].key;
    industrySelect.value = startIndustry;

    const industry = getIndustry(startIndustry);

    applyReportHeader(startIndustry, state.company || "", state.logo || "");
    applyIndustryBaselinesToInputs(industry);

    industrySelect.addEventListener("change", () => {
      saveState({ industry: industrySelect.value });
      const newIndustry = getIndustry(industrySelect.value);
      applyIndustryBaselinesToInputs(newIndustry);
      applyReportHeader(industrySelect.value, companyName?.value || "", loadState().logo || "");
      recalcAll();
    });

    if (companyName) {
      companyName.value = state.company || "";
      companyName.addEventListener("input", debounce(() => {
        saveState({ company: companyName.value });
      }, 120));
    }

    if (companyLogo) {
      companyLogo.addEventListener("change", () => {
        const file = companyLogo.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          saveState({ logo: reader.result });
          applyReportHeader(industrySelect.value, companyName?.value || "", reader.result);
        };
        reader.readAsDataURL(file);
      });
    }

    if (btnShare) {
      btnShare.addEventListener("click", () => {
        navigator.clipboard.writeText(location.href);
        btnShare.textContent = "Copied ✓";
        setTimeout(() => (btnShare.textContent = "Copy share link"), 1500);
      });
    }

    if (btnPrint) btnPrint.addEventListener("click", () => window.print());
  }

  function applyReportHeader(industryKey, company, logo) {
    setText("#reportCompany", company || "Company");
    setText("#reportIndustry", getIndustry(industryKey).label);
    setText("#reportMeta", `Workforce Economics Lab • UK • ${nowISODate()}`);

    const img = $("#reportLogo");
    if (img) {
      if (logo) {
        img.src = logo;
        img.style.display = "block";
      } else {
        img.style.display = "none";
      }
    }
  }

  // --------------------------
  // Engagement score (simple & stable)
  // --------------------------
  function computeEngagementScore(industry, retentionImprovementPP, attractionImprovementDays) {
    // Conservative indicator only (not a claim). Just a narrative score.
    const base = industry.baselines.engagementIndex;

    const bumpFromRetention = clamp(retentionImprovementPP * 2.0, 0, 20);
    const bumpFromAttraction = clamp((attractionImprovementDays / 10) * 1.5, 0, 15);

    return clamp(base + bumpFromRetention + bumpFromAttraction, 0, 100);
  }

  // --------------------------
  // RETENTION
  // --------------------------
  function readRetentionInputs(industry) {
    const headcount = $("#headcount");
    const salary = $("#avgSalary");
    if (!headcount || !salary) return null;

    return {
      headcount: clamp(parseNumber(headcount.value), 0, 500000),
      avgSalary: clamp(parseNumber(salary.value), 0, 500000),
      turnover: clamp(parseNumber($("#turnoverRate")?.value, industry.baselines.turnoverRate), 0, 100),
      improvement: clamp(parseNumber($("#retentionImprovement")?.value, 0), 0, 50)
    };
  }

  function computeRetention(i, industry) {
    const replaceCostPct = industry.baselines.costToReplacePctSalary / 100;

    const leavers = i.headcount * (i.turnover / 100);
    const cost = leavers * i.avgSalary * replaceCostPct;

    const improvedTurnover = clamp(i.turnover - i.improvement, 0, 100);
    const improvedLeavers = i.headcount * (improvedTurnover / 100);
    const improvedCost = improvedLeavers * i.avgSalary * replaceCostPct;

    return {
      leavers,
      cost,
      saving: cost - improvedCost,
      baselineTurnover: i.turnover,
      improvedTurnover
    };
  }

  function renderRetention(r, engagementScore) {
    setText("#kpiLeavers", Math.round(r.leavers).toLocaleString());
    setText("#kpiChurnCost", formatGBP(r.cost));
    setText("#kpiSaving", formatGBP(r.saving));
    setText("#kpiTurnoverBaseline", formatPct(r.baselineTurnover));
    setText("#kpiTurnoverImproved", formatPct(r.improvedTurnover));
    setText("#kpiEngagement", Math.round(engagementScore).toString());
  }

  // --------------------------
  // ATTRACTION
  // --------------------------
  function readAttractionInputs(industry) {
    const open = $("#openRoles");
    const salary = $("#avgSalary");
    const tth = $("#timeToHire");
    if (!open || !salary || !tth) return null;

    return {
      openRoles: clamp(parseNumber(open.value), 0, 100000),
      avgSalary: clamp(parseNumber(salary.value), 0, 500000),
      timeToHire: clamp(parseNumber(tth.value, industry.baselines.timeToHireDays), 0, 365),
      improvement: clamp(parseNumber($("#attractionImprovement")?.value, 0), 0, 365)
    };
  }

  function computeAttraction(i) {
    const daily = i.avgSalary / 260;
    const cost = i.openRoles * daily * i.timeToHire;

    const improvedTTH = clamp(i.timeToHire - i.improvement, 0, 365);
    const improvedCost = i.openRoles * daily * improvedTTH;

    return {
      cost,
      saving: cost - improvedCost
    };
  }

  function renderAttraction(r) {
    setText("#kpiVacancyCost", formatGBP(r.cost));
    setText("#kpiAttractionSaving", formatGBP(r.saving));
  }

  // --------------------------
  // ECONOMICS
  // --------------------------
  function readEconomicsInputs() {
    const headcount = $("#econHeadcount");
    const salary = $("#econAvgSalary");
    const ni = $("#employerNI");
    const adoption = $("#salarySacrificeAdoption");
    const marginal = $("#marginalImprovement");
    if (!headcount || !salary || !ni || !adoption || !marginal) return null;

    return {
      headcount: clamp(parseNumber(headcount.value), 0, 500000),
      avgSalary: clamp(parseNumber(salary.value), 0, 500000),
      ni: clamp(parseNumber(ni.value), 0, 40),
      adoption: clamp(parseNumber(adoption.value), 0, 100),
      marginal: clamp(parseNumber(marginal.value), 0, 10)
    };
  }

  function computeEconomics(i) {
    const payroll = i.headcount * i.avgSalary;
    const niCost = payroll * (i.ni / 100);
    const optimisation = payroll * (i.marginal / 100);

    // Conservative eligibility factor
    const eligible = payroll * 0.08 * (i.adoption / 100);
    const niSaving = eligible * (i.ni / 100);

    return { payroll, niCost, optimisation, niSaving };
  }

  function renderEconomics(r) {
    setText("#kpiPayroll", formatGBP(r.payroll));
    setText("#kpiNI", formatGBP(r.niCost));
    setText("#kpiOptimisation", formatGBP(r.optimisation));
    setText("#kpiNISaving", formatGBP(r.niSaving));
  }

  // --------------------------
  // Main recalculation
  // --------------------------
  const recalcAll = debounce(() => {
    const state = loadState();
    const industry = getIndustry(state.industry || INDUSTRIES[0].key);

    const rInputs = readRetentionInputs(industry);
    const aInputs = readAttractionInputs(industry);

    const engagement = computeEngagementScore(
      industry,
      rInputs ? rInputs.improvement : 0,
      aInputs ? aInputs.improvement : 0
    );

    if (rInputs) renderRetention(computeRetention(rInputs, industry), engagement);

    if (aInputs) renderAttraction(computeAttraction(aInputs));

    const eInputs = readEconomicsInputs();
    if (eInputs) renderEconomics(computeEconomics(eInputs));
  }, 80);

  function bindInputs() {
    $$("input, select").forEach(el => {
      if (el.type === "file") return;
      el.addEventListener("input", recalcAll);
      el.addEventListener("change", recalcAll);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initTopbar();
    bindInputs();
    recalcAll();
  });

})();




