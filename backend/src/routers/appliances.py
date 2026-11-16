from fastapi import APIRouter, HTTPException
from ..models import ApplianceCreate, ApplianceResponse, ApplianceSummaryResponse
from ..services.appliance_service import add_appliance, get_appliances_summary
from ..database import get_db

router = APIRouter(prefix="/api/appliances", tags=["Appliance Inventory"])


@router.post("", response_model=ApplianceResponse, status_code=201)
def create_appliance(data: ApplianceCreate):
    return add_appliance(data)


@router.get("/{property_id}", response_model=ApplianceSummaryResponse)
def get_property_appliances(property_id: str):
    return get_appliances_summary(property_id)


@router.delete("/{appliance_id}")
def delete_appliance(appliance_id: str):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM appliances WHERE id = ?", (appliance_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Appliance not found")
    return {"status": "success", "message": "Appliance deleted successfully"}
