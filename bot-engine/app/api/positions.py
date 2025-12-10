from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def positions_health():
    return {"status": "ok"}
