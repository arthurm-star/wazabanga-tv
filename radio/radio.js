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

/*
  WAZABANGA RADIO v2.0
  Global verified runtime index.

  Frozen regional catalogues remain immutable.
  The outer catalogue country key is authoritative.
*/
function buildWazabangaGlobalStations() {

  const sources = [
    {
      continent: "Africa",
      catalogue:
        typeof WAZABANGA_AFRICA_STATIONS !== "undefined"
          ? WAZABANGA_AFRICA_STATIONS
          : null
    },
    {
      continent: "Asia",
      catalogue:
        typeof WAZABANGA_ASIA_STATIONS !== "undefined"
          ? WAZABANGA_ASIA_STATIONS
          : null
    },
    {
      continent: "Europe",
      catalogue:
        typeof WAZABANGA_EUROPE_STATIONS !== "undefined"
          ? WAZABANGA_EUROPE_STATIONS
          : null
    },
    {
      continent: "North America",
      catalogue:
        typeof WAZABANGA_NORTH_AMERICA_STATIONS !== "undefined"
          ? WAZABANGA_NORTH_AMERICA_STATIONS
          : null
    },
    {
      continent: "South America",
      catalogue:
        typeof WAZABANGA_SOUTH_AMERICA_STATIONS !== "undefined"
          ? WAZABANGA_SOUTH_AMERICA_STATIONS
          : null
    },
    {
      continent: "Oceania",
      catalogue:
        typeof WAZABANGA_OCEANIA_STATIONS !== "undefined"
          ? WAZABANGA_OCEANIA_STATIONS
          : null
    }
  ];

  const stations = [];

  for (const source of sources) {

    if (
      !source.catalogue ||
      typeof source.catalogue !== "object"
    ) {
      continue;
    }

    for (
      const [countryCode, countryStations]
      of Object.entries(source.catalogue)
    ) {

      if (!Array.isArray(countryStations)) {
        continue;
      }

      for (const station of countryStations) {

        if (!station) {
          continue;
        }

        stations.push({
          ...station,

          /*
            The catalogue's outer key is the
            authoritative country identity.
          */
          countrycode: countryCode,

          /*
            Preserve an embedded country name
            where one already exists.
          */
          country:
            String(station.country || "").trim(),

          /*
            Global product metadata.
          */
          _wazabangaContinent: source.continent
        });
      }
    }
  }

  return stations;
}

const WAZABANGA_GLOBAL_STATIONS =
  buildWazabangaGlobalStations();

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

  const emoji =
    String.fromCodePoint(
      ...[...code.toUpperCase()].map(
        ch => 127397 + ch.charCodeAt(0)
      )
    );

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
        this.parentElement.textContent='${emoji}';
      "
    >
  `;
}


function stationCountryDisplayName(station) {

  const code =
    String(station?.countrycode || "")
      .trim()
      .toUpperCase();

  if (code === "AU") {
    return "Australia";
  }

  if (code === "NZ") {
    return "New Zealand";
  }

  return (
    station?._region ||
    station?.country ||
    "Worldwide"
  );
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


function stationDisplayName(station) {
  const rawName =
    String(station?.name || "").trim();

  const cleaned =
    rawName.replace(/^\.+\s*/, "").trim();

  return (
    cleaned ||
    rawName ||
    "Unknown station"
  );
}


function renderStationCards(stations) {

  stationGrid.innerHTML = "";

  stations.forEach(station => {

    const card =
      document.createElement("article");

    card.className = "live-card";

    const region =
      stationCountryDisplayName(station);

    card.innerHTML = `
      <div class="live-top">

        <div class="station-art">
          ${stationArtwork(station)}
        </div>

        <div class="live-info">
          <strong>
            ${escapeHtml(stationDisplayName(station))}
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
        aria-label="Play ${escapeHtml(stationDisplayName(station))}">
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
    stationDisplayName(station);

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
    "Verified Wazabanga stations first, with worldwide discovery."
  );

  discoveryMessage(
    `Searching for "${query}"...`
  );

  scrollToDiscovery();


  /*
    v2.0 verified-global search.

    Search the frozen Wazabanga runtime first.
    Radio Browser remains a secondary discovery source.
  */
  const searchNeedle =
    normalized;

  const normalizeSearchText =
    value =>
      String(value || "")
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();

  const verifiedMatches =
    WAZABANGA_GLOBAL_STATIONS.filter(
      station => {

        const haystack =
          [
            station.name,
            station.country,
            station.countrycode,
            station._wazabangaContinent,
            station.language,
            station.tags
          ]
            .map(normalizeSearchText)
            .filter(Boolean)
            .join(" ");

        return haystack.includes(searchNeedle);
      }
    )
    .map(station => ({
      ...station,
      _verified: true
    }));


  /*
    Prefer stronger verified matches before broader
    metadata matches.
  */
  verifiedMatches.sort(
    (a,b) => {

      const aName =
        normalizeSearchText(a.name);

      const bName =
        normalizeSearchText(b.name);

      const aCountry =
        normalizeSearchText(a.country);

      const bCountry =
        normalizeSearchText(b.country);

      const score =
        station => {

          const name =
            normalizeSearchText(station.name);

          const country =
            normalizeSearchText(station.country);

          const code =
            normalizeSearchText(
              station.countrycode
            );

          if (name === searchNeedle) {
            return 0;
          }

          if (name.startsWith(searchNeedle)) {
            return 1;
          }

          if (name.includes(searchNeedle)) {
            return 2;
          }

          if (
            country === searchNeedle ||
            code === searchNeedle
          ) {
            return 3;
          }

          return 4;
        };

      const scoreDiff =
        score(a) - score(b);

      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      const nameDiff =
        aName.localeCompare(bName);

      if (nameDiff !== 0) {
        return nameDiff;
      }

      return aCountry.localeCompare(bCountry);
    }
  );


  let directoryMatches = [];

  try {

    const data =
      await apiFetch(
        `/json/stations/search?name=${encodeURIComponent(query)}` +
        "&hidebroken=true" +
        "&order=clickcount" +
        "&reverse=true" +
        "&limit=100"
      );

    directoryMatches =
      normalizeStations(data);

  } catch (error) {

    /*
      The verified Wazabanga catalogue remains usable
      even when the public directory is unavailable.
    */
    console.error(
      "Supplementary station search failed:",
      error
    );
  }


  /*
    Merge verified results first.

    Deduplicate by UUID and stream URL while preserving
    the original stream URL for playback.
  */
  const combined =
    [
      ...verifiedMatches,
      ...directoryMatches
    ];

  const seenUUIDs =
    new Set();

  const seenStreams =
    new Set();

  const stations =
    combined.filter(
      station => {

        const uuid =
          String(
            station.stationuuid || ""
          )
            .trim()
            .toLowerCase();

        const stream =
          String(
            station.stream ||
            station.url_resolved ||
            station.url ||
            ""
          )
            .trim()
            .toLowerCase();

        if (
          uuid &&
          seenUUIDs.has(uuid)
        ) {
          return false;
        }

        if (
          stream &&
          seenStreams.has(stream)
        ) {
          return false;
        }

        if (uuid) {
          seenUUIDs.add(uuid);
        }

        if (stream) {
          seenStreams.add(stream);
        }

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

    /*
      Wazabanga v2.0 country browsing.

      The frozen Wazabanga global runtime is authoritative.
      Radio Browser is supplementary only.

      This keeps verified country browsing available even when
      the public directory is unavailable.
    */
    const normalizedCountryCode =
      String(countryCode || "")
        .trim()
        .toUpperCase();

    const verifiedStations =
      WAZABANGA_GLOBAL_STATIONS
        .filter(
          station =>
            String(
              station.countrycode || ""
            )
              .trim()
              .toUpperCase() ===
            normalizedCountryCode
        )
        .map(
          station => ({
            ...station,
            _verified: true
          })
        );

    let directoryStations = [];

    try {

      const data =
        await apiFetch(
          `/json/stations/bycountrycodeexact/${encodeURIComponent(normalizedCountryCode)}` +
          "?hidebroken=true" +
          "&order=clickcount" +
          "&reverse=true" +
          "&limit=100"
        );

      directoryStations =
        normalizeStations(data);

    } catch (error) {

      /*
        Supplementary directory failure must not prevent
        frozen verified Wazabanga stations from loading.
      */
      console.error(
        "Supplementary country directory failed:",
        error
      );
    }

    /*
      Verified runtime always comes first so existing UUID/stream
      deduplication preserves the Wazabanga copy when the directory
      returns the same station.
    */
    let stations = [
      ...verifiedStations,
      ...directoryStations
    ];
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
    "A balanced mix of verified Wazabanga stations from around the world."
  );

  discoveryMessage(
    "Loading worldwide stations..."
  );

  scrollToDiscovery();


  /*
    WAZABANGA RADIO v2.0
    Verified Worldwide showcase.

    Select globally unique stations while building
    the six continent quotas, rather than selecting
    first and deduplicating afterwards.
  */
  const worldwideContinents = [
    "Africa",
    "Asia",
    "Europe",
    "North America",
    "South America",
    "Oceania"
  ];

  const stationsPerContinent = 4;

  const worldwideStations = [];

  const worldwideSeenUUIDs =
    new Set();

  const worldwideSeenStreams =
    new Set();


  const canUseWorldwideStation =
    station => {

      if (!station) {
        return false;
      }

      const uuid =
        String(
          station.stationuuid || ""
        )
          .trim()
          .toLowerCase();

      const stream =
        String(
          station.stream || ""
        )
          .trim()
          .toLowerCase();

      if (!uuid || !stream) {
        return false;
      }

      if (
        worldwideSeenUUIDs.has(uuid) ||
        worldwideSeenStreams.has(stream)
      ) {
        return false;
      }

      return true;
    };


  const addWorldwideStation =
    (station, selected) => {

      if (
        !canUseWorldwideStation(station)
      ) {
        return false;
      }

      const uuid =
        String(
          station.stationuuid || ""
        )
          .trim()
          .toLowerCase();

      const stream =
        String(
          station.stream || ""
        )
          .trim()
          .toLowerCase();

      const verifiedStation = {
        ...station,
        _verified: true
      };

      selected.push(
        verifiedStation
      );

      worldwideStations.push(
        verifiedStation
      );

      worldwideSeenUUIDs.add(uuid);
      worldwideSeenStreams.add(stream);

      return true;
    };


  for (const continent of worldwideContinents) {

    const continentStations =
      WAZABANGA_GLOBAL_STATIONS.filter(
        station =>
          station._wazabangaContinent ===
          continent
      );

    /*
      Group by country while preserving the frozen
      catalogue/runtime order.
    */
    const byCountry =
      new Map();

    for (const station of continentStations) {

      const countryCode =
        String(
          station.countrycode || ""
        )
          .trim()
          .toUpperCase();

      if (!countryCode) {
        continue;
      }

      if (!byCountry.has(countryCode)) {
        byCountry.set(
          countryCode,
          []
        );
      }

      byCountry
        .get(countryCode)
        .push(station);
    }


    const selected = [];


    /*
      Diversity pass.

      Try each country in order. If that country's
      first station collides globally, continue through
      that country's verified stations until a unique
      candidate is found.

      At most one station is taken from each country
      during this pass.
    */
    for (const countryStations of byCountry.values()) {

      if (
        selected.length >=
        stationsPerContinent
      ) {
        break;
      }

      for (const station of countryStations) {

        if (
          addWorldwideStation(
            station,
            selected
          )
        ) {
          break;
        }
      }
    }


    /*
      Fallback pass.

      Only needed when fewer than four distinct
      populated countries can supply globally unique
      stations. Additional unique stations from the
      continent may then fill the quota.
    */
    if (
      selected.length <
      stationsPerContinent
    ) {

      for (const station of continentStations) {

        if (
          selected.length >=
          stationsPerContinent
        ) {
          break;
        }

        addWorldwideStation(
          station,
          selected
        );
      }
    }
  }


  /*
    Selection itself now guarantees global UUID
    and stream uniqueness. This final array is kept
    explicit for renderer compatibility.
  */
  const stations =
    worldwideStations;


  if (!stations.length) {

    discoveryMessage(
      "Worldwide radio is temporarily unavailable."
    );

    return;
  }


  renderStations(stations);
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


















