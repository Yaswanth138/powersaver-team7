// PowerSaver Main Controller

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

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    initTabs();
    initModals();
    initForms();
    await loadProperties();
});

// --- Tab Management ---
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

export function switchTab(tabId) {
    state.activeTab = tabId;

    // Update buttons
    document.querySelectorAll('[data-tab-target]').forEach(btn => {
        const isTarget = btn.getAttribute('data-tab-target') === tabId;
        btn.classList.toggle('bg-blue-50', isTarget);
        btn.classList.toggle('text-blue-600', isTarget);
        btn.classList.toggle('font-semibold', isTarget);
        btn.classList.toggle('text-slate-600', !isTarget);
    });

    // Update contents
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `tab-${tabId}`);
    });

    // Refresh tab specific data if needed
    if (tabId === 'dashboard') loadDashboard();
    if (tabId === 'readings') loadReadingsTab();
    if (tabId === 'tariffs') loadTariffTab();
    if (tabId === 'appliances') loadAppliancesTab();
    if (tabId === 'forecast') loadForecastTab();
}

// --- Data Loaders ---
async function loadProperties() {
    try {
        state.properties = await API.getProperties();
        const selector = document.getElementById('property-selector');
        selector.innerHTML = '';

        if (state.properties.length === 0) {
            // Create default
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
    } catch (err) {
        showToast('Error loading properties: ' + (err.detail || err.message), 'error');
    }
}

async function onPropertySelected(propertyId) {
    try {
        state.meters = await API.getMeters(propertyId);
        state.currentMeter = state.meters[0] || null;

        // Refresh all views
        await loadDashboard();
    } catch (err) {
        console.error(err);
    }
}

// --- Dashboard View ---
async function loadDashboard() {
    if (!state.currentProperty || !state.currentMeter) return;

    try {
        const [trends, comparison, forecast, alerts] = await Promise.all([
            API.getTrends(state.currentMeter.id),
            API.getHistoricalComparison(state.currentMeter.id),
            API.getForecast(state.currentProperty.id, state.currentMeter.id),
            API.getAlerts(state.currentProperty.id)
        ]);

        state.anomalies = forecast.anomalies || [];
        state.alerts = alerts || [];

        // 1. KPI Cards
        document.getElementById('kpi-mtd-units').textContent = `${forecast.mtd_actual_kwh} kWh`;
        document.getElementById('kpi-proj-bill').textContent = `₹${Math.round(forecast.projected_bill_expected_inr).toLocaleString()}`;
        document.getElementById('kpi-bill-range').textContent = `Range: ₹${Math.round(forecast.projected_bill_optimistic_inr).toLocaleString()} – ₹${Math.round(forecast.projected_bill_pessimistic_inr).toLocaleString()}`;
        document.getElementById('kpi-active-alerts').textContent = state.alerts.length + state.anomalies.length;

        // 2. Trend comparison badge
        const wow = comparison.week_over_week;
        const trendEl = document.getElementById('kpi-trend-badge');
        if (wow && wow.prior_7_days_kwh > 0) {
            const isUp = wow.trend === 'UP';
            trendEl.className = `inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${isUp ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`;
            trendEl.innerHTML = `${isUp ? '↑' : '↓'} ${Math.abs(wow.percentage_change)}% vs last week`;
        } else {
            trendEl.className = 'hidden';
        }

        // 3. Render Daily Chart with Anomaly Highlights
        ChartManager.renderDailyChart('chart-daily-consumption', trends.daily, state.anomalies);

        // 4. Render Active Alerts Feed
        renderAlertsList();

        // 5. Render Historical Comparisons
        renderComparisonSection(comparison);

    } catch (err) {
        console.error('Error loading dashboard:', err);
    }
}

function renderAlertsList() {
    const list = document.getElementById('dashboard-alerts-list');
    list.innerHTML = '';

    const allAlerts = [];

    // System alerts from DB
    state.alerts.forEach(a => {
        allAlerts.push({
            id: a.id,
            type: a.alert_type,
            severity: a.severity,
            message: a.message,
            date: a.reading_date,
            canResolve: true
        });
    });

    // Time-series anomalies
    state.anomalies.forEach(a => {
        allAlerts.push({
            id: null,
            type: 'anomaly_spike',
            severity: a.severity,
            message: a.reason,
            date: a.reading_date,
            canResolve: false
        });
    });

    if (allAlerts.length === 0) {
        list.innerHTML = `
            <div class="p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center gap-3">
                <span class="text-emerald-600 text-lg">✓</span>
                <p class="text-sm text-emerald-800 font-medium">All clear! No unusual consumption spikes or missing readings detected.</p>
            </div>
        `;
        return;
    }

    allAlerts.forEach(alert => {
        const isHigh = alert.severity === 'HIGH';
        const item = document.createElement('div');
        item.className = `p-3.5 rounded-xl border flex items-start justify-between gap-3 ${isHigh ? 'bg-red-50/80 border-red-200' : 'bg-amber-50/80 border-amber-200'}`;
        item.innerHTML = `
            <div class="flex items-start gap-2.5">
                <span class="text-base mt-0.5">${isHigh ? '🚨' : '⚠️'}</span>
                <div>
                    <div class="flex items-center gap-2">
                        <span class="text-xs font-bold uppercase tracking-wider ${isHigh ? 'text-red-700' : 'text-amber-700'}">${alert.severity} ALERT</span>
                        ${alert.date ? `<span class="text-xs text-slate-500">• ${alert.date}</span>` : ''}
                    </div>
                    <p class="text-xs text-slate-700 mt-0.5 leading-relaxed">${alert.message}</p>
                </div>
            </div>
            ${alert.canResolve ? `
                <button data-resolve-id="${alert.id}" class="text-xs font-medium text-slate-500 hover:text-slate-800 px-2 py-1 bg-white rounded border border-slate-200 shadow-xs">Dismiss</button>
            ` : ''}
        `;

        if (alert.canResolve) {
            item.querySelector(`[data-resolve-id="${alert.id}"]`).addEventListener('click', async () => {
                await API.resolveAlert(alert.id);
                showToast('Alert resolved', 'success');
                loadDashboard();
            });
        }

        list.appendChild(item);
    });
}

function renderComparisonSection(comparison) {
    const mom = comparison.month_over_month;
    const wow = comparison.week_over_week;

    const momEl = document.getElementById('comp-mom-text');
    if (momEl) {
        if (mom.previous_month) {
            momEl.textContent = `${mom.trend === 'UP' ? '+' : ''}${mom.percentage_change}% (${mom.difference_kwh} kWh)`;
            momEl.className = `text-sm font-bold ${mom.trend === 'UP' ? 'text-red-600' : 'text-emerald-600'}`;
        } else {
            momEl.textContent = 'Awaiting 2nd month of baseline data';
            momEl.className = 'text-xs text-slate-500 italic';
        }
    }

    const wowEl = document.getElementById('comp-wow-text');
    if (wowEl) {
        wowEl.textContent = `${wow.trend === 'UP' ? '+' : ''}${wow.percentage_change}% (${wow.difference_kwh} kWh)`;
        wowEl.className = `text-sm font-bold ${wow.trend === 'UP' ? 'text-red-600' : 'text-emerald-600'}`;
    }
}

// --- Readings Tab ---
async function loadReadingsTab() {
    if (!state.currentMeter) return;
    try {
        const readings = await API.getReadings(state.currentMeter.id);
        state.readings = readings;

        const tableBody = document.getElementById('readings-table-body');
        tableBody.innerHTML = '';

        // Configure CSV export button
        const exportBtn = document.getElementById('btn-export-csv');
        exportBtn.href = API.getExportUrl(state.currentMeter.id);

        if (readings.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-slate-400">No readings logged yet. Record your first meter reading above!</td></tr>`;
            return;
        }

        // Display in reverse chronological order
        [...readings].reverse().forEach(r => {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-slate-100 hover:bg-slate-50/80 transition-colors';
            tr.innerHTML = `
                <td class="py-3 px-4 font-mono text-xs font-semibold text-slate-700">${r.reading_date}</td>
                <td class="py-3 px-4 font-mono text-sm font-bold text-blue-600">${r.cumulative_kwh.toFixed(1)} kWh</td>
                <td class="py-3 px-4 font-mono text-xs font-medium text-slate-800">${r.daily_consumption_kwh > 0 ? `+${r.daily_consumption_kwh.toFixed(2)}` : 'Baseline'}</td>
                <td class="py-3 px-4 text-xs text-slate-500">${r.days_elapsed} day(s)</td>
                <td class="py-3 px-4 text-xs text-slate-500 truncate max-w-xs">${r.notes || '—'}</td>
            `;
            tableBody.appendChild(tr);
        });

        // Set min validation on reading entry form
        const latest = readings[readings.length - 1];
        const inputCum = document.getElementById('input-cum-kwh');
        const helperText = document.getElementById('reading-helper-text');
        if (latest) {
            inputCum.min = latest.cumulative_kwh;
            helperText.textContent = `Previous recorded reading: ${latest.cumulative_kwh} kWh on ${latest.reading_date}. Entry must be ≥ ${latest.cumulative_kwh}.`;
        } else {
            helperText.textContent = `This will be your initial baseline reading.`;
        }

    } catch (err) {
        showToast('Error loading readings', 'error');
    }
}

// --- Tariffs Tab ---
async function loadTariffTab() {
    if (!state.currentProperty) return;
    try {
        state.tariff = await API.getTariff(state.currentProperty.id);

        // Pre-fill tariff config form
        document.getElementById('tariff-discom-name').value = state.tariff.discom_name;
        document.getElementById('tariff-fixed-charge').value = state.tariff.fixed_charge_per_kw;
        document.getElementById('tariff-tax-pct').value = state.tariff.tax_percentage;

        // Render Slabs list
        renderSlabsList(state.tariff.slabs);

        // Run live calculation simulator for default 280 units
        await simulateTariffBill(280);

    } catch (err) {
        console.error(err);
    }
}

function renderSlabsList(slabs) {
    const container = document.getElementById('slabs-list-container');
    container.innerHTML = '';

    slabs.forEach(s => {
        const item = document.createElement('div');
        item.className = 'flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs font-mono';
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

        // Breakdown bars
        const breakdownContainer = document.getElementById('sim-slab-breakdown');
        breakdownContainer.innerHTML = '';
        calc.slab_breakdown.forEach(b => {
            const row = document.createElement('div');
            row.className = 'flex items-center justify-between text-xs py-1 border-b border-slate-100';
            row.innerHTML = `
                <span class="text-slate-600">Slab ${b.slab_label} (${b.units_in_slab} units @ ₹${b.rate_per_unit}):</span>
                <span class="font-mono font-bold text-slate-800">₹${b.amount.toFixed(2)}</span>
            `;
            breakdownContainer.appendChild(row);
        });

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

        // Render Donut Chart
        ChartManager.renderApplianceDonut('chart-appliance-donut', appSummary.category_breakdown);

        // Totals
        document.getElementById('app-total-daily').textContent = `${appSummary.total_estimated_daily_kwh} kWh/day`;
        document.getElementById('app-total-monthly').textContent = `${appSummary.total_estimated_monthly_kwh} kWh/mo`;

        // Render Appliance Table
        const table = document.getElementById('appliances-table-body');
        table.innerHTML = '';
        appSummary.appliances.forEach(app => {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-slate-100 hover:bg-slate-50/80';
            tr.innerHTML = `
                <td class="py-3 px-4 font-semibold text-slate-800 text-xs">${app.name}</td>
                <td class="py-3 px-4 text-xs font-mono text-slate-600">${app.rated_wattage}W</td>
                <td class="py-3 px-4 text-xs text-slate-600">${app.daily_hours_used} hrs</td>
                <td class="py-3 px-4 text-xs font-mono font-bold text-blue-600">${app.estimated_monthly_kwh} kWh</td>
                <td class="py-3 px-4 text-right">
                    <button data-delete-app="${app.id}" class="text-xs text-red-500 hover:text-red-700 font-medium">Remove</button>
                </td>
            `;
            tr.querySelector(`[data-delete-app="${app.id}"]`).addEventListener('click', async () => {
                await API.deleteAppliance(app.id);
                showToast('Appliance removed', 'success');
                loadAppliancesTab();
            });
            table.appendChild(tr);
        });

        // Safety & Ethics Reconciliation Card
        document.getElementById('recon-measured-kwh').textContent = `${recon.measured_meter_kwh} kWh`;
        document.getElementById('recon-estimated-kwh').textContent = `${recon.estimated_appliances_kwh} kWh`;
        document.getElementById('recon-diff-kwh').textContent = `${recon.unaccounted_difference_kwh > 0 ? '+' : ''}${recon.unaccounted_difference_kwh} kWh`;
        document.getElementById('recon-diagnosis-text').textContent = recon.diagnosis;

    } catch (err) {
        console.error(err);
    }
}

// --- Forecast & Intelligence Tab ---
async function loadForecastTab() {
    if (!state.currentProperty || !state.currentMeter) return;
    try {
        const [forecast, recommendations] = await Promise.all([
            API.getForecast(state.currentProperty.id, state.currentMeter.id),
            API.getRecommendations(state.currentProperty.id, state.currentMeter.id)
        ]);

        // Range Cards
        document.getElementById('fore-opt-bill').textContent = `₹${Math.round(forecast.projected_bill_optimistic_inr).toLocaleString()}`;
        document.getElementById('fore-opt-kwh').textContent = `${forecast.projected_total_kwh_optimistic} kWh`;

        document.getElementById('fore-exp-bill').textContent = `₹${Math.round(forecast.projected_bill_expected_inr).toLocaleString()}`;
        document.getElementById('fore-exp-kwh').textContent = `${forecast.projected_total_kwh_expected} kWh`;

        document.getElementById('fore-pes-bill').textContent = `₹${Math.round(forecast.projected_bill_pessimistic_inr).toLocaleString()}`;
        document.getElementById('fore-pes-kwh').textContent = `${forecast.projected_total_kwh_pessimistic} kWh`;

        // Influential Readings Table
        const infTable = document.getElementById('influential-spikes-body');
        infTable.innerHTML = '';
        if (forecast.influential_spikes && forecast.influential_spikes.length > 0) {
            forecast.influential_spikes.forEach(sp => {
                const tr = document.createElement('tr');
                tr.className = 'border-b border-slate-100 text-xs';
                tr.innerHTML = `
                    <td class="py-2.5 px-3 font-mono font-semibold text-slate-700">${sp.date}</td>
                    <td class="py-2.5 px-3 font-mono text-red-600 font-bold">${sp.spike_kwh} kWh</td>
                    <td class="py-2.5 px-3 font-mono text-slate-500">${sp.baseline_kwh} kWh</td>
                    <td class="py-2.5 px-3 font-bold text-amber-700">${sp.estimated_bill_impact}</td>
                `;
                infTable.appendChild(tr);
            });
        } else {
            infTable.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-slate-400">No abnormal spike readings detected this month. Usage is stable.</td></tr>`;
        }

        // Recommendations List
        const recContainer = document.getElementById('recommendations-container');
        recContainer.innerHTML = '';
        recommendations.forEach(r => {
            const card = document.createElement('div');
            card.className = 'p-4 rounded-xl border border-blue-100 bg-blue-50/50 flex items-start gap-3.5';
            card.innerHTML = `
                <div class="p-2 bg-blue-600 text-white rounded-lg text-sm mt-0.5">💡</div>
                <div>
                    <div class="flex items-center gap-2">
                        <h4 class="text-sm font-bold text-slate-800">${r.title}</h4>
                        <span class="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-800 font-semibold rounded-full">${r.impact}</span>
                    </div>
                    <p class="text-xs text-slate-600 mt-1 leading-relaxed">${r.details}</p>
                </div>
            `;
            recContainer.appendChild(card);
        });

    } catch (err) {
        console.error(err);
    }
}

// --- Forms & Event Handlers ---
function initForms() {
    // 1. Reading form
    const readingForm = document.getElementById('form-log-reading');
    if (readingForm) {
        // Default to today
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
                showToast('Meter reading logged successfully!', 'success');
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

    // 2. Tariff simulator slider
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

    // 3. Add appliance form
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
                showToast(`Added ${name}!`, 'success');
                appForm.reset();
                closeModal('modal-add-appliance');
                loadAppliancesTab();
            } catch (err) {
                showToast(err.detail || 'Failed to add appliance', 'error');
            }
        });
    }

    // 4. Quick Presets for Appliance Form
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

// --- Modals ---
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

// --- Toast Notifications ---
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    const isError = type === 'error';
    toast.className = `fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold flex items-center gap-2 transform transition-all duration-300 ${
        isError ? 'bg-red-500 text-white border-red-600' : 'bg-slate-900 text-white border-slate-800'
    }`;
    toast.innerHTML = `<span>${isError ? '✕' : '✓'}</span><span>${message}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}
