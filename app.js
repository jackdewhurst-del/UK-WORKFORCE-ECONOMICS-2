/* Workforce Economics Lab
   Stable, multi-page, no loops, no input rewriting.
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
  // Industry baselines
  // --------------------------

  const INDUSTRIES = [
    {
      key: "hospitality",
      label: "Hospitality",
      baselines: {
        turnoverRate: 35,
        costToReplacePctSalary: 25,
        timeToHireDays: 28,
        engagementIndex: 48
      }
    },
    {
      key: "retail",
      label: "Retail",
      baselines: {
        turnoverRate: 28,
        costToReplacePctSalary: 22,
        timeToHireDays: 30,
        engagementIndex: 52
      }
    },
    {
      key: "healthcare",
      label: "Healthcare",
      baselines: {
        turnoverRate: 18,
        costToReplacePctSalary: 30,
        timeToHireDays: 45,
        engagementIndex: 50
      }
    },
    {
      key: "professional_services",
      label: "Professional Services",
      baselines: {
        turnoverRate: 12,
        costToReplacePctSalary: 35,
        timeToHireDays: 50,
        engagementIndex: 60
      }
    }
  ];

  function getIndustry(key) {
    return INDUSTRIES.find(i => i.key === key) || INDUSTRIES[0];
  }

  // --------------------------
  // URL + local state
  // --------------------------

  const STORAGE_KEY = "wel_state_v1";

  function readURLState() {
    const p = new URLSearchParams(location.search);
    const obj = {};
    for (const [k, v] of p.entries()) obj[k] = v;
    return obj;
  }

  function writeURLState(partial) {
    const p = new URLSearchParams(location.search);
    Object.entries(partial).forEach(([k, v]) => {
      if (!v) p.delete(k);
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
    industrySelect.value = state.industry || INDUSTRIES[0].key;

    applyReportHeader(
      industrySelect.value,
      state.company || "",
      state.logo || ""
    );

    industrySelect.addEventListener("change", () => {
      saveState({ industry: industrySelect.value });
      recalcAll();
    });

    if (companyName) {
      companyName.value = state.company || "";
      companyName.addEventListener("input", debounce(() => {
        saveState({ company: companyName.value });
      }, 120));
    }

    if (companyLogo) {
      companyLogo.addEventListener("change", async () => {
        const file = companyLogo.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          saveState({ logo: reader.result });
          applyReportHeader(industrySelect.value, companyName.value, reader.result);
        };
        reader.readAsDataURL(file);
      });
    }

    if (btnShare) {
      btnShare.addEventListener("click", () => {
        navigator.clipboard.writeText(location.href);
        btnShare.textContent = "Copied ✓";
        setTimeout(() => btnShare.textContent = "Copy share link", 1500);
      });
    }

    if (btnPrint) {
      btnPrint.addEventListener("click", () => window.print());
    }
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

    const improvedTurnover = i.turnover - i.improvement;
    const improvedLeavers = i.headcount * (improvedTurnover / 100);
    const improvedCost = improvedLeavers * i.avgSalary * replaceCostPct;

    return {
      leavers,
      cost,
      saving: cost - improvedCost,
      improvedTurnover
    };
  }

  function renderRetention(r) {
    setText("#kpiLeavers", Math.round(r.leavers).toLocaleString());
    setText("#kpiChurnCost", formatGBP(r.cost));
    setText("#kpiSaving", formatGBP(r.saving));
    setText("#kpiTurnoverImproved", formatPct(r.improvedTurnover));
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

    const improved = i.openRoles * daily * (i.timeToHire - i.improvement);

    return {
      cost,
      saving: cost - improved
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
      headcount: parseNumber(headcount.value),
      avgSalary: parseNumber(salary.value),
      ni: parseNumber(ni.value),
      adoption: parseNumber(adoption.value),
      marginal: parseNumber(marginal.value)
    };
  }

  function computeEconomics(i) {

    const payroll = i.headcount * i.avgSalary;
    const niCost = payroll * (i.ni / 100);
    const optimisation = payroll * (i.marginal / 100);

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
    if (rInputs) renderRetention(computeRetention(rInputs, industry));

    const aInputs = readAttractionInputs(industry);
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



