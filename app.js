/* Workforce Economics Lab - app.js
   Stable: no loops, debounced recalcs, no input rewriting while typing.
   Multi-page: shared topbar + industry presets + shareable URL state + printable report header.
*/

(function () {
  // ---------- Helpers ----------
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

  // Parses "£12,000", "12%", " 12 000 " safely
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
      maximumFractionDigits: 0,
    });
  }

  function formatPct(n) {
    const v = Number.isFinite(n) ? n : 0;
    return `${v.toFixed(1)}%`;
  }

  function nowISODate() {
    return new Date().toISOString().slice(0, 10);
  }

  function setText(sel, value) {
    const el = $(sel);
    if (el) el.textContent = value;
  }

  // ---------- Industry Baselines ----------
  const INDUSTRIES = [
    {
      key: "hospitality",
      label: "Hospitality",
      baselines: {
        turnoverRate: 35,
        costToReplacePctSalary: 25,
        timeToHireDays: 28,
        absenteeismDays: 6,
        engagementIndex: 48,
      },
      sources: { turnoverRate: [{ label: "Add source link", url: "#" }] },
    },
    {
      key: "retail",
      label: "Retail",
      baselines: { turnoverRate: 28, costToReplacePctSalary: 22, timeToHireDays: 30, absenteeismDays: 5.5, engagementIndex: 52 },
      sources: {},
    },
    {
      key: "healthcare",
      label: "Healthcare",
      baselines: { turnoverRate: 18, costToReplacePctSalary: 30, timeToHireDays: 45, absenteeismDays: 7.5, engagementIndex: 50 },
      sources: {},
    },
    {
      key: "manufacturing",
      label: "Manufacturing",
      baselines: { turnoverRate: 14, costToReplacePctSalary: 28, timeToHireDays: 40, absenteeismDays: 6.5, engagementIndex: 54 },
      sources: {},
    },
    {
      key: "professional_services",
      label: "Professional Services",
      baselines: { turnoverRate: 12, costToReplacePctSalary: 35, timeToHireDays: 50, absenteeismDays: 4.5, engagementIndex: 60 },
      sources: {},
    },
    {
      key: "technology",
      label: "Technology",
      baselines: { turnoverRate: 16, costToReplacePctSalary: 45, timeToHireDays: 55, absenteeismDays: 4.0, engagementIndex: 62 },
      sources: {},
    },
    {
      key: "public_sector",
      label: "Public Sector",
      baselines: { turnoverRate: 9, costToReplacePctSalary: 20, timeToHireDays: 60, absenteeismDays: 8.0, engagementIndex: 55 },
      sources: {},
    },
  ];

  function getIndustry(key) {
    return INDUSTRIES.find((i) => i.key === key) || INDUSTRIES[0];
  }

  // ---------- URL + localStorage state ----------
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
      if (v === null || v === undefined || v === "") p.delete(k);
      else p.set(k, String(v));
    });
    history.replaceState({}, "", `${location.pathname}?${p.toString()}`);
  }

  function loadState() {
    const fromStorage = (() => {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      } catch {
        return {};
      }
    })();
    const fromURL = readURLState();
    return { ...fromStorage, ...fromURL };
  }

  function saveState(partial) {
    const current = loadState();
    const next = { ...current, ...partial };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    writeURLState(partial);
    return next;
  }

  // ---------- Report header + topbar ----------
  function applyReportHeader(industryKey, company, logoDataUrl) {
    const ind = getIndustry(industryKey);

    const reportLogo = $("#reportLogo");
    const reportCompany = $("#reportCompany");
    const reportIndustry = $("#reportIndustry");
    const reportMeta = $("#reportMeta");

    if (reportCompany) reportCompany.textContent = company || "Company";
    if (reportIndustry) reportIndustry.textContent = ind.label;
    if (reportMeta) reportMeta.textContent = `Workforce Economics Lab • UK • ${ind.label} • ${nowISODate()}`;

    if (reportLogo) {
      if (logoDataUrl) {
        reportLogo.src = logoDataUrl;
        reportLogo.style.display = "block";
      } else {
        reportLogo.removeAttribute("src");
        reportLogo.style.display = "none";
      }
    }
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ""));
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  function initTopbar() {
    const industrySelect = $("#industrySelect");
    if (!industrySelect) return;

    const companyName = $("#companyName");
    const companyLogo = $("#companyLogo");
    const btnShare = $("#btnShare");
    const btnPrint = $("#btnPrint");

    industrySelect.innerHTML = INDUSTRIES.map(
      (i) => `<option value="${i.key}">${i.label}</option>`
    ).join("");

    const st = loadState();
    const selectedIndustry = st.industry || INDUSTRIES[0].key;
    industrySelect.value = selectedIndustry;

    if (companyName) companyName.value = st.company || "";

    applyReportHeader(selectedIndustry, st.company || "", st.logoDataUrl || "");

    industrySelect.addEventListener("change", () => {
      const next = saveState({ industry: industrySelect.value });
      applyReportHeader(next.industry || INDUSTRIES[0].key, next.company || "", next.logoDataUrl || "");
      recalcAll();
    });

    if (companyName) {
      companyName.addEventListener(
        "input",
        debounce(() => {
          const next = saveState({ company: companyName.value.trim() });
          applyReportHeader(next.industry || INDUSTRIES[0].key, next.company || "", next.logoDataUrl || "");
        }, 120)
      );
    }

    if (companyLogo) {
      companyLogo.addEventListener("change", async () => {
        const file = companyLogo.files && companyLogo.files[0];
        if (!file) return;
        const dataUrl = await readFileAsDataURL(file);
        const next = saveState({ logoDataUrl: dataUrl });
        applyReportHeader(next.industry || INDUSTRIES[0].key, next.company || "", next.logoDataUrl || "");
      });
    }

    if (btnShare) {
      btnShare.addEventListener("click", async () => {
        const url = location.href;
        try {
          await navigator.clipboard.writeText(url);
          btnShare.textContent = "Copied ✓";
          setTimeout(() => (btnShare.textContent = "Copy share link"), 1200);
        } catch {
          prompt("Copy this link:", url);
        }
      });
    }

    if (btnPrint) {
      btnPrint.addEventListener("click", () => {
        const header = $("#reportHeader");
        if (header) header.setAttribute("aria-hidden", "false");
        window.print();
      });
    }
  }

  // ---------- Retention widget ----------
  function readRetentionInputs(industry) {
    const headcountEl = $("#headcount");
    const avgSalaryEl = $("#avgSalary");
    if (!headcountEl || !avgSalaryEl) return null;

    const turnoverRateEl = $("#turnoverRate");
    const improvementEl = $("#retentionImprovement");

    const headcount = clamp(parseNumber(headcountEl.value, 0), 0, 500000);
    const avgSalary = clamp(parseNumber(avgSalaryEl.value, 0), 0, 500000);

    const baselineTurnover = industry.baselines.turnoverRate;
    const turnoverRate = turnoverRateEl
      ? clamp(parseNumber(turnoverRateEl.value, baselineTurnover), 0, 100)
      : baselineTurnover;

    const improvement = improvementEl
      ? clamp(parseNumber(improvementEl.value, 0), -50, 50)
      : 0;

    return { headcount, avgSalary, turnoverRate, improvement };
  }

  function computeRetention(inputs, industry) {
    const costPct = industry.baselines.costToReplacePctSalary / 100;

    const leavers = inputs.headcount * (inputs.turnoverRate / 100);
    const costPerLeaver = inputs.avgSalary * costPct;
    const annualChurnCost = leavers * costPerLeaver;

    const improvedTurnover = clamp(inputs.turnoverRate - inputs.improvement, 0, 100);
    const improvedLeavers = inputs.headcount * (improvedTurnover / 100);
    const improvedCost = improvedLeavers * costPerLeaver;

    const annualSaving = annualChurnCost - improvedCost;

    const engagementScore = clamp(
      industry.baselines.engagementIndex + inputs.improvement * 2.2,
      0,
      100
    );

    return {
      baselineTurnover: inputs.turnoverRate,
      improvedTurnover,
      leavers,
      annualChurnCost,
      annualSaving,
      engagementScore,
    };
  }

  function renderRetention(results, industry) {
    setText("#kpiLeavers", Math.round(results.leavers).toLocaleString("en-GB"));
    setText("#kpiChurnCost", formatGBP(results.annualChurnCost));
    setText("#kpiSaving", formatGBP(results.annualSaving));
    setText("#kpiEngagement", `${Math.round(results.engagementScore)}/100`);
    setText("#kpiTurnoverBase", formatPct(results.baselineTurnover));
    setText("#kpiTurnoverImproved", formatPct(results.improvedTurnover));

    setText(
      "#industryRef",
      `Baseline assumptions for ${industry.label}: turnover ${industry.baselines.turnoverRate}%, time-to-hire ${industry.baselines.timeToHireDays} days.`
    );
  }

  // ---------- Attraction widget ----------
  function readAttractionInputs(industry) {
    const openRolesEl = $("#openRoles");
    const avgSalaryEl = $("#avgSalary");
    const timeToHireEl = $("#timeToHire");
    const improvementEl = $("#attractionImprovement");

    // If this page doesn't have these IDs, skip
    if (!openRolesEl || !avgSalaryEl || !timeToHireEl) return null;

    const openRoles = clamp(parseNumber(openRolesEl.value, 0), 0, 200000);
    const avgSalary = clamp(parseNumber(avgSalaryEl.value, 0), 0, 500000);

    const baselineTTH = industry.baselines.timeToHireDays;
    const timeToHire = clamp(parseNumber(timeToHireEl.value, baselineTTH), 0, 365);

    const improvementDays = improvementEl
      ? clamp(parseNumber(improvementEl.value, 0), 0, 365)
      : 0;

    return { openRoles, avgSalary, timeToHire, improvementDays };
  }

  function computeAttraction(inputs) {
    // Simple, conservative vacancy drag model:
    // daily salary cost ≈ salary / 260 workdays
    // vacancy cost ≈ openRoles × dailySalary × daysUnfilled
    const dailySalary = inputs.avgSalary / 260;
    const vacancyCost = inputs.openRoles * dailySalary * inputs.timeToHire;

    const improvedTime = clamp(inputs.timeToHire - inputs.improvementDays, 0, 365);
    const improvedCost = inputs.openRoles * dailySalary * improvedTime;

    const saving = vacancyCost - improvedCost;

    return { vacancyCost, saving, improvedTime };
  }

  function renderAttraction(results, industry) {
    setText("#kpiVacancyCost", formatGBP(results.vacancyCost));
    setText("#kpiAttractionSaving", formatGBP(results.saving));

    // Optional: if you later add an industry ref block on attraction page
    setText(
      "#industryRefAttraction",
      `Baseline time-to-hire for ${industry.label}: ${industry.baselines.timeToHireDays} days.`
    );
  }

  // ---------- Recalc pipeline ----------
  const recalcAll = debounce(() => {
    const st = loadState();
    const industry = getIndustry(st.industry || INDUSTRIES[0].key);

    const retentionInputs = readRetentionInputs(industry);
    if (retentionInputs) {
      const res = computeRetention(retentionInputs, industry);
      renderRetention(res, industry);
    }

    const attractionInputs = readAttractionInputs(industry);
    if (attractionInputs) {
      const res = computeAttraction(attractionInputs);
      renderAttraction(res, industry);
    }
  }, 80);

  function bindInputs() {
    $$("input, select, textarea").forEach((el) => {
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


