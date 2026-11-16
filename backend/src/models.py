from pydantic import BaseModel, Field
from typing import List, Optional


class PropertyCreate(BaseModel):
    name: str = Field(..., example="Hostel Block B")
    property_type: str = Field("residential", example="hostel")
    sanctioned_load_kw: float = Field(3.0, ge=0.5, le=100.0)


class PropertyResponse(BaseModel):
    id: str
    name: str
    property_type: str
    sanctioned_load_kw: float
    created_at: str


class MeterCreate(BaseModel):
    property_id: str
    meter_number: str
    meter_type: str = "grid"


class MeterResponse(BaseModel):
    id: str
    property_id: str
    meter_number: str
    meter_type: str
    created_at: str


class ReadingCreate(BaseModel):
    meter_id: str
    reading_date: str = Field(..., description="YYYY-MM-DD", example="2026-11-16")
    cumulative_kwh: float = Field(..., ge=0.0, description="Total cumulative kWh on meter display")
    notes: Optional[str] = None


class ReadingResponse(BaseModel):
    id: str
    meter_id: str
    reading_date: str
    cumulative_kwh: float
    daily_consumption_kwh: float
    days_elapsed: int
    is_estimated: bool
    notes: Optional[str] = None
    created_at: str


class SlabItem(BaseModel):
    min_units: float
    max_units: Optional[float] = None
    rate_per_unit: float


class TariffPlanCreate(BaseModel):
    property_id: str
    discom_name: str
    fixed_charge_per_kw: float = 110.0
    tax_percentage: float = 9.0
    slabs: List[SlabItem]


class SlabBreakdown(BaseModel):
    slab_label: str
    units_in_slab: float
    rate_per_unit: float
    amount: float


class BillCalculationResponse(BaseModel):
    total_units_kwh: float
    energy_charges: float
    fixed_charges: float
    subtotal: float
    electricity_duty_tax: float
    total_estimated_bill: float
    currency: str = "INR"
    slab_breakdown: List[SlabBreakdown]
    disclaimer: str = "Calculated estimate based on configured tariff slabs and fixed charges."


class ApplianceCreate(BaseModel):
    property_id: str
    name: str = Field(..., example="1.5 Ton Split AC")
    rated_wattage: float = Field(..., gt=0, example=1500)
    daily_hours_used: float = Field(..., ge=0, le=24, example=6.5)
    quantity: int = Field(1, ge=1, example=2)
    category: str = Field("cooling", example="cooling")


class ApplianceResponse(BaseModel):
    id: str
    property_id: str
    name: str
    rated_wattage: float
    daily_hours_used: float
    quantity: int
    category: str
    estimated_daily_kwh: float
    estimated_monthly_kwh: float


class ApplianceSummaryResponse(BaseModel):
    appliances: List[ApplianceResponse]
    total_estimated_daily_kwh: float
    total_estimated_monthly_kwh: float
    category_breakdown: dict


class AnomalyItem(BaseModel):
    reading_date: str
    consumption_kwh: float
    baseline_median_kwh: float
    z_score: float
    severity: str
    reason: str


class ForecastResponse(BaseModel):
    current_month: str
    days_elapsed: int
    days_remaining: int
    mtd_actual_kwh: float
    projected_total_kwh_expected: float
    projected_total_kwh_optimistic: float
    projected_total_kwh_pessimistic: float
    projected_bill_expected_inr: float
    projected_bill_optimistic_inr: float
    projected_bill_pessimistic_inr: float
    anomalies: List[AnomalyItem]
    influential_spikes: List[dict]
