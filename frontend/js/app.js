// PowerSaver Main Controller - Supporting Dribbble Layout & Creative UX Animations

import { API } from './api.js';
import { ChartManager } from './charts.js';

const state = {
    currentProperty: null,
    currentMeter: null,
    properties: [],
    meters: [],
    anomalies: [],
    alerts: [],
    readings: [],
    tariff: null,
    appliances: null,
    activeTab: 'dashboard'
};

// --- Easing Helper for Smooth Rolling Numbers ---
function animateNumber(element, start, end, duration = 800, formatFn = (n) => n.toString()) {
    if (!element) return;
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease Out Cubic
        const ease = 1 - Math.pow(1 - progress, 3);
        const current = start + (end - start) * ease;
        element.textContent = formatFn(current);

        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.textContent = formatFn(end);
        }
    }

    requestAnimationFrame(update);
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    initTabs();
    initWorkflowStepper();
    initModals();
    initForms();
    await loadProperties();
    if (window.lucide) {
        window.lucide.createIcons();
    }
});

// --- Tab Management with Creative Transition ---
function initTabs() {
    const tabs = document.querySelectorAll('[data-tab-target]');
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            const target = tab.getAttribute('data-tab-target');
            switchTab(target);
        });
    });
}

// --- Interactive UX Guided Stepper ---
function initWorkflowStepper() {
    document.querySelectorAll('[data-stepper-target]').forEach(step => {
        step.addEventListener('click', () => {
            const targetTab = step.getAttribute('data-stepper-target');
            switchTab(targetTab);
        });
    });
}

function updateStepperActiveState(tabId) {
    document.querySelectorAll('[data-stepper-target]').forEach(step => {
        const isMatch = step.getAttribute('data-stepper-target') === tabId;
        step.classList.toggle('border-blue-500', isMatch);
        step.classList.toggle('bg-blue-50/70', isMatch);
        step.classList.toggle('text-blue-700', isMatch);
        step.classList.toggle('border-slate-200', !isMatch);
        step.classList.toggle('text-slate-600', !isMatch);
    });
}

export function switchTab(tabId) {
    state.activeTab = tabId;

    // Trigger Energy Flow line burst
    const flowLine = document.querySelector('.energy-telemetry-bar');
    if (flowLine) {
        flowLine.style.animation = 'none';
        flowLine.offsetHeight; // trigger reflow
        flowLine.style.animation = 'energyFlow 2.4s linear infinite';
    }

    // Update sidebar navigation pills
    document.querySelectorAll('[data-tab-target]').forEach(btn => {
        const isTarget = btn.getAttribute('data-tab-target') === tabId;
        btn.classList.toggle('nav-item-active', isTarget);
        btn.classList.toggle('text-slate-600', !isTarget);
        btn.classList.toggle('hover:bg-slate-50', !isTarget);
    });

    // Update active tab content with smooth slide-fade
    document.querySelectorAll('.tab-content').forEach(content => {
        const isTarget = content.id === `tab-${tabId}`;
        content.classList.toggle('active', isTarget);
    });

    // Update Guided Stepper
    updateStepperActiveState(tabId);

    if (tabId === 'dashboard') loadDashboard();
    if (tabId === 'readings') loadReadingsTab();
    if (tabId === 'tariffs') loadTariffTab();
    if (tabId === 'appliances') loadAppliancesTab();
    if (tabId === 'forecast') loadForecastTab();

    setTimeout(() => {
        if (window.lucide) window.lucide.createIcons();
    }, 60);
}

// --- Data Loaders ---
async function loadProperties() {
    try {
        state.properties = await API.getProperties();
        const selector = document.getElementById('property-selector');
        if (selector) {
            selector.innerHTML = '';
            if (state.properties.length === 0) {
                const def = await API.createProperty({ name: 'My Home', property_type: 'residential', sanctioned_load_kw: 3.0 });
                state.properties = [def];
            }

            state.properties.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = `${p.name} (${p.property_type.toUpperCase()} • ${p.sanctioned_load_kw} kW)`;
                selector.appendChild(opt);
            });

            state.currentProperty = state.properties[0];
            await onPropertySelected(state.currentProperty.id);

            selector.addEventListener('change', async (e) => {
                const p = state.properties.find(item => item.id === e.target.value);
                if (p) {
                    state.currentProperty = p;
                    await onPropertySelected(p.id);
                }
            });
        }
    } catch (err) {
        showToast('Error loading properties: ' + (err.detail || err.message), 'error');
    }
}

async function onPropertySelected(propertyId) {
    try {
        state.meters = await API.getMeters(propertyId);
        state.currentMeter = state.meters[0] || null;
        await loadDashboard();
    } catch (err) {
        console.error(err);
    }
}

// --- Dashboard View with Rolling Numbers ---
async function loadDashboard() {
    if (!state.currentProperty || !state.currentMeter) return;

    try {
        const [trends, comparison, forecast, alerts, appliances] = await Promise.all([
            API.getTrends(state.currentMeter.id),
            API.getHistoricalComparison(state.currentMeter.id),
            API.getForecast(state.currentProperty.id, state.currentMeter.id),
            API.getAlerts(state.currentProperty.id),
            API.getAppliances(state.currentProperty.id)
        ]);

        state.anomalies = forecast.anomalies || [];
        state.alerts = alerts || [];
        state.readings = trends.daily || [];

        // 1. KPI Cards with Smooth Rolling Numbers Animation
        const billEl = document.getElementById('kpi-est-bill');
        if (billEl) {
            const targetBill = Math.round(forecast.projected_bill_expected_inr);
            animateNumber(billEl, 0, targetBill, 900, (n) => `₹${Math.round(n).toLocaleString()}`);
        }

        const unitsEl = document.getElementById('kpi-units-val');
        if (unitsEl) {
            const targetUnits = forecast.mtd_actual_kwh;
            animateNumber(unitsEl, 0, targetUnits, 800, (n) => `${n.toFixed(1)} kWh`);
        }

        const spikesEl = document.getElementById('kpi-spikes-val');
        if (spikesEl) {
            spikesEl.textContent = `${state.anomalies.length} Spikes`;
        }

        // Percentages & trends
        const wow = comparison.week_over_week;
        const wowPctEl = document.getElementById('kpi-wow-pct');
        if (wowPctEl && wow) {
            wowPctEl.textContent = `${wow.trend === 'UP' ? '+' : ''}${wow.percentage_change}%`;
            wowPctEl.className = `text-[11px] font-bold px-2 py-0.5 rounded-md ${wow.trend === 'UP' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`;
        }

        // 2. Render Dribbble Dual-Line Hero Chart
        ChartManager.renderHeroChart('chart-hero-consumption', trends.daily, state.anomalies);

        // 3. Render Slab Target Radial Gauge (88% style in Dribbble)
        ChartManager.renderSlabTargetGauge('chart-slab-gauge', forecast.mtd_actual_kwh, 400);

        // 4. Update Dark Weekly Capsules (Mon - Sun)
        ChartManager.updateWeeklyCapsules(trends.daily);

        // 5. Render Recent Customer Style List (High Load Appliances)
        renderHighLoadAppliances(appliances.appliances);

        // 6. Render Bottom Table (Referrer History Style)
        renderReferrerStyleTable(trends.daily.slice(-6).reverse(), state.anomalies);

        if (window.lucide) window.lucide.createIcons();

    } catch (err) {
        console.error('Error loading dashboard:', err);
    }
}

function renderHighLoadAppliances(appliancesList) {
    const container = document.getElementById('high-load-appliances-list');
    if (!container) return;

    container.innerHTML = '';
    const topApps = [...(appliancesList || [])].sort((a, b) => b.estimated_monthly_kwh - a.estimated_monthly_kwh).slice(0, 4);

    if (topApps.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400 py-3 text-center">No appliances registered yet.</p>`;
        return;
    }

    const icons = {
        cooling: { icon: 'snowflake', bg: 'bg-blue-50 text-blue-600' },
        heating: { icon: 'flame', bg: 'bg-rose-50 text-rose-600' },
        refrigeration: { icon: 'archive', bg: 'bg-emerald-50 text-emerald-600' },
        ventilation: { icon: 'fan', bg: 'bg-amber-50 text-amber-600' },
        lighting: { icon: 'lightbulb', bg: 'bg-purple-50 text-purple-600' },
        general: { icon: 'zap', bg: 'bg-slate-100 text-slate-600' }
    };

    topApps.forEach(app => {
        const meta = icons[app.category] || icons.general;
        const row = document.createElement('div');
        row.className = 'flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 px-1 rounded-xl transition-colors';
        row.innerHTML = `
            <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-full ${meta.bg} flex items-center justify-center shrink-0">
                    <i data-lucide="${meta.icon}" class="w-4 h-4"></i>
                </div>
                <div>
                    <h5 class="text-xs font-bold text-slate-800 truncate max-w-[110px]">${app.name}</h5>
                    <span class="text-[10px] text-slate-400 font-mono">${app.rated_wattage}W • ${app.daily_hours_used}h/day</span>
                </div>
            </div>
            <div class="text-right">
                <span class="text-xs font-bold text-slate-900 font-mono">${app.estimated_monthly_kwh}</span>
                <span class="text-[10px] text-slate-400 block">kWh/mo</span>
            </div>
        `;
        container.appendChild(row);
    });

    if (window.lucide) window.lucide.createIcons();
}

function renderReferrerStyleTable(recentReadings, anomalies) {
    const tbody = document.getElementById('dash-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    const anomalySet = new Set(anomalies.map(a => a.reading_date));

    recentReadings.forEach(r => {
        const isSpike = anomalySet.has(r.reading_date);
        const tr = document.createElement('tr');
        tr.className = 'border-b border-slate-50 hover:bg-slate-50/60 transition-colors text-xs';
        tr.innerHTML = `
            <td class="py-3 px-3 font-semibold text-slate-700 font-mono">${r.reading_date}</td>
            <td class="py-3 px-3 font-mono text-slate-800">${r.cumulative_kwh.toFixed(1)} kWh</td>
            <td class="py-3 px-3 font-mono font-bold ${isSpike ? 'text-red-600' : 'text-blue-600'}">
                +${r.daily_consumption_kwh.toFixed(2)} kWh
            </td>
            <td class="py-3 px-3">
                <span class="text-[10px] font-bold px-2.5 py-0.5 rounded-full ${isSpike ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}">
                    ${isSpike ? '⚠️ Spike Alert' : '✓ Normal'}
                </span>
            </td>
            <td class="py-3 px-3 text-right">
                <button class="text-[11px] font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 px-2.5 py-1 rounded-lg transition-colors">Details ▾</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// --- Readings Tab ---
async function loadReadingsTab() {
    if (!state.currentMeter) return;
    try {
        const readings = await API.getReadings(state.currentMeter.id);
        state.readings = readings;

        const tableBody = document.getElementById('readings-table-body');
        if (!tableBody) return;
        tableBody.innerHTML = '';

        const exportBtn = document.getElementById('btn-export-csv');
        if (exportBtn) exportBtn.href = API.getExportUrl(state.currentMeter.id);

        if (readings.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-slate-400">No readings logged yet. Record your first meter reading above!</td></tr>`;
            return;
        }

        [...readings].reverse().forEach(r => {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-slate-50 hover:bg-slate-50/60 text-xs transition-colors';
            tr.innerHTML = `
                <td class="py-3 px-4 font-mono font-semibold text-slate-700">${r.reading_date}</td>
                <td class="py-3 px-4 font-mono font-bold text-blue-600">${r.cumulative_kwh.toFixed(1)} kWh</td>
                <td class="py-3 px-4 font-mono font-medium text-slate-800">${r.daily_consumption_kwh > 0 ? `+${r.daily_consumption_kwh.toFixed(2)}` : 'Baseline'}</td>
                <td class="py-3 px-4 text-slate-500">${r.days_elapsed} day(s)</td>
                <td class="py-3 px-4 text-slate-500 truncate max-w-xs">${r.notes || '—'}</td>
            `;
            tableBody.appendChild(tr);
        });

        const latest = readings[readings.length - 1];
        const inputCum = document.getElementById('input-cum-kwh');
        const helperText = document.getElementById('reading-helper-text');
        if (latest && inputCum && helperText) {
            inputCum.min = latest.cumulative_kwh;
            helperText.textContent = `Previous reading: ${latest.cumulative_kwh} kWh on ${latest.reading_date}. Entry must be ≥ ${latest.cumulative_kwh}.`;
        }
    } catch (err) {
        showToast('Error loading readings', 'error');
    }
}

// --- Tariffs Tab with Animated Slab Milestone Alerts ---
async function loadTariffTab() {
    if (!state.currentProperty) return;
    try {
        state.tariff = await API.getTariff(state.currentProperty.id);

        document.getElementById('tariff-discom-name').value = state.tariff.discom_name;
        document.getElementById('tariff-fixed-charge').value = state.tariff.fixed_charge_per_kw;
        document.getElementById('tariff-tax-pct').value = state.tariff.tax_percentage;

        renderSlabsList(state.tariff.slabs);
        await simulateTariffBill(280);
    } catch (err) {
        console.error(err);
    }
}

function renderSlabsList(slabs) {
    const container = document.getElementById('slabs-list-container');
    if (!container) return;
    container.innerHTML = '';

    slabs.forEach(s => {
        const item = document.createElement('div');
        item.className = 'flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs font-mono transition-transform hover:scale-[1.01]';
        const label = s.max_units ? `Slab ${s.min_units} - ${s.max_units} units` : `Slab ${s.min_units}+ units`;
        item.innerHTML = `
            <span class="font-semibold text-slate-700">${label}</span>
            <span class="text-blue-600 font-bold">₹${s.rate_per_unit.toFixed(2)} / unit</span>
        `;
        container.appendChild(item);
    });
}

async function simulateTariffBill(units) {
    try {
        const calc = await API.calculateBill(state.currentProperty.id, units);
        document.getElementById('sim-energy-charges').textContent = `₹${calc.energy_charges.toFixed(2)}`;
        document.getElementById('sim-fixed-charges').textContent = `₹${calc.fixed_charges.toFixed(2)}`;
        document.getElementById('sim-duty-tax').textContent = `₹${calc.electricity_duty_tax.toFixed(2)}`;
        document.getElementById('sim-total-bill').textContent = `₹${calc.total_estimated_bill.toFixed(2)}`;

        // Dynamic Slab Milestone Warning Pill
        const milestonePill = document.getElementById('slab-milestone-pill');
        if (milestonePill) {
            if (units <= 100) {
                milestonePill.className = 'text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 transition-all';
                milestonePill.textContent = '✓ Slab 1 Active (Base Rate: ₹3.50/unit)';
            } else if (units <= 200) {
                milestonePill.className = 'text-xs font-bold px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 transition-all';
                milestonePill.textContent = '⚡ Slab 2 Active (Tier Rate: ₹5.50/unit)';
            } else if (units <= 400) {
                milestonePill.className = 'text-xs font-bold px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 transition-all';
                milestonePill.textContent = '⚠️ Slab 3 Crossed! (Surge Rate: ₹7.50/unit)';
            } else {
                milestonePill.className = 'text-xs font-bold px-3 py-1 rounded-full bg-red-50 text-red-700 border border-red-200 animate-alert-pulse transition-all';
                milestonePill.textContent = '🚨 Heavy Slab 4 Penalty Active! (₹9.00/unit)';
            }
        }

        const breakdownContainer = document.getElementById('sim-slab-breakdown');
        if (breakdownContainer) {
            breakdownContainer.innerHTML = '';
            calc.slab_breakdown.forEach(b => {
                const row = document.createElement('div');
                row.className = 'flex items-center justify-between text-xs py-1.5 border-b border-slate-50';
                row.innerHTML = `
                    <span class="text-slate-600 font-medium">Slab ${b.slab_label} (${b.units_in_slab} units @ ₹${b.rate_per_unit}):</span>
                    <span class="font-mono font-bold text-slate-800">₹${b.amount.toFixed(2)}</span>
                `;
                breakdownContainer.appendChild(row);
            });
        }
    } catch (err) {
        console.error(err);
    }
}

// --- Appliances & Reconciliation Tab ---
async function loadAppliancesTab() {
    if (!state.currentProperty || !state.currentMeter) return;
    try {
        const [appSummary, recon] = await Promise.all([
            API.getAppliances(state.currentProperty.id),
            API.getReconciliation(state.currentProperty.id, state.currentMeter.id)
        ]);

        state.appliances = appSummary;
        ChartManager.renderApplianceDonut('chart-appliance-donut', appSummary.category_breakdown);

        document.getElementById('app-total-daily').textContent = `${appSummary.total_estimated_daily_kwh} kWh/day`;
        document.getElementById('app-total-monthly').textContent = `${appSummary.total_estimated_monthly_kwh} kWh/mo`;

        const table = document.getElementById('appliances-table-body');
        if (table) {
            table.innerHTML = '';
            appSummary.appliances.forEach(app => {
                const tr = document.createElement('tr');
                tr.className = 'border-b border-slate-50 hover:bg-slate-50/60 text-xs transition-colors';
                tr.innerHTML = `
                    <td class="py-3 px-4 font-semibold text-slate-800">${app.name}</td>
                    <td class="py-3 px-4 font-mono text-slate-600">${app.rated_wattage}W</td>
                    <td class="py-3 px-4 text-slate-600">${app.daily_hours_used} hrs</td>
                    <td class="py-3 px-4 font-mono font-bold text-blue-600">${app.estimated_monthly_kwh} kWh</td>
                    <td class="py-3 px-4 text-right">
                        <button data-delete-app="${app.id}" class="text-xs text-rose-500 hover:text-rose-700 font-semibold transition-colors">Remove</button>
                    </td>
                `;
                tr.querySelector(`[data-delete-app="${app.id}"]`).addEventListener('click', async () => {
                    await API.deleteAppliance(app.id);
                    showToast('Appliance removed from inventory', 'success');
                    loadAppliancesTab();
                });
                table.appendChild(tr);
            });
        }

        document.getElementById('recon-measured-kwh').textContent = `${recon.measured_meter_kwh} kWh`;
        document.getElementById('recon-estimated-kwh').textContent = `${recon.estimated_appliances_kwh} kWh`;
        document.getElementById('recon-diff-kwh').textContent = `${recon.unaccounted_difference_kwh > 0 ? '+' : ''}${recon.unaccounted_difference_kwh} kWh`;
        document.getElementById('recon-diagnosis-text').textContent = recon.diagnosis;

    } catch (err) {
        console.error(err);
    }
}

// --- Forecast Tab ---
async function loadForecastTab() {
    if (!state.currentProperty || !state.currentMeter) return;
    try {
        const [forecast, recommendations] = await Promise.all([
            API.getForecast(state.currentProperty.id, state.currentMeter.id),
            API.getRecommendations(state.currentProperty.id, state.currentMeter.id)
        ]);

        document.getElementById('fore-opt-bill').textContent = `₹${Math.round(forecast.projected_bill_optimistic_inr).toLocaleString()}`;
        document.getElementById('fore-opt-kwh').textContent = `${forecast.projected_total_kwh_optimistic} kWh`;

        document.getElementById('fore-exp-bill').textContent = `₹${Math.round(forecast.projected_bill_expected_inr).toLocaleString()}`;
        document.getElementById('fore-exp-kwh').textContent = `${forecast.projected_total_kwh_expected} kWh`;

        document.getElementById('fore-pes-bill').textContent = `₹${Math.round(forecast.projected_bill_pessimistic_inr).toLocaleString()}`;
        document.getElementById('fore-pes-kwh').textContent = `${forecast.projected_total_kwh_pessimistic} kWh`;

        const infTable = document.getElementById('influential-spikes-body');
        if (infTable) {
            infTable.innerHTML = '';
            if (forecast.influential_spikes && forecast.influential_spikes.length > 0) {
                forecast.influential_spikes.forEach(sp => {
                    const tr = document.createElement('tr');
                    tr.className = 'border-b border-slate-50 text-xs transition-colors hover:bg-slate-50/50';
                    tr.innerHTML = `
                        <td class="py-2.5 px-3 font-mono font-semibold text-slate-700">${sp.date}</td>
                        <td class="py-2.5 px-3 font-mono text-rose-600 font-bold">${sp.spike_kwh} kWh</td>
                        <td class="py-2.5 px-3 font-mono text-slate-500">${sp.baseline_kwh} kWh</td>
                        <td class="py-2.5 px-3 font-bold text-amber-700">${sp.estimated_bill_impact}</td>
                    `;
                    infTable.appendChild(tr);
                });
            } else {
                infTable.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-slate-400">No abnormal spike readings detected this month. Usage is stable.</td></tr>`;
            }
        }

        const recContainer = document.getElementById('recommendations-container');
        if (recContainer) {
            recContainer.innerHTML = '';
            recommendations.forEach(r => {
                const card = document.createElement('div');
                card.className = 'p-4 rounded-2xl border border-blue-100 bg-blue-50/50 flex items-start gap-3.5 hover-lift transition-all';
                card.innerHTML = `
                    <div class="p-2.5 bg-blue-600 text-white rounded-xl text-sm mt-0.5 shadow-sm">
                        <i data-lucide="lightbulb" class="w-4 h-4 text-white"></i>
                    </div>
                    <div>
                        <div class="flex items-center gap-2">
                            <h4 class="text-xs font-bold text-slate-800">${r.title}</h4>
                            <span class="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-800 font-semibold rounded-full">${r.impact}</span>
                        </div>
                        <p class="text-[11px] text-slate-600 mt-1 leading-relaxed">${r.details}</p>
                    </div>
                `;
                recContainer.appendChild(card);
            });
            if (window.lucide) window.lucide.createIcons();
        }
    } catch (err) {
        console.error(err);
    }
}

// --- Forms & Modals ---
function initForms() {
    const readingForm = document.getElementById('form-log-reading');
    if (readingForm) {
        document.getElementById('input-reading-date').value = new Date().toISOString().split('T')[0];
        readingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const date = document.getElementById('input-reading-date').value;
            const cum = parseFloat(document.getElementById('input-cum-kwh').value);
            const notes = document.getElementById('input-reading-notes').value;

            try {
                await API.logReading({
                    meter_id: state.currentMeter.id,
                    reading_date: date,
                    cumulative_kwh: cum,
                    notes: notes || null
                });
                showToast('Meter reading recorded successfully!', 'success');
                readingForm.reset();
                document.getElementById('input-reading-date').value = new Date().toISOString().split('T')[0];
                closeModal('modal-log-reading');
                loadDashboard();
                loadReadingsTab();
            } catch (err) {
                showToast(err.detail || 'Failed to log reading', 'error');
            }
        });
    }

    const simSlider = document.getElementById('sim-units-slider');
    const simInput = document.getElementById('sim-units-input');
    if (simSlider && simInput) {
        simSlider.addEventListener('input', (e) => {
            simInput.value = e.target.value;
            simulateTariffBill(parseFloat(e.target.value));
        });
        simInput.addEventListener('change', (e) => {
            simSlider.value = e.target.value;
            simulateTariffBill(parseFloat(e.target.value));
        });
    }

    const appForm = document.getElementById('form-add-appliance');
    if (appForm) {
        appForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('app-name').value;
            const watts = parseFloat(document.getElementById('app-wattage').value);
            const hours = parseFloat(document.getElementById('app-hours').value);
            const qty = parseInt(document.getElementById('app-qty').value, 10);
            const category = document.getElementById('app-category').value;

            try {
                await API.addAppliance({
                    property_id: state.currentProperty.id,
                    name,
                    rated_wattage: watts,
                    daily_hours_used: hours,
                    quantity: qty,
                    category
                });
                showToast(`Added ${name} to inventory!`, 'success');
                appForm.reset();
                closeModal('modal-add-appliance');
                loadAppliancesTab();
            } catch (err) {
                showToast(err.detail || 'Failed to add appliance', 'error');
            }
        });
    }

    document.querySelectorAll('[data-preset-app]').forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = btn.getAttribute('data-preset-app');
            const presets = {
                ac: { name: '1.5T 5-Star Split AC', watts: 1450, hours: 6.0, cat: 'cooling' },
                geyser: { name: 'Instant 25L Water Geyser', watts: 2000, hours: 1.5, cat: 'heating' },
                fridge: { name: 'Inverter Refrigerator', watts: 220, hours: 24.0, cat: 'refrigeration' },
                fan: { name: 'BLDC Ceiling Fan', watts: 32, hours: 12.0, cat: 'ventilation' }
            };
            const p = presets[preset];
            if (p) {
                document.getElementById('app-name').value = p.name;
                document.getElementById('app-wattage').value = p.watts;
                document.getElementById('app-hours').value = p.hours;
                document.getElementById('app-category').value = p.cat;
            }
        });
    });
}

function initModals() {
    document.querySelectorAll('[data-open-modal]').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-open-modal');
            openModal(target);
        });
    });

    document.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-close-modal');
            closeModal(target);
        });
    });
}

function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    const isError = type === 'error';
    toast.className = `fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl border text-xs font-semibold flex items-center gap-2 transform transition-all duration-300 ${
        isError ? 'bg-rose-600 text-white border-rose-700' : 'bg-slate-900 text-white border-slate-800'
    }`;
    toast.innerHTML = `<span>${isError ? '✕' : '✓'}</span><span>${message}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}
