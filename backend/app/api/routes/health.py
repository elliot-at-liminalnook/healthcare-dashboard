from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(tags=["health"])


class HealthStatus(BaseModel):
    status: Literal["ok"] = "ok"


@router.get("/health")
async def get_health() -> HealthStatus:
    return HealthStatus()
