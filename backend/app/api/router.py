from fastapi import APIRouter

from app.api.routes import health, notes, patients

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(patients.router)
api_router.include_router(notes.router)
