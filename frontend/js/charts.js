// PowerSaver Chart Manager using Chart.js

let dailyChartInstance = null;
let monthlyChartInstance = null;
let applianceChartInstance = null;

export const ChartManager = {
    renderDailyChart(canvasId, dailyData, anomalies = []) {
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) return;

        if (dailyChartInstance) {
            dailyChartInstance.destroy();
        }

        const anomalyDates = new Set(anomalies.map(a => a.reading_date));
        const labels = dailyData.map(d => d.reading_date.slice(5)); // MM-DD
        const values = dailyData.map(d => d.daily_consumption_kwh);

        // Highlight anomaly spike bars in Red, normal in Emerald/Blue
        const bgColors = dailyData.map(d => {
            if (anomalyDates.has(d.reading_date)) {
                return 'rgba(239, 68, 68, 0.85)'; // Red Spike
            }
            return 'rgba(37, 99, 235, 0.75)'; // Primary Blue
        });

        const borderColors = dailyData.map(d => {
            if (anomalyDates.has(d.reading_date)) {
                return '#b91c1c';
            }
            return '#1d4ed8';
        });

        dailyChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Daily Consumption (kWh)',
                    data: values,
                    backgroundColor: bgColors,
                    borderColor: borderColors,
                    borderWidth: 1.5,
                    borderRadius: 6,
                    maxBarThickness: 28,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        padding: 12,
                        titleFont: { size: 13, weight: '600' },
                        bodyFont: { size: 12 },
                        cornerRadius: 8,
                        callbacks: {
                            afterLabel: function(context) {
                                const fullDate = dailyData[context.dataIndex].reading_date;
                                const anomaly = anomalies.find(a => a.reading_date === fullDate);
                                if (anomaly) {
                                    return `\n⚠️ SPIKE DETECTED (${anomaly.severity}):\n${anomaly.reason}`;
                                }
                                return '';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { font: { size: 11, family: 'Plus Jakarta Sans' } }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(226, 232, 240, 0.8)' },
                        ticks: {
                            callback: value => `${value} kWh`,
                            font: { size: 11 }
                        }
                    }
                }
            }
        });
    },

    renderMonthlyChart(canvasId, monthlyData) {
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) return;

        if (monthlyChartInstance) {
            monthlyChartInstance.destroy();
        }

        const labels = monthlyData.map(m => m.month);
        const values = monthlyData.map(m => m.total_units);

        monthlyChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Monthly Units (kWh)',
                    data: values,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.35,
                    pointBackgroundColor: '#10b981',
                    pointRadius: 5,
                    pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            label: context => ` Units Billed: ${context.raw} kWh`
                        }
                    }
                },
                scales: {
                    x: { grid: { display: false } },
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(226, 232, 240, 0.8)' },
                        ticks: { callback: val => `${val} kWh` }
                    }
                }
            }
        });
    },

    renderApplianceDonut(canvasId, categoryMap) {
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) return;

        if (applianceChartInstance) {
            applianceChartInstance.destroy();
        }

        const labels = Object.keys(categoryMap).map(k => k.charAt(0).toUpperCase() + k.slice(1));
        const values = Object.values(categoryMap);

        const colors = [
            '#3b82f6', // Cooling
            '#ef4444', // Heating
            '#10b981', // Refrigeration
            '#f59e0b', // Ventilation
            '#8b5cf6', // Lighting
            '#64748b'  // Other
        ];

        applianceChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors.slice(0, labels.length),
                    borderWidth: 2,
                    borderColor: '#ffffff',
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '68%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            boxWidth: 12,
                            font: { family: 'Plus Jakarta Sans', size: 12 }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        padding: 10,
                        cornerRadius: 8,
                        callbacks: {
                            label: ctx => ` ${ctx.label}: ${ctx.raw} kWh/mo`
                        }
                    }
                }
            }
        });
    }
};
