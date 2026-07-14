import httpx
import time

job_id = "c7fe6b51-8114-4571-bf5f-f51af2e828bf"
for i in range(15):
    r = httpx.get(f"http://localhost:8000/pipeline/status/{job_id}")
    data = r.json()
    status = data.get("status", "?")
    progress = data.get("progress", 0)
    papers = data.get("papers_found", 0)
    rels = data.get("relationships_created", 0)
    err = data.get("error_message", "")
    print(f"[{i*2}s] status={status} progress={progress} papers={papers} rels={rels}")
    if err:
        print(f"  ERROR: {err}")
    if status in ("done", "failed"):
        break
    time.sleep(2)
