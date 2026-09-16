"""
Spotify KW - Ultra-Lightweight Spotify Alternative
RAM < 70MB | Storage < 5MB | Full 320kbps Audio | Synced Lyrics | Local & Online
"""

import os
import sys
import json
import time
import base64
import re
import urllib.parse
import urllib.request
import threading
import subprocess
import webbrowser
from pathlib import Path
from typing import Optional, List, Dict, Any

from Crypto.Cipher import DES
import requests
import psutil
from tinytag import TinyTag
from fastapi import FastAPI, Request, Response, HTTPException, Query
from fastapi.responses import HTMLResponse, FileResponse, StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Initialize FastAPI App
app = FastAPI(title="Spotify KW", description="Ultra-Lightweight Spotify Alternative")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
CACHE_DIR = BASE_DIR / "cache"
CACHE_DIR.mkdir(exist_ok=True)
DOWNLOADS_DIR = CACHE_DIR / "downloads"
DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)
DOWNLOADS_META_FILE = CACHE_DIR / "downloads.json"

# In-memory download worker queue & state
_DOWNLOAD_QUEUE: List[Dict[str, Any]] = []
_DOWNLOAD_STATE = {
    "is_downloading": False,
    "current_track": None,
    "completed": 0,
    "total": 0,
    "failed": 0
}
_DOWNLOAD_LOCK = threading.Lock()

# In-memory search cache (bounded to 50 items for minimal RAM footprint)
_SEARCH_CACHE: Dict[str, Any] = {}
_MAX_CACHE_SIZE = 50

# JioSaavn DES Key for URL decryption
SAAVN_DES_KEY = b"38346591"


def decrypt_saavn_url(enc_url: str, quality: str = "320") -> Optional[str]:
    """Decrypt JioSaavn encrypted_media_url and replace with desired quality bitrate."""
    if not enc_url:
        return None
    try:
        cipher = DES.new(SAAVN_DES_KEY, DES.MODE_ECB)
        decrypted = cipher.decrypt(base64.b64decode(enc_url))
        pad_len = decrypted[-1]
        raw_url = decrypted[:-pad_len].decode("utf-8")
        
        # Replace bitrate tag
        # e.g. _96.mp4 -> _320.mp4 or _160.mp4
        if quality == "320":
            return raw_url.replace("_96.mp4", "_320.mp4").replace("_160.mp4", "_320.mp4")
        elif quality == "160":
            return raw_url.replace("_96.mp4", "_160.mp4").replace("_320.mp4", "_160.mp4")
        else:
            return raw_url.replace("_320.mp4", "_96.mp4").replace("_160.mp4", "_96.mp4")
    except Exception as e:
        print(f"[Decrypt Error] {e}")
        return None


def format_duration(seconds: int) -> str:
    """Convert duration in seconds to MM:SS string."""
    try:
        sec = int(seconds)
        m, s = divmod(sec, 60)
        return f"{m}:{s:02d}"
    except Exception:
        return "3:30"


def clean_html(raw_html: str) -> str:
    """Clean unescaped HTML entities from titles and artists."""
    if not raw_html:
        return ""
    return (
        raw_html.replace("&amp;", "&")
        .replace("&quot;", '"')
        .replace("&#039;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
    )


EXCLUDED_INDIAN_LANGUAGES = {
    "hindi", "punjabi", "telugu", "tamil", "bhojpuri", "malayalam",
    "marathi", "bengali", "kannada", "gujarati", "urdu", "rajasthani",
    "odia", "assamese", "haryanvi", "sanskrit"
}


def search_saavn(query: str, limit: int = 20) -> List[Dict[str, Any]]:
    """Search JioSaavn library for high quality songs (filtered from Indian/Bollywood languages)."""
    encoded_q = urllib.parse.quote(query)
    url = f"https://www.jiosaavn.com/api.php?__call=search.getResults&_marker=0&q={encoded_q}&ctx=web6dot0&_format=json&p=1&n={limit}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
    }
    
    songs = []
    try:
        resp = requests.get(url, headers=headers, timeout=6)
        if resp.status_code == 200:
            data = resp.json()
            results = data.get("results", [])
            for item in results:
                # Exclude Indian / Bollywood languages
                lang = (item.get("language") or item.get("more_info", {}).get("language") or "").lower().strip()
                if lang in EXCLUDED_INDIAN_LANGUAGES:
                    continue

                enc_url = item.get("encrypted_media_url")
                stream_320 = decrypt_saavn_url(enc_url, "320")
                stream_160 = decrypt_saavn_url(enc_url, "160")
                stream_96 = decrypt_saavn_url(enc_url, "96")
                
                if not stream_320 and not enc_url:
                    continue
                    
                # Get high quality image (500x500 instead of 150x150)
                img = item.get("image", "")
                if img:
                    img = img.replace("150x150.jpg", "500x500.jpg")
                else:
                    img = "/static/images/default-album.png"

                title = clean_html(item.get("song") or item.get("title") or "Unknown Title")
                artist = clean_html(item.get("primary_artists") or item.get("singers") or item.get("artist") or "Unknown Artist")
                album = clean_html(item.get("album") or "Single")
                dur = int(item.get("duration", 0) or 0)
                
                songs.append({
                    "id": f"saavn_{item.get('id')}",
                    "source": "saavn",
                    "title": title,
                    "artist": artist,
                    "album": album,
                    "year": item.get("year", ""),
                    "duration": dur,
                    "duration_str": format_duration(dur),
                    "image": img,
                    "stream_url": stream_320 or stream_160 or stream_96,
                    "stream_320": stream_320,
                    "stream_160": stream_160,
                    "stream_96": stream_96,
                    "has_lyrics": item.get("has_lyrics") == "true",
                })
    except Exception as e:
        print(f"[Saavn Search Error] {e}")
        
    return songs


def search_youtube(query: str, limit: int = 6) -> List[Dict[str, Any]]:
    """Fallback search using yt-dlp to find any song, live version, or rare track."""
    songs = []
    try:
        import yt_dlp
        ydl_opts = {
            "format": "bestaudio/best",
            "noplaylist": True,
            "quiet": True,
            "skip_download": True,
            "default_search": f"ytsearch{limit}",
            "extract_flat": False,
            "js_runtimes": {"node": {}},
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            res = ydl.extract_info(f"ytsearch{limit}:{query}", download=False)
            entries = res.get("entries", [])
            for entry in entries:
                if not entry:
                    continue
                
                title = entry.get("title", "Unknown Title")
                uploader = entry.get("uploader", "Unknown Artist")
                dur = int(entry.get("duration", 0) or 0)
                
                # Get best thumbnail
                thumbs = entry.get("thumbnails", [])
                thumb_url = thumbs[-1]["url"] if thumbs else "/static/images/default-album.png"
                
                # Stream URL
                stream_url = entry.get("url")
                
                songs.append({
                    "id": f"yt_{entry.get('id')}",
                    "source": "youtube",
                    "title": title,
                    "artist": uploader,
                    "album": "YouTube Audio",
                    "year": "",
                    "duration": dur,
                    "duration_str": format_duration(dur),
                    "image": thumb_url,
                    "stream_url": stream_url,
                    "stream_320": stream_url,
                    "stream_160": stream_url,
                    "stream_96": stream_url,
                    "has_lyrics": False,
                    "yt_id": entry.get("id"),
                })
    except Exception as e:
        print(f"[YouTube Search Error] {e}")
        
    return songs


# Spotify Public Playlist Cache & Pre-configured Playlists
_RESOLVE_CACHE: Dict[str, Any] = {}
_SPOTIFY_PLAYLIST_CACHE: Dict[str, Any] = {}

USER_PLAYLISTS_CONFIG = [
    {
        "id": "4OmI8xAbhvqDcuKaLkEaN0",
        "url": "https://open.spotify.com/playlist/4OmI8xAbhvqDcuKaLkEaN0",
        "name": "✨ gen z songs english",
        "subtitle": "krisnika • 100 lagu",
    },
    {
        "id": "1gAv5vmayVaCxbxSX7KmQj",
        "url": "https://open.spotify.com/playlist/1gAv5vmayVaCxbxSX7KmQj",
        "name": "🇮🇩 Indo Happy Playlist",
        "subtitle": "Dewi Nrhyt • 100 lagu",
    },
]


def parse_spotify_playlist(url_or_id: str) -> Optional[Dict[str, Any]]:
    """Parse tracks and metadata from any public Spotify playlist URL or ID via embed."""
    if not url_or_id:
        return None
    try:
        m = re.search(r"playlist/([a-zA-Z0-9]+)", url_or_id)
        pl_id = m.group(1) if m else url_or_id.split("?")[0].strip()

        if pl_id in _SPOTIFY_PLAYLIST_CACHE:
            return _SPOTIFY_PLAYLIST_CACHE[pl_id]

        embed_url = f"https://open.spotify.com/embed/playlist/{pl_id}"
        req = urllib.request.Request(embed_url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode("utf-8")
            jm = re.search(r'<script id="__NEXT_DATA__" type="application/json">([^<]+)</script>', html)
            if not jm:
                return None
            data = json.loads(jm.group(1))
            entity = data.get("props", {}).get("pageProps", {}).get("state", {}).get("data", {}).get("entity", {})
            if not entity:
                return None

            cover = ""
            if entity.get("coverArt", {}).get("sources"):
                cover = entity["coverArt"]["sources"][0]["url"]

            tracks = []
            for t in entity.get("trackList", []):
                dur_sec = int((t.get("duration") or 0) / 1000)
                preview_url = t.get("audioPreview", {}).get("url") if t.get("audioPreview") else None
                tracks.append({
                    "id": f"sp_{t.get('uid') or t.get('uri', '')}",
                    "source": "spotify",
                    "title": t.get("title") or "Unknown Title",
                    "artist": t.get("subtitle") or "Unknown Artist",
                    "album": entity.get("title") or "Spotify Playlist",
                    "duration": dur_sec,
                    "duration_str": format_duration(dur_sec),
                    "image": cover or "/static/images/default-album.svg",
                    "preview_url": preview_url,
                    "stream_url": None,
                    "spotify_uri": t.get("uri"),
                })

            parsed = {
                "id": pl_id,
                "title": entity.get("title") or "Spotify Playlist",
                "subtitle": entity.get("subtitle") or "",
                "cover": cover,
                "track_count": len(tracks),
                "tracks": tracks,
            }
            _SPOTIFY_PLAYLIST_CACHE[pl_id] = parsed
            return parsed
    except Exception as e:
        print(f"[Spotify parse error] {e}")
        return None


def resolve_spotify_track(title: str, artist: str, preview: Optional[str] = None) -> Dict[str, Any]:
    """Resolve a Spotify track title & artist to a playable 320kbps or YouTube stream."""
    clean_title = clean_html(title).split("(")[0].strip()
    clean_artist = clean_html(artist).split(",")[0].strip()
    cache_key = f"{clean_title.lower()}_{clean_artist.lower()}"

    if cache_key in _RESOLVE_CACHE:
        return _RESOLVE_CACHE[cache_key]

    query = f"{clean_title} {clean_artist}"

    # 1. Search JioSaavn first
    try:
        saavn_res = search_saavn(query, limit=2)
        if saavn_res:
            s = saavn_res[0]
            first_word = clean_title.split()[0].lower()
            if first_word in s["title"].lower():
                res = {
                    "stream_url": s["stream_url"],
                    "stream_320": s["stream_320"],
                    "stream_160": s["stream_160"],
                    "stream_96": s["stream_96"],
                    "image": s["image"],
                    "source": "saavn",
                }
                _RESOLVE_CACHE[cache_key] = res
                return res
    except Exception:
        pass

    # 2. Search YouTube fallback
    try:
        yt_res = search_youtube(f"{query} official audio", limit=1)
        if not yt_res:
            yt_res = search_youtube(query, limit=1)
        if yt_res:
            y = yt_res[0]
            res = {
                "stream_url": y["stream_url"],
                "stream_320": y["stream_url"],
                "stream_160": y["stream_url"],
                "stream_96": y["stream_url"],
                "image": y["image"],
                "source": "youtube",
            }
            _RESOLVE_CACHE[cache_key] = res
            return res
    except Exception:
        pass

    # 3. If preview available, fallback to preview
    if preview:
        return {
            "stream_url": preview,
            "stream_320": preview,
            "stream_160": preview,
            "stream_96": preview,
            "image": "/static/images/default-album.svg",
            "source": "spotify_preview",
        }

    return {"stream_url": None, "source": "none"}


# Mount static files
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/favicon.ico")
async def serve_favicon():
    """Serve the SVG favicon for browser tabs."""
    fav = STATIC_DIR / "images" / "favicon.svg"
    if fav.exists():
        return FileResponse(fav, media_type="image/svg+xml")
    return Response(status_code=204)


@app.get("/", response_class=HTMLResponse)
async def serve_index():
    """Serve the single page Spotify KW application."""
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return HTMLResponse("<h1>Spotify KW is starting up...</h1>")


@app.get("/api/search")
async def api_search(
    q: str = Query(..., min_length=1),
    source: str = Query("all"),
    limit: int = Query(20, le=50)
):
    """Search for songs across JioSaavn, YouTube, and local library, or parse Spotify playlist URL."""
    clean_q = q.strip()

    # Check if user pasted a Spotify playlist link
    if "open.spotify.com/playlist/" in clean_q or clean_q.startswith("spotify:playlist:"):
        pl = parse_spotify_playlist(clean_q)
        if pl:
            return {
                "type": "spotify_playlist",
                "playlist": pl,
                "results": pl["tracks"],
                "count": pl["track_count"],
                "cached": False
            }

    cache_key = f"{clean_q.lower()}_{source}_{limit}"
    if cache_key in _SEARCH_CACHE:
        return {"results": _SEARCH_CACHE[cache_key], "cached": True}

    results: List[Dict[str, Any]] = []

    # 1. Search JioSaavn
    if source in ("all", "saavn"):
        saavn_res = search_saavn(clean_q, limit=limit)
        results.extend(saavn_res)

    # 2. If results are few or source specifies YouTube, run YouTube fallback
    if (len(results) < 3 and source == "all") or source == "youtube":
        yt_res = search_youtube(clean_q, limit=6)
        # Avoid exact duplicate titles
        existing_titles = {r["title"].lower() for r in results}
        for yt_item in yt_res:
            if yt_item["title"].lower() not in existing_titles:
                results.append(yt_item)

    # Manage memory: limit cache to 50 items
    if len(_SEARCH_CACHE) >= _MAX_CACHE_SIZE:
        oldest_keys = list(_SEARCH_CACHE.keys())[:10]
        for k in oldest_keys:
            _SEARCH_CACHE.pop(k, None)
            
    _SEARCH_CACHE[cache_key] = results
    return {"results": results, "cached": False, "count": len(results)}


@app.get("/api/spotify/playlist")
async def api_spotify_playlist(url: str = Query(...)):
    """Fetch all tracks and metadata from any Spotify playlist link."""
    pl = parse_spotify_playlist(url)
    if not pl:
        raise HTTPException(status_code=404, detail="Gagal mengambil playlist dari Spotify. Pastikan link valid dan playlist bersifat publik.")
    return pl


@app.get("/api/spotify/resolve")
async def api_spotify_resolve(
    title: str = Query(...),
    artist: str = Query(""),
    preview: Optional[str] = Query(None)
):
    """Resolve a Spotify song title & artist to a playable 320kbps / YouTube stream."""
    return resolve_spotify_track(title, artist, preview)


@app.get("/api/spotify/user-playlists")
async def api_spotify_user_playlists():
    """Get pre-configured user playlists (gen z songs english & Indo Happy Playlist)."""
    results = []
    for cfg in USER_PLAYLISTS_CONFIG:
        pl = parse_spotify_playlist(cfg["url"])
        if pl:
            results.append({
                "id": pl["id"],
                "name": cfg["name"],
                "title": pl["title"],
                "subtitle": pl["subtitle"],
                "cover": pl["cover"],
                "track_count": pl["track_count"],
                "url": cfg["url"],
            })
    return results


CURATED_PLAYLISTS = {
    "featured-global": {
        "id": "featured-global",
        "title": "🔥 Top Global Billboard Hits",
        "subtitle": "Koleksi hits internasional terpopuler (Bruno Mars, Billie Eilish, Taylor Swift, dll.)",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&q=80",
        "queries": [
            ("Die With A Smile", "Lady Gaga, Bruno Mars", 251),
            ("BIRDS OF A FEATHER", "Billie Eilish", 183),
            ("Cruel Summer", "Taylor Swift", 178),
            ("Espresso", "Sabrina Carpenter", 175),
            ("Blinding Lights", "The Weeknd", 200),
            ("Viva La Vida", "Coldplay", 242),
            ("Beautiful Things", "Benson Boone", 180),
            ("As It Was", "Harry Styles", 167),
            ("greedy", "Tate McRae", 131),
            ("Flowers", "Miley Cyrus", 200),
            ("Stay", "The Kid LAROI, Justin Bieber", 141),
            ("Levitating", "Dua Lipa", 203),
        ]
    },
    "featured-indo": {
        "id": "featured-indo",
        "title": "🇮🇩 Indonesian Top Hits",
        "subtitle": "Koleksi hits terpopuler musisi tanah air (Bernadya, Tulus, Hindia, Nadin, dll.)",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&q=80",
        "queries": [
            ("Untungnya, Hidup Harus Tetap Berjalan", "Bernadya", 217),
            ("Rayuan Perempuan Gila", "Nadin Amizah", 312),
            ("Lebih Indah", "Adera", 258),
            ("Hati-Hati di Jalan", "Tulus", 242),
            ("Evaluasi", "Hindia", 235),
            ("Sial", "Mahalini", 243),
            ("Komang", "Raim Laode", 239),
            ("Remaja", "HiVi!", 218),
            ("Adu Rayu", "Yovie Widianto, Tulus, Glenn Fredly", 207),
            ("Asing", "Juicy Luicy", 210),
            ("Kisah Sempurna", "Mahalini", 276),
            ("Rumah ke Rumah", "Hindia", 277),
        ]
    },
    "featured-chill": {
        "id": "featured-chill",
        "title": "☕ Chill & Lofi Vibes",
        "subtitle": "Lagu santai untuk fokus, belajar, ngopi, dan relaksasi",
        "cover": "https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=500&q=80",
        "queries": [
            ("Glimpse of Us", "Joji", 233),
            ("Beside You", "keshi", 166),
            ("Every Summertime", "NIKI", 215),
            ("comethru", "Jeremy Zucker", 181),
            ("Sanctuary", "Joji", 180),
            ("death bed (coffee for your head)", "Powfu, beabadoobee", 173),
            ("Sunday Best", "Surfaces", 158),
            ("Location Unknown", "HONNE", 298),
            ("Double Take", "dhruv", 171),
            ("Until I Found You", "Stephen Sanchez", 177),
            ("Paris in the Rain", "Lauv", 205),
            ("Best Part", "Daniel Caesar, H.E.R.", 209),
        ]
    },
    "featured-rock": {
        "id": "featured-rock",
        "title": "🎸 Rock & Classic Legends",
        "subtitle": "Karya legendaris abadi sepanjang masa tanpa batas zaman",
        "cover": "https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=500&q=80",
        "queries": [
            ("Bohemian Rhapsody", "Queen", 354),
            ("Yellow", "Coldplay", 269),
            ("Don't Look Back In Anger", "Oasis", 288),
            ("Boulevard of Broken Dreams", "Green Day", 262),
            ("Creep", "Radiohead", 238),
            ("Numb", "Linkin Park", 187),
            ("Smells Like Teen Spirit", "Nirvana", 301),
            ("Sweet Child O' Mine", "Guns N' Roses", 356),
            ("Wonderwall", "Oasis", 258),
            ("In The End", "Linkin Park", 216),
            ("Hotel California", "Eagles", 391),
            ("Fix You", "Coldplay", 295),
        ]
    }
}


@app.get("/api/playlist/curated")
async def api_playlist_curated(id: str = Query(...)):
    """Get curated Western or Indonesian playlist without any Indian tracks."""
    if id in CURATED_PLAYLISTS:
        data = CURATED_PLAYLISTS[id]
        tracks = []
        for idx, (title, artist, dur) in enumerate(data["queries"]):
            tracks.append({
                "id": f"cur_{id}_{idx}",
                "source": "curated",
                "title": title,
                "artist": artist,
                "album": data["title"],
                "duration": dur,
                "duration_str": format_duration(dur),
                "image": data["cover"],
                "stream_url": None,
            })
        return {
            "id": id,
            "title": data["title"],
            "subtitle": data["subtitle"],
            "cover": data["cover"],
            "track_count": len(tracks),
            "tracks": tracks,
        }
    raise HTTPException(status_code=404, detail="Playlist tidak ditemukan")


@app.get("/api/featured")
async def api_featured():
    """Curated initial music sections (100% Western & Indonesian, NO Indian music)."""
    sections = []
    for pl_id, data in CURATED_PLAYLISTS.items():
        tracks = []
        for idx, (title, artist, dur) in enumerate(data["queries"][:6]):
            tracks.append({
                "id": f"cur_{pl_id}_{idx}",
                "source": "curated",
                "title": title,
                "artist": artist,
                "album": data["title"],
                "duration": dur,
                "duration_str": format_duration(dur),
                "image": data["cover"],
                "stream_url": None,
            })
        sections.append({
            "id": pl_id,
            "category": data["title"],
            "subtitle": data["subtitle"],
            "tracks": tracks,
        })
    return sections


def get_safe_filename(track_id: str) -> str:
    return re.sub(r'[^a-zA-Z0-9_-]', '_', str(track_id))


def load_downloads_meta() -> Dict[str, Any]:
    if DOWNLOADS_META_FILE.exists():
        try:
            with open(DOWNLOADS_META_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def save_downloads_meta(data: Dict[str, Any]):
    try:
        with open(DOWNLOADS_META_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[Save downloads.json error] {e}")


def download_single_track(track: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    track_id = track.get("id")
    if not track_id:
        return None

    safe_name = get_safe_filename(track_id)
    file_path = DOWNLOADS_DIR / f"{safe_name}.m4a"

    # If already downloaded and valid size (>50KB), return existing
    if file_path.exists() and file_path.stat().st_size > 50000:
        meta = load_downloads_meta()
        if track_id in meta:
            return meta[track_id]

    stream_url = track.get("stream_url") or track.get("stream_320")
    if not stream_url:
        # Resolve Spotify stream
        resolved = resolve_spotify_track(track.get("title", ""), track.get("artist", ""), track.get("preview_url"))
        if resolved and resolved.get("stream_url"):
            stream_url = resolved["stream_url"]
            if resolved.get("image") and not track.get("image"):
                track["image"] = resolved["image"]

    if not stream_url:
        return None

    try:
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
        resp = requests.get(stream_url, headers=headers, stream=True, timeout=25)
        if resp.status_code not in (200, 206):
            return None

        temp_path = DOWNLOADS_DIR / f"{safe_name}.tmp"
        size = 0
        with open(temp_path, "wb") as f:
            for chunk in resp.iter_content(chunk_size=65536):
                if chunk:
                    f.write(chunk)
                    size += len(chunk)

        if size < 50000:
            if temp_path.exists():
                temp_path.unlink()
            return None

        if file_path.exists():
            file_path.unlink()
        temp_path.rename(file_path)

        track_meta = {
            "id": track_id,
            "title": track.get("title") or "Unknown Title",
            "artist": track.get("artist") or "Unknown Artist",
            "album": track.get("album") or "Offline Download",
            "duration": track.get("duration") or 0,
            "duration_str": track.get("duration_str") or format_duration(track.get("duration", 0)),
            "image": track.get("image") or "/static/images/default-album.svg",
            "local_file": str(file_path),
            "file_size": size,
            "downloaded_at": int(time.time()),
            "source": "offline",
            "stream_url": f"/api/offline/stream/{safe_name}",
        }

        all_meta = load_downloads_meta()
        all_meta[track_id] = track_meta
        save_downloads_meta(all_meta)
        return track_meta
    except Exception as e:
        print(f"[Download Track Error] {e}")
        return None


def _download_worker():
    global _DOWNLOAD_STATE, _DOWNLOAD_QUEUE
    while True:
        track = None
        with _DOWNLOAD_LOCK:
            if not _DOWNLOAD_QUEUE:
                _DOWNLOAD_STATE["is_downloading"] = False
                _DOWNLOAD_STATE["current_track"] = None
                break
            track = _DOWNLOAD_QUEUE.pop(0)
            _DOWNLOAD_STATE["is_downloading"] = True
            _DOWNLOAD_STATE["current_track"] = track.get("title", "")

        res = download_single_track(track)
        with _DOWNLOAD_LOCK:
            if res:
                _DOWNLOAD_STATE["completed"] += 1
            else:
                _DOWNLOAD_STATE["failed"] += 1
        time.sleep(0.15)


@app.get("/api/stream")
async def api_stream(request: Request, url: str = Query(...), track_id: Optional[str] = Query(None)):
    """
    Streaming proxy with full HTTP 206 Partial Content support.
    Enables instant seek scrubbing and minimal RAM allocation (64KB chunks).
    If track is downloaded offline, serves directly from disk with 0 internet.
    """
    if track_id:
        safe_name = get_safe_filename(track_id)
        local_file = DOWNLOADS_DIR / f"{safe_name}.m4a"
        if local_file.exists() and local_file.stat().st_size > 50000:
            return FileResponse(local_file, media_type="audio/mp4")

    if not url or not url.startswith("http"):
        # Check if url might be an offline stream endpoint
        if url and "/api/offline/stream/" in url:
            safe_name = url.split("/")[-1]
            local_file = DOWNLOADS_DIR / f"{safe_name}.m4a"
            if local_file.exists() and local_file.stat().st_size > 50000:
                return FileResponse(local_file, media_type="audio/mp4")
        raise HTTPException(status_code=400, detail="Invalid stream URL")

    # Range header from client (browser <audio>)
    range_header = request.headers.get("Range")
    upstream_headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    }
    if range_header:
        upstream_headers["Range"] = range_header

    try:
        upstream_resp = requests.get(url, headers=upstream_headers, stream=True, timeout=10)
        
        status_code = upstream_resp.status_code
        response_headers = {}
        for h in ["Content-Range", "Content-Length", "Content-Type", "Accept-Ranges"]:
            if h in upstream_resp.headers:
                response_headers[h] = upstream_resp.headers[h]
        if "Accept-Ranges" not in response_headers:
            response_headers["Accept-Ranges"] = "bytes"
        if "Content-Type" not in response_headers:
            response_headers["Content-Type"] = "audio/mp4"

        def iter_chunks():
            try:
                for chunk in upstream_resp.iter_content(chunk_size=65536):
                    if chunk:
                        yield chunk
            except Exception as e:
                print(f"[Stream chunk err] {e}")

        return StreamingResponse(
            iter_chunks(),
            status_code=status_code,
            headers=response_headers,
            media_type=response_headers.get("Content-Type", "audio/mp4")
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Streaming error: {str(e)}")


@app.get("/api/offline/list")
async def api_offline_list():
    """Return all locally downloaded tracks."""
    meta = load_downloads_meta()
    valid_tracks = []
    updated = False
    for tid, t in list(meta.items()):
        safe_name = get_safe_filename(tid)
        local_file = DOWNLOADS_DIR / f"{safe_name}.m4a"
        if local_file.exists() and local_file.stat().st_size > 50000:
            t["stream_url"] = f"/api/offline/stream/{safe_name}"
            valid_tracks.append(t)
        else:
            del meta[tid]
            updated = True
    if updated:
        save_downloads_meta(meta)
    return valid_tracks


@app.post("/api/offline/download")
async def api_offline_download(request: Request):
    """Download a single track for offline playback."""
    track = await request.json()
    if not track or not track.get("id"):
        raise HTTPException(status_code=400, detail="Invalid track data")
    
    res = download_single_track(track)
    if res:
        return {"status": "success", "track": res}
    return {"status": "error", "message": "Gagal mengunduh lagu"}


@app.post("/api/offline/download-playlist")
async def api_offline_download_playlist(request: Request):
    """Queue entire playlist for background sequential download."""
    data = await request.json()
    tracks = data.get("tracks", [])
    if not tracks:
        return {"status": "empty", "queued": 0}

    all_meta = load_downloads_meta()
    to_queue = []
    for t in tracks:
        tid = t.get("id")
        if not tid:
            continue
        safe_name = get_safe_filename(tid)
        local_file = DOWNLOADS_DIR / f"{safe_name}.m4a"
        if not (local_file.exists() and local_file.stat().st_size > 50000 and tid in all_meta):
            to_queue.append(t)

    with _DOWNLOAD_LOCK:
        _DOWNLOAD_QUEUE.extend(to_queue)
        _DOWNLOAD_STATE["total"] += len(to_queue)
        if not _DOWNLOAD_STATE["is_downloading"]:
            _DOWNLOAD_STATE["is_downloading"] = True
            threading.Thread(target=_download_worker, daemon=True).start()

    return {"status": "queued", "queued_count": len(to_queue), "total_queue": len(_DOWNLOAD_QUEUE)}


@app.get("/api/offline/progress")
async def api_offline_progress():
    """Return background download progress."""
    with _DOWNLOAD_LOCK:
        return {
            "is_downloading": _DOWNLOAD_STATE["is_downloading"],
            "current_track": _DOWNLOAD_STATE["current_track"],
            "completed": _DOWNLOAD_STATE["completed"],
            "total": _DOWNLOAD_STATE["total"],
            "failed": _DOWNLOAD_STATE["failed"],
            "remaining": len(_DOWNLOAD_QUEUE),
        }


@app.delete("/api/offline/delete")
async def api_offline_delete(track_id: str = Query(...)):
    """Delete a downloaded track from disk and metadata."""
    safe_name = get_safe_filename(track_id)
    local_file = DOWNLOADS_DIR / f"{safe_name}.m4a"
    if local_file.exists():
        try:
            local_file.unlink()
        except Exception:
            pass

    all_meta = load_downloads_meta()
    if track_id in all_meta:
        del all_meta[track_id]
        save_downloads_meta(all_meta)

    return {"status": "deleted", "id": track_id}


@app.get("/api/offline/stream/{safe_name}")
async def api_offline_stream(safe_name: str):
    """Serve downloaded track directly from local disk."""
    local_file = DOWNLOADS_DIR / f"{safe_name}.m4a"
    if local_file.exists():
        return FileResponse(local_file, media_type="audio/mp4")
    raise HTTPException(status_code=404, detail="File offline tidak ditemukan")


@app.get("/api/lyrics")
async def api_lyrics(track: str = Query(...), artist: str = Query(""), duration: Optional[float] = None):
    """
    Fetch synchronized lyrics (LRCLIB) for karaoke style scrolling.
    """
    # Clean track title (remove feat, remaster, radio edit, etc.)
    clean_title = track.split("(")[0].split("-")[0].strip()
    clean_artist = artist.split(",")[0].split("&")[0].strip()

    params = {
        "track_name": clean_title,
        "artist_name": clean_artist,
    }
    if duration and duration > 0:
        params["duration"] = str(int(duration))

    headers = {"User-Agent": "SpotifyKW/1.0 (https://github.com/spotify-kw)"}

    try:
        resp = requests.get("https://lrclib.net/api/get", params=params, headers=headers, timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            return {
                "synced": bool(data.get("syncedLyrics")),
                "syncedLyrics": data.get("syncedLyrics"),
                "plainLyrics": data.get("plainLyrics"),
            }
    except Exception as e:
        print(f"[LRCLIB Error] {e}")

    # Fallback: search lrclib
    try:
        search_resp = requests.get(
            f"https://lrclib.net/api/search?q={urllib.parse.quote(clean_title + ' ' + clean_artist)}",
            headers=headers,
            timeout=5
        )
        if search_resp.status_code == 200:
            results = search_resp.json()
            if results and len(results) > 0:
                first = results[0]
                return {
                    "synced": bool(first.get("syncedLyrics")),
                    "syncedLyrics": first.get("syncedLyrics"),
                    "plainLyrics": first.get("plainLyrics"),
                }
    except Exception:
        pass

    return {"synced": False, "syncedLyrics": None, "plainLyrics": "Lirik tidak ditemukan untuk lagu ini."}


@app.get("/api/local/scan")
async def api_local_scan(path: Optional[str] = Query(None)):
    """Scan a local directory on Windows for audio files with metadata."""
    if not path or not os.path.exists(path):
        # Default to user's Music folder
        path = os.path.expanduser("~/Music")

    audio_extensions = {".mp3", ".flac", ".wav", ".m4a", ".aac", ".ogg"}
    songs = []

    try:
        for root, _, files in os.walk(path):
            for file in files:
                ext = os.path.splitext(file)[1].lower()
                if ext in audio_extensions:
                    full_path = os.path.join(root, file)
                    try:
                        tag = TinyTag.get(full_path, image=False)
                        dur = int(tag.duration or 0)
                        title = tag.title or os.path.splitext(file)[0]
                        artist = tag.artist or "Unknown Artist"
                        album = tag.album or "Local Music"
                        year = tag.year or ""
                    except Exception:
                        title = os.path.splitext(file)[0]
                        artist = "Unknown Artist"
                        album = "Local Music"
                        dur = 0
                        year = ""

                    songs.append({
                        "id": f"local_{hash(full_path)}",
                        "source": "local",
                        "title": title,
                        "artist": artist,
                        "album": album,
                        "year": year,
                        "duration": dur,
                        "duration_str": format_duration(dur),
                        "image": "/static/images/local-album.png",
                        "file_path": full_path,
                        "stream_url": f"/api/local/stream?file={urllib.parse.quote(full_path)}",
                    })
    except Exception as e:
        print(f"[Local scan error] {e}")

    return {"folder": path, "count": len(songs), "songs": songs}


@app.get("/api/local/stream")
async def api_local_stream(request: Request, file: str = Query(...)):
    """Stream a local audio file with HTTP Range support for seeking."""
    if not os.path.exists(file):
        raise HTTPException(status_code=404, detail="File not found")

    file_size = os.path.getsize(file)
    range_header = request.headers.get("Range")

    if range_header:
        byte_range = range_header.replace("bytes=", "").split("-")
        start = int(byte_range[0]) if byte_range[0] else 0
        end = int(byte_range[1]) if len(byte_range) > 1 and byte_range[1] else file_size - 1
        length = (end - start) + 1

        def file_iterator():
            with open(file, "rb") as f:
                f.seek(start)
                bytes_left = length
                while bytes_left > 0:
                    chunk_size = min(65536, bytes_left)
                    chunk = f.read(chunk_size)
                    if not chunk:
                        break
                    bytes_left -= len(chunk)
                    yield chunk

        headers = {
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(length),
            "Content-Type": "audio/mpeg",
        }
        return StreamingResponse(file_iterator(), status_code=206, headers=headers)
    else:
        return FileResponse(file, media_type="audio/mpeg")


@app.get("/api/open-folder")
async def api_open_folder():
    """Trigger a native Windows FolderBrowserDialog via PowerShell."""
    try:
        ps_cmd = (
            "[System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms') | Out-Null; "
            "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog; "
            "$dialog.Description = 'Pilih Folder Musik Anda'; "
            "$dialog.ShowNewFolderButton = $false; "
            "if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { "
            "  Write-Output $dialog.SelectedPath "
            "}"
        )
        proc = subprocess.run(["powershell", "-Command", ps_cmd], capture_output=True, text=True, timeout=30)
        selected_path = proc.stdout.strip()
        if selected_path and os.path.exists(selected_path):
            return {"success": True, "path": selected_path}
    except Exception as e:
        print(f"[Folder dialog error] {e}")

    # Fallback to standard Music folder
    default_music = os.path.expanduser("~/Music")
    return {"success": True, "path": default_music}


@app.get("/api/stats")
async def api_stats():
    """
    Live RAM & Storage resource tracker.
    Monitors memory consumption of Spotify KW vs Official Spotify benchmark.
    """
    current_proc = psutil.Process(os.getpid())
    py_ram_bytes = current_proc.memory_info().rss
    
    # Check child processes
    for child in current_proc.children(recursive=True):
        try:
            py_ram_bytes += child.memory_info().rss
        except Exception:
            pass

    # Check Edge processes if launched in app mode
    edge_ram_bytes = 0
    try:
        for p in psutil.process_iter(["name", "memory_info", "cmdline"]):
            if p.info["name"] and "msedge" in p.info["name"].lower():
                cmdline = p.info.get("cmdline") or []
                if any("spotify-kw" in arg.lower() or "8765" in arg for arg in cmdline):
                    edge_ram_bytes += p.info["memory_info"].rss
    except Exception:
        pass

    total_ram_mb = round((py_ram_bytes + edge_ram_bytes) / (1024 * 1024), 1)
    python_ram_mb = round(py_ram_bytes / (1024 * 1024), 1)
    
    # Calculate disk cache size
    cache_bytes = 0
    try:
        for root, _, files in os.walk(CACHE_DIR):
            for f in files:
                cache_bytes += os.path.getsize(os.path.join(root, f))
    except Exception:
        pass
    cache_mb = round(cache_bytes / (1024 * 1024), 2)

    # Official Spotify Benchmarks
    spotify_benchmark_ram = 650.0  # ~650 MB average
    spotify_benchmark_storage = 550.0  # ~550 MB average

    ram_saved_pct = max(0, round(((spotify_benchmark_ram - total_ram_mb) / spotify_benchmark_ram) * 100))
    storage_saved_pct = max(0, round(((spotify_benchmark_storage - (cache_mb + 4.5)) / spotify_benchmark_storage) * 100))

    return {
        "python_ram_mb": python_ram_mb,
        "total_ram_mb": total_ram_mb,
        "spotify_benchmark_ram_mb": spotify_benchmark_ram,
        "ram_saved_percent": ram_saved_pct,
        "cache_mb": cache_mb,
        "spotify_benchmark_storage_mb": spotify_benchmark_storage,
        "storage_saved_percent": storage_saved_pct,
        "in_memory_cache_count": len(_SEARCH_CACHE),
    }


@app.post("/api/cache/clear")
async def api_cache_clear():
    """Flush all in-memory search caches and disk temporary items."""
    global _SEARCH_CACHE
    _SEARCH_CACHE.clear()
    
    deleted_files = 0
    for root, _, files in os.walk(CACHE_DIR):
        for f in files:
            try:
                os.remove(os.path.join(root, f))
                deleted_files += 1
            except Exception:
                pass
                
    return {"status": "success", "message": "Cache berhasil dibersihkan", "deleted_files": deleted_files}


def launch_desktop_window(port: int = 8765):
    """
    Launch Microsoft Edge in dedicated standalone App Mode.
    Provides a genuine native desktop app experience (no URL bar, no tabs)
    while sharing the system's preloaded browser engine to keep RAM under 70MB.
    """
    time.sleep(1.2)  # Wait for uvicorn to boot
    app_url = f"http://127.0.0.1:{port}"
    edge_paths = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    ]
    
    edge_bin = None
    for p in edge_paths:
        if os.path.exists(p):
            edge_bin = p
            break

    profile_dir = Path(os.path.expandvars(r"%LOCALAPPDATA%\SpotifyKW\Profile"))
    profile_dir.mkdir(parents=True, exist_ok=True)

    if edge_bin:
        args = [
            edge_bin,
            f"--app={app_url}",
            f"--user-data-dir={profile_dir}",
            "--window-size=1280,820",
            "--app-id=spotify-kw",
            "--disable-features=Translate,ExtensionsToolbarMenu",
        ]
        try:
            subprocess.Popen(args)
            return
        except Exception as e:
            print(f"[Edge launch error] {e}")

    # Fallback to default browser
    webbrowser.open(app_url)


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass

    port = 8765
    desktop_mode = "--no-desktop" not in sys.argv

    if desktop_mode:
        threading.Thread(target=launch_desktop_window, args=(port,), daemon=True).start()

    print("=" * 60)
    print("  [>] Spotify KW - Ultra-Lightweight Edition")
    print(f"  [*] Local access:   http://127.0.0.1:{port}")
    print(f"  [*] Network access: http://0.0.0.0:{port} (Bisa dibuka HP / PC lain di Wi-Fi yang sama)")
    print("  [*] Minimal RAM & Storage Consumption (<70MB RAM)")
    print("=" * 60)
    
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="warning")
