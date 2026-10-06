(function () {
  "use strict";

  /*
   * Wazabanga Radio
   * Dynamic Globe Controller
   *
   * v1.3 Phase 1
   *
   * OBSERVER ONLY.
   *
   * This controller does not own:
   * - radio navigation
   * - station loading
   * - playback
   * - browser history
   * - REGION_MAP
   * - catalogue data
   *
   * It observes the existing Wazabanga UI and exposes
   * a derived globe state for presentation logic.
   */

  const VERSION = "1.3-phase1";

  const CONTINENT_POINT = Object.freeze({
    africa: 1,
    asia: 2,
    europe: 3,
    "north-america": 4,
    "south-america": 5,
    oceania: 6,
    antarctica: 7
  });

  const state = {
    mode: "home",
    continentKey: null,
    continentName: null,
    countryCode: null,
    countryName: null,
    stationName: null,
    broadcasting: false,
    activityPoint: null
  };

  let activityLayer = null;
  let headingTitle = null;
  let headingSubtitle = null;
  let playerStation = null;
  let playerMeta = null;
  let playerPlay = null;

  let headingObserver = null;
  let playerObserver = null;

  function clean(value) {
    return String(value || "").trim();
  }

  function normalize(value) {
    return clean(value).toLowerCase();
  }

  function intelligence() {
    return window.WAZABANGA_GLOBE || null;
  }

  function allContinents() {
    const api = intelligence();

    if (!api || !api.continents) {
      return [];
    }

    return Object.entries(api.continents);
  }

  function findContinentByName(name) {
    const target = normalize(name);

    if (!target) return null;

    for (const [key, continent] of allContinents()) {
      if (normalize(continent && continent.name) === target) {
        return {
          key,
          continent
        };
      }
    }

    return null;
  }

  function findCountryByName(name) {
    const api = intelligence();
    const target = normalize(name);

    if (!api || !target) {
      return null;
    }

    const countries =
      typeof api.getAllCountries === "function"
        ? api.getAllCountries()
        : [];

    for (const country of countries) {
      if (normalize(country && country.name) === target) {
        return country;
      }
    }

    return null;
  }

  function deriveNavigationState() {
    const title =
      clean(headingTitle && headingTitle.textContent);

    const subtitle =
      clean(headingSubtitle && headingSubtitle.textContent);

    if (!title) {
      return;
    }

    if (normalize(title) === "live now") {
      state.mode = "home";
      state.continentKey = null;
      state.continentName = null;
      state.countryCode = null;
      state.countryName = null;
      state.activityPoint = null;

      publish();
      return;
    }

    if (normalize(title) === "worldwide") {
      state.mode = "worldwide";
      state.continentKey = null;
      state.continentName = null;
      state.countryCode = null;
      state.countryName = null;
      state.activityPoint = 8;

      publish();
      return;
    }

    const continentMatch =
      findContinentByName(title);

    if (
      continentMatch &&
      normalize(subtitle) === "choose a country"
    ) {
      state.mode = "continent";
      state.continentKey = continentMatch.key;
      state.continentName =
        continentMatch.continent.name;
      state.countryCode = null;
      state.countryName = null;

      state.activityPoint =
        CONTINENT_POINT[continentMatch.key] || null;

      publish();
      return;
    }

    const country =
      findCountryByName(title);

    if (country) {
      state.mode = "country";
      state.countryCode = country.code;
      state.countryName = country.name;
      state.continentKey =
        country.continentKey || null;

      const continent =
        state.continentKey &&
        intelligence() &&
        typeof intelligence().getContinent === "function"
          ? intelligence().getContinent(state.continentKey)
          : null;

      state.continentName =
        continent && continent.name
          ? continent.name
          : null;

      state.activityPoint =
        CONTINENT_POINT[state.continentKey] || null;

      publish();
    }
  }

  function derivePlayerState() {
    const station =
      clean(playerStation && playerStation.textContent);

    const meta =
      clean(playerMeta && playerMeta.textContent);

    const button =
      clean(playerPlay && playerPlay.textContent);

    const hasStation =
      station &&
      normalize(station) !== "select a station";

    /*
     * radio.js renders:
     *   pause symbol while playing
     *   play symbol while paused/stopped
     *
     * textContent for the pause symbol is sufficient
     * for observation without accessing private audio.
     */
    const broadcasting =
      hasStation &&
      (
        button === "❚❚" ||
        button === "Ⅱ" ||
        button === "||"
      );

    state.stationName =
      hasStation ? station : null;

    state.broadcasting =
      Boolean(broadcasting);

    if (
      meta &&
      normalize(meta).includes("stream unavailable")
    ) {
      state.broadcasting = false;
    }

    publish();
  }

  function updateActivityLayer() {
    if (!activityLayer) return;

    const points =
      Array.from(
        activityLayer.querySelectorAll(
          ".globe-activity-point"
        )
      );

    activityLayer.dataset.globeMode =
      state.mode;

    activityLayer.dataset.broadcasting =
      state.broadcasting
        ? "true"
        : "false";

    if (state.continentKey) {
      activityLayer.dataset.continent =
        state.continentKey;
    } else {
      delete activityLayer.dataset.continent;
    }

    if (state.countryCode) {
      activityLayer.dataset.country =
        state.countryCode;
    } else {
      delete activityLayer.dataset.country;
    }

    if (state.stationName) {
      activityLayer.dataset.station =
        state.stationName;
    } else {
      delete activityLayer.dataset.station;
    }

    points.forEach((point, index) => {
      const number = index + 1;

      point.dataset.active =
        state.activityPoint === number
          ? "true"
          : "false";

      point.dataset.broadcasting =
        state.broadcasting &&
        state.activityPoint === number
          ? "true"
          : "false";
    });
  }

  function snapshot() {
    return Object.freeze({
      version: VERSION,
      mode: state.mode,
      continentKey: state.continentKey,
      continentName: state.continentName,
      countryCode: state.countryCode,
      countryName: state.countryName,
      stationName: state.stationName,
      broadcasting: state.broadcasting,
      activityPoint: state.activityPoint
    });
  }

  function publish() {
    updateActivityLayer();

    const detail = snapshot();

    window.dispatchEvent(
      new CustomEvent(
        "wazabanga:globe-state",
        {
          detail
        }
      )
    );
  }

  function locateDom() {
    activityLayer =
      document.getElementById(
        "globeActivityLayer"
      );

    playerStation =
      document.getElementById(
        "playerStation"
      );

    playerMeta =
      document.getElementById(
        "playerMeta"
      );

    playerPlay =
      document.getElementById(
        "playerPlay"
      );

    const stationGrid =
      document.getElementById(
        "stationGrid"
      );

    const section =
      stationGrid &&
      stationGrid.closest(
        ".radio-section"
      );

    headingTitle =
      section &&
      section.querySelector(
        ".section-heading h2"
      );

    headingSubtitle =
      section &&
      section.querySelector(
        ".section-heading p"
      );

    return Boolean(
      activityLayer &&
      headingTitle &&
      headingSubtitle &&
      playerStation &&
      playerMeta &&
      playerPlay
    );
  }

  function observe() {
    headingObserver =
      new MutationObserver(
        deriveNavigationState
      );

    headingObserver.observe(
      headingTitle,
      {
        childList: true,
        characterData: true,
        subtree: true
      }
    );

    headingObserver.observe(
      headingSubtitle,
      {
        childList: true,
        characterData: true,
        subtree: true
      }
    );

    playerObserver =
      new MutationObserver(
        derivePlayerState
      );

    playerObserver.observe(
      playerStation,
      {
        childList: true,
        characterData: true,
        subtree: true
      }
    );

    playerObserver.observe(
      playerMeta,
      {
        childList: true,
        characterData: true,
        subtree: true
      }
    );

    playerObserver.observe(
      playerPlay,
      {
        childList: true,
        characterData: true,
        subtree: true
      }
    );
  }

  function init() {
    if (!intelligence()) {
      console.warn(
        "Wazabanga Globe Dynamic: intelligence API unavailable."
      );
      return;
    }

    if (!locateDom()) {
      console.warn(
        "Wazabanga Globe Dynamic: required DOM unavailable."
      );
      return;
    }

    observe();

    deriveNavigationState();
    derivePlayerState();

    console.info(
      "Wazabanga Globe Dynamic",
      VERSION,
      "ready"
    );
  }

  window.WAZABANGA_GLOBE_DYNAMIC =
    Object.freeze({
      version: VERSION,

      getState() {
        return snapshot();
      },

      refresh() {
        deriveNavigationState();
        derivePlayerState();

        return snapshot();
      }
    });

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      {
        once: true
      }
    );
  } else {
    init();
  }
})();
