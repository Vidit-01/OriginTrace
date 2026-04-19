import os

from fastapi import FastAPI, HTTPException, Query
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware

if __package__:
    from .get_data import get_supply_chain_data
else:
    # Running as `uvicorn main:app` with cwd = backend/
    from get_data import get_supply_chain_data

app = FastAPI(
    title="Synergy Supply Chain API",
    description="Exposes supplier/recursive discovery data as a graph of nodes and edges.",
    version="1.0.0"
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allows all origins
    allow_credentials=True,
    allow_methods=["*"], # Allows all methods
    allow_headers=["*"], # Allows all headers
)

@app.get("/")
def read_root():
    return {"message": "Synergy Supply Chain API is running. Use /company/{name} to explore."}

@app.get("/test")
def test():
    """Quick connectivity test with depth=0."""
    try:
        return get_supply_chain_data("Apple", depth=0, limit=1)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/company/{name}")
async def get_company_graph(
    name: str, 
    depth: int = Query(1, ge=0, le=3), 
    limit: int = Query(3, ge=1, le=10)
):
    """
    Builds and returns a supply chain graph for the specified company.
    - name: Company name to search (e.g., 'Apple')
    - depth: How many layers deep to go (0-3). Default is 1.
    - limit: How many suppliers to follow per layer (1-10). Default is 3.
    """
    try:
        data = await run_in_threadpool(get_supply_chain_data, name, depth=depth, limit=limit)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # Allow port to be set by environment variable for deployment flexibility
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
