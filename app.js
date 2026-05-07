const DATA_PATH = "data/library.generated.json";
const STORAGE_KEYS = {
  activeMonth: "ourflix-active-month",
};

const ui = {
  loadingScreen: document.getElementById("loadingScreen"),
  introScreen: document.getElementById("introScreen"),
  profileScreen: document.getElementById("profileScreen"),
  browseScreen: document.getElementById("browseScreen"),
  introHeadline: document.getElementById("introHeadline"),
  introSubheadline: document.getElementById("introSubheadline"),
  enterButton: document.getElementById("enterButton"),
  brandButton: document.getElementById("brandButton"),
  profileGrid: document.getElementById("profileGrid"),
  monthTabs: document.getElementById("monthTabs"),
  returnToProfiles: document.getElementById("returnToProfiles"),
  heroSection: document.getElementById("heroSection"),
  detailsRibbon: document.getElementById("detailsRibbon"),
  gallerySection: document.getElementById("gallerySection"),
  detailModal: document.getElementById("detailModal"),
  modalBackdrop: document.getElementById("modalBackdrop"),
  closeModal: document.getElementById("closeModal"),
  closeDetailButton: document.getElementById("closeDetailButton"),
  playAnotherButton: document.getElementById("playAnotherButton"),
  modalVideo: document.getElementById("modalVideo"),
  modalImage: document.getElementById("modalImage"),
  modalFallback: document.getElementById("modalFallback"),
  modalTitle: document.getElementById("modalTitle"),
  modalKicker: document.getElementById("modalKicker"),
  modalDescription: document.getElementById("modalDescription"),
  toast: document.getElementById("toast"),
};

const state = {
  library: null,
  activeMonthId: null,
  activeCardId: null,
  audioContext: null,
  startupTimer: null,
  startupRunning: false,
  ambientStarted: false,
  ambientTimer: null,
  fallbackArtCache: new Map(),
};

async function init() {
  try {
    const response = await fetch(`${DATA_PATH}?v=${Date.now()}`);
    if (!response.ok) {
      throw new Error(`Failed to load media library (${response.status})`);
    }

    state.library = await response.json();
    const requestedMonthId = resolveRequestedMonth();
    state.activeMonthId = requestedMonthId || resolveInitialMonth();
    if (requestedMonthId) {
      window.localStorage.setItem(STORAGE_KEYS.activeMonth, requestedMonthId);
    }

    bindGlobalEvents();
    hydrateStaticCopy();
    renderProfiles();
    renderTabs();
    renderActiveMonth();

    ui.loadingScreen.classList.add("hidden");
    if (requestedMonthId) {
      showBrowse();
    } else {
      ui.introScreen.classList.remove("hidden");
    }
  } catch (error) {
    ui.loadingScreen.innerHTML = `
      <div class="brand-lockup">
        <span class="brand-word">NETFLIXX</span>
        <span class="brand-subtitle">Could Not Load</span>
      </div>
      <p class="loading-copy">${escapeHtml(error.message)}</p>
      <p class="loading-copy">Run the media refresh script and try again.</p>
    `;
    console.error(error);
  }
}

function resolveRequestedMonth() {
  const params = new URLSearchParams(window.location.search);
  const hashMonthId = window.location.hash.replace(/^#/, "");
  const requestedId = params.get("month") || hashMonthId;
  const exists = state.library.months.some((month) => month.id === requestedId);
  return exists ? requestedId : null;
}

function resolveInitialMonth() {
  const savedId = window.localStorage.getItem(STORAGE_KEYS.activeMonth);
  const exists = state.library.months.some((month) => month.id === savedId);
  return exists ? savedId : state.library.months[0]?.id || null;
}

function startIntroExperience() {
  if (state.startupRunning) {
    return;
  }

  state.startupRunning = true;
  window.scrollTo(0, 0);
  ui.introScreen.classList.add("is-playing");
  playStartupSound();
  startAmbientLoop();

  window.clearTimeout(state.startupTimer);
  state.startupTimer = window.setTimeout(() => {
    ui.introScreen.classList.remove("is-playing");
    showProfiles();
    state.startupRunning = false;
  }, 3600);
}

function bindGlobalEvents() {
  ui.enterButton.addEventListener("click", () => {
    startIntroExperience();
  });

  ui.brandButton.addEventListener("click", () => {
    playUiClickSound();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  ui.returnToProfiles.addEventListener("click", () => {
    playUiClickSound();
    showProfiles();
  });

  ui.closeModal.addEventListener("click", () => {
    playCloseSound();
    closeModal();
  });

  ui.closeDetailButton.addEventListener("click", () => {
    playCloseSound();
    closeModal();
  });

  ui.modalBackdrop.addEventListener("click", () => {
    playCloseSound();
    closeModal();
  });

  ui.playAnotherButton.addEventListener("click", () => {
    playSelectSound();
    playAnotherClipFromCurrentCard();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal();
    }
  });
}

function hydrateStaticCopy() {
  const site = state.library.site;
  document.title = `${site.brand} | ${site.title}`;
  ui.introHeadline.textContent = site.headline;
  ui.introSubheadline.textContent = site.subheadline;
}

function showProfiles() {
  ui.introScreen.classList.add("hidden");
  ui.browseScreen.classList.add("hidden");
  ui.profileScreen.classList.remove("hidden");
  const stage = ui.profileScreen.querySelector(".profile-stage");
  stage?.classList.remove("is-revealed");
  window.requestAnimationFrame(() => {
    stage?.classList.add("is-revealed");
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showBrowse() {
  ui.profileScreen.classList.add("hidden");
  ui.introScreen.classList.add("hidden");
  ui.browseScreen.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderProfiles() {
  ui.profileGrid.innerHTML = state.library.months
    .map((month) => {
      const profileImage = resolveMonthImage(month, "profile");
      return `
        <button class="profile-card" type="button" data-month-id="${month.id}">
          <div class="profile-avatar">
            <img src="${profileImage}" alt="${escapeHtml(month.label)} profile art" />
            <span class="profile-chip">${escapeHtml(month.shortLabel)}</span>
          </div>
          <span class="profile-label">${escapeHtml(month.label)}</span>
          <span class="profile-tagline">${escapeHtml(month.tagline)}</span>
          <span class="profile-cta">Open Chapter</span>
        </button>
      `;
    })
    .join("");

  ui.profileGrid.querySelectorAll("[data-month-id]").forEach((button) => {
    button.addEventListener("click", () => {
      selectMonth(button.dataset.monthId);
      playSelectSound();
      showBrowse();
    });
  });
}

function renderTabs() {
  ui.monthTabs.innerHTML = state.library.months
    .map(
      (month) => `
        <button
          class="month-tab ${month.id === state.activeMonthId ? "is-active" : ""}"
          type="button"
          data-month-tab="${month.id}"
        >
          ${escapeHtml(month.label)}
        </button>
      `,
    )
    .join("");

  ui.monthTabs.querySelectorAll("[data-month-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      selectMonth(button.dataset.monthTab);
      playUiClickSound();
      showBrowse();
    });
  });
}

function selectMonth(monthId) {
  state.activeMonthId = monthId;
  window.localStorage.setItem(STORAGE_KEYS.activeMonth, monthId);
  renderTabs();
  renderActiveMonth();
}

function renderActiveMonth() {
  const month = getActiveMonth();
  if (!month) {
    return;
  }

  renderHero(month);
  renderDetailRibbon(month);
  renderGallery(month);
}

function renderHero(month) {
  const heroImage = resolveMonthImage(month, "hero");
  const leadButtonLabel = month.heroVideo ? "Play Trailer" : "Open Feature";
  ui.heroSection.innerHTML = `
    <div class="hero-backdrop">
      ${renderHeroBackdropMedia(month, heroImage)}
    </div>
    <div class="hero-scrim"></div>
    <div class="hero-copy-shell">
      <div>
        <p class="eyebrow">${escapeHtml(month.highlight)}</p>
        <h2 class="hero-title">${escapeHtml(month.label)}</h2>
        <p class="hero-description">${escapeHtml(month.description)}</p>
      </div>
      <div class="hero-mini-meta">
        <span class="meta-pill">${escapeHtml(month.tagline)}</span>
        <span class="meta-pill">${escapeHtml(month.status)}</span>
      </div>
      <div class="hero-buttons">
        <button id="playTrailerButton" class="button button-primary" type="button">
          ${leadButtonLabel}
        </button>
        <button id="jumpToGalleryButton" class="button button-secondary" type="button">
          Open Gallery
        </button>
      </div>
    </div>
    <div class="hero-preview-shell">
      <div class="hero-preview-card">
        <span class="hero-preview-label">Now Streaming</span>
        ${renderHeroPreviewMedia(month, heroImage)}
        <div class="hero-preview-caption">
          <strong>${escapeHtml(month.previewTitle)}</strong>
          <span>${escapeHtml(month.previewCaption)}</span>
        </div>
      </div>
    </div>
  `;

  ui.heroSection.querySelector("#playTrailerButton").addEventListener("click", () => {
    playSelectSound();
    openModal({
      month,
      title: month.previewTitle,
      kicker: `${month.label} Feature`,
      description: month.previewCaption,
      videoSource: month.heroVideo || pickRandomVideo(month),
      imageSource: heroImage,
      imageAlt: `${month.label} feature art`,
    });
  });

  ui.heroSection.querySelector("#jumpToGalleryButton").addEventListener("click", () => {
    playUiClickSound();
    ui.gallerySection.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function renderHeroBackdropMedia(month, heroImage) {
  if (month.heroVideo) {
    return `
      <video autoplay muted loop playsinline preload="metadata" poster="${heroImage}">
        <source src="${month.heroVideo}" />
      </video>
    `;
  }

  return `<img src="${heroImage}" alt="${escapeHtml(month.label)} backdrop" />`;
}

function renderHeroPreviewMedia(month, heroImage) {
  if (month.heroVideo) {
    return `
      <video autoplay muted loop playsinline preload="metadata" poster="${heroImage}">
        <source src="${month.heroVideo}" />
      </video>
    `;
  }

  return `<img src="${heroImage}" alt="${escapeHtml(month.label)} preview art" />`;
}

function renderDetailRibbon(month) {
  const cards = [
    { label: "Mood", value: month.tagline },
    { label: "Status", value: month.status },
    { label: "Era", value: month.highlight },
  ];

  ui.detailsRibbon.innerHTML = cards
    .map(
      (card) => `
        <article class="detail-chip-card">
          <span class="detail-chip-label">${escapeHtml(card.label)}</span>
          <span class="detail-chip-value">${escapeHtml(card.value)}</span>
        </article>
      `,
    )
    .join("");
}

function renderGallery(month) {
  ui.gallerySection.innerHTML = `
    <div class="gallery-header">
      <div>
        <h3 class="gallery-title">Featured Memories</h3>
        <p class="gallery-copy">
          Tap any frame to open the scene. Photos open like little posters, and videos play right
          inside the page.
        </p>
      </div>
    </div>
    <div class="gallery-grid">
      ${month.items.map((item, index) => renderCardMarkup(item, month, index)).join("")}
    </div>
  `;

  ui.gallerySection.querySelectorAll("[data-card-id]").forEach((button) => {
    button.addEventListener("click", () => {
      playSelectSound();
      openCard(button.dataset.cardId);
    });
  });
}

function renderCardMarkup(item, month, index) {
  const imageSource = resolveItemImage(item, month, index);

  return `
    <button
      class="memory-card"
      type="button"
      data-card-id="${item.id}"
      style="--card-delay: ${index * 70}ms;"
    >
      <img src="${imageSource}" alt="${escapeHtml(item.title)}" loading="lazy" />
      <div class="memory-card-copy">
        <span class="memory-card-kicker">${escapeHtml(item.kicker)}</span>
        <span class="memory-card-title">${escapeHtml(item.title)}</span>
        <span class="memory-card-caption">${escapeHtml(item.caption)}</span>
      </div>
    </button>
  `;
}

function openCard(cardId) {
  const month = getActiveMonth();
  const itemIndex = month.items.findIndex((entry) => entry.id === cardId);
  const item = month.items[itemIndex];

  if (!item) {
    return;
  }

  state.activeCardId = cardId;
  openModal({
    month,
    title: item.title,
    kicker: item.kicker,
    description: item.caption,
    videoSource: pickRandomVideo(month, item),
    imageSource: resolveItemImage(item, month, itemIndex),
    imageAlt: item.title,
  });
}

function openModal({ month, title, kicker, description, videoSource, imageSource, imageAlt }) {
  ui.modalTitle.textContent = title;
  ui.modalKicker.textContent = kicker || month.label;
  ui.modalDescription.textContent =
    description || "One more moment that absolutely deserved its own streaming slot.";

  showModalMedia({ videoSource, imageSource, imageAlt: imageAlt || title });
  ui.detailModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function showModalMedia({ videoSource, imageSource, imageAlt }) {
  ui.modalVideo.pause();
  ui.modalVideo.removeAttribute("src");
  ui.modalVideo.load();
  ui.modalVideo.classList.add("hidden");

  ui.modalImage.classList.add("hidden");
  ui.modalImage.removeAttribute("src");
  ui.modalImage.alt = "";

  ui.modalFallback.classList.add("hidden");

  if (videoSource) {
    ui.modalVideo.src = videoSource;
    if (imageSource) {
      ui.modalVideo.poster = imageSource;
    } else {
      ui.modalVideo.removeAttribute("poster");
    }
    ui.modalVideo.classList.remove("hidden");
    ui.modalVideo.currentTime = 0;
    ui.modalVideo.play().catch(() => {
      showToast("Press play on the video controls to start the clip.");
    });
    return;
  }

  if (imageSource) {
    ui.modalImage.src = imageSource;
    ui.modalImage.alt = imageAlt || "Memory image";
    ui.modalImage.classList.remove("hidden");
    return;
  }

  ui.modalFallback.classList.remove("hidden");
}

function closeModal() {
  ui.modalVideo.pause();
  ui.modalVideo.removeAttribute("src");
  ui.modalVideo.load();
  ui.modalImage.removeAttribute("src");
  ui.modalImage.alt = "";
  ui.detailModal.classList.add("hidden");
  document.body.style.overflow = "";
}

function playAnotherClipFromCurrentCard() {
  const month = getActiveMonth();
  const item = month.items.find((entry) => entry.id === state.activeCardId);
  const source = pickRandomVideo(month, item);

  if (!source) {
    showToast("Add a video to this month folder and refresh the site.");
    return;
  }

  showModalMedia({
    videoSource: source,
    imageSource: item ? resolveItemImage(item, month, month.items.indexOf(item)) : null,
    imageAlt: item?.title || month.label,
  });
}

function pickRandomVideo(month, item = null) {
  const preferred = item?.videoOptions?.length ? item.videoOptions : [];
  const fallbackPool = month.videos || [];
  const pool = preferred.length ? preferred : fallbackPool;

  if (!pool.length) {
    return null;
  }

  const index = Math.floor(Math.random() * pool.length);
  return pool[index];
}

function getActiveMonth() {
  return state.library.months.find((month) => month.id === state.activeMonthId);
}

function resolveMonthImage(month, kind) {
  if (kind === "profile" && month.profileImage) {
    return month.profileImage;
  }

  if (kind === "hero" && month.heroImage) {
    return month.heroImage;
  }

  return buildFallbackArt(month, kind);
}

function resolveItemImage(item, month, index) {
  if (item.image) {
    return item.image;
  }

  return buildFallbackArt(month, "memory", item, index);
}

function buildFallbackArt(month, kind, item = null, index = 0) {
  const cacheKey = `${month.id}:${kind}:${item?.id || index}`;
  if (state.fallbackArtCache.has(cacheKey)) {
    return state.fallbackArtCache.get(cacheKey);
  }

  const palette = getMonthPalette(month.id);
  const layout =
    kind === "profile"
      ? { width: 800, height: 1000, labelY: 140, titleY: 520, subtitleY: 640, maxChars: 16 }
      : kind === "hero"
        ? { width: 1600, height: 900, labelY: 146, titleY: 500, subtitleY: 640, maxChars: 20 }
        : { width: 960, height: 660, labelY: 116, titleY: 340, subtitleY: 470, maxChars: 18 };

  const label = kind === "memory" ? item?.kicker || month.shortLabel : month.shortLabel;
  const title =
    kind === "profile"
      ? month.label
      : kind === "hero"
        ? month.previewTitle
        : item?.title || month.label;
  const subtitle =
    kind === "profile"
      ? month.tagline
      : kind === "hero"
        ? month.previewCaption
        : item?.caption || month.description;

  const titleLines = wrapText(title, layout.maxChars, 3);
  const subtitleLines = wrapText(subtitle, layout.maxChars + 8, 3);
  const beamWidth = kind === "hero" ? 240 : 170;
  const beamHeight = kind === "hero" ? 760 : 760;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.width} ${layout.height}">
      <defs>
        <linearGradient id="bg" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stop-color="${palette.deep}" />
          <stop offset="40%" stop-color="${palette.primary}" />
          <stop offset="100%" stop-color="#060606" />
        </linearGradient>
        <linearGradient id="beam" x1="0%" x2="0%" y1="0%" y2="100%">
          <stop offset="0%" stop-color="${palette.soft}" />
          <stop offset="100%" stop-color="${palette.primary}" />
        </linearGradient>
        <radialGradient id="glow" cx="70%" cy="15%" r="75%">
          <stop offset="0%" stop-color="${palette.glow}" stop-opacity="0.95" />
          <stop offset="70%" stop-color="${palette.glow}" stop-opacity="0.12" />
          <stop offset="100%" stop-color="${palette.glow}" stop-opacity="0" />
        </radialGradient>
        <filter id="blur">
          <feGaussianBlur stdDeviation="34" />
        </filter>
      </defs>

      <rect width="${layout.width}" height="${layout.height}" fill="#050505" />
      <rect width="${layout.width}" height="${layout.height}" fill="url(#bg)" />
      <circle cx="${layout.width * 0.78}" cy="${layout.height * 0.16}" r="${layout.height * 0.28}" fill="url(#glow)" filter="url(#blur)" />
      <circle cx="${layout.width * 0.14}" cy="${layout.height * 0.8}" r="${layout.height * 0.18}" fill="${palette.spark}" opacity="0.14" filter="url(#blur)" />

      <rect x="${layout.width * 0.08}" y="${layout.height * 0.1}" rx="46" ry="46" width="${beamWidth}" height="${beamHeight}" fill="${palette.shadow}" opacity="0.5" />
      <rect x="${layout.width * 0.12}" y="${layout.height * 0.1}" rx="42" ry="42" width="${beamWidth}" height="${beamHeight}" fill="url(#beam)" />
      <rect x="${layout.width * 0.18}" y="${layout.height * 0.13}" rx="30" ry="30" width="${beamWidth * 0.28}" height="${beamHeight * 0.86}" fill="${palette.deep}" opacity="0.55" />

      <g opacity="0.92">
        <path d="M ${layout.width * 0.84} ${layout.height * 0.22} c -20 -34 -74 -28 -88 10 c -14 -38 -68 -44 -88 -10 c -16 28 -6 62 20 84 l68 56 l68 -56 c 26 -22 36 -56 20 -84 z" fill="${palette.soft}" />
        <path d="M ${layout.width * 0.72} ${layout.height * 0.32} c -12 -20 -44 -17 -52 6 c -8 -23 -40 -26 -52 -6 c -10 18 -4 38 12 52 l40 34 l40 -34 c 16 -14 22 -34 12 -52 z" fill="${palette.spark}" opacity="0.88" />
      </g>

      <text x="${layout.width * 0.36}" y="${layout.labelY}" fill="${palette.spark}" font-size="${kind === "hero" ? 44 : 34}" font-family="Arial, sans-serif" letter-spacing="8" font-weight="700">${escapeSvgText(label)}</text>
      ${renderSvgLines(
        titleLines,
        layout.width * 0.36,
        layout.titleY,
        kind === "hero" ? 92 : 80,
        kind === "memory" ? 54 : 72,
        "#ffffff",
      )}
      ${renderSvgLines(
        subtitleLines,
        layout.width * 0.36,
        layout.subtitleY,
        48,
        kind === "memory" ? 26 : 30,
        "rgba(255,255,255,0.82)",
        false,
      )}
    </svg>
  `;

  const encoded = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  state.fallbackArtCache.set(cacheKey, encoded);
  return encoded;
}

function getMonthPalette(monthId) {
  const palettes = {
    "month-1": {
      primary: "#e50914",
      soft: "#ff6782",
      glow: "#ff8eb5",
      spark: "#ffd3de",
      deep: "#280207",
      shadow: "#120103",
    },
    "month-3": {
      primary: "#ba1220",
      soft: "#ff7a8f",
      glow: "#ffb183",
      spark: "#ffe2b2",
      deep: "#1f0507",
      shadow: "#120205",
    },
    "month-6": {
      primary: "#bf0c18",
      soft: "#ff7c54",
      glow: "#ffd16b",
      spark: "#fff0b1",
      deep: "#240507",
      shadow: "#130204",
    },
  };

  return palettes[monthId] || palettes["month-1"];
}

function renderSvgLines(lines, x, y, lineHeight, fontSize, fill, strong = true) {
  return `
    <text
      x="${x}"
      y="${y}"
      fill="${fill}"
      font-size="${fontSize}"
      font-family="${strong ? "Arial Black, Arial, sans-serif" : "Arial, sans-serif"}"
      font-weight="${strong ? "700" : "500"}"
      letter-spacing="${strong ? "-1.5" : "0"}"
    >
      ${lines
        .map(
          (line, index) =>
            `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${escapeSvgText(line)}</tspan>`,
        )
        .join("")}
    </text>
  `;
}

function wrapText(value, maxChars, maxLines) {
  const words = String(value).trim().split(/\s+/).filter(Boolean);
  if (!words.length) {
    return [""];
  }

  const lines = [];
  let current = words[0];

  for (let index = 1; index < words.length; index += 1) {
    const next = words[index];
    if (`${current} ${next}`.length <= maxChars || lines.length === maxLines - 1) {
      current = `${current} ${next}`;
      continue;
    }

    lines.push(current);
    current = next;
  }

  lines.push(current);
  return lines.slice(0, maxLines);
}

function playStartupSound() {
  playToneSequence([
    { frequency: 64, start: 0, duration: 0.36, gain: 0.34, type: "sawtooth" },
    { frequency: 96, start: 0, duration: 0.34, gain: 0.2, type: "triangle" },
    { frequency: 48, start: 0.42, duration: 0.58, gain: 0.42, type: "sawtooth" },
    { frequency: 144, start: 0.43, duration: 0.48, gain: 0.2, type: "triangle" },
    { frequency: 220, start: 0.66, duration: 0.64, gain: 0.11, type: "triangle" },
    { frequency: 330, start: 0.78, duration: 0.56, gain: 0.09, type: "sine" },
    { frequency: 494, start: 0.94, duration: 0.46, gain: 0.07, type: "sine" },
  ], 0.72);
}

function startAmbientLoop() {
  if (state.ambientStarted) {
    return;
  }

  state.ambientStarted = true;

  const scheduleAmbient = () => {
    playToneSequence([
      { frequency: 196, start: 0, duration: 1.8, gain: 0.018, type: "sine" },
      { frequency: 247, start: 0.2, duration: 1.4, gain: 0.012, type: "triangle" },
      { frequency: 392, start: 0.64, duration: 0.9, gain: 0.01, type: "sine" },
    ], 0.08);

    state.ambientTimer = window.setTimeout(scheduleAmbient, 6200);
  };

  state.ambientTimer = window.setTimeout(scheduleAmbient, 2100);
}

function playSelectSound() {
  playToneSequence([
    { frequency: 392, start: 0, duration: 0.16, gain: 0.05, type: "triangle" },
    { frequency: 587, start: 0.08, duration: 0.18, gain: 0.05, type: "triangle" },
    { frequency: 784, start: 0.18, duration: 0.16, gain: 0.035, type: "sine" },
  ], 0.18);
}

function playUiClickSound() {
  playToneSequence([
    { frequency: 510, start: 0, duration: 0.08, gain: 0.045, type: "triangle" },
    { frequency: 640, start: 0.04, duration: 0.07, gain: 0.035, type: "triangle" },
  ], 0.14);
}

function playCloseSound() {
  playToneSequence([
    { frequency: 520, start: 0, duration: 0.08, gain: 0.03, type: "triangle" },
    { frequency: 320, start: 0.04, duration: 0.1, gain: 0.028, type: "triangle" },
  ], 0.1);
}

function playToneSequence(steps, masterPeak = 0.16) {
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) {
    return;
  }

  const totalDuration = steps.reduce(
    (max, step) => Math.max(max, step.start + step.duration),
    0,
  );

  if (!state.audioContext) {
    state.audioContext = new AudioCtor();
  }

  const context = state.audioContext;
  if (context.state === "suspended") {
    context.resume().catch(() => {});
  }

  const compressor = context.createDynamicsCompressor();
  const master = context.createGain();
  const now = context.currentTime + 0.02;
  compressor.threshold.setValueAtTime(-18, now);
  compressor.knee.setValueAtTime(18, now);
  compressor.ratio.setValueAtTime(8, now);
  compressor.attack.setValueAtTime(0.004, now);
  compressor.release.setValueAtTime(0.22, now);
  master.connect(compressor);
  compressor.connect(context.destination);
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(masterPeak, now + 0.03);
  master.gain.exponentialRampToValueAtTime(0.0001, now + totalDuration + 0.35);

  steps.forEach((step) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = step.type;
    oscillator.frequency.setValueAtTime(step.frequency, now + step.start);
    oscillator.connect(gain);
    gain.connect(master);
    gain.gain.setValueAtTime(0.0001, now + step.start);
    gain.gain.exponentialRampToValueAtTime(step.gain, now + step.start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + step.start + step.duration);
    oscillator.start(now + step.start);
    oscillator.stop(now + step.start + step.duration + 0.05);
  });

  window.setTimeout(() => {
    master.disconnect();
    compressor.disconnect();
  }, (totalDuration + 0.7) * 1000);
}

function showToast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.remove("hidden");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => {
    ui.toast.classList.add("hidden");
  }, 2400);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeSvgText(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

init();
