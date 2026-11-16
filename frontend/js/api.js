// PowerSaver API Client

const BASE_URL = window.location.origin.includes('8000') 
    ? window.location.origin 
    : 'http://127.0.0.1:8000';

export const API = {
    // Properties & Meters
    async getProperties() {
        const res = await fetch(`${BASE_URL}/api/properties`);
        return res.json();
    },

    async createProperty(data) {
        const res = await fetch(`${BASE_URL}/api/properties`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw await res.json();
        return res.json();
    },

    async getMeters(propertyId) {
        const res = await fetch(`${BASE_URL}/api/properties/${propertyId}/meters`);
        return res.json();
    },

    // Meter Readings
    async getReadings(meterId) {
        const res = await fetch(`${BASE_URL}/api/readings?meter_id=${meterId}`);
        return res.json();
    },

    async getTrends(meterId) {
        const res = await fetch(`${BASE_URL}/api/readings/trends?meter_id=${meterId}`);
        return res.json();
    },

    async logReading(readingData) {
        const res = await fetch(`${BASE_URL}/api/readings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(readingData)
        });
        if (!res.ok) throw await res.json();
        return res.json();
    },

    async getHistoricalComparison(meterId) {
        const res = await fetch(`${BASE_URL}/api/readings/compare?meter_id=${meterId}`);
        return res.json();
    },

    getExportUrl(meterId) {
        return `${BASE_URL}/api/readings/export?meter_id=${meterId}`;
    },

    // Tariffs & Calculation
    async getTariff(propertyId) {
        const res = await fetch(`${BASE_URL}/api/tariffs/${propertyId}`);
        return res.json();
    },

    async updateTariff(propertyId, tariffData) {
        const res = await fetch(`${BASE_URL}/api/tariffs/${propertyId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tariffData)
        });
        if (!res.ok) throw await res.json();
        return res.json();
    },

    async calculateBill(propertyId, totalUnits) {
        const res = await fetch(`${BASE_URL}/api/tariffs/calculate?property_id=${propertyId}&total_units=${totalUnits}`, {
            method: 'POST'
        });
        return res.json();
    },

    // Appliances & Reconciliation
    async getAppliances(propertyId) {
        const res = await fetch(`${BASE_URL}/api/appliances/${propertyId}`);
        return res.json();
    },

    async addAppliance(data) {
        const res = await fetch(`${BASE_URL}/api/appliances`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw await res.json();
        return res.json();
    },

    async deleteAppliance(applianceId) {
        const res = await fetch(`${BASE_URL}/api/appliances/${applianceId}`, {
            method: 'DELETE'
        });
        return res.json();
    },

    async getReconciliation(propertyId, meterId) {
        const res = await fetch(`${BASE_URL}/api/analytics/reconciliation?property_id=${propertyId}&meter_id=${meterId}`);
        return res.json();
    },

    // Advanced Intelligence & Forecasting
    async getForecast(propertyId, meterId) {
        const res = await fetch(`${BASE_URL}/api/analytics/forecast?property_id=${propertyId}&meter_id=${meterId}`);
        return res.json();
    },

    async getAlerts(propertyId) {
        const res = await fetch(`${BASE_URL}/api/analytics/alerts?property_id=${propertyId}`);
        return res.json();
    },

    async resolveAlert(alertId) {
        const res = await fetch(`${BASE_URL}/api/analytics/alerts/${alertId}/resolve`, {
            method: 'POST'
        });
        return res.json();
    },

    async getRecommendations(propertyId, meterId) {
        const res = await fetch(`${BASE_URL}/api/analytics/recommendations?property_id=${propertyId}&meter_id=${meterId}`);
        return res.json();
    }
};
