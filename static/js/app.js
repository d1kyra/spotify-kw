/**
 * Spotify KW - Core Application Engine
 * Ultra-Lightweight | Zero-Framework ES6+ | Web Audio API | Synced Lyrics
 */

document.addEventListener('DOMContentLoaded', () => {
  // ==========================================
  // STATE MANAGEMENT
  // ==========================================
  const state = {
    currentTrack: null,
    queue: [],
    history: [],
    isPlaying: false,
    isShuffle: false,
    repeatMode: 0, // 0: off, 1: all, 2: one
    volume: parseFloat(localStorage.getItem('spkw_volume') || '0.8'),
    isMuted: false,
    audioQuality: localStorage.getItem('spkw_quality') || '320',
    likedSongs: JSON.parse(localStorage.getItem('spkw_liked') || '[]'),
    userPlaylists: JSON.parse(localStorage.getItem('spkw_playlists') || '[]'),
    activeView: 'home',
    searchSource: 'all',
    searchDebounceTimer: null,
    syncedLyrics: [],
    activeLyricIndex: -1,
    lyricsOpen: false,
    visualizerOpen: false,
    queueOpen: false,
    localSongs: [],
    audioContext: null,
    analyser: null,
    visualizerAnimationId: null,
    currentPlaylistTracks: [],
  };

  // ==========================================
  // DOM ELEMENTS CACHE
  // ==========================================
  const audio = document.getElementById('audio-engine');
  const btnPlayPause = document.getElementById('btn-play-pause');
  const iconPlay = document.getElementById('icon-play');
  const iconPause = document.getElementById('icon-pause');
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');
  const btnShuffle = document.getElementById('btn-shuffle');
  const btnRepeat = document.getElementById('btn-repeat');
  const repeatOneIndicator = document.getElementById('repeat-one-indicator');
  
  const playerThumb = document.getElementById('player-thumb');
  const playerTitle = document.getElementById('player-title');
  const playerArtist = document.getElementById('player-artist');
  const btnLikeCurrent = document.getElementById('btn-like-current');
  
  const seekSlider = document.getElementById('seek-slider');
  const seekFill = document.getElementById('seek-fill');
  const currentTimeLabel = document.getElementById('current-time');
  const totalDurationLabel = document.getElementById('total-duration');
  
  const volumeSlider = document.getElementById('volume-slider');
  const volumeFill = document.getElementById('volume-fill');
  const btnVolumeIcon = document.getElementById('btn-volume-icon');
  const volIconHigh = document.getElementById('vol-icon-high');
  const volIconMuted = document.getElementById('vol-icon-muted');
  const audioQualitySelect = document.getElementById('audio-quality-select');
  
  const globalSearchInput = document.getElementById('global-search-input');
  const btnClearSearch = document.getElementById('btn-clear-search');
  
  // Views
  const viewHome = document.getElementById('view-home');
  const viewSearch = document.getElementById('view-search');
  const viewPlaylist = document.getElementById('view-playlist');
  const viewLocal = document.getElementById('view-local');
  const views = { home: viewHome, search: viewSearch, playlist: viewPlaylist, local: viewLocal };

  // Nav Items
  const navHome = document.getElementById('nav-home');
  const navSearch = document.getElementById('nav-search');
  const navLibrary = document.getElementById('nav-library');
  const navLiked = document.getElementById('nav-liked');
  const navLocal = document.getElementById('nav-local');
  const likedCountBadge = document.getElementById('liked-count-badge');
  const localCountBadge = document.getElementById('local-count-badge');

  // Overlays / Modals
  const lyricsOverlay = document.getElementById('lyrics-overlay');
  const lyricsContainer = document.getElementById('lyrics-container');
  const lyricsTitle = document.getElementById('lyrics-title');
  const lyricsArtist = document.getElementById('lyrics-artist');
  const btnToggleLyrics = document.getElementById('btn-toggle-lyrics');
  const btnCloseLyrics = document.getElementById('btn-close-lyrics');

  const visualizerOverlay = document.getElementById('visualizer-overlay');
  const visualizerCanvas = document.getElementById('visualizer-canvas');
  const btnToggleVisualizer = document.getElementById('btn-toggle-visualizer');
  const btnCloseVisualizer = document.getElementById('btn-close-visualizer');

  const queueDrawer = document.getElementById('queue-drawer');
  const btnToggleQueue = document.getElementById('btn-toggle-queue');
  const btnCloseQueue = document.getElementById('btn-close-queue');
  const queueNowPlayingBox = document.getElementById('queue-now-playing-box');
  const queueNextItems = document.getElementById('queue-next-items');
  const btnClearQueue = document.getElementById('btn-clear-queue');

  const statsModal = document.getElementById('stats-modal');
  const ramPill = document.getElementById('ram-pill');
  const ramStatText = document.getElementById('ram-stat-text');
  const ramSaveTag = document.getElementById('ram-save-tag');
  const btnOpenStatsModal = document.getElementById('btn-open-stats-modal');
  const btnCloseStatsModal = document.getElementById('btn-close-stats-modal');
  const btnClearCache = document.getElementById('btn-clear-cache');

  // ==========================================
  // INITIALIZATION
  // ==========================================
  function init() {
    setupAudioEvents();
    setupControls();
    setupNavigation();
    setupSearch();
    setupLyrics();
    setupVisualizer();
    setupLocalMusic();
    setupStatsPoller();
    setupMediaSession();
    setupKeyboardShortcuts();
    
    // Set initial volume
    audio.volume = state.volume;
    volumeSlider.value = state.volume;
    volumeFill.style.width = `${state.volume * 100}%`;
    audioQualitySelect.value = state.audioQuality;
    updateLikedBadge();

    // Set greeting based on time of day
    setGreeting();

    // Load initial recommendations on home page
    loadFeaturedMusic();
  }

  function setGreeting() {
    const greetingText = document.getElementById('greeting-text');
    const hour = new Date().getHours();
    let greet = 'Selamat Datang';
    if (hour >= 4 && hour < 11) greet = 'Selamat Pagi ☀️';
    else if (hour >= 11 && hour < 15) greet = 'Selamat Siang 🌤️';
    else if (hour >= 15 && hour < 18) greet = 'Selamat Sore 🌇';
    else greet = 'Selamat Malam 🌙';
    if (greetingText) greetingText.textContent = greet;
  }

  // ==========================================
  // AUDIO & PLAYBACK ENGINE
  // ==========================================
  function setupAudioEvents() {
    audio.addEventListener('play', () => {
      state.isPlaying = true;
      updatePlayPauseIcons();
      initWebAudio();
    });

    audio.addEventListener('pause', () => {
      state.isPlaying = false;
      updatePlayPauseIcons();
    });

    audio.addEventListener('timeupdate', () => {
      if (!audio.duration || isNaN(audio.duration)) return;
      const cur = audio.currentTime;
      const dur = audio.duration;

      // Update seekbar
      seekSlider.value = (cur / dur) * 100;
      seekFill.style.width = `${(cur / dur) * 100}%`;
      currentTimeLabel.textContent = formatTime(cur);
      totalDurationLabel.textContent = formatTime(dur);

      // Synchronize lyrics if active
      if (state.lyricsOpen && state.syncedLyrics.length > 0) {
        updateSyncedLyrics(cur);
      }
    });

    audio.addEventListener('ended', () => {
      handleTrackEnded();
    });

    audio.addEventListener('error', (e) => {
      console.warn('Audio playback error, attempting fallback:', e);
      // If error occurs with 320kbps, try 160kbps or next track
      if (state.currentTrack && state.currentTrack.stream_160 && state.audioQuality === '320') {
        audio.src = `/api/stream?url=${encodeURIComponent(state.currentTrack.stream_160)}`;
        audio.play().catch(() => {});
      }
    });
  }

  function playTrack(track, newQueue = null) {
    if (!track) return;
    
    if (newQueue && Array.isArray(newQueue)) {
      state.queue = [...newQueue];
    }
    
    // Add current track to history
    if (state.currentTrack) {
      state.history.push(state.currentTrack);
      if (state.history.length > 30) state.history.shift();
    }

    state.currentTrack = track;

    // Check if track is from Spotify or Curated and streamUrl needs resolving
    if ((track.source === 'spotify' || track.source === 'curated') && !track.stream_url) {
      playerTitle.textContent = track.title || 'Unknown Title';
      playerArtist.textContent = (track.artist || 'Unknown Artist') + ' • Mengambil audio 320k...';
      playerThumb.src = track.image || '/static/images/default-album.svg';
      updateCurrentLikeButton();
      updateQueueUI();
      highlightActiveTrackRow();

      // If preview available, start it immediately so user hears sound in <50ms
      if (track.preview_url) {
        audio.src = `/api/stream?url=${encodeURIComponent(track.preview_url)}`;
        audio.play().then(() => {
          state.isPlaying = true;
          updatePlayPauseIcons();
        }).catch(() => {});
      }

      // Resolve full 320kbps stream in background
      fetch(`/api/spotify/resolve?title=${encodeURIComponent(track.title)}&artist=${encodeURIComponent(track.artist)}&preview=${encodeURIComponent(track.preview_url || '')}`)
        .then(r => r.json())
        .then(res => {
          if (res.stream_url) {
            track.stream_url = res.stream_url;
            track.stream_320 = res.stream_320 || res.stream_url;
            track.stream_160 = res.stream_160 || res.stream_url;
            track.stream_96 = res.stream_96 || res.stream_url;
            if (res.image && res.image !== '/static/images/default-album.svg') {
              track.image = res.image;
              playerThumb.src = res.image;
            }
            playerArtist.textContent = track.artist || 'Unknown Artist';
            const curTime = audio.currentTime;
            audio.src = `/api/stream?url=${encodeURIComponent(res.stream_url)}`;
            audio.currentTime = curTime;
            audio.play().then(() => {
              state.isPlaying = true;
              updatePlayPauseIcons();
            }).catch(() => {});
          } else {
            playerArtist.textContent = track.artist || 'Unknown Artist';
          }
        })
        .catch(e => {
          console.warn('Resolve error:', e);
          playerArtist.textContent = track.artist || 'Unknown Artist';
        });

      updateMediaSessionMetadata(track);
      loadLyrics(track);
      return;
    }

    // Resolve stream URL
    let streamUrl = track.stream_url;
    if (state.audioQuality === '160' && track.stream_160) {
      streamUrl = track.stream_160;
    } else if (state.audioQuality === '96' && track.stream_96) {
      streamUrl = track.stream_96;
    } else if (track.stream_320) {
      streamUrl = track.stream_320;
    }

    if (!streamUrl) {
      alert('Tautan lagu tidak valid atau tidak dapat dimainkan.');
      return;
    }

    // Use streaming proxy for range header support and zero CORS issues
    if (streamUrl.startsWith('http')) {
      audio.src = `/api/stream?url=${encodeURIComponent(streamUrl)}`;
    } else {
      audio.src = streamUrl; // Local file stream
    }

    // Update bottom player UI
    playerTitle.textContent = track.title || 'Unknown Title';
    playerArtist.textContent = track.artist || 'Unknown Artist';
    playerThumb.src = track.image || '/static/images/default-album.svg';
    playerThumb.onerror = () => { playerThumb.src = '/static/images/default-album.svg'; };

    // Update Like Heart
    updateCurrentLikeButton();

    // Start playback
    audio.play().then(() => {
      state.isPlaying = true;
      updatePlayPauseIcons();
    }).catch(err => {
      console.warn('Playback error:', err);
    });

    // Update MediaSession
    updateMediaSessionMetadata(track);

    // Fetch synchronized lyrics
    loadLyrics(track);

    // Update queue UI if open
    updateQueueUI();

    // Highlight row in active tracklist
    highlightActiveTrackRow();
  }

  function togglePlayPause() {
    if (!state.currentTrack) {
      if (state.currentPlaylistTracks.length > 0) {
        playTrack(state.currentPlaylistTracks[0], state.currentPlaylistTracks.slice(1));
      }
      return;
    }

    if (audio.paused) {
      audio.play().catch(e => console.warn(e));
    } else {
      audio.pause();
    }
  }

  function playNextTrack() {
    if (state.repeatMode === 2) {
      audio.currentTime = 0;
      audio.play();
      return;
    }

    if (state.queue.length > 0) {
      let nextIndex = 0;
      if (state.isShuffle) {
        nextIndex = Math.floor(Math.random() * state.queue.length);
      }
      const nextTrack = state.queue.splice(nextIndex, 1)[0];
      playTrack(nextTrack);
    } else if (state.repeatMode === 1 && state.history.length > 0) {
      // Repeat all
      state.queue = [...state.history];
      state.history = [];
      playNextTrack();
    } else {
      console.log('End of queue');
    }
  }

  function playPrevTrack() {
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }

    if (state.history.length > 0) {
      const prevTrack = state.history.pop();
      if (state.currentTrack) {
        state.queue.unshift(state.currentTrack);
      }
      playTrack(prevTrack);
    } else {
      audio.currentTime = 0;
    }
  }

  function handleTrackEnded() {
    if (state.repeatMode === 2) {
      audio.currentTime = 0;
      audio.play();
    } else {
      playNextTrack();
    }
  }

  function updatePlayPauseIcons() {
    if (state.isPlaying) {
      iconPlay.style.display = 'none';
      iconPause.style.display = 'block';
    } else {
      iconPlay.style.display = 'block';
      iconPause.style.display = 'none';
    }
  }

  // ==========================================
  // CONTROLS & LISTENERS
  // ==========================================
  function setupControls() {
    btnPlayPause.addEventListener('click', togglePlayPause);
    btnNext.addEventListener('click', playNextTrack);
    btnPrev.addEventListener('click', playPrevTrack);

    // Shuffle
    btnShuffle.addEventListener('click', () => {
      state.isShuffle = !state.isShuffle;
      btnShuffle.classList.toggle('active', state.isShuffle);
    });

    // Repeat mode toggle: 0 (off) -> 1 (all) -> 2 (one)
    btnRepeat.addEventListener('click', () => {
      state.repeatMode = (state.repeatMode + 1) % 3;
      btnRepeat.classList.toggle('active', state.repeatMode > 0);
      btnRepeat.classList.toggle('repeat-one', state.repeatMode === 2);
    });

    // Seek Slider
    seekSlider.addEventListener('input', () => {
      if (!audio.duration) return;
      const targetTime = (seekSlider.value / 100) * audio.duration;
      currentTimeLabel.textContent = formatTime(targetTime);
      seekFill.style.width = `${seekSlider.value}%`;
    });

    seekSlider.addEventListener('change', () => {
      if (!audio.duration) return;
      const targetTime = (seekSlider.value / 100) * audio.duration;
      audio.currentTime = targetTime;
    });

    // Volume Slider
    volumeSlider.addEventListener('input', () => {
      const val = parseFloat(volumeSlider.value);
      state.volume = val;
      audio.volume = val;
      volumeFill.style.width = `${val * 100}%`;
      localStorage.setItem('spkw_volume', val.toString());
      updateVolumeIcon(val);
      if (val > 0) state.isMuted = false;
    });

    // Mute button
    btnVolumeIcon.addEventListener('click', () => {
      state.isMuted = !state.isMuted;
      if (state.isMuted) {
        audio.volume = 0;
        volumeSlider.value = 0;
        volumeFill.style.width = '0%';
        volIconHigh.style.display = 'none';
        volIconMuted.style.display = 'block';
      } else {
        const val = state.volume > 0 ? state.volume : 0.8;
        audio.volume = val;
        volumeSlider.value = val;
        volumeFill.style.width = `${val * 100}%`;
        volIconHigh.style.display = 'block';
        volIconMuted.style.display = 'none';
      }
    });

    // Audio Quality Dropdown
    audioQualitySelect.addEventListener('change', (e) => {
      state.audioQuality = e.target.value;
      localStorage.setItem('spkw_quality', state.audioQuality);
      // Seamlessly switch quality if currently playing
      if (state.currentTrack && state.isPlaying) {
        const curTime = audio.currentTime;
        let newUrl = state.currentTrack.stream_url;
        if (state.audioQuality === '160' && state.currentTrack.stream_160) {
          newUrl = state.currentTrack.stream_160;
        } else if (state.audioQuality === '96' && state.currentTrack.stream_96) {
          newUrl = state.currentTrack.stream_96;
        } else if (state.currentTrack.stream_320) {
          newUrl = state.currentTrack.stream_320;
        }
        audio.src = `/api/stream?url=${encodeURIComponent(newUrl)}`;
        audio.currentTime = curTime;
        audio.play().catch(() => {});
      }
    });

    // Like current song button
    btnLikeCurrent.addEventListener('click', () => {
      if (!state.currentTrack) return;
      toggleLikeTrack(state.currentTrack);
    });

    // History arrows
    document.getElementById('btn-history-back').addEventListener('click', () => {
      switchView('home');
    });
    document.getElementById('btn-history-forward').addEventListener('click', () => {
      switchView('search');
    });
  }

  function updateVolumeIcon(val) {
    if (val === 0) {
      volIconHigh.style.display = 'none';
      volIconMuted.style.display = 'block';
    } else {
      volIconHigh.style.display = 'block';
      volIconMuted.style.display = 'none';
    }
  }

  // ==========================================
  // NAVIGATION & VIEWS
  // ==========================================
  function setupNavigation() {
    navHome.addEventListener('click', () => switchView('home'));
    navSearch.addEventListener('click', () => {
      switchView('search');
      globalSearchInput.focus();
    });
    navLibrary.addEventListener('click', () => openLikedSongsView());
    navLiked.addEventListener('click', () => openLikedSongsView());
    navLocal.addEventListener('click', () => switchView('local'));

    // Sidebar Curated Playlists clicks
    document.querySelectorAll('.playlist-item[data-id]').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        openCuratedPlaylist(id, item.textContent);
      });
    });

    // Sidebar Spotify Playlists clicks
    document.querySelectorAll('.playlist-item.spotify-pl-item').forEach(item => {
      item.addEventListener('click', () => {
        const spId = item.dataset.spotify;
        openSpotifyPlaylist(spId);
      });
    });

    // Import Spotify Modal Handlers
    const importModal = document.getElementById('import-modal');
    const btnOpenImportModal = document.getElementById('btn-open-import-modal');
    const btnCloseImportModal = document.getElementById('btn-close-import-modal');
    const btnSubmitImport = document.getElementById('btn-submit-import-spotify');
    const importInput = document.getElementById('import-spotify-input');

    if (btnOpenImportModal) {
      btnOpenImportModal.addEventListener('click', () => {
        importModal.style.display = 'flex';
        importInput.focus();
      });
    }

    if (btnCloseImportModal) {
      btnCloseImportModal.addEventListener('click', () => {
        importModal.style.display = 'none';
      });
    }

    if (btnSubmitImport) {
      btnSubmitImport.addEventListener('click', () => {
        const val = importInput.value.trim();
        if (val) {
          importModal.style.display = 'none';
          openSpotifyPlaylist(val);
          importInput.value = '';
        }
      });
      importInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') btnSubmitImport.click();
      });
    }

    // Quick Import Chips in Modal
    document.querySelectorAll('.quick-import-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const id = chip.dataset.id;
        importModal.style.display = 'none';
        openSpotifyPlaylist(id);
      });
    });

    // Create playlist button
    document.getElementById('btn-create-playlist').addEventListener('click', () => {
      const name = prompt('Nama playlist baru:');
      if (name && name.trim()) {
        const newPl = { id: `user_pl_${Date.now()}`, name: name.trim(), tracks: [] };
        state.userPlaylists.push(newPl);
        localStorage.setItem('spkw_playlists', JSON.stringify(state.userPlaylists));
        renderUserPlaylists();
        alert(`Playlist "${name}" berhasil dibuat!`);
      }
    });

    // Playlist banner Play All button
    document.getElementById('btn-playlist-play-all').addEventListener('click', () => {
      if (state.currentPlaylistTracks.length > 0) {
        playTrack(state.currentPlaylistTracks[0], state.currentPlaylistTracks.slice(1));
      }
    });

    // Playlist banner Shuffle button
    document.getElementById('btn-playlist-shuffle-all').addEventListener('click', () => {
      if (state.currentPlaylistTracks.length > 0) {
        state.isShuffle = true;
        btnShuffle.classList.add('active');
        const shuffled = [...state.currentPlaylistTracks].sort(() => 0.5 - Math.random());
        playTrack(shuffled[0], shuffled.slice(1));
      }
    });
  }

  function switchView(viewName) {
    state.activeView = viewName;
    Object.keys(views).forEach(k => {
      if (views[k]) {
        views[k].style.display = (k === viewName) ? 'flex' : 'none';
      }
    });

    // Nav active highlights
    navHome.classList.toggle('active', viewName === 'home');
    navSearch.classList.toggle('active', viewName === 'search');
    navLiked.classList.toggle('active', viewName === 'playlist' && state.activePlaylistId === 'liked');
    navLocal.classList.toggle('active', viewName === 'local');

    // Scroll to top
    document.getElementById('main-content-scroll').scrollTop = 0;
  }

  // ==========================================
  // HOME / FEATURED MUSIC
  // ==========================================
  async function loadFeaturedMusic() {
    const container = document.getElementById('home-featured-sections');
    const quickGrid = document.getElementById('quick-grid-container');

    try {
      const resp = await fetch('/api/featured');
      const sections = await resp.json();

      container.innerHTML = '';
      quickGrid.innerHTML = '';

      // Create quick cards from first section
      if (sections.length > 0 && sections[0].tracks) {
        const topTracks = sections[0].tracks.slice(0, 6);
        topTracks.forEach(tr => {
          const qc = document.createElement('div');
          qc.className = 'quick-card';
          qc.innerHTML = `
            <img src="${tr.image}" alt="${tr.title}" onerror="this.src='/static/images/default-album.svg'" />
            <span class="quick-card-title">${escapeHtml(tr.title)}</span>
            <button class="play-hover-btn" title="Putar">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="black"><polygon points="6,4 20,12 6,20"/></svg>
            </button>
          `;
          qc.addEventListener('click', () => {
            playTrack(tr, topTracks.filter(t => t.id !== tr.id));
          });
          quickGrid.appendChild(qc);
        });
      }

      // Render User's Spotify Playlists section first
      try {
        const uplResp = await fetch('/api/spotify/user-playlists');
        const userPlaylists = await uplResp.json();
        if (userPlaylists && userPlaylists.length > 0) {
          const spSec = document.createElement('div');
          spSec.className = 'section-wrapper';
          spSec.innerHTML = `
            <div class="section-head">
              <div>
                <h2 class="section-title">⭐ Playlist Contoh dari Link Anda</h2>
                <p class="section-subtitle">Playlist Spotify yang Anda berikan siap diputar langsung</p>
              </div>
            </div>
            <div class="cards-grid"></div>
          `;
          const spGrid = spSec.querySelector('.cards-grid');
          userPlaylists.forEach(pl => {
            const card = document.createElement('div');
            card.className = 'music-card';
            card.innerHTML = `
              <div class="card-art-box">
                <img src="${pl.cover || '/static/images/default-album.svg'}" alt="${escapeHtml(pl.title)}" onerror="this.src='/static/images/default-album.svg'" loading="lazy" />
                <button class="card-play-btn" title="Buka Playlist">
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="black"><polygon points="6,4 20,12 6,20"/></svg>
                </button>
              </div>
              <div class="card-title">${escapeHtml(pl.name || pl.title)}</div>
              <div class="card-subtitle">${escapeHtml(pl.subtitle || '100 lagu')}</div>
            `;
            card.addEventListener('click', () => {
              openSpotifyPlaylist(pl.id);
            });
            spGrid.appendChild(card);
          });
          container.appendChild(spSec);
        }
      } catch (e) {
        console.warn('User playlists load error:', e);
      }

      // Render sections
      sections.forEach(sec => {
        const secDiv = document.createElement('div');
        secDiv.className = 'section-wrapper';
        secDiv.innerHTML = `
          <div class="section-head">
            <div>
              <h2 class="section-title">${escapeHtml(sec.category)}</h2>
              <p class="section-subtitle">${escapeHtml(sec.subtitle)}</p>
            </div>
          </div>
          <div class="cards-grid"></div>
        `;

        const grid = secDiv.querySelector('.cards-grid');
        (sec.tracks || []).forEach(track => {
          const card = createMusicCard(track, sec.tracks);
          grid.appendChild(card);
        });

        container.appendChild(secDiv);
      });
    } catch (err) {
      console.error('Error loading featured:', err);
      container.innerHTML = `
        <div class="loading-spinner-box">
          <p>Gagal memuat rekomendasi musik online. Silakan periksa koneksi atau cari lagu lewat kolom pencarian.</p>
        </div>
      `;
    }
  }

  function createMusicCard(track, trackListContext) {
    const card = document.createElement('div');
    card.className = 'music-card';
    card.innerHTML = `
      <div class="card-art-box">
        <img src="${track.image}" alt="${escapeHtml(track.title)}" onerror="this.src='/static/images/default-album.svg'" loading="lazy" />
        <button class="card-play-btn" title="Putar">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="black"><polygon points="6,4 20,12 6,20"/></svg>
        </button>
      </div>
      <div class="card-title">${escapeHtml(track.title)}</div>
      <div class="card-subtitle">${escapeHtml(track.artist)}</div>
    `;

    card.addEventListener('click', () => {
      const restOfList = (trackListContext || []).filter(t => t.id !== track.id);
      playTrack(track, restOfList);
    });

    return card;
  }

  // ==========================================
  // SEARCH ENGINE
  // ==========================================
  function setupSearch() {
    globalSearchInput.addEventListener('input', (e) => {
      const q = e.target.value.trim();
      btnClearSearch.style.display = q.length > 0 ? 'block' : 'none';

      clearTimeout(state.searchDebounceTimer);
      if (q.length === 0) {
        showSearchState('empty');
        return;
      }

      state.searchDebounceTimer = setTimeout(() => {
        performSearch(q);
      }, 350);
    });

    btnClearSearch.addEventListener('click', () => {
      globalSearchInput.value = '';
      btnClearSearch.style.display = 'none';
      showSearchState('empty');
      globalSearchInput.focus();
    });

    // Category pills
    document.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        state.searchSource = chip.dataset.source;
        const q = globalSearchInput.value.trim();
        if (q) performSearch(q);
      });
    });
  }

  function showSearchState(st) {
    document.getElementById('search-state-empty').style.display = (st === 'empty') ? 'block' : 'none';
    document.getElementById('search-state-loading').style.display = (st === 'loading') ? 'flex' : 'none';
    document.getElementById('search-results-container').style.display = (st === 'results') ? 'block' : 'none';
  }

  async function performSearch(query) {
    const trimmed = query.trim();
    // Auto-detect Spotify playlist URL
    if (trimmed.includes('open.spotify.com/playlist/') || trimmed.startsWith('spotify:playlist:')) {
      openSpotifyPlaylist(trimmed);
      return;
    }

    switchView('search');
    showSearchState('loading');

    try {
      const resp = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}&source=${state.searchSource}&limit=25`);
      const data = await resp.json();

      if (data.type === 'spotify_playlist' && data.playlist) {
        openSpotifyPlaylist(data.playlist.id);
        return;
      }

      const results = data.results || [];

      if (results.length === 0) {
        showSearchState('empty');
        document.getElementById('search-state-empty').innerHTML = `
          <h2>Tidak ada lagu ditemukan</h2>
          <p>Coba kata kunci lain atau pilih tab "Semua" / "YouTube".</p>
        `;
        return;
      }

      renderSearchResults(results);
      showSearchState('results');
    } catch (err) {
      console.error('Search error:', err);
      showSearchState('empty');
    }
  }

  function renderSearchResults(results) {
    const topResultBox = document.getElementById('top-result-card-box');
    const tracklistMini = document.getElementById('search-tracklist-mini');
    const cardsGrid = document.getElementById('search-cards-grid');

    topResultBox.innerHTML = '';
    tracklistMini.innerHTML = '';
    cardsGrid.innerHTML = '';

    // Top Result Card (first item)
    const top = results[0];
    const topCard = document.createElement('div');
    topCard.className = 'top-result-card';
    topCard.innerHTML = `
      <img src="${top.image}" alt="${escapeHtml(top.title)}" onerror="this.src='/static/images/default-album.svg'" />
      <h3>${escapeHtml(top.title)}</h3>
      <span class="artist-meta">${escapeHtml(top.artist)}</span>
      <span class="badge-source">${top.source === 'saavn' ? '320kbps High-Res' : 'YouTube Audio'}</span>
      <button class="card-play-btn" title="Putar">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="black"><polygon points="6,4 20,12 6,20"/></svg>
      </button>
    `;
    topCard.addEventListener('click', () => {
      playTrack(top, results.slice(1));
    });
    topResultBox.appendChild(topCard);

    // Mini Tracklist (top 4 songs)
    results.slice(0, 4).forEach((tr, i) => {
      const row = createTrackRow(tr, i + 1, results);
      tracklistMini.appendChild(row);
    });

    // Cards Grid (remaining songs)
    results.slice(4).forEach(tr => {
      const card = createMusicCard(tr, results);
      cardsGrid.appendChild(card);
    });
  }

  function createTrackRow(track, index, trackListContext) {
    const row = document.createElement('div');
    row.className = 'track-row';
    row.dataset.id = track.id;
    if (state.currentTrack && state.currentTrack.id === track.id) {
      row.classList.add('playing');
    }

    const isLiked = isTrackLiked(track.id);

    row.innerHTML = `
      <div class="track-num-col">
        <span>${index}</span>
        <svg class="row-play-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><polygon points="6,4 20,12 6,20"/></svg>
      </div>
      <div class="track-title-col">
        <img class="track-thumb-mini" src="${track.image}" onerror="this.src='/static/images/default-album.svg'" loading="lazy" />
        <div class="track-title-text-wrap">
          <span class="track-name">${escapeHtml(track.title)}</span>
          <span class="track-artist-sub">${escapeHtml(track.artist)}</span>
        </div>
      </div>
      <div class="track-album-col">${escapeHtml(track.album || 'Single')}</div>
      <div class="track-dur-col">
        <button class="row-like-btn ${isLiked ? 'liked' : ''}" title="Sukai">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="${isLiked ? '#1ed760' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </button>
        <span>${track.duration_str || formatTime(track.duration)}</span>
      </div>
    `;

    row.addEventListener('click', (e) => {
      // Don't trigger play if clicked on like button
      if (e.target.closest('.row-like-btn')) {
        e.stopPropagation();
        toggleLikeTrack(track);
        const likeBtn = row.querySelector('.row-like-btn');
        const nowLiked = isTrackLiked(track.id);
        likeBtn.classList.toggle('liked', nowLiked);
        likeBtn.querySelector('svg').setAttribute('fill', nowLiked ? '#1ed760' : 'none');
        return;
      }

      const otherTracks = (trackListContext || []).filter(t => t.id !== track.id);
      playTrack(track, otherTracks);
    });

    return row;
  }

  function highlightActiveTrackRow() {
    document.querySelectorAll('.track-row').forEach(r => {
      const isCurrent = state.currentTrack && r.dataset.id === state.currentTrack.id;
      r.classList.toggle('playing', isCurrent);
    });
  }

  // ==========================================
  // PLAYLISTS & LIKED SONGS
  // ==========================================
  function openLikedSongsView() {
    state.activePlaylistId = 'liked';
    state.currentPlaylistTracks = state.likedSongs;

    document.getElementById('playlist-hero-title').textContent = 'Lagu yang Disukai';
    document.getElementById('playlist-hero-desc').textContent = 'Koleksi semua lagu favorit Anda tersimpan aman secara offline';
    document.getElementById('playlist-cover-img').src = '/static/images/default-album.svg';
    document.getElementById('playlist-cover-img').style.background = 'linear-gradient(135deg, #450af5, #c4efd9)';
    document.getElementById('playlist-meta-type').textContent = 'KOLEKSI PRIBADI';
    document.getElementById('playlist-track-count').textContent = `${state.likedSongs.length} lagu`;

    renderPlaylistTable(state.likedSongs);
    switchView('playlist');
  }

  function openCuratedPlaylist(playlistId, title) {
    state.activePlaylistId = playlistId;
    document.getElementById('playlist-hero-title').textContent = title;
    document.getElementById('playlist-hero-desc').textContent = 'Koleksi pilihan Spotify KW (100% Kualitas 320kbps)';
    document.getElementById('playlist-meta-type').textContent = 'PLAYLIST TERKURASI';
    document.getElementById('playlist-cover-img').src = '/static/images/default-album.svg';
    document.getElementById('playlist-tracklist-items').innerHTML = `
      <div class="loading-spinner-box">
        <div class="spinner"></div>
        <span>Memuat daftar lagu pilihan...</span>
      </div>
    `;
    switchView('playlist');

    fetch(`/api/playlist/curated?id=${encodeURIComponent(playlistId)}`)
      .then(r => r.json())
      .then(pl => {
        state.currentPlaylistTracks = pl.tracks || [];
        document.getElementById('playlist-hero-title').textContent = pl.title || title;
        document.getElementById('playlist-hero-desc').textContent = pl.subtitle || 'Koleksi pilihan Spotify KW';
        document.getElementById('playlist-track-count').textContent = `${state.currentPlaylistTracks.length} lagu`;
        if (pl.cover) {
          document.getElementById('playlist-cover-img').src = pl.cover;
        }
        renderPlaylistTable(state.currentPlaylistTracks);
      })
      .catch(e => {
        console.error(e);
        document.getElementById('playlist-tracklist-items').innerHTML = `
          <div style="text-align: center; padding: 48px; color: var(--text-subdued);">
            Gagal memuat playlist terkurasi.
          </div>
        `;
      });
  }

  async function openSpotifyPlaylist(playlistIdOrUrl) {
    state.activePlaylistId = `spotify_${playlistIdOrUrl}`;
    document.getElementById('playlist-hero-title').textContent = 'Memuat Playlist Spotify...';
    document.getElementById('playlist-hero-desc').textContent = 'Mengambil 100 lagu dari Spotify...';
    document.getElementById('playlist-cover-img').src = '/static/images/default-album.svg';
    document.getElementById('playlist-meta-type').textContent = 'PLAYLIST SPOTIFY';
    document.getElementById('playlist-track-count').textContent = 'Memuat lagu...';
    document.getElementById('playlist-tracklist-items').innerHTML = `
      <div class="loading-spinner-box">
        <div class="spinner"></div>
        <span>Mengambil 100 lagu dari Spotify & menyiapkan audio 320kbps...</span>
      </div>
    `;
    switchView('playlist');

    try {
      const resp = await fetch(`/api/spotify/playlist?url=${encodeURIComponent(playlistIdOrUrl)}`);
      const pl = await resp.json();

      document.getElementById('playlist-hero-title').textContent = pl.title || 'Playlist Spotify';
      document.getElementById('playlist-hero-desc').textContent = pl.subtitle ? `Dibuat oleh ${pl.subtitle} • 100% Kualitas 320kbps` : 'Playlist Spotify';
      document.getElementById('playlist-cover-img').src = pl.cover || '/static/images/default-album.svg';
      document.getElementById('playlist-track-count').textContent = `${pl.track_count || pl.tracks.length} lagu`;

      state.currentPlaylistTracks = pl.tracks || [];
      renderPlaylistTable(state.currentPlaylistTracks);
    } catch (e) {
      console.error('Spotify playlist fetch error:', e);
      document.getElementById('playlist-tracklist-items').innerHTML = `
        <div style="text-align: center; padding: 48px; color: var(--text-subdued);">
          Gagal memuat playlist Spotify. Pastikan tautan playlist bersifat publik.
        </div>
      `;
    }
  }

  function renderPlaylistTable(tracks) {
    const container = document.getElementById('playlist-tracklist-items');
    container.innerHTML = '';

    if (!tracks || tracks.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 48px; color: var(--text-subdued);">
          Belum ada lagu di sini. Silakan tambahkan lagu dengan menekan ikon hati.
        </div>
      `;
      return;
    }

    tracks.forEach((tr, i) => {
      const row = createTrackRow(tr, i + 1, tracks);
      container.appendChild(row);
    });
  }

  function isTrackLiked(id) {
    return state.likedSongs.some(t => t.id === id);
  }

  function toggleLikeTrack(track) {
    const idx = state.likedSongs.findIndex(t => t.id === track.id);
    if (idx >= 0) {
      state.likedSongs.splice(idx, 1);
    } else {
      state.likedSongs.push(track);
    }
    localStorage.setItem('spkw_liked', JSON.stringify(state.likedSongs));
    updateLikedBadge();
    updateCurrentLikeButton();

    // If currently viewing liked playlist, re-render
    if (state.activeView === 'playlist' && state.activePlaylistId === 'liked') {
      openLikedSongsView();
    }
  }

  function updateLikedBadge() {
    likedCountBadge.textContent = state.likedSongs.length;
  }

  function updateCurrentLikeButton() {
    if (!state.currentTrack) return;
    const liked = isTrackLiked(state.currentTrack.id);
    btnLikeCurrent.classList.toggle('liked', liked);
    const svg = btnLikeCurrent.querySelector('svg');
    svg.setAttribute('fill', liked ? '#1ed760' : 'none');
    svg.style.color = liked ? '#1ed760' : 'var(--text-subdued)';
  }

  // ==========================================
  // SYNCHRONIZED LYRICS (KARAOKE)
  // ==========================================
  function setupLyrics() {
    btnToggleLyrics.addEventListener('click', () => {
      state.lyricsOpen = !state.lyricsOpen;
      lyricsOverlay.style.display = state.lyricsOpen ? 'flex' : 'none';
      btnToggleLyrics.classList.toggle('active', state.lyricsOpen);
      if (state.lyricsOpen && state.currentTrack) {
        updateSyncedLyrics(audio.currentTime);
      }
    });

    btnCloseLyrics.addEventListener('click', () => {
      state.lyricsOpen = false;
      lyricsOverlay.style.display = 'none';
      btnToggleLyrics.classList.remove('active');
    });
  }

  async function loadLyrics(track) {
    lyricsTitle.textContent = track.title;
    lyricsArtist.textContent = track.artist;
    lyricsContainer.innerHTML = '<div class="lyrics-placeholder">Mencari lirik lagu...</div>';
    state.syncedLyrics = [];
    state.activeLyricIndex = -1;

    try {
      const resp = await fetch(`/api/lyrics?track=${encodeURIComponent(track.title)}&artist=${encodeURIComponent(track.artist)}&duration=${track.duration}`);
      const data = await resp.json();

      if (data.synced && data.syncedLyrics) {
        state.syncedLyrics = parseLRC(data.syncedLyrics);
        renderSyncedLyrics(state.syncedLyrics);
      } else if (data.plainLyrics) {
        renderPlainLyrics(data.plainLyrics);
      } else {
        lyricsContainer.innerHTML = '<div class="lyrics-placeholder">Lirik tidak tersedia untuk lagu ini.</div>';
      }
    } catch (e) {
      console.warn('Lyrics fetch error:', e);
      lyricsContainer.innerHTML = '<div class="lyrics-placeholder">Lirik belum tersedia.</div>';
    }
  }

  function parseLRC(lrcText) {
    const lines = lrcText.split('\n');
    const result = [];
    const timeReg = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;

    lines.forEach(line => {
      const match = timeReg.exec(line);
      if (match) {
        const m = parseInt(match[1]);
        const s = parseInt(match[2]);
        const ms = parseInt(match[3].padEnd(3, '0'));
        const time = m * 60 + s + ms / 1000;
        const text = line.replace(timeReg, '').trim();
        if (text) {
          result.push({ time, text });
        }
      }
    });

    return result.sort((a, b) => a.time - b.time);
  }

  function renderSyncedLyrics(parsedLyrics) {
    lyricsContainer.innerHTML = '';
    parsedLyrics.forEach((line, idx) => {
      const p = document.createElement('p');
      p.className = 'lyrics-line';
      p.dataset.index = idx;
      p.textContent = line.text;
      p.addEventListener('click', () => {
        audio.currentTime = line.time;
      });
      lyricsContainer.appendChild(p);
    });
  }

  function renderPlainLyrics(plainText) {
    lyricsContainer.innerHTML = '';
    const div = document.createElement('div');
    div.style.textAlign = 'center';
    div.style.lineHeight = '2';
    div.style.fontSize = '1.3rem';
    div.style.color = 'var(--text-secondary)';
    div.textContent = plainText;
    lyricsContainer.appendChild(div);
  }

  function updateSyncedLyrics(currentTime) {
    if (state.syncedLyrics.length === 0) return;

    let activeIdx = -1;
    for (let i = 0; i < state.syncedLyrics.length; i++) {
      if (currentTime >= state.syncedLyrics[i].time) {
        activeIdx = i;
      } else {
        break;
      }
    }

    if (activeIdx !== state.activeLyricIndex && activeIdx >= 0) {
      state.activeLyricIndex = activeIdx;
      const allLines = lyricsContainer.querySelectorAll('.lyrics-line');
      allLines.forEach((el, idx) => {
        el.classList.toggle('active', idx === activeIdx);
      });

      // Scroll into center smoothly
      const currentEl = allLines[activeIdx];
      if (currentEl) {
        currentEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }

  // ==========================================
  // AUDIO SPECTRUM VISUALIZER (WEB AUDIO API)
  // ==========================================
  function initWebAudio() {
    if (state.audioContext) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      state.audioContext = new AudioCtx();
      state.analyser = state.audioContext.createAnalyser();
      state.analyser.fftSize = 256;
      const source = state.audioContext.createMediaElementSource(audio);
      source.connect(state.analyser);
      state.analyser.connect(state.audioContext.destination);
    } catch (e) {
      console.warn('Web Audio API not supported or blocked:', e);
    }
  }

  function setupVisualizer() {
    btnToggleVisualizer.addEventListener('click', () => {
      state.visualizerOpen = !state.visualizerOpen;
      visualizerOverlay.style.display = state.visualizerOpen ? 'flex' : 'none';
      btnToggleVisualizer.classList.toggle('active', state.visualizerOpen);

      if (state.visualizerOpen) {
        initWebAudio();
        startVisualizerLoop();
      } else {
        cancelAnimationFrame(state.visualizerAnimationId);
      }
    });

    btnCloseVisualizer.addEventListener('click', () => {
      state.visualizerOpen = false;
      visualizerOverlay.style.display = 'none';
      btnToggleVisualizer.classList.remove('active');
      cancelAnimationFrame(state.visualizerAnimationId);
    });

    // Resize canvas dynamically
    window.addEventListener('resize', resizeVisualizerCanvas);
  }

  function resizeVisualizerCanvas() {
    if (!visualizerCanvas) return;
    visualizerCanvas.width = visualizerCanvas.parentElement.clientWidth;
    visualizerCanvas.height = visualizerCanvas.parentElement.clientHeight;
  }

  function startVisualizerLoop() {
    resizeVisualizerCanvas();
    const ctx = visualizerCanvas.getContext('2d');
    if (!state.analyser) return;

    const bufferLength = state.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function render() {
      if (!state.visualizerOpen) return;
      state.visualizerAnimationId = requestAnimationFrame(render);

      state.analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);

      const width = visualizerCanvas.width;
      const height = visualizerCanvas.height;
      const barWidth = (width / bufferLength) * 2.2;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * height * 0.85;

        const grad = ctx.createLinearGradient(0, height - barHeight, 0, height);
        grad.addColorStop(0, '#1ed760');
        grad.addColorStop(0.5, '#1db954');
        grad.addColorStop(1, '#0c4d22');

        ctx.fillStyle = grad;
        ctx.fillRect(x, height - barHeight, barWidth - 2, barHeight);

        x += barWidth;
        if (x > width) break;
      }
    }

    render();
  }

  // ==========================================
  // LOCAL MUSIC SCANNER & DRAG-AND-DROP
  // ==========================================
  function setupLocalMusic() {
    const btnBrowse = document.getElementById('btn-browse-local-folder');
    const btnScanDefault = document.getElementById('btn-scan-default-music');
    const dropZone = document.getElementById('drag-drop-zone');
    const fileInput = document.getElementById('file-input-direct');

    btnBrowse.addEventListener('click', async () => {
      try {
        const r = await fetch('/api/open-folder');
        const d = await r.json();
        if (d.success && d.path) {
          scanLocalFolder(d.path);
        }
      } catch (e) {
        console.warn('Folder picker error:', e);
      }
    });

    btnScanDefault.addEventListener('click', () => {
      scanLocalFolder(null);
    });

    // Drag & Drop
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('audio/') || /\.(mp3|flac|wav|m4a|ogg)$/i.test(f.name));
      handleDroppedAudioFiles(files);
    });

    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      handleDroppedAudioFiles(Array.from(e.target.files));
    });
  }

  async function scanLocalFolder(path) {
    const folderStatus = document.getElementById('local-folder-status');
    const pathLabel = document.getElementById('local-current-path');
    const countText = document.getElementById('local-count-text');
    const tracklistContainer = document.getElementById('local-tracklist-container');
    const tracklistItems = document.getElementById('local-tracklist-items');

    try {
      const url = path ? `/api/local/scan?path=${encodeURIComponent(path)}` : '/api/local/scan';
      const resp = await fetch(url);
      const data = await resp.json();

      state.localSongs = data.songs || [];
      localCountBadge.textContent = state.localSongs.length;

      folderStatus.style.display = 'flex';
      pathLabel.textContent = data.folder || 'Folder Musik';
      countText.textContent = `${state.localSongs.length} lagu ditemukan`;

      tracklistContainer.style.display = 'flex';
      tracklistItems.innerHTML = '';

      if (state.localSongs.length === 0) {
        tracklistItems.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-subdued);">Tidak ditemukan file audio (.mp3, .wav, .flac) di folder ini.</div>';
        return;
      }

      state.localSongs.forEach((song, i) => {
        const row = createTrackRow(song, i + 1, state.localSongs);
        tracklistItems.appendChild(row);
      });
    } catch (e) {
      console.error('Scan error:', e);
    }
  }

  function handleDroppedAudioFiles(files) {
    if (!files || files.length === 0) return;

    const newLocalTracks = files.map((file, i) => {
      const blobUrl = URL.createObjectURL(file);
      const cleanName = file.name.replace(/\.[^/.]+$/, '');
      return {
        id: `blob_${Date.now()}_${i}`,
        source: 'local_file',
        title: cleanName,
        artist: 'Local File',
        album: 'Offline Audio',
        duration: 0,
        duration_str: '--:--',
        image: '/static/images/local-album.svg',
        stream_url: blobUrl,
      };
    });

    state.localSongs = [...newLocalTracks, ...state.localSongs];
    localCountBadge.textContent = state.localSongs.length;

    const tracklistContainer = document.getElementById('local-tracklist-container');
    const tracklistItems = document.getElementById('local-tracklist-items');
    tracklistContainer.style.display = 'flex';
    tracklistItems.innerHTML = '';

    state.localSongs.forEach((s, idx) => {
      tracklistItems.appendChild(createTrackRow(s, idx + 1, state.localSongs));
    });

    // Auto-play the first dropped track
    playTrack(newLocalTracks[0], newLocalTracks.slice(1));
    switchView('local');
  }

  // ==========================================
  // QUEUE DRAWER
  // ==========================================
  btnToggleQueue.addEventListener('click', () => {
    state.queueOpen = !state.queueOpen;
    queueDrawer.style.display = state.queueOpen ? 'flex' : 'none';
    btnToggleQueue.classList.toggle('active', state.queueOpen);
    if (state.queueOpen) updateQueueUI();
  });

  btnCloseQueue.addEventListener('click', () => {
    state.queueOpen = false;
    queueDrawer.style.display = 'none';
    btnToggleQueue.classList.remove('active');
  });

  btnClearQueue.addEventListener('click', () => {
    state.queue = [];
    updateQueueUI();
  });

  function updateQueueUI() {
    if (!state.queueOpen) return;

    // Now playing
    if (state.currentTrack) {
      queueNowPlayingBox.innerHTML = `
        <div class="track-title-col">
          <img class="track-thumb-mini" src="${state.currentTrack.image}" onerror="this.src='/static/images/default-album.svg'" />
          <div class="track-title-text-wrap">
            <span class="track-name" style="color: var(--spotify-green);">${escapeHtml(state.currentTrack.title)}</span>
            <span class="track-artist-sub">${escapeHtml(state.currentTrack.artist)}</span>
          </div>
        </div>
      `;
    } else {
      queueNowPlayingBox.innerHTML = '<span class="empty-queue-hint">Tidak ada lagu yang sedang diputar</span>';
    }

    // Next in queue
    queueNextItems.innerHTML = '';
    if (state.queue.length === 0) {
      queueNextItems.innerHTML = '<span class="empty-queue-hint">Antrean kosong</span>';
      return;
    }

    state.queue.forEach((tr, i) => {
      const qRow = document.createElement('div');
      qRow.className = 'track-row';
      qRow.innerHTML = `
        <div class="track-num-col"><span>${i + 1}</span></div>
        <div class="track-title-col">
          <img class="track-thumb-mini" src="${tr.image}" onerror="this.src='/static/images/default-album.svg'" />
          <div class="track-title-text-wrap">
            <span class="track-name">${escapeHtml(tr.title)}</span>
            <span class="track-artist-sub">${escapeHtml(tr.artist)}</span>
          </div>
        </div>
        <div></div>
        <div class="track-dur-col">${tr.duration_str || ''}</div>
      `;
      qRow.addEventListener('click', () => {
        state.queue.splice(i, 1);
        playTrack(tr);
      });
      queueNextItems.appendChild(qRow);
    });
  }

  // ==========================================
  // SYSTEM RESOURCE MONITOR & STATS
  // ==========================================
  function setupStatsPoller() {
    // Initial fetch
    fetchStats();
    // Poll every 3.5 seconds
    setInterval(fetchStats, 3500);

    // Open Modal
    ramPill.addEventListener('click', openStatsModal);
    btnOpenStatsModal.addEventListener('click', openStatsModal);
    btnCloseStatsModal.addEventListener('click', () => { statsModal.style.display = 'none'; });

    // Clear Cache Button
    btnClearCache.addEventListener('click', async () => {
      try {
        const resp = await fetch('/api/cache/clear', { method: 'POST' });
        const res = await resp.json();
        alert(res.message || 'Cache berhasil dibersihkan!');
        fetchStats();
      } catch (e) {
        console.warn('Clear cache err:', e);
      }
    });
  }

  async function fetchStats() {
    try {
      const resp = await fetch('/api/stats');
      const data = await resp.json();

      const ramMb = data.total_ram_mb || 52;
      const ramSaved = data.ram_saved_percent || 90;

      // Update sidebar badge
      ramStatText.textContent = `RAM: ${ramMb} MB`;
      ramSaveTag.textContent = `-${ramSaved}%`;

      // Update Modal if open
      document.getElementById('modal-ram-val').textContent = ramMb;
      document.getElementById('modal-ram-bar').style.width = `${Math.min(100, Math.max(8, (ramMb / 650) * 100))}%`;
      document.getElementById('modal-ram-tag').textContent = `Hemat ${ramSaved}% RAM`;
      document.getElementById('modal-storage-val').textContent = (data.cache_mb + 4.5).toFixed(1);
      document.getElementById('modal-cache-size').textContent = `${data.cache_mb} MB`;
    } catch (e) {
      // Offline fallback
    }
  }

  function openStatsModal() {
    fetchStats();
    statsModal.style.display = 'flex';
  }

  // ==========================================
  // WINDOWS MEDIASESSION API INTEGRATION
  // ==========================================
  function setupMediaSession() {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => {
        audio.play();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        audio.pause();
      });
      navigator.mediaSession.setActionHandler('previoustrack', playPrevTrack);
      navigator.mediaSession.setActionHandler('nexttrack', playNextTrack);
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime && audio.duration) {
          audio.currentTime = details.seekTime;
        }
      });
    }
  }

  function updateMediaSessionMetadata(track) {
    if ('mediaSession' in navigator && track) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: track.album || 'Spotify KW',
        artwork: [
          { src: track.image || '/static/images/default-album.svg', sizes: '512x512', type: 'image/jpeg' }
        ]
      });
    }
  }

  // ==========================================
  // KEYBOARD SHORTCUTS
  // ==========================================
  function setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Don't capture when typing in search input
      if (document.activeElement === globalSearchInput) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (audio.duration) audio.currentTime = Math.max(0, audio.currentTime - 5);
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (audio.duration) audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
          break;
        case 'ArrowUp':
          e.preventDefault();
          state.volume = Math.min(1, state.volume + 0.05);
          audio.volume = state.volume;
          volumeSlider.value = state.volume;
          volumeFill.style.width = `${state.volume * 100}%`;
          updateVolumeIcon(state.volume);
          break;
        case 'ArrowDown':
          e.preventDefault();
          state.volume = Math.max(0, state.volume - 0.05);
          audio.volume = state.volume;
          volumeSlider.value = state.volume;
          volumeFill.style.width = `${state.volume * 100}%`;
          updateVolumeIcon(state.volume);
          break;
        case 'KeyM':
          btnVolumeIcon.click();
          break;
        case 'KeyL':
          btnToggleLyrics.click();
          break;
        case 'KeyV':
          btnToggleVisualizer.click();
          break;
        case 'KeyQ':
          btnToggleQueue.click();
          break;
      }
    });
  }

  // ==========================================
  // UTILITIES
  // ==========================================
  function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Run initial boot
  init();
});
