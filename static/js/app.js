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
    downloadedTracks: [],
    activePlaylistTitle: 'gen z songs english',
  };

  let isDraggingNpSeek = false;
  let trackToAddToPlaylist = null;
  let downloadPollInterval = null;

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
  // COSMIC STARFIELD BACKGROUND ENGINE
  // ==========================================
  function initStarfield() {
    const canvas = document.getElementById('starfield-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0, height = 0;
    let stars = [];
    const STAR_COUNT = 90; // Ultra low RAM & CPU impact (<0.5% CPU)

    function resize() {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    // Create twinkling cosmic stars
    for (let i = 0; i < STAR_COUNT; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 1.4 + 0.3,
        alpha: Math.random() * 0.7 + 0.2,
        speed: Math.random() * 0.008 + 0.002,
        phase: Math.random() * Math.PI * 2
      });
    }

    function animate() {
      if (document.hidden) {
        // Pause drawing when tab is inactive to save battery and RAM
        requestAnimationFrame(animate);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        s.phase += s.speed;
        const currentAlpha = s.alpha + Math.sin(s.phase) * 0.25;

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(230, 240, 255, ${Math.max(0.1, Math.min(1, currentAlpha))})`;
        if (s.radius > 1.2) {
          ctx.shadowBlur = 4;
          ctx.shadowColor = 'rgba(255, 255, 255, 0.6)';
        } else {
          ctx.shadowBlur = 0;
        }
        ctx.fill();
      }

      requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
  }

  // ==========================================
  // INITIALIZATION
  // ==========================================
  function init() {
    initStarfield();
    setupAudioEvents();
    setupControls();
    setupRightPanel();
    setupSidebarLibrary();
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
    if (volumeSlider) {
      volumeSlider.value = state.volume;
      if (volumeFill) volumeFill.style.width = `${state.volume * 100}%`;
    }
    if (audioQualitySelect) audioQualitySelect.value = state.audioQuality;
    updateLikedBadge();
    renderUserPlaylists();
    loadDownloadedTracks();

    // Set greeting based on time of day
    setGreeting();

    // Setup initial right panel preview (Image 1 replica: Old Love)
    setupInitialRightPanelPreview();

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

      // Update bottom seekbar
      if (seekSlider) seekSlider.value = (cur / dur) * 100;
      if (seekFill) seekFill.style.width = `${(cur / dur) * 100}%`;
      if (currentTimeLabel) currentTimeLabel.textContent = formatTime(cur);
      if (totalDurationLabel) totalDurationLabel.textContent = formatTime(dur);

      // Update Right Panel scrubber
      const npSeekSlider = document.getElementById('np-seek-slider');
      const npSeekFill = document.getElementById('np-seek-fill');
      const npCurrentTime = document.getElementById('np-current-time');
      const npTotalDuration = document.getElementById('np-total-duration');
      if (npSeekSlider && !isDraggingNpSeek) {
        npSeekSlider.value = (cur / dur) * 100;
      }
      if (npSeekFill) npSeekFill.style.width = `${(cur / dur) * 100}%`;
      if (npCurrentTime) npCurrentTime.textContent = formatTime(cur);
      if (npTotalDuration) npTotalDuration.textContent = formatTime(dur);

      // Synchronize lyrics if active
      if (state.lyricsOpen && state.syncedLyrics.length > 0) {
        updateSyncedLyrics(cur);
      }
    });

    audio.addEventListener('loadedmetadata', () => {
      if (audio.duration && !isNaN(audio.duration)) {
        if (totalDurationLabel) totalDurationLabel.textContent = formatTime(audio.duration);
        const npTotalDuration = document.getElementById('np-total-duration');
        if (npTotalDuration) npTotalDuration.textContent = formatTime(audio.duration);
      }
    });

    audio.addEventListener('ended', () => {
      handleTrackEnded();
    });

    audio.addEventListener('error', (e) => {
      console.warn('Audio playback error, attempting fallback:', e);
      if (state.currentTrack && state.currentTrack.stream_160 && state.audioQuality === '320' && audio.src.indexOf(encodeURIComponent(state.currentTrack.stream_160)) === -1) {
        audio.src = `/api/stream?url=${encodeURIComponent(state.currentTrack.stream_160)}`;
        audio.play().catch(() => playNextTrack(false));
      } else {
        setTimeout(() => playNextTrack(false), 1200);
      }
    });
  }

  function playTrackInContext(track, trackListContext) {
    if (!track) return;
    const list = Array.isArray(trackListContext) && trackListContext.length > 0
      ? trackListContext
      : (state.currentPlaylistTracks.length > 0 ? state.currentPlaylistTracks : [track]);

    state.currentPlaylistTracks = list;

    const trackIndex = list.findIndex(t =>
      (t.id && track.id && t.id == track.id) ||
      (t.title && track.title && t.title.trim().toLowerCase() === track.title.trim().toLowerCase() &&
       t.artist && track.artist && t.artist.trim().toLowerCase() === track.artist.trim().toLowerCase())
    );

    let upcomingQueue = [];
    if (state.isShuffle) {
      const pool = list.filter((_, idx) => idx !== trackIndex);
      upcomingQueue = pool.sort(() => 0.5 - Math.random());
    } else {
      if (trackIndex !== -1) {
        // Strictly play upcoming songs in sequence from this position
        upcomingQueue = list.slice(trackIndex + 1);
      } else {
        upcomingQueue = list.filter(t => t.id != track.id);
      }
    }

    playTrack(track, upcomingQueue);
  }

  function playTrack(track, newQueue = null) {
    if (!track) return;
    
    // Auto-reopen Pict 2 (Now Playing Panel) whenever any song is played
    openNowPlayingPanel();

    if (newQueue && Array.isArray(newQueue)) {
      state.queue = [...newQueue];
    }
    
    // Add current track to history
    if (state.currentTrack && state.currentTrack.id !== track.id) {
      state.history.push(state.currentTrack);
      if (state.history.length > 30) state.history.shift();
    }

    state.currentTrack = track;

    // Reset seek progress and timer display cleanly to 0:00
    if (seekSlider) seekSlider.value = 0;
    if (seekFill) seekFill.style.width = '0%';
    if (currentTimeLabel) currentTimeLabel.textContent = '0:00';
    if (totalDurationLabel) totalDurationLabel.textContent = track.duration_str || (track.duration ? formatTime(track.duration) : '0:00');

    // Reset Right Panel seek progress and metadata
    const npSeekSlider = document.getElementById('np-seek-slider');
    const npSeekFill = document.getElementById('np-seek-fill');
    const npCurrentTime = document.getElementById('np-current-time');
    const npTotalDuration = document.getElementById('np-total-duration');
    if (npSeekSlider) npSeekSlider.value = 0;
    if (npSeekFill) npSeekFill.style.width = '0%';
    if (npCurrentTime) npCurrentTime.textContent = '0:00';
    if (npTotalDuration) npTotalDuration.textContent = track.duration_str || (track.duration ? formatTime(track.duration) : '0:00');
    updateRightPanelUI(track);

    // Reset lyrics state
    state.syncedLyrics = [];
    state.activeLyricIndex = -1;
    if (lyricsContainer) lyricsContainer.innerHTML = '';

    // Check if track is downloaded offline for instant 0-internet playback
    if (isTrackDownloaded(track.id) || track.source === 'offline') {
      const safeName = getSafeFilename(track.id);
      track.stream_url = `/api/offline/stream/${safeName}`;
      track.source = 'offline';
    }

    // Check if track is from Spotify or Curated and streamUrl needs resolving
    if ((track.source === 'spotify' || track.source === 'curated') && !track.stream_url) {
      playerTitle.textContent = track.title || 'Unknown Title';
      playerArtist.textContent = (track.artist || 'Unknown Artist') + ' • Mengambil audio 320k...';
      playerThumb.src = track.image || '/static/images/default-album.svg';
      updateCurrentLikeButton();
      updateQueueUI();
      highlightActiveTrackRow();

      let previewStarted = false;
      // If preview available, start it immediately so user hears sound in <50ms
      if (track.preview_url) {
        audio.pause();
        audio.src = `/api/stream?url=${encodeURIComponent(track.preview_url)}`;
        audio.currentTime = 0;
        audio.play().then(() => {
          state.isPlaying = true;
          updatePlayPauseIcons();
        }).catch(() => {});
        previewStarted = true;
      } else {
        audio.pause();
        audio.src = '';
        audio.currentTime = 0;
      }

      // Resolve full 320kbps stream in background
      fetch(`/api/spotify/resolve?title=${encodeURIComponent(track.title)}&artist=${encodeURIComponent(track.artist)}&preview=${encodeURIComponent(track.preview_url || '')}`)
        .then(r => r.json())
        .then(res => {
          if (!state.currentTrack || state.currentTrack.id !== track.id) return;

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
            updateRightPanelUI(track);
            const curTime = (previewStarted && !isNaN(audio.currentTime)) ? audio.currentTime : 0;
            audio.src = `/api/stream?url=${encodeURIComponent(res.stream_url)}`;
            if (curTime > 0) {
              audio.currentTime = curTime;
            } else {
              audio.currentTime = 0;
            }
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
      console.warn('Tautan lagu tidak valid, memutar lagu berikutnya...');
      setTimeout(() => playNextTrack(false), 500);
      return;
    }

    // Reset audio and set source from beginning
    audio.pause();
    audio.currentTime = 0;
    if (streamUrl.startsWith('http')) {
      audio.src = `/api/stream?url=${encodeURIComponent(streamUrl)}`;
    } else {
      audio.src = streamUrl; // Local file stream
    }
    audio.currentTime = 0;

    // Update bottom player UI
    playerTitle.textContent = track.title || 'Unknown Title';
    playerArtist.textContent = track.artist || 'Unknown Artist';
    playerThumb.src = track.image || '/static/images/default-album.svg';
    playerThumb.onerror = () => { playerThumb.src = '/static/images/default-album.svg'; };

    // Update Right Panel UI
    updateRightPanelUI(track);

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
        playTrackInContext(state.currentPlaylistTracks[0], state.currentPlaylistTracks);
      } else {
        const previewTrack = {
          id: 'preview_old_love',
          title: 'Old Love',
          artist: 'yuji, putri dahlia',
          source: 'spotify',
          image: 'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=500&q=80'
        };
        playTrack(previewTrack);
      }
      return;
    }

    if (audio.paused) {
      openNowPlayingPanel();
      audio.play().catch(e => console.warn(e));
    } else {
      audio.pause();
    }
  }

  function playNextTrack(isManual = false) {
    if (state.repeatMode === 2 && !isManual) {
      audio.currentTime = 0;
      audio.play().catch(e => console.warn(e));
      return;
    }

    // Reset seek progress UI
    seekSlider.value = 0;
    seekFill.style.width = '0%';
    currentTimeLabel.textContent = '0:00';

    if (state.queue.length > 0) {
      let nextIndex = 0;
      if (state.isShuffle) {
        nextIndex = Math.floor(Math.random() * state.queue.length);
      }
      const nextTrack = state.queue.splice(nextIndex, 1)[0];
      playTrack(nextTrack);
    } else if (state.currentPlaylistTracks && state.currentPlaylistTracks.length > 0) {
      const currIdx = state.currentTrack
        ? state.currentPlaylistTracks.findIndex(t =>
            (t.id && state.currentTrack.id && t.id == state.currentTrack.id) ||
            (t.title && state.currentTrack.title && t.title.trim().toLowerCase() === state.currentTrack.title.trim().toLowerCase() &&
             t.artist && state.currentTrack.artist && t.artist.trim().toLowerCase() === state.currentTrack.artist.trim().toLowerCase())
          )
        : -1;

      if (currIdx !== -1 && currIdx + 1 < state.currentPlaylistTracks.length) {
        const nextTrack = state.currentPlaylistTracks[currIdx + 1];
        state.queue = state.currentPlaylistTracks.slice(currIdx + 2);
        playTrack(nextTrack);
      } else if (state.repeatMode === 1) {
        // Repeat all: loop back to beginning of playlist
        const firstTrack = state.currentPlaylistTracks[0];
        state.queue = state.currentPlaylistTracks.slice(1);
        playTrack(firstTrack);
      } else {
        // End of playlist
        state.isPlaying = false;
        audio.pause();
        audio.currentTime = 0;
        updatePlayPauseIcons();
        highlightActiveTrackRow();
      }
    } else if (state.repeatMode === 1 && state.history.length > 0) {
      state.queue = [...state.history];
      state.history = [];
      playNextTrack(isManual);
    } else {
      state.isPlaying = false;
      audio.pause();
      audio.currentTime = 0;
      updatePlayPauseIcons();
      highlightActiveTrackRow();
    }
  }

  function playPrevTrack() {
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      audio.play().catch(e => console.warn(e));
      return;
    }

    if (state.history.length > 0) {
      const prevTrack = state.history.pop();
      if (state.currentTrack) {
        state.queue.unshift(state.currentTrack);
      }
      playTrack(prevTrack);
      return;
    }

    if (state.currentPlaylistTracks && state.currentPlaylistTracks.length > 0 && state.currentTrack) {
      const currIdx = state.currentPlaylistTracks.findIndex(t =>
        (t.id && state.currentTrack.id && t.id == state.currentTrack.id) ||
        (t.title && state.currentTrack.title && t.title.trim().toLowerCase() === state.currentTrack.title.trim().toLowerCase())
      );
      if (currIdx > 0) {
        const prevTrack = state.currentPlaylistTracks[currIdx - 1];
        state.queue = state.currentPlaylistTracks.slice(currIdx);
        playTrack(prevTrack);
        return;
      }
    }

    audio.currentTime = 0;
  }

  function handleTrackEnded() {
    if (state.repeatMode === 2) {
      audio.currentTime = 0;
      audio.play().catch(e => console.warn(e));
    } else {
      playNextTrack(false);
    }
  }

  function updatePlayPauseIcons() {
    if (iconPlay && iconPause) {
      iconPlay.style.display = state.isPlaying ? 'none' : 'block';
      iconPause.style.display = state.isPlaying ? 'block' : 'none';
    }
    const npIconPlay = document.getElementById('np-icon-play');
    const npIconPause = document.getElementById('np-icon-pause');
    if (npIconPlay && npIconPause) {
      npIconPlay.style.display = state.isPlaying ? 'none' : 'block';
      npIconPause.style.display = state.isPlaying ? 'block' : 'none';
    }
    const vinylDisc = document.getElementById('np-vinyl-disc');
    if (vinylDisc) {
      vinylDisc.classList.toggle('playing', state.isPlaying);
    }
  }

  // ==========================================
  // CONTROLS & LISTENERS
  // ==========================================
  function setupControls() {
    btnPlayPause.addEventListener('click', togglePlayPause);
    btnNext.addEventListener('click', () => playNextTrack(true));
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
  // RIGHT COLUMN (NOW PLAYING & VINYL ENGINE)
  // ==========================================
  function openNowPlayingPanel() {
    const container = document.querySelector('.app-container');
    const panel = document.getElementById('panel-now-playing');
    const bottomBar = document.getElementById('bottom-player-bar');
    if (container) container.classList.remove('right-panel-closed');
    if (panel) panel.style.display = 'flex';
    if (bottomBar) bottomBar.style.display = 'none';
  }

  function closeNowPlayingPanel() {
    const container = document.querySelector('.app-container');
    const panel = document.getElementById('panel-now-playing');
    const bottomBar = document.getElementById('bottom-player-bar');
    if (container) container.classList.add('right-panel-closed');
    if (panel) panel.style.display = 'none';
    if (bottomBar) bottomBar.style.display = 'flex';
  }

  function toggleNowPlayingPanel() {
    const container = document.querySelector('.app-container');
    if (container && container.classList.contains('right-panel-closed')) {
      openNowPlayingPanel();
    } else {
      closeNowPlayingPanel();
    }
  }

  function setupRightPanel() {
    const btnNpPlayPause = document.getElementById('btn-np-play-pause');
    const btnNpPrev = document.getElementById('btn-np-prev');
    const btnNpNext = document.getElementById('btn-np-next');
    const btnNpShuffle = document.getElementById('btn-np-shuffle');
    const btnNpRepeat = document.getElementById('btn-np-repeat');
    const btnNpLyrics = document.getElementById('btn-np-lyrics');
    const btnNpQueue = document.getElementById('btn-np-queue');
    const btnNpVolumeIcon = document.getElementById('btn-np-volume-icon');
    const npVolumeSlider = document.getElementById('np-volume-slider');
    const npVolumeFill = document.getElementById('np-volume-fill');
    const npSeekSlider = document.getElementById('np-seek-slider');
    const npSeekFill = document.getElementById('np-seek-fill');
    const npCurrentTime = document.getElementById('np-current-time');
    const btnNpFullscreen = document.getElementById('btn-np-fullscreen');
    const btnNpAddToPl = document.getElementById('btn-np-add-to-pl');
    const btnToggleNpPanel = document.getElementById('btn-toggle-np-panel');

    if (btnNpPlayPause) btnNpPlayPause.addEventListener('click', togglePlayPause);
    if (btnNpPrev) btnNpPrev.addEventListener('click', playPrevTrack);
    if (btnNpNext) btnNpNext.addEventListener('click', () => playNextTrack(true));

    if (btnNpShuffle) {
      btnNpShuffle.addEventListener('click', () => {
        state.isShuffle = !state.isShuffle;
        if (btnShuffle) btnShuffle.classList.toggle('active', state.isShuffle);
        btnNpShuffle.classList.toggle('active', state.isShuffle);
      });
    }

    if (btnNpRepeat) {
      btnNpRepeat.addEventListener('click', () => {
        state.repeatMode = (state.repeatMode + 1) % 3;
        if (btnRepeat) {
          btnRepeat.classList.toggle('active', state.repeatMode > 0);
          btnRepeat.classList.toggle('repeat-one', state.repeatMode === 2);
        }
        btnNpRepeat.classList.toggle('active', state.repeatMode > 0);
      });
    }

    if (btnNpLyrics) {
      btnNpLyrics.addEventListener('click', () => {
        if (btnToggleLyrics) btnToggleLyrics.click();
      });
    }

    if (btnNpQueue) {
      btnNpQueue.addEventListener('click', () => {
        if (btnToggleQueue) btnToggleQueue.click();
      });
    }

    // Scrubber
    if (npSeekSlider) {
      npSeekSlider.addEventListener('mousedown', () => { isDraggingNpSeek = true; });
      npSeekSlider.addEventListener('touchstart', () => { isDraggingNpSeek = true; });

      npSeekSlider.addEventListener('input', () => {
        if (!audio.duration) return;
        const targetTime = (npSeekSlider.value / 100) * audio.duration;
        if (npCurrentTime) npCurrentTime.textContent = formatTime(targetTime);
        if (currentTimeLabel) currentTimeLabel.textContent = formatTime(targetTime);
        if (npSeekFill) npSeekFill.style.width = `${npSeekSlider.value}%`;
        if (seekFill) seekFill.style.width = `${npSeekSlider.value}%`;
      });

      npSeekSlider.addEventListener('change', () => {
        isDraggingNpSeek = false;
        if (!audio.duration) return;
        const targetTime = (npSeekSlider.value / 100) * audio.duration;
        audio.currentTime = targetTime;
      });

      window.addEventListener('mouseup', () => { isDraggingNpSeek = false; });
      window.addEventListener('touchend', () => { isDraggingNpSeek = false; });
    }

    // Volume
    if (npVolumeSlider) {
      npVolumeSlider.value = state.volume;
      if (npVolumeFill) npVolumeFill.style.width = `${state.volume * 100}%`;

      npVolumeSlider.addEventListener('input', () => {
        const val = parseFloat(npVolumeSlider.value);
        state.volume = val;
        audio.volume = val;
        if (npVolumeFill) npVolumeFill.style.width = `${val * 100}%`;
        if (volumeSlider) volumeSlider.value = val;
        if (volumeFill) volumeFill.style.width = `${val * 100}%`;
        localStorage.setItem('spkw_volume', val.toString());
        updateVolumeIcon(val);
      });
    }

    if (btnNpVolumeIcon) {
      btnNpVolumeIcon.addEventListener('click', () => {
        if (btnVolumeIcon) btnVolumeIcon.click();
        if (npVolumeSlider) npVolumeSlider.value = audio.volume;
        if (npVolumeFill) npVolumeFill.style.width = `${audio.volume * 100}%`;
      });
    }

    if (btnNpFullscreen) {
      btnNpFullscreen.addEventListener('click', () => {
        if (btnToggleVisualizer) {
          btnToggleVisualizer.click();
        } else if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      });
    }

    if (btnNpAddToPl) {
      btnNpAddToPl.addEventListener('click', () => {
        if (state.currentTrack) {
          openAddToPlaylistModal(state.currentTrack);
        }
      });
    }

    if (btnToggleNpPanel) {
      btnToggleNpPanel.addEventListener('click', () => {
        closeNowPlayingPanel();
      });
    }

    const btnToggleNpTopbar = document.getElementById('btn-toggle-np-topbar');
    if (btnToggleNpTopbar) {
      btnToggleNpTopbar.addEventListener('click', () => {
        toggleNowPlayingPanel();
      });
    }

    const btnReopenNpBar = document.getElementById('btn-reopen-np-bar');
    if (btnReopenNpBar) {
      btnReopenNpBar.addEventListener('click', () => {
        openNowPlayingPanel();
      });
    }

    if (playerThumb) {
      playerThumb.addEventListener('click', () => {
        openNowPlayingPanel();
      });
    }

    if (playerTitle) {
      playerTitle.addEventListener('click', () => {
        openNowPlayingPanel();
      });
    }
  }

  function updateRightPanelUI(track) {
    if (!track) return;
    const npTrackTitle = document.getElementById('np-track-title');
    const npTrackArtist = document.getElementById('np-track-artist');
    const npVinylCover = document.getElementById('np-vinyl-cover');
    const npLargeArtImg = document.getElementById('np-large-art-img');
    const npCardTrackTitle = document.getElementById('np-card-track-title');
    const npCardTrackArtist = document.getElementById('np-card-track-artist');
    const npContextTitle = document.getElementById('np-context-title');
    const npArtistBanner = document.getElementById('np-artist-banner');
    const npAboutArtistName = document.getElementById('np-about-artist-name');
    const npAboutArtistListeners = document.getElementById('np-about-artist-listeners');
    const npAboutArtistDesc = document.getElementById('np-about-artist-desc');
    const npTotalDuration = document.getElementById('np-total-duration');
    const npCurrentTime = document.getElementById('np-current-time');
    const npSeekSlider = document.getElementById('np-seek-slider');
    const npSeekFill = document.getElementById('np-seek-fill');

    const cover = track.image || '/static/images/default-album.svg';
    const title = track.title || 'Unknown Title';
    const artist = track.artist || 'Unknown Artist';
    const primaryArtist = artist.split(',')[0].split('&')[0].trim();

    if (npTrackTitle) npTrackTitle.textContent = title;
    if (npTrackArtist) npTrackArtist.textContent = artist;
    if (npCardTrackTitle) npCardTrackTitle.textContent = title;
    if (npCardTrackArtist) npCardTrackArtist.textContent = artist;
    if (npVinylCover) {
      npVinylCover.src = cover;
      npVinylCover.onerror = () => { npVinylCover.src = '/static/images/default-album.svg'; };
    }
    if (npLargeArtImg) {
      npLargeArtImg.src = cover;
      npLargeArtImg.onerror = () => { npLargeArtImg.src = '/static/images/default-album.svg'; };
    }

    if (npContextTitle) {
      npContextTitle.textContent = state.activePlaylistTitle
        || (state.activePlaylistId ? (document.getElementById('playlist-hero-title')?.textContent || 'Playlist') : (track.album || 'Now Playing'));
    }

    if (npAboutArtistName) npAboutArtistName.textContent = primaryArtist;
    if (npArtistBanner) {
      npArtistBanner.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.2), rgba(0,0,0,0.85)), url('${cover}')`;
    }

    if (track.duration_str) {
      if (npTotalDuration) npTotalDuration.textContent = track.duration_str;
    } else if (track.duration) {
      if (npTotalDuration) npTotalDuration.textContent = formatTime(track.duration);
    }

    // Deterministic monthly listeners based on artist name
    let hash = 0;
    for (let i = 0; i < primaryArtist.length; i++) {
      hash = (hash << 5) - hash + primaryArtist.charCodeAt(i);
      hash |= 0;
    }
    const listeners = Math.floor(Math.abs(hash) % 8500000) + 1200000;
    if (npAboutArtistListeners) {
      npAboutArtistListeners.textContent = `${listeners.toLocaleString()} monthly listeners`;
    }
    if (npAboutArtistDesc) {
      npAboutArtistDesc.textContent = `${primaryArtist} adalah musisi dengan karya populer yang dinikmati jutaan penggemar setiap bulannya di Spotify KW.`;
    }

    // Keep icons in sync with play state
    updatePlayPauseIcons();
  }

  function setupInitialRightPanelPreview() {
    const initialTrack = {
      id: 'preview_old_love',
      title: 'Old Love',
      artist: 'yuji, putri dahlia',
      album: 'Old Love - Single',
      duration: 249,
      duration_str: '4:09',
      image: 'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=500&q=80',
      source: 'spotify'
    };
    updateRightPanelUI(initialTrack);
    const npCurrentTime = document.getElementById('np-current-time');
    const npTotalDuration = document.getElementById('np-total-duration');
    const npSeekSlider = document.getElementById('np-seek-slider');
    const npSeekFill = document.getElementById('np-seek-fill');
    if (npCurrentTime) npCurrentTime.textContent = '1:20';
    if (npTotalDuration) npTotalDuration.textContent = '4:09';
    if (npSeekSlider) npSeekSlider.value = 32;
    if (npSeekFill) npSeekFill.style.width = '32%';
  }

  // ==========================================
  // SIDEBAR YOUR LIBRARY (Rich List & Zero Clip)
  // ==========================================
  function setupSidebarLibrary() {
    // Filter chips: All / Playlists / Artists
    document.querySelectorAll('.lib-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.lib-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const filter = chip.dataset.filter;
        document.querySelectorAll('.library-item').forEach(item => {
          if (filter === 'all') {
            item.style.display = 'flex';
          } else if (filter === 'playlists') {
            item.style.display = item.dataset.type === 'playlist' ? 'flex' : 'none';
          } else if (filter === 'artists') {
            item.style.display = item.dataset.type === 'artist' ? 'flex' : 'none';
          }
        });
      });
    });

    // Pinned Liked Songs
    const navLiked = document.getElementById('nav-liked');
    if (navLiked) navLiked.addEventListener('click', () => openLikedSongsView());

    // Downloaded Offline
    const navDownloaded = document.getElementById('nav-downloaded');
    if (navDownloaded) navDownloaded.addEventListener('click', () => openDownloadedSongsView());

    // Local PC
    const navLocal = document.getElementById('nav-local');
    if (navLocal) navLocal.addEventListener('click', () => switchView('local'));

    // Preset items with data-spotify / data-id / data-query
    document.querySelectorAll('.library-item').forEach(item => {
      if (item.id === 'nav-liked' || item.id === 'nav-downloaded' || item.id === 'nav-local') return;

      item.addEventListener('click', () => {
        if (item.dataset.spotify) {
          openSpotifyPlaylist(item.dataset.spotify);
        } else if (item.dataset.id) {
          const title = item.querySelector('.lib-item-title')?.textContent || 'Playlist';
          openCuratedPlaylist(item.dataset.id, title);
        } else if (item.dataset.query) {
          if (globalSearchInput) {
            globalSearchInput.value = item.dataset.query;
            performSearch(item.dataset.query);
          }
        }
      });
    });
  }

  // ==========================================
  // NAVIGATION & VIEWS
  // ==========================================
  function setupNavigation() {
    if (navHome) navHome.addEventListener('click', () => switchView('home'));

    const searchBox = document.getElementById('topbar-search-box');
    if (searchBox) {
      searchBox.addEventListener('click', (e) => {
        switchView('search');
        if (e.target !== btnClearSearch) {
          globalSearchInput?.focus();
        }
      });
    }

    if (globalSearchInput) {
      globalSearchInput.addEventListener('focus', () => {
        if (state.activeView !== 'search') {
          switchView('search');
        }
      });
    }

    const btnBrowseCategory = document.getElementById('btn-browse-category');
    if (btnBrowseCategory) {
      btnBrowseCategory.addEventListener('click', (e) => {
        e.stopPropagation();
        switchView('search');
        globalSearchInput?.focus();
      });
    }

    if (navLiked) navLiked.addEventListener('click', () => openLikedSongsView());
    if (navLocal) navLocal.addEventListener('click', () => switchView('local'));

    const navDownloaded = document.getElementById('nav-downloaded');
    if (navDownloaded) {
      navDownloaded.addEventListener('click', () => openDownloadedSongsView());
    }

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

    // Create playlist button (+) in sidebar
    const btnCreatePl = document.getElementById('btn-create-playlist');
    if (btnCreatePl) {
      btnCreatePl.addEventListener('click', () => {
        const name = prompt('Nama playlist baru:');
        if (name && name.trim()) {
          const newPl = { id: `user_pl_${Date.now()}`, name: name.trim(), tracks: [] };
          state.userPlaylists.unshift(newPl);
          localStorage.setItem('spkw_playlists', JSON.stringify(state.userPlaylists));
          renderUserPlaylists();
          openUserPlaylist(newPl.id);
        }
      });
    }

    // Modal Add To Playlist Handlers
    const addToPlModal = document.getElementById('add-to-playlist-modal');
    const btnCloseAddToPl = document.getElementById('btn-close-add-to-pl');
    const btnCreatePlFromModal = document.getElementById('btn-create-pl-from-modal');

    if (btnCloseAddToPl) {
      btnCloseAddToPl.addEventListener('click', () => {
        addToPlModal.style.display = 'none';
      });
    }

    if (btnCreatePlFromModal) {
      btnCreatePlFromModal.addEventListener('click', () => {
        const name = prompt('Nama playlist baru:');
        if (name && name.trim()) {
          const newPl = { id: `user_pl_${Date.now()}`, name: name.trim(), tracks: [] };
          if (trackToAddToPlaylist) {
            newPl.tracks.push(trackToAddToPlaylist);
          }
          state.userPlaylists.unshift(newPl);
          localStorage.setItem('spkw_playlists', JSON.stringify(state.userPlaylists));
          renderUserPlaylists();
          addToPlModal.style.display = 'none';
          openUserPlaylist(newPl.id);
        }
      });
    }

    // Playlist banner Play All button
    const btnPlayAll = document.getElementById('btn-playlist-play-all');
    if (btnPlayAll) {
      btnPlayAll.addEventListener('click', () => {
        if (state.currentPlaylistTracks.length > 0) {
          playTrackInContext(state.currentPlaylistTracks[0], state.currentPlaylistTracks);
        }
      });
    }

    // Playlist banner Shuffle button
    const btnPlShuffle = document.getElementById('btn-playlist-shuffle-all');
    if (btnPlShuffle) {
      btnPlShuffle.addEventListener('click', () => {
        if (state.currentPlaylistTracks.length > 0) {
          state.isShuffle = true;
          if (btnShuffle) btnShuffle.classList.add('active');
          const shuffled = [...state.currentPlaylistTracks].sort(() => 0.5 - Math.random());
          playTrack(shuffled[0], shuffled.slice(1));
        }
      });
    }

    // Playlist banner Download All button
    const btnDownloadAll = document.getElementById('btn-playlist-download-all');
    if (btnDownloadAll) {
      btnDownloadAll.addEventListener('click', handleDownloadPlaylist);
    }
  }

  function switchView(viewName) {
    state.activeView = viewName;
    Object.keys(views).forEach(k => {
      if (views[k]) {
        views[k].style.display = (k === viewName) ? 'block' : 'none';
      }
    });

    // Nav active highlights
    if (navHome) navHome.classList.toggle('active', viewName === 'home');
    const searchBox = document.getElementById('topbar-search-box');
    if (searchBox) searchBox.classList.toggle('active', viewName === 'search');
    if (navLiked) navLiked.classList.toggle('active', viewName === 'playlist' && state.activePlaylistId === 'liked');
    if (navLocal) navLocal.classList.toggle('active', viewName === 'local');

    const navDownloaded = document.getElementById('nav-downloaded');
    if (navDownloaded) {
      navDownloaded.classList.toggle('active', viewName === 'playlist' && state.activePlaylistId === 'downloaded');
    }

    // Scroll to top
    const scrollEl = document.getElementById('main-content-scroll');
    if (scrollEl) scrollEl.scrollTop = 0;
  }

  // ==========================================
  // HOME / FEATURED MUSIC
  // ==========================================
  async function loadFeaturedMusic() {
    const quickGrid = document.getElementById('quick-grid-container');
    const gridJump = document.getElementById('grid-jump-back-in');
    const gridDikiwi = document.getElementById('grid-made-for-dikiwi');
    const gridRecents = document.getElementById('grid-recents');

    // Wire up miniplayer banner
    const btnTryMiniplayer = document.getElementById('btn-try-miniplayer');
    const btnMiniplayerTips = document.getElementById('btn-miniplayer-tips');
    if (btnTryMiniplayer) {
      btnTryMiniplayer.addEventListener('click', () => {
        showToast('Miniplayer Mode aktif! Membuka visualizer...');
        if (btnToggleVisualizer) btnToggleVisualizer.click();
      });
    }
    if (btnMiniplayerTips) {
      btnMiniplayerTips.addEventListener('click', () => {
        showToast('Tips: Tekan Space untuk Play/Pause, M untuk Mute, L untuk Lirik!', 'info');
      });
    }

    // 1. POPULATE QUICK GRID 8 CARDS (Exactly matching Image 1)
    const quickCardsData = [
      {
        id: 'liked',
        title: 'Liked Songs',
        isLikedSpecial: true,
        action: () => openLikedSongsView()
      },
      {
        id: 'cur-puting',
        title: 'Arabic < >',
        img: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=150&q=80',
        action: () => openCuratedPlaylist('cur-puting', 'Arabic < >')
      },
      {
        id: 'cur-puting',
        title: 'Puting Beliung',
        img: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=150&q=80',
        action: () => openCuratedPlaylist('cur-puting', 'Puting Beliung')
      },
      {
        id: 'cur-hipdut',
        title: 'HIPDUT VIRAL ASIK',
        img: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=150&q=80',
        action: () => openCuratedPlaylist('cur-hipdut', 'HIPDUT VIRAL ASIK')
      },
      {
        id: 'cur-olivia',
        title: 'Olivia Rodrigo',
        img: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&q=80',
        action: () => openCuratedPlaylist('cur-olivia', 'Olivia Rodrigo')
      },
      {
        id: 'cur-dailymix3',
        title: 'Daily Mix 3',
        img: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150&q=80',
        action: () => openCuratedPlaylist('cur-dailymix3', 'Daily Mix 3')
      },
      {
        id: 'cur-jagoanmamah',
        title: 'jagoanmamah DJ old TT',
        img: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=150&q=80',
        action: () => openCuratedPlaylist('cur-jagoanmamah', 'jagoanmamah DJ old TT')
      },
      {
        id: '4OmI8xAbhvqDcuKaLkEaN0',
        title: 'gen z songs english',
        img: 'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=150&q=80',
        action: () => openSpotifyPlaylist('4OmI8xAbhvqDcuKaLkEaN0')
      }
    ];

    if (quickGrid) {
      quickGrid.innerHTML = '';
      quickCardsData.forEach(item => {
        const card = document.createElement('div');
        card.className = 'quick-card-item';
        if (item.isLikedSpecial) {
          card.innerHTML = `
            <div class="quick-card-img" style="background: linear-gradient(135deg, #450af5, #8e8ee5); display: flex; align-items: center; justify-content: center;">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="white"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
            </div>
            <span class="quick-card-title">${escapeHtml(item.title)}</span>
            <button class="quick-card-play-btn" title="Buka">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="black"><polygon points="6,4 20,12 6,20"/></svg>
            </button>
          `;
        } else {
          card.innerHTML = `
            <img class="quick-card-img" src="${item.img}" alt="${escapeHtml(item.title)}" loading="lazy" />
            <span class="quick-card-title">${escapeHtml(item.title)}</span>
            <button class="quick-card-play-btn" title="Putar">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="black"><polygon points="6,4 20,12 6,20"/></svg>
            </button>
          `;
        }
        card.addEventListener('click', item.action);
        quickGrid.appendChild(card);
      });
    }

    // 1.5. POPULATE 3 PLAYLIST SERING DIDENGAR (Gambar 3)
    const gridTopPlaylists = document.getElementById('grid-top-playlists');
    const topPlaylistsData = [
      {
        id: '4OmI8xAbhvqDcuKaLkEaN0',
        title: 'gen z songs english',
        badge: '🔥 TOP #1 • 2.4M PENDENGAR',
        desc: 'Old Love, golden hour, Until I Found You, Here With Me, Glimpse of Us & lagu hits Gen Z terpopuler.',
        meta: '60 lagu • Sering didengar',
        cover: 'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=600&q=80',
        action: () => openSpotifyPlaylist('4OmI8xAbhvqDcuKaLkEaN0')
      },
      {
        id: '1gAv5vmayVaCxbxSX7KmQj',
        title: 'Indo Happy Playlist',
        badge: '🇮🇩 FAVORIT KAMU • 1.8M PENDENGAR',
        desc: 'Pilihan musik Indonesia paling asik: Bunga Citra Lestari, Afgan, Tulus, Dewa 19, Rizky Febian.',
        meta: '50 lagu • Sering didengar',
        cover: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&q=80',
        action: () => openSpotifyPlaylist('1gAv5vmayVaCxbxSX7KmQj')
      },
      {
        id: 'cur-hipdut',
        title: 'HIPDUT VIRAL ASIK',
        badge: '⚡ TRENDING MINGGUAN • 3.1M PENDENGAR',
        desc: 'Koplo hits dan dangdut viral TikTok: Rungkad, Nemen, Ginio, Dumes, Cundamani, Kisinan.',
        meta: '45 lagu • Sering didengar',
        cover: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&q=80',
        action: () => openCuratedPlaylist('cur-hipdut', 'HIPDUT VIRAL ASIK')
      }
    ];

    if (gridTopPlaylists) {
      gridTopPlaylists.innerHTML = '';
      topPlaylistsData.forEach(item => {
        const card = document.createElement('div');
        card.className = 'top-playlist-card';
        card.innerHTML = `
          <div class="top-pl-cover-box">
            <span class="top-pl-badge">${escapeHtml(item.badge)}</span>
            <img src="${item.cover}" alt="${escapeHtml(item.title)}" loading="lazy" />
            <button class="top-pl-play-btn" title="Putar Playlist">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="black"><polygon points="7,5 19,12 7,19"/></svg>
            </button>
          </div>
          <div class="top-pl-info">
            <h3 class="top-pl-title">${escapeHtml(item.title)}</h3>
            <p class="top-pl-desc">${escapeHtml(item.desc)}</p>
            <div class="top-pl-meta-row">
              <span>${escapeHtml(item.meta)}</span>
            </div>
          </div>
        `;
        card.addEventListener('click', item.action);
        gridTopPlaylists.appendChild(card);
      });
    }

    // 2. POPULATE "JUMP BACK IN" (MMG, Phonk, Dewa 19, Dj Old)
    const jumpCards = [
      {
        id: 'cur-mmg',
        title: 'MMG',
        sub: 'With Naykilla, dia, Akbar Chalay and more',
        cover: 'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=500&q=80',
        action: () => openCuratedPlaylist('cur-mmg', 'MMG')
      },
      {
        id: 'cur-phonk',
        title: 'BRAZILIAN PHONK 2026 🔥',
        sub: 'With DJ FKU, Slowboy, Crazy Mano and more',
        cover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&q=80',
        action: () => openCuratedPlaylist('cur-phonk', 'BRAZILIAN PHONK 2026 🔥')
      },
      {
        id: 'cur-dewa19',
        title: 'Dewa 19',
        sub: 'Artist • 3,420,119 monthly listeners',
        cover: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=500&q=80',
        action: () => openCuratedPlaylist('cur-dewa19', 'Dewa 19')
      },
      {
        id: 'cur-djold',
        title: 'Dj old 2019-2023 🔥',
        sub: 'With DJ Desa, DJ Opus, DJ Nofin Asia and more',
        cover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&q=80',
        action: () => openCuratedPlaylist('cur-djold', 'Dj old 2019-2023 🔥')
      }
    ];

    if (gridJump) {
      gridJump.innerHTML = '';
      jumpCards.forEach(item => {
        gridJump.appendChild(createMusicCardV2(item));
      });
    }

    // 3. POPULATE "MADE FOR DIKIWI" (Discover Weekly, Daily Mixes 1-6, Release Radar)
    const dikiwiCards = [
      {
        id: 'cur-discover',
        title: 'Discover Weekly',
        sub: 'Your weekly mixtape of fresh music. Enjoy new music and deep cuts.',
        cover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80',
        action: () => openCuratedPlaylist('cur-discover', 'Discover Weekly')
      },
      {
        id: 'cur-mix-01',
        title: 'Daily Mix 1',
        sub: 'Bernadya, Nadin Amizah, Tulus and more',
        cover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&q=80',
        action: () => openCuratedPlaylist('cur-mix-01', 'Daily Mix 1')
      },
      {
        id: 'cur-mix-02',
        title: 'Daily Mix 2',
        sub: 'Joji, keshi, NIKI, Jeremy Zucker and more',
        cover: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=500&q=80',
        action: () => openCuratedPlaylist('cur-mix-02', 'Daily Mix 2')
      },
      {
        id: 'cur-mix-04',
        title: 'Daily Mix 4',
        sub: 'Queen, Oasis, Nirvana, Coldplay and more',
        cover: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=500&q=80',
        action: () => openCuratedPlaylist('cur-mix-04', 'Daily Mix 4')
      },
      {
        id: 'cur-mix-05',
        title: 'Daily Mix 5',
        sub: 'Happy Asmara, Denny Caknan, Gildcoustic and more',
        cover: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=500&q=80',
        action: () => openCuratedPlaylist('cur-mix-05', 'Daily Mix 5')
      },
      {
        id: 'cur-mix-06',
        title: 'Daily Mix 6',
        sub: 'Olivia Rodrigo, Billie Eilish, Sabrina Carpenter and more',
        cover: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&q=80',
        action: () => openCuratedPlaylist('cur-mix-06', 'Daily Mix 6')
      },
      {
        id: 'cur-release',
        title: 'Release Radar',
        sub: 'Catch all the latest music from artists you follow, updated every Friday.',
        cover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&q=80',
        action: () => openCuratedPlaylist('cur-release', 'Release Radar')
      }
    ];

    if (gridDikiwi) {
      gridDikiwi.innerHTML = '';
      dikiwiCards.forEach(item => {
        gridDikiwi.appendChild(createMusicCardV2(item));
      });
    }

    // 4. POPULATE "RECENTS"
    const recentCards = [
      {
        id: '1gAv5vmayVaCxbxSX7KmQj',
        title: 'Indo Happy Playlist',
        sub: 'Playlist • Spotify',
        cover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&q=80',
        action: () => openSpotifyPlaylist('1gAv5vmayVaCxbxSX7KmQj')
      },
      {
        id: 'featured-chill',
        title: '☕ Chill & Lofi Vibes',
        sub: 'Lagu santai untuk fokus dan relaksasi',
        cover: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=500&q=80',
        action: () => openCuratedPlaylist('featured-chill', '☕ Chill & Lofi Vibes')
      },
      {
        id: 'featured-global',
        title: 'Your All-Time Top Songs',
        sub: 'Made for Dikiwi',
        cover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&q=80',
        action: () => openCuratedPlaylist('featured-global', 'Your All-Time Top Songs')
      },
      {
        id: 'featured-rock',
        title: '🎸 Rock & Classic Legends',
        sub: 'Karya legendaris abadi sepanjang masa',
        cover: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=500&q=80',
        action: () => openCuratedPlaylist('featured-rock', '🎸 Rock & Classic Legends')
      }
    ];

    if (gridRecents) {
      gridRecents.innerHTML = '';
      recentCards.forEach(item => {
        gridRecents.appendChild(createMusicCardV2(item));
      });
    }
  }

  function createMusicCardV2(item) {
    const card = document.createElement('div');
    card.className = 'music-card-v2';
    card.innerHTML = `
      <div class="card-v2-img-box">
        <img src="${item.cover || '/static/images/default-album.svg'}" alt="${escapeHtml(item.title)}" loading="lazy" />
        <button class="card-v2-play-btn" title="Buka Playlist">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="black"><polygon points="6,4 20,12 6,20"/></svg>
        </button>
      </div>
      <div class="card-v2-title">${escapeHtml(item.title)}</div>
      <div class="card-v2-sub">${escapeHtml(item.sub || '')}</div>
    `;
    card.addEventListener('click', item.action);
    return card;
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
      playTrackInContext(track, trackListContext);
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
      playTrackInContext(top, results);
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
    const isDl = isTrackDownloaded(track.id);

    row.innerHTML = `
      <div class="track-num-col">
        <span>${index}</span>
        <svg class="row-play-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><polygon points="6,4 20,12 6,20"/></svg>
      </div>
      <div class="track-title-col">
        <img class="track-thumb-mini" src="${track.image || '/static/images/default-album.svg'}" onerror="this.src='/static/images/default-album.svg'" loading="lazy" />
        <div class="track-title-text-wrap">
          <span class="track-name">${escapeHtml(track.title)}</span>
          <span class="track-artist-sub">${escapeHtml(track.artist)}</span>
        </div>
      </div>
      <div class="track-album-col">${escapeHtml(track.album || 'Single')}</div>
      <div class="track-dur-col">
        <button class="btn-add-to-pl" title="Tambah ke Playlist" data-id="${track.id}">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
        </button>
        <button class="btn-download-track ${isDl ? 'downloaded' : ''}" title="${isDl ? 'Tersimpan Offline' : 'Download Lagu'}" data-id="${track.id}">
          ${isDl 
            ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#1ed760" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>'
            : '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>'
          }
        </button>
        <button class="row-like-btn ${isLiked ? 'liked' : ''}" title="Sukai">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="${isLiked ? '#1ed760' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </button>
        <span>${track.duration_str || formatTime(track.duration)}</span>
      </div>
    `;

    row.addEventListener('click', (e) => {
      if (e.target.closest('.btn-add-to-pl')) {
        e.stopPropagation();
        openAddToPlaylistModal(track);
        return;
      }

      if (e.target.closest('.btn-download-track')) {
        e.stopPropagation();
        const dlBtn = row.querySelector('.btn-download-track');
        handleDownloadSingleTrack(track, dlBtn);
        return;
      }

      if (e.target.closest('.row-like-btn')) {
        e.stopPropagation();
        toggleLikeTrack(track);
        const likeBtn = row.querySelector('.row-like-btn');
        const nowLiked = isTrackLiked(track.id);
        likeBtn.classList.toggle('liked', nowLiked);
        likeBtn.querySelector('svg').setAttribute('fill', nowLiked ? '#1ed760' : 'none');
        return;
      }

      playTrackInContext(track, trackListContext);
    });

    return row;
  }

  function highlightActiveTrackRow() {
    document.querySelectorAll('.track-row').forEach(r => {
      const isCurrent = state.currentTrack && (
        (state.currentTrack.id && r.dataset.id == state.currentTrack.id) ||
        (r.querySelector('.track-name')?.textContent === state.currentTrack.title &&
         r.querySelector('.track-artist-sub')?.textContent === state.currentTrack.artist)
      );
      r.classList.toggle('playing', !!isCurrent);
    });
  }

  // ==========================================
  // PLAYLISTS & OFFLINE DOWNLOAD ENGINE
  // ==========================================
  function renderUserPlaylists() {
    const container = document.getElementById('user-playlist-items');
    if (!container) return;
    container.innerHTML = '';

    if (!state.userPlaylists || state.userPlaylists.length === 0) return;

    state.userPlaylists.forEach(pl => {
      const item = document.createElement('div');
      item.className = 'library-item user-pl-item';
      if (state.activePlaylistId === pl.id) {
        item.classList.add('active-library');
      }
      item.dataset.type = 'playlist';
      item.dataset.id = pl.id;
      item.innerHTML = `
        <div class="lib-thumb-box user-pl-gradient">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="white"><path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/></svg>
        </div>
        <div class="lib-item-info">
          <span class="lib-item-title">${escapeHtml(pl.name)}</span>
          <span class="lib-item-sub">Playlist • ${(pl.tracks ? pl.tracks.length : 0)} lagu</span>
        </div>
        <button class="btn-del-library-item" title="Hapus Playlist" data-id="${pl.id}">&times;</button>
      `;

      item.addEventListener('click', (e) => {
        if (e.target.closest('.btn-del-library-item')) {
          e.stopPropagation();
          deleteUserPlaylist(pl.id, e);
          return;
        }
        openUserPlaylist(pl.id);
      });

      container.appendChild(item);
    });
  }

  function openUserPlaylist(playlistId) {
    const pl = state.userPlaylists.find(p => p.id === playlistId);
    if (!pl) return;

    state.activePlaylistId = playlistId;
    state.currentPlaylistTracks = pl.tracks || [];

    document.getElementById('playlist-hero-title').textContent = pl.name;
    document.getElementById('playlist-hero-desc').textContent = 'Playlist Pribadi Anda';
    document.getElementById('playlist-cover-img').src = pl.cover || '/static/images/default-album.svg';
    document.getElementById('playlist-cover-img').style.background = 'linear-gradient(135deg, #3b82f6, #1d4ed8)';
    document.getElementById('playlist-meta-type').textContent = 'PLAYLIST SAYA';
    document.getElementById('playlist-track-count').textContent = `${state.currentPlaylistTracks.length} lagu`;

    const btnSaveLib = document.getElementById('btn-playlist-save-library');
    if (btnSaveLib) btnSaveLib.style.display = 'none';

    const btnDlAll = document.getElementById('btn-playlist-download-all');
    if (btnDlAll) {
      btnDlAll.style.display = 'inline-flex';
      const allDownloaded = state.currentPlaylistTracks.length > 0 && state.currentPlaylistTracks.every(t => isTrackDownloaded(t.id));
      const dlText = document.getElementById('btn-download-all-text');
      if (dlText) {
        dlText.textContent = allDownloaded ? 'Semua Diunduh ✓' : 'Download Playlist';
      }
    }

    renderPlaylistTable(state.currentPlaylistTracks);
    switchView('playlist');
    highlightActivePlaylistItem();
  }

  function deleteUserPlaylist(playlistId, e) {
    if (e) e.stopPropagation();
    const pl = state.userPlaylists.find(p => p.id === playlistId);
    const name = pl ? pl.name : 'Playlist';
    if (confirm(`Apakah Anda yakin ingin menghapus playlist "${name}"?`)) {
      state.userPlaylists = state.userPlaylists.filter(p => p.id !== playlistId);
      localStorage.setItem('spkw_playlists', JSON.stringify(state.userPlaylists));
      renderUserPlaylists();
      showToast(`Playlist "${name}" berhasil dihapus`, 'info');
      if (state.activePlaylistId === playlistId) {
        switchView('home');
      }
    }
  }

  function openAddToPlaylistModal(track) {
    trackToAddToPlaylist = track;
    const modal = document.getElementById('add-to-playlist-modal');
    const titleEl = document.getElementById('add-to-pl-track-title');
    const listEl = document.getElementById('add-to-pl-list');
    if (!modal || !listEl) return;

    if (titleEl) {
      titleEl.textContent = `Lagu: ${track.title} - ${track.artist}`;
    }

    listEl.innerHTML = '';
    if (!state.userPlaylists || state.userPlaylists.length === 0) {
      listEl.innerHTML = '<div style="color: var(--text-subdued); font-size: 0.85rem; padding: 12px 0;">Anda belum memiliki playlist. Buat playlist baru di bawah.</div>';
    } else {
      state.userPlaylists.forEach(pl => {
        const alreadyHas = pl.tracks && pl.tracks.some(t => t.id === track.id);
        const row = document.createElement('div');
        row.className = 'add-to-pl-item';
        row.innerHTML = `
          <span>${escapeHtml(pl.name)} (${pl.tracks ? pl.tracks.length : 0} lagu)</span>
          <span style="font-size: 0.78rem; color: ${alreadyHas ? 'var(--spotify-green)' : 'var(--text-subdued)'};">
            ${alreadyHas ? '✓ Tersedia' : '+ Tambahkan'}
          </span>
        `;
        row.addEventListener('click', () => {
          if (!pl.tracks) pl.tracks = [];
          if (alreadyHas) {
            showToast(`Lagu sudah ada di "${pl.name}"`, 'info');
          } else {
            pl.tracks.push(track);
            localStorage.setItem('spkw_playlists', JSON.stringify(state.userPlaylists));
            renderUserPlaylists();
            showToast(`Berhasil menambahkan ke "${pl.name}"!`, 'success');
          }
          modal.style.display = 'none';
        });
        listEl.appendChild(row);
      });
    }

    modal.style.display = 'flex';
  }

  function highlightActivePlaylistItem() {
    document.querySelectorAll('.library-item, .playlist-item').forEach(el => {
      const isAct = el.dataset.id === state.activePlaylistId || 
                    (state.activePlaylistId && state.activePlaylistId.startsWith('spotify_') && el.dataset.spotify && state.activePlaylistId.includes(el.dataset.spotify));
      el.classList.toggle('active-library', !!isAct);
      el.classList.toggle('active-playlist', !!isAct);
    });
  }

  async function loadDownloadedTracks() {
    try {
      const res = await fetch('/api/offline/list');
      if (res.ok) {
        const list = await res.json();
        state.downloadedTracks = Array.isArray(list) ? list : (list.tracks || []);
        const badge = document.getElementById('downloaded-count-badge');
        if (badge) {
          badge.textContent = state.downloadedTracks.length;
        }
      }
    } catch (err) {
      console.warn('Offline list check failed:', err);
    }
  }

  function isTrackDownloaded(id) {
    if (!id) return false;
    return state.downloadedTracks.some(t => t.id === id);
  }

  function openDownloadedSongsView() {
    state.activePlaylistId = 'downloaded';
    state.currentPlaylistTracks = state.downloadedTracks;

    document.getElementById('playlist-hero-title').textContent = 'Lagu Terunduh (Offline)';
    document.getElementById('playlist-hero-desc').textContent = 'Koleksi lagu tersimpan di perangkat. Putar kapan saja 100% tanpa internet.';
    document.getElementById('playlist-cover-img').src = '/static/images/default-album.svg';
    document.getElementById('playlist-cover-img').style.background = 'linear-gradient(135deg, #10b981, #059669)';
    document.getElementById('playlist-meta-type').textContent = 'KOLEKSI OFFLINE';
    document.getElementById('playlist-track-count').textContent = `${state.downloadedTracks.length} lagu`;

    const btnSaveLib = document.getElementById('btn-playlist-save-library');
    if (btnSaveLib) btnSaveLib.style.display = 'none';

    const btnDlAll = document.getElementById('btn-playlist-download-all');
    if (btnDlAll) {
      btnDlAll.style.display = 'none';
    }

    renderPlaylistTable(state.downloadedTracks);
    switchView('playlist');
    highlightActivePlaylistItem();
  }

  async function handleDownloadSingleTrack(track, btnEl) {
    if (isTrackDownloaded(track.id)) {
      showToast(`"${track.title}" sudah tersimpan offline`, 'info');
      return;
    }

    if (btnEl) {
      btnEl.classList.add('downloading');
      btnEl.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-linecap="round"/></svg>`;
    }
    showToast(`Mulai mengunduh: ${track.title}...`, 'info');

    try {
      const res = await fetch('/api/offline/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: track.id,
          title: track.title,
          artist: track.artist || 'Unknown',
          album: track.album || '',
          duration: track.duration || 0,
          image: track.image || ''
        })
      });
      const result = await res.json();
      if (res.ok && result.status === 'success') {
        await loadDownloadedTracks();
        if (btnEl) {
          btnEl.classList.remove('downloading');
          btnEl.classList.add('downloaded');
          btnEl.title = 'Tersimpan Offline';
          btnEl.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#1ed760" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
        }
        showToast(`Lagu "${track.title}" berhasil diunduh ke offline!`, 'success');
      } else {
        throw new Error(result.message || 'Download failed');
      }
    } catch (err) {
      console.error('Download single track failed:', err);
      if (btnEl) {
        btnEl.classList.remove('downloading');
        btnEl.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>`;
      }
      showToast(`Gagal mengunduh "${track.title}".`, 'error');
    }
  }

  async function handleDownloadPlaylist() {
    const tracks = state.currentPlaylistTracks || [];
    if (tracks.length === 0) {
      showToast('Tidak ada lagu untuk diunduh dalam playlist ini.', 'info');
      return;
    }

    const dlText = document.getElementById('btn-download-all-text');
    const pending = tracks.filter(t => !isTrackDownloaded(t.id));
    if (pending.length === 0) {
      showToast('Semua lagu di playlist ini sudah terunduh offline!', 'info');
      if (dlText) dlText.textContent = 'Semua Diunduh ✓';
      return;
    }

    if (dlText) dlText.textContent = `Mengantre (${pending.length} lagu)...`;
    showToast(`Mengunduh ${pending.length} lagu di background...`, 'info');

    try {
      const res = await fetch('/api/offline/download-playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playlist_title: document.getElementById('playlist-hero-title')?.textContent || 'Playlist',
          tracks: tracks.map(t => ({
            id: t.id,
            title: t.title,
            artist: t.artist || '',
            album: t.album || '',
            duration: t.duration || 0,
            image: t.image || ''
          }))
        })
      });

      if (res.ok) {
        pollDownloadProgress();
      } else {
        showToast('Gagal memulai unduhan playlist.', 'error');
        if (dlText) dlText.textContent = 'Download Playlist';
      }
    } catch (err) {
      console.error('Download playlist error:', err);
      showToast('Koneksi terputus saat memulai unduhan.', 'error');
      if (dlText) dlText.textContent = 'Download Playlist';
    }
  }

  function pollDownloadProgress() {
    if (downloadPollInterval) clearInterval(downloadPollInterval);
    const dlText = document.getElementById('btn-download-all-text');

    downloadPollInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/offline/progress');
        if (res.ok) {
          const p = await res.json();
          if (p.is_downloading) {
            if (dlText) {
              dlText.textContent = `Mengunduh (${p.completed}/${p.total})...`;
            }
          } else {
            clearInterval(downloadPollInterval);
            downloadPollInterval = null;
            await loadDownloadedTracks();
            if (dlText) {
              dlText.textContent = 'Semua Diunduh ✓';
            }
            showToast('Selesai! Seluruh lagu playlist kini tersimpan offline.', 'success');
            if (state.activeView === 'playlist') {
              renderPlaylistTable(state.currentPlaylistTracks);
            }
          }
        }
      } catch (e) {
        clearInterval(downloadPollInterval);
        downloadPollInterval = null;
      }
    }, 1200);
  }

  function openLikedSongsView() {
    state.activePlaylistId = 'liked';
    state.currentPlaylistTracks = state.likedSongs;

    document.getElementById('playlist-hero-title').textContent = 'Lagu yang Disukai';
    document.getElementById('playlist-hero-desc').textContent = 'Koleksi semua lagu favorit Anda tersimpan aman secara offline';
    document.getElementById('playlist-cover-img').src = '/static/images/default-album.svg';
    document.getElementById('playlist-cover-img').style.background = 'linear-gradient(135deg, #450af5, #c4efd9)';
    document.getElementById('playlist-meta-type').textContent = 'KOLEKSI PRIBADI';
    document.getElementById('playlist-track-count').textContent = `${state.likedSongs.length} lagu`;

    const btnSaveLib = document.getElementById('btn-playlist-save-library');
    if (btnSaveLib) btnSaveLib.style.display = 'none';

    const btnDlAll = document.getElementById('btn-playlist-download-all');
    if (btnDlAll) {
      btnDlAll.style.display = 'inline-flex';
      const allDownloaded = state.likedSongs.length > 0 && state.likedSongs.every(t => isTrackDownloaded(t.id));
      const dlText = document.getElementById('btn-download-all-text');
      if (dlText) {
        dlText.textContent = allDownloaded ? 'Semua Diunduh ✓' : 'Download Playlist';
      }
    }

    renderPlaylistTable(state.likedSongs);
    switchView('playlist');
    highlightActivePlaylistItem();
  }

  function openCuratedPlaylist(playlistId, title) {
    state.activePlaylistId = playlistId;
    state.activePlaylistTitle = title;
    const npCtx = document.getElementById('np-context-title');
    if (npCtx) npCtx.textContent = title;
    document.getElementById('playlist-hero-title').textContent = title;
    document.getElementById('playlist-hero-desc').textContent = 'Koleksi pilihan Spotify KW (100% Kualitas 320kbps)';
    document.getElementById('playlist-meta-type').textContent = 'PLAYLIST TERKURASI';
    document.getElementById('playlist-cover-img').src = '/static/images/default-album.svg';

    const btnSaveLib = document.getElementById('btn-playlist-save-library');
    if (btnSaveLib) btnSaveLib.style.display = 'none';

    const btnDlAll = document.getElementById('btn-playlist-download-all');
    if (btnDlAll) {
      btnDlAll.style.display = 'inline-flex';
      const dlText = document.getElementById('btn-download-all-text');
      if (dlText) dlText.textContent = 'Download Playlist';
    }

    document.getElementById('playlist-tracklist-items').innerHTML = `
      <div class="loading-spinner-box">
        <div class="spinner"></div>
        <span>Memuat daftar lagu pilihan...</span>
      </div>
    `;
    switchView('playlist');
    highlightActivePlaylistItem();

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

        if (btnDlAll) {
          const allDownloaded = state.currentPlaylistTracks.length > 0 && state.currentPlaylistTracks.every(t => isTrackDownloaded(t.id));
          const dlText = document.getElementById('btn-download-all-text');
          if (dlText) dlText.textContent = allDownloaded ? 'Semua Diunduh ✓' : 'Download Playlist';
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
    highlightActivePlaylistItem();

    try {
      const resp = await fetch(`/api/spotify/playlist?url=${encodeURIComponent(playlistIdOrUrl)}`);
      const pl = await resp.json();

      state.activePlaylistTitle = pl.title || 'Playlist Spotify';
      const npCtx = document.getElementById('np-context-title');
      if (npCtx) npCtx.textContent = state.activePlaylistTitle;

      document.getElementById('playlist-hero-title').textContent = pl.title || 'Playlist Spotify';
      document.getElementById('playlist-hero-desc').textContent = pl.subtitle ? `Dibuat oleh ${pl.subtitle} • 100% Kualitas 320kbps` : 'Playlist Spotify';
      document.getElementById('playlist-cover-img').src = pl.cover || '/static/images/default-album.svg';
      document.getElementById('playlist-track-count').textContent = `${pl.track_count || pl.tracks.length} lagu`;

      state.currentPlaylistTracks = pl.tracks || [];

      // Show Save to Library button
      const btnSaveLib = document.getElementById('btn-playlist-save-library');
      if (btnSaveLib) {
        btnSaveLib.style.display = 'inline-flex';
        btnSaveLib.onclick = () => {
          const existing = state.userPlaylists.find(p => p.id === state.activePlaylistId || p.name === (pl.title || 'Playlist'));
          if (existing) {
            showToast('Playlist ini sudah ada di Library Anda!', 'info');
            return;
          }
          const newPl = {
            id: `saved_${Date.now()}`,
            name: pl.title || 'Playlist Spotify',
            cover: pl.cover || '/static/images/default-album.svg',
            tracks: [...state.currentPlaylistTracks]
          };
          state.userPlaylists.unshift(newPl);
          localStorage.setItem('spkw_playlists', JSON.stringify(state.userPlaylists));
          renderUserPlaylists();
          showToast(`Playlist "${newPl.name}" berhasil disimpan ke Library!`, 'success');
        };
      }

      // Show Download All button
      const btnDlAll = document.getElementById('btn-playlist-download-all');
      if (btnDlAll) {
        btnDlAll.style.display = 'inline-flex';
        const allDl = state.currentPlaylistTracks.length > 0 && state.currentPlaylistTracks.every(t => isTrackDownloaded(t.id));
        const dlText = document.getElementById('btn-download-all-text');
        if (dlText) dlText.textContent = allDl ? 'Semua Diunduh ✓' : 'Download Playlist';
      }

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
          Belum ada lagu di sini. Silakan tambahkan lagu dengan tombol + atau menekan ikon hati.
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

  function getSafeFilename(id) {
    return String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  function showToast(message, type = 'info') {
    let toast = document.getElementById('spkw-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'spkw-toast';
      toast.style.position = 'fixed';
      toast.style.bottom = '100px';
      toast.style.left = '50%';
      toast.style.transform = 'translateX(-50%) translateY(20px)';
      toast.style.background = '#282828';
      toast.style.color = '#fff';
      toast.style.padding = '12px 24px';
      toast.style.borderRadius = '30px';
      toast.style.boxShadow = '0 8px 24px rgba(0,0,0,0.5)';
      toast.style.fontSize = '0.9rem';
      toast.style.fontWeight = '600';
      toast.style.zIndex = '99999';
      toast.style.opacity = '0';
      toast.style.transition = 'all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)';
      toast.style.pointerEvents = 'none';
      toast.style.border = '1px solid rgba(255,255,255,0.1)';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.borderColor = type === 'success' ? '#1ed760' : (type === 'error' ? '#e91429' : 'rgba(255,255,255,0.15)');
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
    
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(20px)';
    }, 3000);
  }

  // ==========================================
  // SYNCHRONIZED LYRICS (KARAOKE)
  // ==========================================
  function setupLyrics() {
    if (btnToggleLyrics) {
      btnToggleLyrics.addEventListener('click', () => {
        state.lyricsOpen = !state.lyricsOpen;
        if (lyricsOverlay) lyricsOverlay.style.display = state.lyricsOpen ? 'flex' : 'none';
        btnToggleLyrics.classList.toggle('active', state.lyricsOpen);
        if (state.lyricsOpen && state.currentTrack) {
          updateSyncedLyrics(audio.currentTime);
        }
      });
    }

    if (btnCloseLyrics) {
      btnCloseLyrics.addEventListener('click', () => {
        state.lyricsOpen = false;
        if (lyricsOverlay) lyricsOverlay.style.display = 'none';
        if (btnToggleLyrics) btnToggleLyrics.classList.remove('active');
      });
    }
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
    if (btnToggleVisualizer) {
      btnToggleVisualizer.addEventListener('click', () => {
        state.visualizerOpen = !state.visualizerOpen;
        if (visualizerOverlay) visualizerOverlay.style.display = state.visualizerOpen ? 'flex' : 'none';
        btnToggleVisualizer.classList.toggle('active', state.visualizerOpen);

        if (state.visualizerOpen) {
          initWebAudio();
          startVisualizerLoop();
        } else {
          cancelAnimationFrame(state.visualizerAnimationId);
        }
      });
    }

    if (btnCloseVisualizer) {
      btnCloseVisualizer.addEventListener('click', () => {
        state.visualizerOpen = false;
        if (visualizerOverlay) visualizerOverlay.style.display = 'none';
        if (btnToggleVisualizer) btnToggleVisualizer.classList.remove('active');
        cancelAnimationFrame(state.visualizerAnimationId);
      });
    }

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
    const localFileInput = document.getElementById('local-file-input');
    const localFolderInput = document.getElementById('local-folder-input');

    if (btnBrowse) {
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
    }

    if (btnScanDefault) {
      btnScanDefault.addEventListener('click', () => {
        scanLocalFolder(null);
      });
    }

    // Drag & Drop
    if (dropZone) {
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

      if (fileInput) {
        dropZone.addEventListener('click', () => fileInput.click());
      }
    }

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        handleDroppedAudioFiles(Array.from(e.target.files));
      });
    }

    if (localFileInput) {
      localFileInput.addEventListener('change', (e) => {
        handleDroppedAudioFiles(Array.from(e.target.files));
      });
    }

    if (localFolderInput) {
      localFolderInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files).filter(f => f.type.startsWith('audio/') || /\.(mp3|flac|wav|m4a|ogg)$/i.test(f.name));
        handleDroppedAudioFiles(files);
      });
    }
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
      if (localCountBadge) localCountBadge.textContent = state.localSongs.length;

      if (folderStatus) folderStatus.style.display = 'flex';
      if (pathLabel) pathLabel.textContent = data.folder || 'Folder Musik';
      if (countText) countText.textContent = `${state.localSongs.length} lagu ditemukan`;

      if (tracklistContainer) tracklistContainer.style.display = 'flex';
      if (tracklistItems) {
        tracklistItems.innerHTML = '';
        if (state.localSongs.length === 0) {
          tracklistItems.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-subdued);">Tidak ditemukan file audio (.mp3, .wav, .flac) di folder ini.</div>';
          return;
        }

        state.localSongs.forEach((song, i) => {
          const row = createTrackRow(song, i + 1, state.localSongs);
          tracklistItems.appendChild(row);
        });
      }
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
    playTrackInContext(newLocalTracks[0], state.localSongs);
    switchView('local');
  }

  // ==========================================
  // QUEUE DRAWER
  // ==========================================
  if (btnToggleQueue) {
    btnToggleQueue.addEventListener('click', () => {
      state.queueOpen = !state.queueOpen;
      if (queueDrawer) queueDrawer.style.display = state.queueOpen ? 'flex' : 'none';
      btnToggleQueue.classList.toggle('active', state.queueOpen);
      if (state.queueOpen) updateQueueUI();
    });
  }

  if (btnCloseQueue) {
    btnCloseQueue.addEventListener('click', () => {
      state.queueOpen = false;
      if (queueDrawer) queueDrawer.style.display = 'none';
      if (btnToggleQueue) btnToggleQueue.classList.remove('active');
    });
  }

  if (btnClearQueue) {
    btnClearQueue.addEventListener('click', () => {
      state.queue = [];
      updateQueueUI();
    });
  }

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
        const nextQueue = state.queue.slice(i + 1);
        playTrack(tr, nextQueue);
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
    if (ramPill) ramPill.addEventListener('click', openStatsModal);
    if (btnOpenStatsModal) btnOpenStatsModal.addEventListener('click', openStatsModal);
    if (btnCloseStatsModal) btnCloseStatsModal.addEventListener('click', () => { if (statsModal) statsModal.style.display = 'none'; });

    // Clear Cache Button
    if (btnClearCache) {
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
  }

  async function fetchStats() {
    try {
      const resp = await fetch('/api/stats');
      const data = await resp.json();

      const ramMb = data.total_ram_mb || 52;
      const ramSaved = data.ram_saved_percent || 90;

      // Update sidebar badge
      if (ramStatText) ramStatText.textContent = `RAM: ${ramMb} MB`;
      if (ramSaveTag) ramSaveTag.textContent = `-${ramSaved}%`;

      // Update Modal if open
      const mRamVal = document.getElementById('modal-ram-val');
      if (mRamVal) mRamVal.textContent = ramMb;
      const mRamBar = document.getElementById('modal-ram-bar');
      if (mRamBar) mRamBar.style.width = `${Math.min(100, Math.max(8, (ramMb / 650) * 100))}%`;
      const mRamTag = document.getElementById('modal-ram-tag');
      if (mRamTag) mRamTag.textContent = `Hemat ${ramSaved}% RAM`;
      const mStorageVal = document.getElementById('modal-storage-val');
      if (mStorageVal) mStorageVal.textContent = (data.cache_mb + 4.5).toFixed(1);
      const mCacheSize = document.getElementById('modal-cache-size');
      if (mCacheSize) mCacheSize.textContent = `${data.cache_mb} MB`;
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
        case 'KeyN':
          playNextTrack(true);
          break;
        case 'KeyP':
          playPrevTrack();
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
