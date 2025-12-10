from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def trades_health():
    return {"status": "ok"}
