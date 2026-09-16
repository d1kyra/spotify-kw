import main
from fastapi.testclient import TestClient

client = TestClient(main.app)

def test_all():
    print("[1/5] Testing /api/featured...")
    resp = client.get("/api/featured")
    assert resp.status_code == 200, f"Status {resp.status_code}"
    data = resp.json()
    print(f"  -> Featured categories: {len(data)}")

    print("[2/5] Testing /api/search...")
    resp = client.get("/api/search?q=Coldplay&source=saavn&limit=5")
    assert resp.status_code == 200, f"Status {resp.status_code}"
    results = resp.json().get("results", [])
    print(f"  -> Search results: {len(results)}")
    assert len(results) > 0, "No search results"
    sample = results[0]
    print(f"  -> First track: {sample.get('title')} - {sample.get('artist')}")
    print(f"  -> Stream URL: {str(sample.get('stream_url'))[:60]}...")

    print("[3/5] Testing /api/lyrics...")
    resp = client.get("/api/lyrics?track=Yellow&artist=Coldplay")
    assert resp.status_code == 200
    lyrics_data = resp.json()
    print(f"  -> Synced lyrics available: {lyrics_data.get('synced')}")

    print("[4/5] Testing /api/stats...")
    resp = client.get("/api/stats")
    assert resp.status_code == 200
    stats = resp.json()
    print(f"  -> Process RAM: {stats.get('total_ram_mb')} MB (Hemat: {stats.get('ram_saved_percent')}%)")
    print(f"  -> Disk Cache: {stats.get('cache_mb')} MB")

    print("[5/5] Testing Index HTML & Static Files...")
    resp = client.get("/")
    assert resp.status_code == 200
    assert "Spotify KW" in resp.text
    print("  -> Index HTML loaded with Spotify KW branding!")

    print("\n" + "="*50)
    print(" >>> ALL AUTOMATED TESTS COMPLETED SUCCESSFULLY! <<< ")
    print("="*50)

if __name__ == "__main__":
    test_all()
