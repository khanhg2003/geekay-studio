from fastapi import APIRouter

from app.api.v1 import mentor, render

api_router = APIRouter(prefix="/v1")
api_router.include_router(render.router, tags=["render"])
api_router.include_router(mentor.router, tags=["mentor"])
