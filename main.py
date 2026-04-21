from get_data import get_supply_chain_data, get_company_suppliers_slice, STORE_PATH
import json
import os
from pathlib import Path
from cache_manager import PersistentCache

from fastapi import FastAPI, HTTPException, Query
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware

if __package__:
    from .get_data import get_supply_chain_data, get_company_suppliers_slice, STORE_PATH
else:
    # Running as `uvicorn main:app` with cwd = backend/
    from get_data import get_supply_chain_data, get_company_suppliers_slice, STORE_PATH

app = FastAPI(
    title="GLOBALTRACE Supply Chain API",
    description="Exposes supplier/recursive discovery data as a graph of nodes and edges.",
    version="1.1.0"
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

CACHE_PATH = Path(__file__).parent / "request_cache.json"
request_cache = PersistentCache(CACHE_PATH)


@app.get("/")
def read_root():
    return {"message": "GLOBALTRACE Supply Chain API is running. Use /company/{name} to explore."}


@app.get("/test")
async def test():
    """Quick connectivity test with a shallow tier."""
    cache_key = "test"
    cached = request_cache.get(cache_key)
    if cached:
        return cached

    try:
        data = await run_in_threadpool(get_supply_chain_data, "Apple", 1, 1)
        request_cache.set(cache_key, data)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/company/{name}")
async def get_company_graph(
    name: str,
    depth: int = Query(3, ge=0, le=8),
    max_tier: int | None = Query(None, ge=0, le=8),
    limit: int = Query(3, ge=1, le=20),
    anchor_hsn: str | None = Query(None),
):
    """
    Builds and returns a supply chain graph for the specified company.
    - name: Company name to search (e.g., 'Apple')
    - depth: Legacy compatibility parameter for traversal depth
    - max_tier: Preferred tier cap (overrides depth when provided)
    - limit: Max suppliers to follow per layer
    - anchor_hsn: Optional user-selected HSN anchor
    """
    cache_key = f"company_{name}_d{depth}_t{max_tier}_l{limit}_h{anchor_hsn}"
    cached = request_cache.get(cache_key)
    if cached:
        return cached

    try:
        effective_max_tier = max_tier if max_tier is not None else depth
        data = await run_in_threadpool(
            get_supply_chain_data,
            name,
            depth,
            limit,
            anchor_hsn,
            effective_max_tier,
        )
        request_cache.set(cache_key, data)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/company/{name}/suppliers")
async def get_suppliers_slice(
    name: str,
    start: int = Query(0, ge=0),
    end: int = Query(5, ge=1),
):
    """
    Returns a slice of suppliers for a specific company node.
    Used for incremental 'Expand More' functionality.
    """
    cache_key = f"expand_{name}_s{start}_e{end}"
    cached = request_cache.get(cache_key)
    if cached:
        return cached

    try:
        data = await run_in_threadpool(
            get_company_suppliers_slice,
            name,
            start,
            end,
        )
        request_cache.set(cache_key, data)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/all_companies_data")
def get_all_companies_data():
    """
    Returns all cached company graph data for the aggregate dashboard.
    """
    if not STORE_PATH.exists():
        return []
    try:
        with open(STORE_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read store: {e}")


if __name__ == "__main__":
    import uvicorn

    # Allow port to be set by environment variable for deployment flexibility
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
