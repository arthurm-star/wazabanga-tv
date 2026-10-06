"use strict";

const API_SERVERS = [
  "https://de1.api.radio-browser.info",
  "https://de2.api.radio-browser.info",
  "https://fi1.api.radio-browser.info"
];

const FEATURED_COUNTRIES = [
  { code: "TT", name: "Trinidad & Tobago", region: "Caribbean" },
  { code: "UG", name: "Uganda", region: "East Africa" },
  { code: "JM", name: "Jamaica", region: "Caribbean" },
  { code: "KE", name: "Kenya", region: "East Africa" }
];

const searchInput = document.getElementById("radioSearch");
const searchButton = document.getElementById("radioSearchButton");
const stationGrid = document.getElementById("stationGrid");

const player = document.getElementById("radioPlayer");
const playerArt = document.getElementById("playerArt");
const playerStation = document.getElementById("playerStation");
const playerMeta = document.getElementById("playerMeta");
const playerPlay = document.getElementById("playerPlay");
const playerFavorite = document.getElementById("playerFavorite");

const audio = new Audio();

audio.preload = "none";

let currentStation = null;
let currentCardButton = null;
let favorites = loadFavorites();
let recentlyPlayed = loadRecentlyPlayed();


function loadFavorites() {
  try {
    return JSON.parse(
      localStorage.getItem("wazabanga-radio-favorites") || "[]"
    );
  } catch {
    return [];
  }
}


function saveFavorites() {
  localStorage.setItem(
    "wazabanga-radio-favorites",
    JSON.stringify(favorites)
  );
}


function isFavorite(uuid) {
  return favorites.some(
    station => station.stationuuid === uuid
  );
}


function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


async function apiFetch(path) {

  let lastError;

  for (const server of API_SERVERS) {

    try {

      const response = await fetch(
        server + path,
        {
          headers: {
            "User-Agent": "WazabangaRadio/0.2"
          }
        }
      );

      if (!response.ok) {
        throw new Error(
          `Radio API returned ${response.status}`
        );
      }

      return await response.json();

    } catch (error) {

      console.warn(
        "Radio Browser server failed:",
        server,
        error
      );

      lastError = error;
    }
  }

  throw lastError || new Error("Radio service unavailable");
}


function normalizeStations(stations) {

  return stations.filter(station => {

    const url =
      station.url_resolved ||
      station.url ||
      "";

    return (
      station.stationuuid &&
      station.name &&
      url &&
      url.startsWith("https://")
    );
  });
}


/*
  Country catalogue validation.

  Radio Browser country metadata is community-maintained and can
  contain incorrectly classified international stations.

  Wazabanga verified stations are always trusted.
*/
function validateCountryStation(station, countryCode) {

  if (!station) {
    return false;
  }

  if (station._verified === true) {
    return true;
  }

  const code =
    String(countryCode || "")
      .trim()
      .toUpperCase();

  const stationCode =
    String(station.countrycode || "")
      .trim()
      .toUpperCase();

  /*
    Directory entries must at least claim the requested country.
  */
  if (stationCode && stationCode !== code) {
    return false;
  }

  const name =
    String(station.name || "")
      .trim()
      .toLowerCase();

  const homepage =
    String(station.homepage || "")
      .trim()
      .toLowerCase();

  const stream =
    String(
      station.url_resolved ||
      station.url ||
      ""
    )
      .trim()
      .toLowerCase();

  /*
    Global non-station source validation.

    These sources are known content/audio providers rather than
    country radio stations and may be misclassified under many
    countries by the public directory.
  */
  const globalNonStationSources = [
    "mp3islam.com",
    "streams.rautemusik.fm",
    "streaming.exclusive.radio",
    "exclusive.com",
    "play.exclusive.radio"
  ];

  if (
    globalNonStationSources.some(
      source =>
        homepage.includes(source) ||
        stream.includes(source)
    )
  ) {
    return false;
  }
  /*
    Uganda pilot rules.

    These remove known foreign/global services currently
    misclassified by the public directory as Uganda stations.

    They do NOT block these broadcasters from Search or Worldwide.
  */
  if (code === "UG") {

    const foreignNamePatterns = [
      /\bbbc\b/,
      /\bsky\s*news\b/,
      /\bskynews\b/,
      /\bcnn\b/,
      /\bjamaica\b/,
      /\bcanton\b.*\bchina\b/,
      /\bcbs\s*news\b/,
      /\btalkradio\b/,
      /\btalksport\b/,
      /\b80['\u2019]?s\s+90['\u2019]?s\s+old\s+music\s+radio\b/,
      /\bold\s+school\s+music\b/,
      /\bsmooth\s+country\b/,
      /\bdw\s+news\b/,
      /\bfun\s+kids\s+radio\b/,
      /\bsmooth\s+chill\b/,
      /\bsonlife\s+radio\b/
    ];

    if (
      foreignNamePatterns.some(
        pattern => pattern.test(name)
      )
    ) {
      return false;
    }

    const foreignSourcePatterns = [
      "bbcmedia.co.uk",
      "news.sky.com",
      "video.news.sky.com",
      "cdnstream1.com/2868",
      "fame95fm.com",
      "gztv.com",
      "qingting.fm",
      "cbsnews.com",
      "talkradio.co.uk",
      "talksport.com",
      "torontocast.com",
      "ilikeitoldskool.co.uk",
      "musicradio.com",
      "dw.audiostream.io",
      "sharp-stream.com/funkids",
      "sardius.media"
    ];

    if (
      foreignSourcePatterns.some(
        source =>
          homepage.includes(source) ||
          stream.includes(source)
      )
    ) {
      return false;
    }
  }

  return true;
}

async function getTopStation(countryCode) {

  const data = await apiFetch(
    `/json/stations/bycountrycodeexact/${encodeURIComponent(countryCode)}?hidebroken=true&order=clickcount&reverse=true&limit=20`
  );

  const stations = normalizeStations(data);

  return stations[0] || null;
}


async function loadFeaturedStations() {

  stationGrid.innerHTML =
    `<div style="opacity:.55;padding:20px 0">
       Loading live stations...
     </div>`;

  try {

    const results = await Promise.all(
      FEATURED_COUNTRIES.map(async country => {

        const station =
          await getTopStation(country.code);

        if (!station) return null;

        station._region = country.region;

        return station;
      })
    );

    const stations = results.filter(Boolean);

    if (!stations.length) {
      throw new Error("No working stations returned");
    }

    renderStations(stations);

  } catch (error) {

    console.error(error);

    stationGrid.innerHTML =
      `<div style="opacity:.6;padding:20px 0">
         Live stations could not be loaded.
       </div>`;
  }
}


function countryFlag(countryCode) {

  const code =
    String(countryCode || "")
      .trim()
      .toLowerCase();

  if (!/^[a-z]{2}$/.test(code)) {
    return "\u{1F310}";
  }

  return `
    <img
      src="/radio/assets/flags/${escapeHtml(code)}.svg"
      alt=""
      class="country-flag"
      style="
        width:100%;
        height:100%;
        object-fit:cover;
        border-radius:15px;
      "
      onerror="
        this.style.display='none';
        this.parentElement.textContent='\u{1F310}';
      "
    >
  `;
}


function stationArtwork(station) {

  if (station.favicon) {

    return `
      <img
        src="${escapeHtml(station.favicon)}"
        alt=""
        style="
          width:100%;
          height:100%;
          object-fit:cover;
          border-radius:15px;
        "
        onerror="
          this.style.display='none';
          this.parentElement.innerHTML=countryFlag('${escapeHtml(station.countrycode || "")}');
        "
      >
    `;
  }

  return countryFlag(station.countrycode);
}


const STATIONS_PER_PAGE = 12;

let catalogueStations = [];
let catalogueVisibleCount = STATIONS_PER_PAGE;


function renderStationCards(stations) {

  stationGrid.innerHTML = "";

  stations.forEach(station => {

    const card =
      document.createElement("article");

    card.className = "live-card";

    const region =
      station._region ||
      station.country ||
      "Worldwide";

    card.innerHTML = `
      <div class="live-top">

        <div class="station-art">
          ${stationArtwork(station)}
        </div>

        <div class="live-info">
          <strong>
            ${escapeHtml(station.name)}
          </strong>

          <span>
            ${escapeHtml(region)}
          </span>
        </div>

      </div>

      <div class="live-status">
        <i class="live-dot"></i>
        Live
      </div>

      <button
        class="card-play"
        type="button"
        aria-label="Play ${escapeHtml(station.name)}">
        &#9654;
      </button>
    `;

    const button =
      card.querySelector(".card-play");

    button.addEventListener(
      "click",
      () => selectStation(station, button)
    );

    stationGrid.appendChild(card);
  });
}


function updateCatalogueView() {

  const visibleStations =
    catalogueStations.slice(
      0,
      catalogueVisibleCount
    );

  renderStationCards(
    visibleStations
  );

  const existingButton =
    document.getElementById(
      "loadMoreStations"
    );

  if (existingButton) {
    existingButton.remove();
  }

  if (
    catalogueVisibleCount >=
    catalogueStations.length
  ) {
    return;
  }

  const wrapper =
    document.createElement("div");

  wrapper.style.gridColumn =
    "1 / -1";

  wrapper.style.display =
    "flex";

  wrapper.style.justifyContent =
    "center";

  wrapper.style.padding =
    "18px 0 4px";

  const loadMore =
    document.createElement("button");

  loadMore.id =
    "loadMoreStations";

  loadMore.type =
    "button";

  loadMore.className =
    "card-play";

  loadMore.style.width =
    "auto";

  loadMore.style.padding =
    "10px 22px";

  loadMore.textContent =
    `Load More Stations (${Math.min(
      STATIONS_PER_PAGE,
      catalogueStations.length -
      catalogueVisibleCount
    )})`;

  loadMore.addEventListener(
    "click",
    () => {

      catalogueVisibleCount +=
        STATIONS_PER_PAGE;

      updateCatalogueView();
    }
  );

  wrapper.appendChild(
    loadMore
  );

  stationGrid.appendChild(
    wrapper
  );
}


function renderStations(stations) {

  catalogueStations =
    Array.isArray(stations)
      ? stations
      : [];

  catalogueVisibleCount =
    STATIONS_PER_PAGE;

  updateCatalogueView();
}



async function selectStation(station, button) {

  const streamUrl =
    station.url_resolved ||
    station.url ||
    station.stream;

  if (!streamUrl) return;

  if (
    currentStation &&
    currentStation.stationuuid === station.stationuuid &&
    !audio.paused
  ) {

    audio.pause();
    updatePlayState();

    return;
  }

  currentStation = station;
  currentCardButton = button;

  addRecentlyPlayed(station);

  audio.src = streamUrl;

  player.style.display = "flex";

  playerStation.textContent =
    station.name || "Unknown station";

  playerMeta.textContent =
    [
      station.country,
      station.tags
        ? station.tags.split(",")[0]
        : ""
    ]
      .filter(Boolean)
      .join(" - ") ||
    "Wazabanga Radio";

  if (station.favicon) {

    playerArt.innerHTML = `
      <img
        src="${escapeHtml(station.favicon)}"
        alt=""
        style="
          width:100%;
          height:100%;
          object-fit:cover;
          border-radius:12px;
        "
        onerror="
          this.style.display='none';
          this.parentElement.innerHTML=countryFlag('${escapeHtml(station.countrycode || "")}');
        "
      >
    `;

  } else {

    playerArt.innerHTML = countryFlag(station.countrycode);
  }

  updateFavoriteButton();

  try {

    await audio.play();

  } catch (error) {

    console.error(
      "Playback failed:",
      error
    );

    playerMeta.textContent =
      "Stream unavailable - try another station";
  }

  updatePlayState();
}


function updatePlayState() {

  const playing =
    currentStation &&
    !audio.paused;

  playerPlay.innerHTML =
    playing
      ? "&#10074;&#10074;"
      : "&#9654;";

  document
    .querySelectorAll(".card-play")
    .forEach(button => {
      button.innerHTML = "&#9654;";
    });

  if (playing && currentCardButton) {

    currentCardButton.innerHTML =
      "&#10074;&#10074;";
  }
}


playerPlay.addEventListener(
  "click",
  async () => {

    if (!currentStation) return;

    if (audio.paused) {

      try {
        await audio.play();
      } catch (error) {
        console.error(error);
      }

    } else {

      audio.pause();
    }

    updatePlayState();
  }
);


function updateFavoriteButton() {

  if (!currentStation) {
    playerFavorite.innerHTML = "&#9825;";
    return;
  }

  playerFavorite.innerHTML =
    isFavorite(currentStation.stationuuid)
      ? "&#9829;"
      : "&#9825;";
}


playerFavorite.addEventListener(
  "click",
  () => {

    if (!currentStation) return;

    if (isFavorite(currentStation.stationuuid)) {

      favorites =
        favorites.filter(
          station =>
            station.stationuuid !==
            currentStation.stationuuid
        );

    } else {

      favorites.push({
        stationuuid:
          currentStation.stationuuid,

        name:
          currentStation.name,

        country:
          currentStation.country,

        countrycode:
          currentStation.countrycode,

        favicon:
          currentStation.favicon,

        url:
          currentStation.url,

        url_resolved:
          currentStation.url_resolved,

        tags:
          currentStation.tags
      });
    }

    saveFavorites();
    updateFavoriteButton();
    updateFavoritesCount();
  }
);


async function searchStations() {

  const query =
    searchInput.value.trim();

  if (!query) return;

  const normalized =
    query
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();


  /* COUNTRY ALIASES */

  const COUNTRY_ALIASES = {

    "trinidad":
      ["TT","Trinidad & Tobago","caribbean"],

    "trinidad and tobago":
      ["TT","Trinidad & Tobago","caribbean"],

    "tobago":
      ["TT","Trinidad & Tobago","caribbean"],

    "uganda":
      ["UG","Uganda","east-africa"],

    "kenya":
      ["KE","Kenya","east-africa"],

    "jamaica":
      ["JM","Jamaica","caribbean"],

    "barbados":
      ["BB","Barbados","caribbean"],

    "uk":
      ["GB","United Kingdom","europe"],

    "britain":
      ["GB","United Kingdom","europe"],

    "great britain":
      ["GB","United Kingdom","europe"],

    "united kingdom":
      ["GB","United Kingdom","europe"],

    "usa":
      ["US","United States","americas"],

    "us":
      ["US","United States","americas"],

    "america":
      ["US","United States","americas"],

    "united states":
      ["US","United States","americas"],

    "uae":
      ["AE","United Arab Emirates","middle-east"],

    "united arab emirates":
      ["AE","United Arab Emirates","middle-east"],

    "south korea":
      ["KR","South Korea","asia"]
  };


  /*
    First check the countries already defined
    in REGION_MAP.
  */

  for (
    const [regionKey,region]
    of Object.entries(REGION_MAP)
  ) {

    const country =
      region.countries.find(
        ([code,name]) => {

          const normalizedName =
            name
              .toLowerCase()
              .replace(/&/g, "and")
              .replace(/[^a-z0-9]+/g, " ")
              .trim();

          return (
            normalized === normalizedName ||
            normalized ===
              code.toLowerCase()
          );
        }
      );


    if (country) {

      setLibraryActive("");

      await loadCountryStations(
        country[0],
        country[1],
        regionKey
      );

      return;
    }
  }


  /*
    Then check friendly country aliases.
  */

  if (COUNTRY_ALIASES[normalized]) {

    const [
      code,
      name,
      regionKey
    ] =
      COUNTRY_ALIASES[normalized];

    setLibraryActive("");

    await loadCountryStations(
      code,
      name,
      regionKey
    );

    return;
  }


  /* GENRE SEARCH */

  const GENRE_ALIASES = {

    "soca": "soca",
    "reggae": "reggae",
    "dancehall": "dancehall",

    "afrobeats": "afrobeats",
    "afrobeat": "afrobeat",

    "gospel": "gospel",

    "r and b": "r&b",
    "rnb": "r&b",

    "hip hop": "hip hop",
    "hiphop": "hip hop",

    "jazz": "jazz",
    "pop": "pop",
    "news": "news",
    "talk": "talk",
    "sports": "sports"
  };


  if (GENRE_ALIASES[normalized]) {

    const tag =
      GENRE_ALIASES[normalized];

    clearBackButton();

    setLibraryActive("");

    setDiscoveryHeading(
      query,
      `Popular ${query} radio stations.`
    );

    discoveryMessage(
      `Searching for ${query} stations...`
    );

    scrollToDiscovery();


    try {

      const data =
        await apiFetch(
          `/json/stations/bytagexact/${encodeURIComponent(tag)}` +
          "?hidebroken=true" +
          "&order=clickcount" +
          "&reverse=true" +
          "&limit=100"
        );


      const stations =
        normalizeStations(data);


      if (!stations.length) {

        discoveryMessage(
          `No working ${query} stations were found.`
        );

        return;
      }


      renderStations(
        stations.slice(0,24)
      );


    } catch (error) {

      console.error(
        "Genre search failed:",
        error
      );

      discoveryMessage(
        "Search is temporarily unavailable."
      );
    }


    return;
  }


  /* STATION NAME SEARCH */

  clearBackButton();

  setLibraryActive("");

  setDiscoveryHeading(
    `Search: ${query}`,
    "Matching radio stations from around the world."
  );

  discoveryMessage(
    `Searching for "${query}"...`
  );

  scrollToDiscovery();


  try {

    const data =
      await apiFetch(
        `/json/stations/search?name=${encodeURIComponent(query)}` +
        "&hidebroken=true" +
        "&order=clickcount" +
        "&reverse=true" +
        "&limit=100"
      );


    let stations =
      normalizeStations(data);


    /*
      Remove duplicate station UUIDs.
    */

    const seen = new Set();

    stations =
      stations.filter(
        station => {

          if (
            seen.has(
              station.stationuuid
            )
          ) {
            return false;
          }

          seen.add(
            station.stationuuid
          );

          return true;
        }
      );


    if (!stations.length) {

      discoveryMessage(
        `No working stations found for "${query}".`
      );

      return;
    }


    renderStations(
      stations.slice(0,24)
    );


  } catch (error) {

    console.error(
      "Station search failed:",
      error
    );

    discoveryMessage(
      "Search is temporarily unavailable."
    );
  }
}

searchButton.addEventListener(
  "click",
  searchStations
);


searchInput.addEventListener(
  "keydown",
  event => {

    if (event.key === "Enter") {
      searchStations();
    }
  }
);


/* =========================================================
   WAZABANGA RADIO STREAM RESILIENCE
   Connection status + timeout handling
   ========================================================= */

let streamTimeout = null;

const STREAM_TIMEOUT_MS = 15000;


function clearStreamTimeout() {

  if (streamTimeout) {

    clearTimeout(streamTimeout);

    streamTimeout = null;
  }
}


function stationMetaText(station) {

  if (!station) {
    return "Wazabanga Radio";
  }

  return (
    [
      station.country,
      station.tags
        ? station.tags.split(",")[0]
        : ""
    ]
      .filter(Boolean)
      .join(" - ") ||
    "Wazabanga Radio"
  );
}


function startStreamTimeout() {

  clearStreamTimeout();

  streamTimeout =
    setTimeout(
      () => {

        if (
          currentStation &&
          audio.paused
        ) {

          playerMeta.textContent =
            "Station is taking too long to respond - try again or choose another station";

          updatePlayState();
        }

        streamTimeout = null;

      },
      STREAM_TIMEOUT_MS
    );
}


audio.addEventListener(
  "loadstart",
  () => {

    if (!currentStation) return;

    playerMeta.textContent =
      "Connecting...";

    startStreamTimeout();
  }
);


audio.addEventListener(
  "playing",
  () => {

    clearStreamTimeout();

    if (currentStation) {

      playerMeta.textContent =
        stationMetaText(
          currentStation
        );
    }

    updatePlayState();
  }
);


audio.addEventListener(
  "canplay",
  () => {

    clearStreamTimeout();
  }
);


audio.addEventListener(
  "waiting",
  () => {

    if (
      !currentStation ||
      audio.paused
    ) {
      return;
    }

    playerMeta.textContent =
      "Buffering...";

    startStreamTimeout();
  }
);


audio.addEventListener(
  "stalled",
  () => {

    if (!currentStation) return;

    playerMeta.textContent =
      "Stream stalled - reconnecting...";

    startStreamTimeout();
  }
);


audio.addEventListener(
  "play",
  updatePlayState
);


audio.addEventListener(
  "pause",
  () => {

    clearStreamTimeout();

    updatePlayState();
  }
);


audio.addEventListener(
  "error",
  () => {

    clearStreamTimeout();

    updatePlayState();

    if (currentStation) {

      playerMeta.textContent =
        "Stream unavailable - try another station";
    }
  }
);

loadFeaturedStations();


/* =========================================================
   WAZABANGA RADIO DISCOVERY V2
   Region -> Country -> Stations
   ========================================================= */

const REGION_MAP = {

  "africa": {
    name: "Africa",
    countries: [
      ["AO","Angola"],
      ["BF","Burkina Faso"],
      ["BJ","Benin"],
      ["BI","Burundi"],
      ["CD","Democratic Republic of the Congo"],
      ["CF","Central African Republic"],
      ["CG","Republic of the Congo"],
      ["CI","Côte d'Ivoire"],
      ["CM","Cameroon"],
      ["CV","Cape Verde"],
      ["DZ","Algeria"],
      ["EG","Egypt"],
      ["ER","Eritrea"],
      ["ET","Ethiopia"],
      ["GH","Ghana"],
      ["GN","Guinea"],
      ["GQ","Equatorial Guinea"],
      ["GW","Guinea-Bissau"],
      ["KE","Kenya"],
      ["LR","Liberia"],
      ["LS","Lesotho"],
      ["LY","Libya"],
      ["MA","Morocco"],
      ["MG","Madagascar"],
      ["ML","Mali"],
      ["MR","Mauritania"],
      ["MU","Mauritius"],
      ["MW","Malawi"],
      ["MZ","Mozambique"],
      ["NA","Namibia"],
      ["NG","Nigeria"],
      ["RW","Rwanda"],
      ["SC","Seychelles"],
      ["SD","Sudan"],
      ["SL","Sierra Leone"],
      ["SN","Senegal"],
      ["SO","Somalia"],
      ["SS","South Sudan"],
      ["ST","São Tomé and Príncipe"],
      ["SZ","Eswatini"],
      ["TD","Chad"],
      ["TG","Togo"],
      ["TN","Tunisia"],
      ["TZ","Tanzania"],
      ["UG","Uganda"],
      ["ZA","South Africa"],
      ["ZM","Zambia"],
      ["ZW","Zimbabwe"]
    ]
  },

  "asia": {
    name: "Asia",
    countries: [
      ["AE","United Arab Emirates"],
      ["BD","Bangladesh"],
      ["BH","Bahrain"],
      ["ID","Indonesia"],
      ["IL","Israel"],
      ["IN","India"],
      ["JO","Jordan"],
      ["JP","Japan"],
      ["KR","South Korea"],
      ["KW","Kuwait"],
      ["LB","Lebanon"],
      ["MY","Malaysia"],
      ["OM","Oman"],
      ["PH","Philippines"],
      ["PK","Pakistan"],
      ["QA","Qatar"],
      ["SA","Saudi Arabia"],
      ["SG","Singapore"],
      ["TH","Thailand"],
      ["TR","Turkey"],
      ["VN","Vietnam"]
    ]
  },

  "europe": {
    name: "Europe",
    countries: [
      ["AT","Austria"],
      ["BE","Belgium"],
      ["CH","Switzerland"],
      ["DE","Germany"],
      ["DK","Denmark"],
      ["ES","Spain"],
      ["FI","Finland"],
      ["FR","France"],
      ["GB","United Kingdom"],
      ["GR","Greece"],
      ["IE","Ireland"],
      ["IT","Italy"],
      ["NL","Netherlands"],
      ["NO","Norway"],
      ["PL","Poland"],
      ["PT","Portugal"],
      ["SE","Sweden"]
    ]
  },

  "north-america": {
    name: "North America",
    countries: [
      ["AG","Antigua & Barbuda"],
      ["BB","Barbados"],
      ["BS","Bahamas"],
      ["CA","Canada"],
      ["CR","Costa Rica"],
      ["CU","Cuba"],
      ["DM","Dominica"],
      ["DO","Dominican Republic"],
      ["GD","Grenada"],
      ["GT","Guatemala"],
      ["HT","Haiti"],
      ["JM","Jamaica"],
      ["KN","Saint Kitts & Nevis"],
      ["LC","Saint Lucia"],
      ["MX","Mexico"],
      ["PA","Panama"],
      ["PR","Puerto Rico"],
      ["TT","Trinidad & Tobago"],
      ["US","United States"],
      ["VC","Saint Vincent & the Grenadines"]
    ]
  },

  "south-america": {
    name: "South America",
    countries: [
      ["AR","Argentina"],
      ["BR","Brazil"],
      ["CL","Chile"],
      ["CO","Colombia"],
      ["PE","Peru"],
      ["VE","Venezuela"]
    ]
  },

  "oceania": {
    name: "Australia / Oceania",
    countries: [
      ["AU","Australia"],
      ["NZ","New Zealand"]
    ]
  },

  "antarctica": {
    name: "Antarctica",
    countries: []
  }
};


let currentRegion = null;
let currentCountry = null;

let wazabangaHistoryReady = false;
let wazabangaRestoringHistory = false;

function radioHomeState() {
  return {
    wazabangaRadio: true,
    level: "home"
  };
}

function regionHistoryState(regionKey) {
  return {
    wazabangaRadio: true,
    level: "region",
    regionKey
  };
}

function worldwideHistoryState() {
  return {
    wazabangaRadio: true,
    level: "worldwide"
  };
}


function countryHistoryState(countryCode, countryName, regionKey) {
  return {
    wazabangaRadio: true,
    level: "country",
    regionKey,
    countryCode,
    countryName
  };
}

function ensureRadioHistory() {
  if (wazabangaHistoryReady) return;

  history.replaceState(
    radioHomeState(),
    "",
    window.location.href
  );

  wazabangaHistoryReady = true;
}

function pushRadioHistory(state) {
  if (wazabangaRestoringHistory) return;

  ensureRadioHistory();

  history.pushState(
    state,
    "",
    window.location.href
  );
}



function getLiveSection() {
  return stationGrid.closest(".radio-section");
}


function setDiscoveryHeading(title, subtitle) {

  const section = getLiveSection();
  if (!section) return;

  const h2 =
    section.querySelector(".section-heading h2");

  const p =
    section.querySelector(".section-heading p");

  if (h2) h2.textContent = title;
  if (p) p.textContent = subtitle || "";
}


function scrollToDiscovery() {

  const section = getLiveSection();
  if (!section) return;

  section.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}


function discoveryMessage(message) {

  stationGrid.innerHTML = `
    <div style="
      grid-column:1/-1;
      padding:24px 0;
      opacity:.55;
    ">
      ${escapeHtml(message)}
    </div>
  `;
}


function clearBackButton() {

  document
    .querySelector(".country-back")
    ?.remove();
}


function addBackToCountries(regionKey) {

  const section = getLiveSection();
  if (!section) return;

  const heading =
    section.querySelector(".section-heading");

  if (!heading) return;

  clearBackButton();

  const button =
    document.createElement("button");

  button.type = "button";
  button.className =
    "section-link country-back";

  button.style.background =
    "transparent";

  button.style.border = "0";
  button.style.cursor = "pointer";

  button.textContent =
    "Back to countries";

  button.addEventListener(
    "click",
() => history.back()
  );

  heading.appendChild(button);
}


function countryCard(
  code,
  name,
  regionKey
) {

  const card =
    document.createElement("article");

  card.className = "live-card";
  card.style.cursor = "pointer";

  card.innerHTML = `
    <div class="live-top">

      <div class="station-art">
        ${countryFlag(code)}
      </div>

      <div class="live-info">

        <strong>
          ${escapeHtml(name)}
        </strong>

        <span>
          Browse radio stations
        </span>

      </div>

    </div>

    <div class="live-status">
      Explore
    </div>

    <button
      class="card-play"
      type="button"
      aria-label="Open ${escapeHtml(name)}">
      &#8250;
    </button>
  `;

  const openCountry = () => {
    loadCountryStations(
      code,
      name,
      regionKey
    );
  };

  card.addEventListener(
    "click",
    event => {

      if (
        event.target.closest(".card-play")
      ) {
        return;
      }

      openCountry();
    }
  );

  card
    .querySelector(".card-play")
    .addEventListener(
      "click",
      event => {

        event.stopPropagation();
        openCountry();
      }
    );

  return card;
}


function showCountries(regionKey, pushHistory = true) {

  const region =
    REGION_MAP[regionKey];

  if (!region) return;

  if (pushHistory) {
    pushRadioHistory(
      regionHistoryState(regionKey)
    );
  }

  currentRegion = regionKey;
  currentCountry = null;

  clearBackButton();

  setDiscoveryHeading(
    region.name,
    "Choose a country"
  );

  stationGrid.innerHTML = "";

  if (region.countries.length === 0) {

    setDiscoveryHeading(
      region.name,
      "Radio discovery for this continent."
    );

    discoveryMessage(
      "No radio stations are currently available for this continent."
    );

    scrollToDiscovery();
    return;
  }

  region.countries.forEach(
    ([code,name]) => {

      stationGrid.appendChild(
        countryCard(
          code,
          name,
          regionKey
        )
      );
    }
  );

  scrollToDiscovery();
}


async function loadCountryStations(
  countryCode,
  countryName,
regionKey,
pushHistory = true
) {

  if (pushHistory) {
    pushRadioHistory(
      countryHistoryState(
        countryCode,
        countryName,
        regionKey
      )
    );
  }

  currentRegion = regionKey;

  currentCountry = {
    code: countryCode,
    name: countryName
  };

  const regionName =
    REGION_MAP[regionKey]?.name ||
    "Explore";

  clearBackButton();

  setDiscoveryHeading(
    countryName,
    `${regionName} > ${countryName}`
  );

  discoveryMessage(
    `Loading radio stations in ${countryName}...`
  );

  scrollToDiscovery();

  try {

    const data = await apiFetch(
      `/json/stations/bycountrycodeexact/${encodeURIComponent(countryCode)}` +
      "?hidebroken=true" +
      "&order=clickcount" +
      "&reverse=true" +
      "&limit=100"
    );

    const directoryStations =
      normalizeStations(data);

    /*
      Wazabanga verified stations are placed first.
      Radio Browser supplements the catalogue.
    */
    const verifiedStations =
      (
        typeof WAZABANGA_VERIFIED_STATIONS !== "undefined" &&
        Array.isArray(WAZABANGA_VERIFIED_STATIONS[countryCode])
      )
        ? WAZABANGA_VERIFIED_STATIONS[countryCode]
        : [];

    const caribbeanStations =
      (
        typeof WAZABANGA_CARIBBEAN_STATIONS !== "undefined" &&
        Array.isArray(WAZABANGA_CARIBBEAN_STATIONS[countryCode])
      )
        ? WAZABANGA_CARIBBEAN_STATIONS[countryCode]
        : [];

    const eastAfricaStations =
      (
        typeof WAZABANGA_EAST_AFRICA_STATIONS !== "undefined" &&
        Array.isArray(WAZABANGA_EAST_AFRICA_STATIONS[countryCode])
      )
        ? WAZABANGA_EAST_AFRICA_STATIONS[countryCode]
        : [];
    const africaStations =
      (
        typeof WAZABANGA_AFRICA_STATIONS !== "undefined" &&
        Array.isArray(WAZABANGA_AFRICA_STATIONS[countryCode])
      )
        ? WAZABANGA_AFRICA_STATIONS[countryCode]
        : [];

    const asiaStations =
      (
        typeof WAZABANGA_ASIA_STATIONS !== "undefined" &&
        Array.isArray(WAZABANGA_ASIA_STATIONS[countryCode])
      )
        ? WAZABANGA_ASIA_STATIONS[countryCode]
        : [];
    const WAZABANGA_QA_REJECTED_STATIONS = new Set([
  // Grenada -- failed real browser playback QA on 2026-10-04.
  "a347aba6-4247-4b97-bc4f-ba90c3d1c380",
  // Cuba -- failed real browser playback QA on 2026-10-05.
  "fe653321-02bc-47ed-9102-f50e1abc5479",
  "b6154a79-7eca-476c-ab74-1d96b5d4c456",
  // Ethiopia -- Bisrat FM failed real browser playback QA on 2026-10-05.
  "22dd8fd6-ee1a-445b-af52-18dc574cff2d",
  // Rwanda -- non-station Abdulbasit/mp3islam entry rejected during browser QA.
  "b50082c6-87c0-4e84-be74-c1b817be0a4f",
  // South Sudan -- non-station Abdulbasit/mp3islam entry rejected during browser QA.
  "3629fd24-5c49-43b3-b125-06217bee9510"
]);

function isQaRejectedStation(station) {
  return Boolean(
    station &&
    station.stationuuid &&
    WAZABANGA_QA_REJECTED_STATIONS.has(station.stationuuid)
  );
}
let stations = [
  ...verifiedStations,
  ...caribbeanStations,
  ...eastAfricaStations,
  ...africaStations, ...asiaStations,
  ...directoryStations
];

stations = stations.filter(station => !isQaRejectedStation(station));

    /*
      Validate stations against the requested country.

      Wazabanga verified stations are always trusted.
      Public directory entries pass through country validation.
    */
    stations = stations.filter(
      station => validateCountryStation(station, countryCode)
    );

    /*
    /*
      Remove duplicates by UUID and canonical stream URL.

      Canonicalization is ONLY for duplicate comparison.
      The original URL remains untouched for playback.
    */
    const seenUUIDs = new Set();
    const seenStreams = new Set();

    stations =
      stations.filter(
        station => {

          const uuid =
            String(station.stationuuid || "")
              .trim()
              .toLowerCase();

          const stream =
            String(
              station.url_resolved ||
              station.url ||
              ""
            )
              .trim()
              .toLowerCase();

          /*
            Ignore temporary query strings/fragments when comparing
            streams.

            Examples:
              /stream
              /stream?
              /stream?token=123
              /stream#fragment

            are treated as the same underlying stream.
          */
          const canonicalStream =
            stream
              .split("#")[0]
              .split("?")[0]
              .replace(/\/+$/, "");

          /*
            Some providers expose the same underlying station through
            different stream URL formats.

            RadioMast embeds a stable UUID in those URLs, so use that
            UUID as the duplicate-comparison identity when available.

            Playback still uses the original stream URL.
          */
          const radioMastMatch =
            canonicalStream.match(
              /(?:^|\/)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/|$)/i
            );

          const streamIdentity =
            (
              canonicalStream.includes("radiomast.io") &&
              radioMastMatch
            )
              ? `radiomast:${radioMastMatch[1].toLowerCase()}`
              : canonicalStream;


          if (
            (uuid && seenUUIDs.has(uuid)) ||
            (
              canonicalStream &&
              seenStreams.has(streamIdentity)
            )
          ) {
            return false;
          }

          if (uuid) {
            seenUUIDs.add(uuid);
          }

          if (canonicalStream) {
            seenStreams.add(streamIdentity);
          }

          return true;
        }
      );

    if (!stations.length) {

      discoveryMessage(
        `No working stations were found in ${countryName}.`
      );

      addBackToCountries(regionKey);
      return;
    }

    /*
      Country catalogue display order.

      Sort the final validated and deduplicated catalogue
      alphabetically by station name.

      Numeric station names such as "89 Smart FM" are sorted
      naturally before alphabetic names.

      This affects country browsing only.
    */
    stations.sort(
      (a, b) =>
        String(a.name || "").localeCompare(
          String(b.name || ""),
          undefined,
          {
            sensitivity: "base",
            numeric: true
          }
        )
    );

    renderStations(stations);

    addBackToCountries(regionKey);

  } catch (error) {

    console.error(
      "Country station loading failed:",
      error
    );

    discoveryMessage(
      `${countryName} stations are temporarily unavailable.`
    );

    addBackToCountries(regionKey);
  }
}


/* WORLDWIDE */

async function showWorldwide(pushHistory = true) {

  if (pushHistory) {
    pushRadioHistory(
      worldwideHistoryState()
    );
  }

  currentRegion = "worldwide";
  currentCountry = null;

  clearBackButton();

  setDiscoveryHeading(
    "Worldwide",
    "A balanced mix of radio stations from around the world."
  );

  discoveryMessage(
    "Loading worldwide stations..."
  );

  scrollToDiscovery();

  const worldwideCountries = [
    { code: "NG", continent: "Africa" },
    { code: "ZA", continent: "Africa" },
    { code: "KE", continent: "Africa" },
    { code: "UG", continent: "Africa" },

    { code: "IN", continent: "Asia" },
    { code: "JP", continent: "Asia" },
    { code: "PH", continent: "Asia" },
    { code: "AE", continent: "Asia" },

    { code: "GB", continent: "Europe" },
    { code: "FR", continent: "Europe" },
    { code: "DE", continent: "Europe" },
    { code: "IT", continent: "Europe" },

    { code: "US", continent: "North America" },
    { code: "CA", continent: "North America" },
    { code: "TT", continent: "North America" },
    { code: "MX", continent: "North America" },

    { code: "BR", continent: "South America" },
    { code: "AR", continent: "South America" },
    { code: "CO", continent: "South America" },
    { code: "CL", continent: "South America" },

    { code: "AU", continent: "Oceania" },
    { code: "NZ", continent: "Oceania" },
    { code: "FJ", continent: "Oceania" },
    { code: "PG", continent: "Oceania" }
  ];

  try {

    const results = await Promise.all(
      worldwideCountries.map(
        async country => {

          try {

            const station =
              await getTopStation(country.code);

            if (!station) {
              return null;
            }

            if (
              !validateCountryStation(
                station,
                country.code
              )
            ) {

              console.warn(
                "Worldwide country mismatch:",
                country.code,
                station.name,
                station.countrycode
              );

              return null;
            }

            station._continent =
              country.continent;

            return station;

          } catch (error) {

            console.warn(
              "Worldwide country unavailable:",
              country.code,
              error
            );

            return null;
          }
        }
      )
    );

    let stations =
      results.filter(Boolean);

    /*
      Protect Worldwide against duplicate UUIDs
      or duplicate canonical stream URLs.
    */

    const seenUuid =
      new Set();

    const seenStream =
      new Set();

    stations =
      stations.filter(station => {

        const uuid =
          String(
            station.stationuuid || ""
          )
            .trim()
            .toLowerCase();

        const stream =
          String(
            station.url_resolved ||
            station.url ||
            ""
          )
            .trim()
            .toLowerCase();

        if (
          (uuid && seenUuid.has(uuid)) ||
          (stream && seenStream.has(stream))
        ) {
          return false;
        }

        if (uuid) {
          seenUuid.add(uuid);
        }

        if (stream) {
          seenStream.add(stream);
        }

        return true;
      });

    if (!stations.length) {

      discoveryMessage(
        "Worldwide radio is temporarily unavailable."
      );

      return;
    }

    renderStations(stations);

  } catch (error) {

    console.error(error);

    discoveryMessage(
      "Worldwide radio is temporarily unavailable."
    );
  }
}


/* BROWSER / DEVICE BACK NAVIGATION */

ensureRadioHistory();

window.addEventListener(
  "popstate",
  event => {

    const state = event.state;

    if (!state || state.wazabangaRadio !== true) {
      return;
    }

    wazabangaRestoringHistory = true;

    try {

      if (state.level === "country") {
        loadCountryStations(
          state.countryCode,
          state.countryName,
          state.regionKey,
          false
        );
        return;
      }

      if (state.level === "worldwide") {

        showWorldwide(false);

        return;
      }

      if (state.level === "region") {
        showCountries(
          state.regionKey,
          false
        );
        return;
      }

      if (state.level === "home") {
        currentRegion = null;
        currentCountry = null;

        clearBackButton();
        setLibraryActive("live");

        setDiscoveryHeading(
          "Live now",
          "Featured stations from the Wazabanga world."
        );

        loadFeaturedStations();
        scrollToDiscovery();
      }

    } finally {
      wazabangaRestoringHistory = false;
    }
  }
);


/* REGION CARDS */

document
  .querySelectorAll(
    ".region-card[data-region]"
  )
  .forEach(card => {

    card.addEventListener(
      "click",
      () => {

        const regionKey =
          card.dataset.region;

        if (
          regionKey === "worldwide"
        ) {

          showWorldwide();

        } else {

          showCountries(regionKey);
        }
      }
    );

  });


/* GENRES */

document
  .querySelectorAll(
    ".genre[data-genre]"
  )
  .forEach(button => {

    button.addEventListener(
      "click",
      async () => {

        clearBackButton();

        const genre =
          button.dataset.genre;

        const label =
          button.textContent.trim();

        setDiscoveryHeading(
          label,
          `Popular ${label} radio stations.`
        );

        discoveryMessage(
          `Loading ${label} stations...`
        );

        scrollToDiscovery();

        let tag =
          genre.replaceAll("-", " ");

        if (genre === "randb") {
          tag = "r&b";
        }

        try {

          const data =
            await apiFetch(
              `/json/stations/bytagexact/${encodeURIComponent(tag)}` +
              "?hidebroken=true" +
              "&order=clickcount" +
              "&reverse=true" +
              "&limit=80"
            );

          const stations =
            normalizeStations(data);

          if (!stations.length) {

            discoveryMessage(
              `No ${label} stations were found.`
            );

            return;
          }

          renderStations(
            stations.slice(0,24)
          );

        } catch (error) {

          console.error(error);

          discoveryMessage(
            `${label} stations are temporarily unavailable.`
          );
        }
      }
    );

  });


/* VIEW ALL */

const viewAllStationsV2 =
  document.getElementById(
    "viewAllStations"
  );

if (viewAllStationsV2) {

  viewAllStationsV2.addEventListener(
    "click",
    event => {

      event.preventDefault();
      showWorldwide();
    }
  );
}



/* =========================================================
   WAZABANGA RADIO LIBRARY
   Favorites + Recently Played
   ========================================================= */

const RECENT_STORAGE_KEY =
  "wazabanga-radio-recent";

const MAX_RECENT_STATIONS = 20;


function loadRecentlyPlayed() {

  try {

    const stored =
      JSON.parse(
        localStorage.getItem(
          RECENT_STORAGE_KEY
        ) || "[]"
      );

    return Array.isArray(stored)
      ? stored
      : [];

  } catch {

    return [];
  }
}


function saveRecentlyPlayed() {

  localStorage.setItem(
    RECENT_STORAGE_KEY,
    JSON.stringify(recentlyPlayed)
  );
}


function stationSnapshot(station) {

  return {
    stationuuid: station.stationuuid,
    name: station.name,
    country: station.country,
    countrycode: station.countrycode,
    favicon: station.favicon,
    url: station.url,
    url_resolved: station.url_resolved,
    tags: station.tags
  };
}


function addRecentlyPlayed(station) {

  if (
    !station ||
    !station.stationuuid
  ) {
    return;
  }

  recentlyPlayed =
    recentlyPlayed.filter(
      item =>
        item.stationuuid !==
        station.stationuuid
    );

  recentlyPlayed.unshift(
    stationSnapshot(station)
  );

  recentlyPlayed =
    recentlyPlayed.slice(
      0,
      MAX_RECENT_STATIONS
    );

  saveRecentlyPlayed();
}


function updateFavoritesCount() {

  const count =
    document.getElementById(
      "favoritesCount"
    );

  if (count) {
    count.textContent =
      String(favorites.length);
  }
}


function setLibraryActive(name) {

  document
    .querySelectorAll(
      ".radio-library-tab"
    )
    .forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.library === name
      );
    });
}


function showFavorites() {

  clearBackButton();

  setLibraryActive(
    "favorites"
  );

  setDiscoveryHeading(
    "Favorites",
    "Your saved Wazabanga radio stations."
  );

  if (!favorites.length) {

    discoveryMessage(
      "You have no favorite stations yet. Play a station and tap the heart to save it."
    );

    scrollToDiscovery();
    return;
  }

  renderStations(favorites);

  scrollToDiscovery();
}


function showRecentlyPlayed() {

  clearBackButton();

  setLibraryActive(
    "recent"
  );

  setDiscoveryHeading(
    "Recently Played",
    "Stations you listened to recently."
  );

  if (!recentlyPlayed.length) {

    discoveryMessage(
      "Your recently played stations will appear here."
    );

    scrollToDiscovery();
    return;
  }

  renderStations(
    recentlyPlayed
  );

  scrollToDiscovery();
}


function showLiveNow() {

  clearBackButton();

  setLibraryActive(
    "live"
  );

  setDiscoveryHeading(
    "Live now",
    "Featured stations from the Wazabanga world."
  );

  loadFeaturedStations();

  scrollToDiscovery();
}


document
  .querySelectorAll(
    ".radio-library-tab"
  )
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        const library =
          button.dataset.library;

        if (
          library === "favorites"
        ) {
          showFavorites();
          return;
        }

        if (
          library === "recent"
        ) {
          showRecentlyPlayed();
          return;
        }

        showLiveNow();
      }
    );

  });


updateFavoritesCount();


















