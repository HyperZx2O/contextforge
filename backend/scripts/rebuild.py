"""Clear Neo4j, clear NONE cache, re-run attention mechanism pipeline."""
import httpx, time, json, asyncio

BASE = "http://localhost:8000"

# Wait for backend
print("Waiting for backend...")
for i in range(10):
    try:
        r = httpx.get(f"{BASE}/health", timeout=5)
        if r.status_code == 200:
            print("Backend is up.")
            break
    except:
        pass
    time.sleep(1)
else:
    print("Backend not available")
    exit(1)

# Check current graph state
r = httpx.get(f"{BASE}/graph/nodes", timeout=10)
print(f"Current nodes: {r.json().get('total', 0) if r.status_code == 200 else 'error'}")

# Clear NONE synthesis cache
async def clear_cache():
    from dependencies import _session_factory
    from sqlalchemy import text
    f = _session_factory
    async with f() as s:
        await s.execute(text("DELETE FROM synthesis_cache WHERE relationship_type = 'NONE'"))
        await s.commit()
        r = await s.execute(text("SELECT COUNT(*) FROM synthesis_cache"))
        print(f"Cache entries remaining: {r.one()[0]}")
asyncio.run(clear_cache())

# Clear Neo4j
async def clear_neo4j():
    from dependencies import get_neo4j_driver
    driver = get_neo4j_driver()
    async with driver.session() as session:
        await session.run("MATCH (n) DETACH DELETE n")
        print("Neo4j cleared.")
asyncio.run(clear_neo4j())

# Run pipeline
print("\nRunning pipeline: attention mechanism...")
r = httpx.post(f"{BASE}/pipeline/run", json={
    "query": "attention mechanism",
    "max_papers": 15,
    "sources": ["arxiv"]
}, timeout=15)
job_id = r.json().get("job_id", "")
print(f"Job ID: {job_id}")

if not job_id:
    print("No job_id")
    exit(1)

print("\nPolling...")
for i in range(90):
    time.sleep(3)
    r = httpx.get(f"{BASE}/pipeline/status/{job_id}", timeout=10)
    d = r.json()
    s = d["status"]
    print(f"  [{i*3:2d}s] {s:14s} progress={d['progress']}% papers={d['papers_found']} processed={d['papers_processed']} rels={d['relationships_created']}")
    if d.get("error_message"):
        print(f"  ERROR: {d['error_message'][:300]}")
    if s in ("done", "failed"):
        break

print(f"\nFinal: {json.dumps(d, indent=2)}")

print("\n=== Graph state ===")
r = httpx.get(f"{BASE}/graph/nodes", timeout=10)
print(f"Nodes: {r.json().get('total', 0)}")
r = httpx.get(f"{BASE}/graph/edges", timeout=10)
d = r.json()
print(f"Edges: {d.get('total', 0)}")
for e in d.get("edges", [])[:10]:
    props = e.get("properties", {})
    print(f"  {e['source']} --[{e['type']}]--> {e['target']} (conf={props.get('confidence','?')})")
r = httpx.get(f"{BASE}/graph/gaps", timeout=10)
print(f"Gaps: {len(r.json().get('gaps', []))}")
