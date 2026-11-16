// PowerSaver Advanced Chart Manager - Replicating Dribbble "Dashcom" Visual Style

let heroChartInstance = null;
let gaugeChartInstance = null;
let applianceDonutInstance = null;

export const ChartManager = {
    // 1. Dual-Line Curved Spline Hero Chart (Matches Dribbble Sales History)
    renderHeroChart(canvasId, dailyData, anomalies = []) {
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) return;

        if (heroChartInstance) {
            heroChartInstance.destroy();
        }

        const anomalyMap = new Map(anomalies.map(a => [a.reading_date, a]));
        const labels = dailyData.map(d => d.reading_date.slice(5)); // MM-DD
        const actualValues = dailyData.map(d => d.daily_consumption_kwh);

        // Baseline median
        const sorted = [...actualValues].filter(v => v > 0).sort((a, b) => a - b);
        const medianVal = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 11.0;
        const baselineValues = dailyData.map((d, i) => {
            // Slight natural variance around median for visual aesthetics
            return +(medianVal + Math.sin(i / 2) * 1.5).toFixed(1);
        });

        // Point styling: make anomaly spike points prominent pink/red rings
        const pointRadius = dailyData.map(d => anomalyMap.has(d.reading_date) ? 7 : 3);
        const pointBg = dailyData.map(d => anomalyMap.has(d.reading_date) ? '#ef4444' : '#2563eb');

        heroChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Baseline Expected',
                        data: baselineValues,
                        borderColor: '#d946ef', // Magenta
                        backgroundColor: 'transparent',
                        borderWidth: 2.5,
                        tension: 0.45,
                        pointRadius: 0,
                        pointHoverRadius: 5,
                        pointHoverBackgroundColor: '#d946ef'
                    },
                    {
                        label: 'Actual Metered Units',
                        data: actualValues,
                        borderColor: '#2563eb', // Electric Blue
                        backgroundColor: 'rgba(37, 99, 235, 0.04)',
                        borderWidth: 3,
                        tension: 0.45,
                        fill: true,
                        pointRadius: pointRadius,
                        pointBackgroundColor: pointBg,
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        pointHoverRadius: 8
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: true,
                        backgroundColor: '#0f172a', // Matches Dribbble black tooltip pill
                        titleColor: '#94a3b8',
                        titleFont: { size: 11, family: 'Plus Jakarta Sans', weight: '500' },
                        bodyColor: '#ffffff',
                        bodyFont: { size: 14, family: 'JetBrains Mono', weight: '700' },
                        padding: 14,
                        cornerRadius: 14,
                        displayColors: false,
                        callbacks: {
                            title: function(items) {
                                const idx = items[0].dataIndex;
                                return dailyData[idx].reading_date;
                            },
                            label: function(item) {
                                if (item.datasetIndex === 1) {
                                    return `${item.raw} kWh  (Metered)`;
                                }
                                return `${item.raw} kWh  (Baseline)`;
                            },
                            afterBody: function(items) {
                                const idx = items[0].dataIndex;
                                const date = dailyData[idx].reading_date;
                                const anomaly = anomalyMap.get(date);
                                if (anomaly) {
                                    return `\n⚠️ SPIKE DETECTED (+${anomaly.z_score}σ):\n${anomaly.reason}`;
                                }
                                return '';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            font: { family: 'Plus Jakarta Sans', size: 11 },
                            color: '#94a3b8'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(241, 245, 249, 0.8)' },
                        ticks: {
                            font: { family: 'JetBrains Mono', size: 11 },
                            color: '#94a3b8',
                            callback: v => `${v}k`
                        }
                    }
                }
            }
        });
    },

    // 2. Radial Gauge Target (Matches Dribbble Marketing Target 88% Widget)
    renderSlabTargetGauge(canvasId, currentUnits, slabThreshold = 400) {
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) return;

        if (gaugeChartInstance) {
            gaugeChartInstance.destroy();
        }

        const pct = Math.min(100, Math.round((currentUnits / slabThreshold) * 100));
        const remaining = Math.max(0, 100 - pct);

        gaugeChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [pct, remaining],
                    backgroundColor: ['#3754db', '#f1f5f9'],
                    borderWidth: 0,
                    circumference: 360,
                    rotation: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '82%',
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false }
                }
            }
        });

        // Update center text
        const pctEl = document.getElementById('gauge-pct-text');
        if (pctEl) pctEl.textContent = `${pct}%`;

        const subEl = document.getElementById('gauge-sub-text');
        if (subEl) subEl.textContent = `${currentUnits.toFixed(0)} / ${slabThreshold} kWh`;
    },

    // 3. Weekly Summary Dark Capsule Bars (Matches Dribbble Weekly Summary Widget)
    updateWeeklyCapsules(dailyData) {
        const last7 = dailyData.slice(-7);
        const days = ['Mo', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const container = document.getElementById('weekly-capsules-container');
        if (!container) return;

        container.innerHTML = '';
        const maxVal = Math.max(...last7.map(d => d.daily_consumption_kwh), 15);

        for (let i = 0; i < 7; i++) {
            const reading = last7[i] || { daily_consumption_kwh: 8.0 };
            const heightPct = Math.min(100, Math.max(15, Math.round((reading.daily_consumption_kwh / maxVal) * 100)));
            const isSpike = reading.daily_consumption_kwh > (maxVal * 0.85);

            const col = document.createElement('div');
            col.className = 'flex flex-col items-center gap-1.5';
            col.innerHTML = `
                <div class="capsule-track" title="${reading.reading_date || ''}: ${reading.daily_consumption_kwh} kWh">
                    <div class="capsule-fill" style="height: ${heightPct}%; background: ${isSpike ? 'linear-gradient(180deg, #f43f5e 0%, #be123c 100%)' : 'linear-gradient(180deg, #38bdf8 0%, #2563eb 100%)'}"></div>
                </div>
                <span class="text-[10px] font-medium text-slate-400">${days[i]}</span>
            `;
            container.appendChild(col);
        }
    },

    // 4. Appliance Category Donut
    renderApplianceDonut(canvasId, categoryMap) {
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) return;

        if (applianceDonutInstance) {
            applianceDonutInstance.destroy();
        }

        const labels = Object.keys(categoryMap).map(k => k.charAt(0).toUpperCase() + k.slice(1));
        const values = Object.values(categoryMap);
        const colors = ['#3b82f6', '#d946ef', '#10b981', '#f59e0b', '#8b5cf6', '#64748b'];

        applianceDonutInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors.slice(0, labels.length),
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '72%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { boxWidth: 10, font: { family: 'Plus Jakarta Sans', size: 11 } }
                    }
                }
            }
        });
    }
};
