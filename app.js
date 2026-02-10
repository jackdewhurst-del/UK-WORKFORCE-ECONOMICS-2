// Workforce Economics Lab (static multi-page)
// Shared data + calculations. Pages read the same "state" and render what they need.
// NOTE: Benchmarking model for prioritisation (not a prediction). No product mentions.

const INDUSTRIES = [
  { key:"Healthcare & Social Care", attr:26, attrRange:[22,30], stress:42, acceptance:70, tth:45, sacrifice:45, eligible:75, pensionE:5, pensionER:3, usage:18, renewal:8, mix:[70,10,20] },
  { key:"Retail", attr:35, attrRange:[30,40], stress:45, acceptance:68, tth:35, sacrifice:35, eligible:80, pensionE:4, pensionER:3, usage:14, renewal:10, mix:[75,8,17] },
  { key:"Hospitality", attr:40, attrRange:[35,45], stress:48, acceptance:65, tth:28, sacrifice:30, eligible:80, pensionE:4, pensionER:3, usage:12, renewal:10, mix:[78,7,15] },
  { key:"Professional Services", attr:18, attrRange:[15,22], stress:28, acceptance:78, tth:55, sacrifice:55, eligible:70, pensionE:6, pensionER:4, usage:26, renewal:7, mix:[35,20,45] },
  { key:"Manufacturing", attr:12, attrRange:[10,15], stress:30, acceptance:75, tth:50, sacrifice:45, eligible:75, pensionE:5, pensionER:3, usage:18, renewal:8, mix:[65,12,23] },
  { key:"Tech / SaaS", attr:20, attrRange:[15,25], stress:26, acceptance:82, tth:60, sacrifice:60, eligible:70, pensionE:6, pensionER:4, usage:28, renewal:6, mix:[25,20,55] },
  { key:"Education", attr:15, attrRange:[12,18], stress:25, acceptance:78, tth:65, sacrifice:50, eligible:75, pensionE:6, pensionER:6, usage:22, renewal:7, mix:[55,15,30] },
  { key:"Logistics", attr:22, attrRange:[18,28], stress:38, acceptance:70, tth:40, sacrifice:40, eligible:80, pensionE:4, pensionER:3, usage:16, renewal:9, mix:[70,10,20] },
  { key:"Construction", attr:22, attrRange:[18,28], stress:36, acceptance:72, tth:45, sacrifice:40, eligible:75, pensionE:4, pensionER:3, usage:16, renewal:9, mix:[72,10,18] },
  { key:"Financial Services", attr:14, attrRange:[10,18], stress:22, acceptance:80, tth:65, sacrifice:65, eligible:70, pensionE:7, pensionER:5, usage:30, renewal:6, mix:[30,25,45] },
  { key:"Public Sector (General)", attr:10, attrRange:[8,14], stress:24, acceptance:75, tth:75, sacrifice:55, eligible:80, pensionE:6, pensionER:6, usage:20, renewal:7, mix:[55,18,27] },
  { key:"Energy & Utilities", attr:14, attrRange:[10,18], stress:24, acceptance:78, tth:60, sacrifice:55, eligible:70, pensionE:6, pensionER:4, usage:24, renewal:7, mix:[45,18,37] },
  { key:"Charity / Non-profit", attr:18, attrRange:[14,24], stress:34, acceptance:74, tth:55, sacrifice:45, eligible:80, pensionE:5, pensionER:3, usage:18, renewal:8, mix:[60,15,25] },
  { key:"Media & Creative", attr:22, attrRange:[16,28], stress:32, acceptance:76, tth:50, sacrifice:50, eligible:75, pensionE:5, pensionER:3, usage:22, renewal:8, mix:[45,18,37] },
  { key:"Real Estate", attr:18, attrRange:[14,24], stress:28, acceptance:76, tth:55, sacrifice:50, eligible:70, pensionE:5, pensionER:3, usage:22, renewal:8, mix:[50,20,30] },
  { key:"Automotive", attr:18, attrRange:[14,24], stress:34, acceptance:74, tth:45, sacrifice:45, eligible:75, pensionE:5, pensionER:3, usage:18, renewal:9, mix:[65,12,23] },
  { key:"Telecoms", attr:16, attrRange:[12,22], stress:26, acceptance:78, tth:60, sacrifice:55, eligible:70, pensionE:6, pensionER:4, usage:24, renewal:7, mix:[45,18,37] },
  { key:"Pharma / Life Sciences", attr:14, attrRange:[10,18], stress:22, acceptance:82, tth:65, sacrifice:60, eligible:70, pensionE:7, pensionER:5, usage:28, renewal:6, mix:[35,20,45] },
  { key:"Agriculture", attr:20, attrRange:[14,28], stress:40, acceptance:70, tth:45, sacrifice:35, eligible:80, pensionE:4, pensionER:3, usage:14, renewal:9, mix:[75,8,17] },
];

const REGIONS = {
  uk:      { label:"UK average", attrMul: 1.00, tthMul: 1.00, acceptMul: 1.00 },
  london:  { label:"London (tighter market)", attrMul: 1.08, tthMul: 1.10, acceptMul: 0.96 },
  se:      { label:"South East", attrMul: 1.05, tthMul: 1.05, acceptMul: 0.98 },
  midlands:{ label:"Midlands", attrMul: 0.98, tthMul: 0.98, acceptMul: 1.01 },
  north:   { label:"North", attrMul: 0.97, tthMul: 0.98, acceptMul: 1.02 },
  scotland:{ label:"Scotland", attrMul: 0.97, tthMul: 1.00, acceptMul: 1.01 },
  wales:   { label:"Wales", attrMul: 0.96, tthMul: 0.98, acceptMul: 1.02 },
  ni:      { label:"Northern Ireland", attrMul: 0.95, tthMul: 0.98, acceptMul: 1.02 },
};

const KEYWORDS = [
  "national insurance","hmrc","tax","salary sacrifice",
  "pension","auto-enrol","auto enrol","workplace pension",
  "pay","wage","minimum wage","living wage","inflation","cpi",
  "employment law","tribunal","redundancy","layoff","hiring",
  "benefits","wellbeing","absence","sick","workforce","labour","labor"
];

const FEEDS = [
  { name: "ONS", url: "https://www.ons.gov.uk/feeds/latestnews.xml" },
  { name: "HMRC", url: "https://www.gov.uk/government/organisations/hm-revenue-customs.atom" },
  { name: "UK Gov", url: "https://www.gov.uk/government/topical-events.atom" },
  { name: "Bank of England", url: "https://www.bankofengland.co.uk/rss/news" }
];

const $ = (id) => document.getElementById(id);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const pct01 = (x) => clamp(Number(x || 0), 0, 100) / 100;

function fmtGBP(n){
  const v = Math.round(n);
  return "£" + v.toLocaleString("en-GB");
}
function fmtInt(n){
  return Math.round(n).toLocaleString("en-GB");
}

function getState(){
  const saved = JSON.parse(localStorage.getItem("wel_state") || "null");
  if (saved) return saved;

  // defaults
  return {
    industry: "Healthcare & Social Care",
    region: "uk",
    headcount: 250,
    salary: 32000,

    mixFrontline: 70,
    mixManagers: 10,
    mixSpecialists: 20,

    attritionRate: 26,
    replFrontline: 30,
    replManagers: 60,
    replSpecialists: 90,

    targetGrowth: 25,
    acceptanceRate: 70,
    timeToHire: 45,
    recruitCostPct: 8,

    sacrificeUptake: 45,
    eligiblePct: 75,
    niRate: 13.8,
    avgSacrificePct: 6,

    pensionEmployee: 5,
    pensionEmployer: 3,
    pensionTarget: 12,
    retireYears: 25,

    benefitUsage: 18,
    renewalIncrease: 8,
    valuePerUser: 120,
    benefitEligiblePct: 85,

    // scenario
    improveRetentionPP: 1.0,
    improveProductivityPct: 5,
    improveSacrificePP: 5,
    improveEngagementPP: 8
  };
}

function setState(next){
  localStorage.setItem("wel_state", JSON.stringify(next));
}

function selectedIndustry(state){
  return INDUSTRIES.find(x => x.key === state.industry) || INDUSTRIES[0];
}
function selectedRegion(state){
  return REGIONS[state.region] || REGIONS.uk;
}

function normalisedMix(state){
  let f = clamp(Number(state.mixFrontline || 0), 0, 100);
  let m = clamp(Number(state.mixManagers || 0), 0, 100);
  let s = clamp(Number(state.mixSpecialists || 0), 0, 100);
  const total = f + m + s;
  if (total <= 0) return { f:0.60, m:0.15, s:0.25, total:100 };
  return { f:f/total, m:m/total, s:s/total, total };
}

function scoreFromRisk(risk, low, high){
  const t = (risk - low) / (high - low);
  return Math.round(100 * (1 - clamp(t, 0, 1)));
}

function compute(state){
  const ind = selectedIndustry(state);
  const reg = selectedRegion(state);

  const headcount = Math.max(1, Number(state.headcount || 1));
  const salary = Math.max(0, Number(state.salary || 0));
  const payroll = headcount * salary;

  const mix = normalisedMix(state);

  // retention
  const attrRateRaw = clamp(Number(state.attritionRate || 0), 0, 100) / 100;
  const attrRate = clamp(attrRateRaw * reg.attrMul, 0, 1);

  const replF = clamp(Number(state.replFrontline || 0), 0, 300) / 100;
  const replM = clamp(Number(state.replManagers || 0), 0, 300) / 100;
  const replS = clamp(Number(state.replSpecialists || 0), 0, 300) / 100;

  const roleAttrF = attrRate * 1.10;
  const roleAttrM = attrRate * 0.90;
  const roleAttrS = attrRate * 0.95;

  const salF = salary * 0.85;
  const salM = salary * 1.30;
  const salS = salary * 1.60;

  const hcF = headcount * mix.f;
  const hcM = headcount * mix.m;
  const hcS = headcount * mix.s;

  const leaversF = hcF * roleAttrF;
  const leaversM = hcM * roleAttrM;
  const leaversS = hcS * roleAttrS;

  const costF = leaversF * (salF * replF);
  const costM = leaversM * (salM * replM);
  const costS = leaversS * (salS * replS);

  const annualLeavers = leaversF + leaversM + leaversS;
  const annualAttrCost = costF + costM + costS;

  // attraction & scaling
  const targetGrowth = Math.max(0, Number(state.targetGrowth || 0));
  const acceptance = clamp(Number(state.acceptanceRate || 0), 1, 100) / 100;
  const acceptanceAdj = clamp(acceptance * reg.acceptMul, 0.2, 0.98);

  const tth = Math.max(1, Number(state.timeToHire || 1));
  const tthAdj = Math.max(1, tth * reg.tthMul);

  const hiresNeeded = targetGrowth + annualLeavers;
  const speedFactor = clamp(45 / tthAdj, 0.30, 1.15);
  const realisedHires = hiresNeeded * acceptanceAdj * speedFactor;
  const netGrowthRealised = Math.max(0, realisedHires - annualLeavers);
  const growthShortfall = Math.max(0, targetGrowth - netGrowthRealised);

  const recruitCostPct = clamp(Number(state.recruitCostPct || 0), 0, 50) / 100;
  const recruitCost = realisedHires * (salary * recruitCostPct);
  const capacityCost = growthShortfall * salary * 0.30;

  // NI gap
  const sacrificeUptake = pct01(state.sacrificeUptake);
  const eligiblePct = pct01(state.eligiblePct);
  const niRate = clamp(Number(state.niRate || 13.8), 0, 30) / 100;
  const avgSacPct = clamp(Number(state.avgSacrificePct || 6), 0, 25) / 100;

  const eligibleEmployees = headcount * eligiblePct;
  const notUsing = eligibleEmployees * (1 - sacrificeUptake);
  const avgSacAmt = salary * avgSacPct;
  const annualNiGap = notUsing * avgSacAmt * niRate;

  // pension proxy
  const pensionE = clamp(Number(state.pensionEmployee || 0), 0, 40) / 100;
  const pensionER = clamp(Number(state.pensionEmployer || 0), 0, 40) / 100;
  const pensionTarget = clamp(Number(state.pensionTarget || 12), 0, 40) / 100;
  const retireYears = clamp(Number(state.retireYears || 25), 1, 50);

  const totalPension = pensionE + pensionER;
  const pensionGapRate = Math.max(0, pensionTarget - totalPension);
  const pensionExposure = payroll * pensionGapRate * (retireYears / 25) * 0.35;

  // benefits engagement
  const usage = pct01(state.benefitUsage);
  const renewal = clamp(Number(state.renewalIncrease || 0), 0, 100) / 100;
  const valuePerUser = Math.max(0, Number(state.valuePerUser || 0));
  const benefitEligiblePct = pct01(state.benefitEligiblePct);

  const eligibleUsers = headcount * benefitEligiblePct;
  const engagedUsers = eligibleUsers * usage;
  const valueCaptured = engagedUsers * valuePerUser * (1 - (renewal * 0.25));
  const engagementRisk = (1 - usage) * (0.65 + renewal * 0.85);

  // composite score
  const scoreRetention = scoreFromRisk(attrRate, 0.10, 0.40);
  const scoreGrowth = scoreFromRisk(growthShortfall / Math.max(1, targetGrowth || 1), 0.05, 0.70);
  const scoreNI = scoreFromRisk(annualNiGap / Math.max(1, payroll * 0.005), 0.3, 5.0);
  const scorePension = scoreFromRisk(pensionGapRate, 0.00, 0.06);
  const scoreBenefits = scoreFromRisk(engagementRisk, 0.20, 1.20);

  const engagementScore =
    Math.round(scoreRetention * 0.30 +
               scoreGrowth   * 0.20 +
               scoreBenefits * 0.20 +
               scoreNI       * 0.15 +
               scorePension  * 0.15);

  // scenario impact
  const improveRetentionPP = clamp(Number(state.improveRetentionPP || 0), 0, 3) / 100;
  const newAttrRate = Math.max(0, attrRate - improveRetentionPP);

  const newAttrCost =
    (hcF * (newAttrRate * 1.10)) * (salF * replF) +
    (hcM * (newAttrRate * 0.90)) * (salM * replM) +
    (hcS * (newAttrRate * 0.95)) * (salS * replS);

  const retentionSavings = Math.max(0, annualAttrCost - newAttrCost);

  const improveProd = clamp(Number(state.improveProductivityPct || 0), 0, 15) / 100;
  const stressPct = (ind.stress || 30) / 100;
  const hoursLostPerWeek = 1.0 * stressPct;
  const hourlyRate = salary / (52 * 37.5);
  const productivityLeak = headcount * hoursLostPerWeek * 52 * hourlyRate;
  const productivitySavings = productivityLeak * improveProd;

  const improveSacPP = clamp(Number(state.improveSacrificePP || 0), 0, 20) / 100;
  const newSacUptake = clamp(sacrificeUptake + improveSacPP, 0, 1);
  const extraUsing = eligibleEmployees * (newSacUptake - sacrificeUptake);
  const niSavings = Math.max(0, extraUsing * avgSacAmt * niRate);

  const improveEngPP = clamp(Number(state.improveEngagementPP || 0), 0, 25) / 100;
  const newUsage = clamp(usage + improveEngPP, 0, 1);
  const lift = Math.max(0, newUsage - usage);
  const engagementSavings = (annualAttrCost * 0.006) * (lift * 4) + (eligibleUsers * valuePerUser * lift * 0.15);

  const totalImpact = retentionSavings + productivitySavings + niSavings + engagementSavings;

  return {
    ind, reg,
    headcount, salary, payroll,
    mix,
    attrRate: attrRate * 100,
    annualLeavers,
    annualAttrCost,
    targetGrowth, netGrowthRealised, growthShortfall, recruitCost, capacityCost,
    annualNiGap, notUsing,
    pensionExposure, pensionGapRate: pensionGapRate * 100,
    eligibleUsers, engagedUsers, valueCaptured, engagementRisk,
    engagementScore: clamp(engagementScore, 0, 100),
    totalImpact, retentionSavings, productivitySavings, niSavings, engagementSavings,
  };
}

// UI helpers
function setActiveNav(){
  const path = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  document.querySelectorAll(".nav a").forEach(a => {
    const href = (a.getAttribute("href") || "").toLowerCase();
    if (href === path) a.classList.add("active");
  });
}

function fillCommonSelectors(state){
  // industry selector
  const indSel = $("industry");
  if (indSel && indSel.options.length === 0){
    for (const ind of INDUSTRIES){
      const opt = document.createElement("option");
      opt.value = ind.key;
      opt.textContent = ind.key;
      indSel.appendChild(opt);
    }
  }
  if (indSel) indSel.value = state.industry;

  // region selector
  const regSel = $("region");
  if (regSel && regSel.options.length === 0){
    Object.entries(REGIONS).forEach(([key, obj]) => {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = obj.label;
      regSel.appendChild(opt);
    });
  }
  if (regSel) regSel.value = state.region;

  const hc = $("headcount"); if (hc) hc.value = state.headcount;
  const sal = $("salary"); if (sal) sal.value = state.salary;
}

function bindCommonInputs(){
  const ids = ["industry","region","headcount","salary"];
  ids.forEach(id => {
    const el = $(id);
    if (!el) return;
    el.addEventListener("input", () => {
      const state = getState();
      state.industry = $("industry")?.value ?? state.industry;
      state.region = $("region")?.value ?? state.region;
      state.headcount = Number($("headcount")?.value ?? state.headcount);
      state.salary = Number($("salary")?.value ?? state.salary);

      // if headcount changed and targetGrowth approx old default, update gently
      const suggested = Math.round(Math.max(1, state.headcount) * 0.10);
      if (Math.abs((state.targetGrowth || suggested) - suggested) <= 2) state.targetGrowth = suggested;

      setState(state);
      render();
    });
  });
}

function bindInputToState(id, key, num=true){
  const el = $(id);
  if (!el) return;
  el.addEventListener("input", () => {
    const state = getState();
    state[key] = num ? Number(el.value) : el.value;
    setState(state);
    render();
  });
}

function renderCommonKPIs(calc){
  const score = $("engagementScore");
  if (score) score.textContent = String(calc.engagementScore);

  const totalImpact = $("totalImpact");
  if (totalImpact) totalImpact.textContent = fmtGBP(calc.totalImpact);

  const totalImpactNote = $("totalImpactNote");
  if (totalImpactNote){
    totalImpactNote.textContent =
      `Retention ${fmtGBP(calc.retentionSavings)} + Productivity ${fmtGBP(calc.productivitySavings)} + NI ${fmtGBP(calc.niSavings)} + Engagement ${fmtGBP(calc.engagementSavings)}.`;
  }
}

// Page renders
function renderHome(calc, state){
  const k1 = $("kpiAttrCost");
  const k1n = $("kpiAttrNote");
  if (k1) k1.textContent = fmtGBP(calc.annualAttrCost);
  if (k1n) k1n.textContent = `~${fmtInt(calc.annualLeavers)} leavers/year (role-adjusted).`;

  const k2 = $("kpiGrowthDrag");
  const k2n = $("kpiGrowthNote");
  if (k2) k2.textContent = `${fmtInt(calc.growthShortfall)} roles`;
  if (k2n) k2n.textContent = `Recruiting proxy ${fmtGBP(calc.recruitCost)} + capacity leakage ${fmtGBP(calc.capacityCost)}.`;

  const k3 = $("kpiNiGap");
  const k3n = $("kpiNiNote");
  if (k3) k3.textContent = fmtGBP(calc.annualNiGap);
  if (k3n) k3n.textContent = `${fmtInt(calc.notUsing)} eligible employees not using salary sacrifice (proxy).`;

  const k4 = $("kpiPensionGap");
  const k4n = $("kpiPensionNote");
  if (k4) k4.textContent = fmtGBP(calc.pensionExposure);
  if (k4n) k4n.textContent = `Gap proxy: ${calc.pensionGapRate.toFixed(1)}pp vs target.`;

  // scenario sliders
  const r = $("improveRetentionPP");
  const p = $("improveProductivityPct");
  const s = $("improveSacrificePP");
  const e = $("improveEngagementPP");
  if (r) r.value = state.improveRetentionPP;
  if (p) p.value = state.improveProductivityPct;
  if (s) s.value = state.improveSacrificePP;
  if (e) e.value = state.improveEngagementPP;

  const rv = $("improveRetentionPPVal"); if (rv) rv.textContent = `${Number(state.improveRetentionPP).toFixed(1)}pp`;
  const pv = $("improveProductivityPctVal"); if (pv) pv.textContent = `${Number(state.improveProductivityPct)}%`;
  const sv = $("improveSacrificePPVal"); if (sv) sv.textContent = `${Number(state.improveSacrificePP)}pp`;
  const ev = $("improveEngagementPPVal"); if (ev) ev.textContent = `${Number(state.improveEngagementPP)}pp`;

  // bind once
  bindInputToState("improveRetentionPP","improveRetentionPP",true);
  bindInputToState("improveProductivityPct","improveProductivityPct",true);
  bindInputToState("improveSacrificePP","improveSacrificePP",true);
  bindInputToState("improveEngagementPP","improveEngagementPP",true);

  const copyBtn = $("copySummary");
  if (copyBtn && !copyBtn.dataset.bound){
    copyBtn.dataset.bound = "1";
    copyBtn.addEventListener("click", async () => {
      const lines = [
        `Workforce Economics Lab — Summary`,
        ``,
        `Inputs`,
        `- Industry: ${calc.ind.key}`,
        `- Region: ${calc.reg.label}`,
        `- Headcount: ${calc.headcount.toLocaleString("en-GB")}`,
        `- Avg salary: £${Math.round(calc.salary).toLocaleString("en-GB")}`,
        ``,
        `Current exposure (12 months)`,
        `- Engagement score: ${calc.engagementScore}/100`,
        `- Attrition leakage: ${fmtGBP(calc.annualAttrCost)} (~${fmtInt(calc.annualLeavers)} leavers/year)`,
        `- Hiring drag: ${fmtInt(calc.growthShortfall)} roles (recruiting ${fmtGBP(calc.recruitCost)} + capacity ${fmtGBP(calc.capacityCost)})`,
        `- NI optimisation gap: ${fmtGBP(calc.annualNiGap)}`,
        `- Pension gap (proxy): ${fmtGBP(calc.pensionExposure)}`,
        ``,
        `Improvement scenario (12 months)`,
        `- Estimated impact: ${fmtGBP(calc.totalImpact)} (${fmtGBP(calc.retentionSavings)} retention + ${fmtGBP(calc.productivitySavings)} productivity + ${fmtGBP(calc.niSavings)} NI + ${fmtGBP(calc.engagementSavings)} engagement)`,
        ``,
        `Note: Benchmarking model for prioritisation (not a prediction).`
      ];
      try{
        await navigator.clipboard.writeText(lines.join("\n"));
        const st = $("summaryStatus"); if (st) st.textContent = "Copied.";
        setTimeout(()=>{ const st = $("summaryStatus"); if (st) st.textContent=""; }, 1500);
      }catch{
        const st = $("summaryStatus"); if (st) st.textContent = "Copy failed.";
      }
    });
  }

  const printBtn = $("printView");
  if (printBtn && !printBtn.dataset.bound){
    printBtn.dataset.bound = "1";
    printBtn.addEventListener("click", () => window.print());
  }
}

function renderRetention(calc, state){
  // inputs
  const ids = [
    ["mixFrontline","mixFrontline"],["mixManagers","mixManagers"],["mixSpecialists","mixSpecialists"],
    ["attritionRate","attritionRate"],
    ["replFrontline","replFrontline"],["replManagers","replManagers"],["replSpecialists","replSpecialists"]
  ];
  ids.forEach(([id,key])=>{
    const el = $(id); if (el) el.value = state[key];
    bindInputToState(id, key, true);
  });

  const mixHint = $("mixHint");
  if (mixHint){
    mixHint.textContent = Math.abs(calc.mix.total - 100) < 0.01
      ? "Role mix totals 100%."
      : `Role mix totals ${calc.mix.total.toFixed(0)}%. Model normalises internally.`;
  }

  const retHint = $("retentionHint");
  if (retHint){
    retHint.textContent = `Benchmark for ${calc.ind.key}: ${calc.ind.attrRange[0]}–${calc.ind.attrRange[1]}% (region modifier applied).`;
  }

  const k1 = $("ret_leavers"); if (k1) k1.textContent = fmtInt(calc.annualLeavers);
  const k2 = $("ret_cost"); if (k2) k2.textContent = fmtGBP(calc.annualAttrCost);
}

function renderAttraction(calc, state){
  const ids = [
    ["targetGrowth","targetGrowth"],
    ["acceptanceRate","acceptanceRate"],
    ["timeToHire","timeToHire"],
    ["recruitCostPct","recruitCostPct"]
  ];
  ids.forEach(([id,key])=>{
    const el = $(id); if (el) el.value = state[key];
    bindInputToState(id, key, true);
  });

  const k1 = $("att_hiresNeeded"); if (k1) k1.textContent = fmtInt(calc.targetGrowth + calc.annualLeavers);
  const k2 = $("att_shortfall"); if (k2) k2.textContent = fmtInt(calc.growthShortfall);
  const k3 = $("att_recruit"); if (k3) k3.textContent = fmtGBP(calc.recruitCost);
  const k4 = $("att_capacity"); if (k4) k4.textContent = fmtGBP(calc.capacityCost);
}

function renderEconomics(calc, state){
  const ids = [
    ["sacrificeUptake","sacrificeUptake"],
    ["eligiblePct","eligiblePct"],
    ["niRate","niRate"],
    ["avgSacrificePct","avgSacrificePct"],
    ["pensionEmployee","pensionEmployee"],
    ["pensionEmployer","pensionEmployer"],
    ["pensionTarget","pensionTarget"],
    ["retireYears","retireYears"],
    ["benefitUsage","benefitUsage"],
    ["renewalIncrease","renewalIncrease"],
    ["valuePerUser","valuePerUser"],
    ["benefitEligiblePct","benefitEligiblePct"]
  ];
  ids.forEach(([id,key])=>{
    const el = $(id); if (el) el.value = state[key];
    bindInputToState(id, key, true);
  });

  const ni1 = $("eco_ni_gap"); if (ni1) ni1.textContent = fmtGBP(calc.annualNiGap);
  const ni2 = $("eco_ni_users"); if (ni2) ni2.textContent = fmtInt(calc.notUsing);

  const p1 = $("eco_pension_gap"); if (p1) p1.textContent = fmtGBP(calc.pensionExposure);
  const p2 = $("eco_pension_pp"); if (p2) p2.textContent = `${calc.pensionGapRate.toFixed(1)}pp`;

  const b1 = $("eco_value"); if (b1) b1.textContent = fmtGBP(calc.valueCaptured);
  const b2 = $("eco_engaged"); if (b2) b2.textContent = fmtInt(calc.engagedUsers);
}

function relevant(title){
  const t = (title || "").toLowerCase();
  return KEYWORDS.some(k => t.includes(k));
}
async function fetchFeed(feedUrl){
  const proxied = `https://api.allorigins.win/raw?url=${encodeURIComponent(feedUrl)}`;
  const res = await fetch(proxied, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}
function parseRss(xmlText){
  const doc = new DOMParser().parseFromString(xmlText, "text/xml");
  const items = Array.from(doc.querySelectorAll("item")).map(x => ({
    title: x.querySelector("title")?.textContent?.trim() || "Untitled",
    link: x.querySelector("link")?.textContent?.trim() || "",
    date: x.querySelector("pubDate")?.textContent?.trim() || ""
  }));
  if (items.length) return items;

  return Array.from(doc.querySelectorAll("entry")).map(x => ({
    title: x.querySelector("title")?.textContent?.trim() || "Untitled",
    link: x.querySelector("link")?.getAttribute("href") || "",
    date: x.querySelector("updated")?.textContent?.trim()
      || x.querySelector("published")?.textContent?.trim() || ""
  }));
}
function renderNews(items){
  const list = $("newsList");
  if (!list) return;
  list.innerHTML = "";
  if (!items.length){
    list.innerHTML = `<div class="news-item"><div class="muted">No relevant items found right now. Try refresh.</div></div>`;
    return;
  }
  for (const it of items.slice(0, 12)){
    const div = document.createElement("div");
    div.className = "news-item";
    const date = it.date ? new Date(it.date).toLocaleDateString("en-GB") : "";
    div.innerHTML = `
      <a href="${it.link || "#"}" target="_blank" rel="noreferrer">${it.title}</a>
      <div class="news-meta"><span>${it.feedName}</span><span>${date}</span></div>
    `;
    list.appendChild(div);
  }
}
async function refreshNews(){
  const status = $("newsStatus");
  if (status) status.textContent = "Loading…";
  const all = [];
  let ok = 0;

  for (const f of FEEDS){
    try{
      const xml = await fetchFeed(f.url);
      const items = parseRss(xml).filter(x => relevant(x.title)).slice(0, 10)
        .map(x => ({...x, feedName: f.name}));
      all.push(...items);
      ok += 1;
    }catch{
      // skip blocked feeds
    }
  }
  all.sort((a,b) => (new Date(b.date).getTime()||0) - (new Date(a.date).getTime()||0));
  renderNews(all);
  if (status) status.textContent = ok ? `Updated (${ok}/${FEEDS.length} feeds).` : `Feeds blocked (try refresh later).`;
}

function render(){
  const state = getState();
  const calc = compute(state);

  setActiveNav();
  renderCommonKPIs(calc);

  const page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  if (page === "index.html" || page === "") renderHome(calc, state);
  if (page === "retention.html") renderRetention(calc, state);
  if (page === "attraction.html") renderAttraction(calc, state);
  if (page === "economics.html") renderEconomics(calc, state);
  if (page === "news.html") {
    const btn = $("refreshNews");
    if (btn && !btn.dataset.bound){
      btn.dataset.bound = "1";
      btn.addEventListener("click", refreshNews);
    }
    refreshNews();
  }
}

function init(){
  const state = getState();

  fillCommonSelectors(state);
  bindCommonInputs();

  // pages that have their own inputs will bind in renderX
  render();

  // Also bind any common selectors if present later
  document.addEventListener("DOMContentLoaded", render);
}

window.addEventListener("load", init);
