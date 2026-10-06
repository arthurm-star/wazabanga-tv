/* =========================================================
   WAZABANGA RADIO VERIFIED GLOBAL CATALOGUE
   =========================================================

   PURPOSE
   -------
   Supplements public radio directories with stations that have
   been independently verified by Wazabanga.

   VERIFIED ENTRIES MAY:
   - restore legitimate stations missing from public directories;
   - replace outdated or broken directory streams;
   - provide reliable country/city classification;
   - preserve important local broadcasters.

   RULES
   -----
   1. Never add a station until its stream has been tested.
   2. Prefer HTTPS streams.
   3. Use ISO 3166-1 alpha-2 country codes.
   4. Keep station UUIDs unique.
   5. Verified stations are trusted by the country validator.
   6. Public directory stations continue to supplement this list.

   COUNTRY CODES CURRENTLY PREPARED
   --------------------------------
   UG - Uganda
   TT - Trinidad & Tobago
   KE - Kenya
   JM - Jamaica
   BB - Barbados

   Additional countries can be added without changing radio.js.
   ========================================================= */


const WAZABANGA_VERIFIED_STATIONS = {

  /*
     =========================================================
     UGANDA
     =========================================================
  */

  UG: [

    {
      stationuuid: "wazabanga-ug-nbs-894",
      name: "NBS 89.4 FM",
      country: "Uganda",
      countrycode: "UG",
      state: "Jinja",
      language: "English, Lusoga",
      tags: "music,news,talk,uganda,jinja",
      url: "https://khodeyo.radioca.st/stream",
      url_resolved: "https://khodeyo.radioca.st/stream",
      favicon: "",
      homepage: "",
      codec: "MP3",
      bitrate: 0,

      _verified: true,
      _verifiedBy: "Wazabanga",
      _verifiedDate: "2026-10-04",
      _catalogueSource: "manual",
      _region: "Uganda"
    },

    {
      stationuuid: "wazabanga-ug-smartfm-890",
      name: "89 Smart FM 89.0",
      country: "Uganda",
      countrycode: "UG",
      state: "Jinja",
      language: "English, Lusoga",
      tags: "music,news,talk,uganda,jinja",
      url: "https://smart.radioca.st/stream",
      url_resolved: "https://smart.radioca.st/stream",
      favicon: "",
      homepage: "",
      codec: "MP3",
      bitrate: 0,

      _verified: true,
      _verifiedBy: "Wazabanga",
      _verifiedDate: "2026-10-04",
      _catalogueSource: "manual",
      _region: "Uganda"
    }

  ],


  /*
     =========================================================
     TRINIDAD & TOBAGO
     =========================================================
  */

  TT: [

    {
      stationuuid: "wazabanga-tt-slam-1005",
      name: "Slam 100.5",
      country: "Trinidad & Tobago",
      countrycode: "TT",
      state: "Port of Spain",
      language: "English",
      tags: "music,urban,trinidad,tobago",
      url: "https://www.radiomast.io/stream/68540e88-54b8-4924-b098-5a668f7da7b6/listen",
      url_resolved: "https://www.radiomast.io/stream/68540e88-54b8-4924-b098-5a668f7da7b6/listen",
      favicon: "",
      homepage: "https://tbcradionetwork.co.tt/slam1005fm/",
      codec: "MP3",
      bitrate: 0,

      _verified: true,
      _verifiedBy: "Wazabanga",
      _verifiedDate: "2026-10-04",
      _catalogueSource: "manual",
      _region: "Trinidad & Tobago"
    },

    {
      stationuuid: "wazabanga-tt-wack-901",
      name: "WACK 90.1 FM",
      country: "Trinidad & Tobago",
      countrycode: "TT",
      state: "San Fernando",
      language: "English",
      tags: "music,soca,calypso,culture,trinidad,tobago",
      url: "https://stream.zenolive.com/6178mp9emq5tv",
      url_resolved: "https://stream.zenolive.com/6178mp9emq5tv",
      favicon: "",
      homepage: "https://wack.tv/",
      codec: "MP3",
      bitrate: 0,

      _verified: true,
      _verifiedBy: "Wazabanga",
      _verifiedDate: "2026-10-04",
      _catalogueSource: "manual",
      _region: "Trinidad & Tobago"
    }
  ],


  /*
     =========================================================
     KENYA

     =========================================================
  */

  KE: [],


  /*
     =========================================================
     JAMAICA
     =========================================================
  */

  JM: [],


  /*
     =========================================================
     BARBADOS
     =========================================================
  */

  BB: [],


  /*
     =========================================================
     ST. KITTS & NEVIS
     =========================================================
  */

  KN: [
    {
      stationuuid: "wazabanga-kn-ziz-radio",
      name: "ZIZ Radio",
      country: "St. Kitts & Nevis",
      countrycode: "KN",
      state: "Basseterre",
      language: "English",
      tags: "news,music,talk,st-kitts,nevis",

      url: "https://media.slactech.com:8014/stream",
      url_resolved: "https://media.slactech.com:8014/stream",

      favicon: "",
      homepage: "https://zizonline.com/",

      codec: "MP3",
      bitrate: 0,

      _verified: true,
      _verifiedBy: "Wazabanga",
      _verifiedDate: "2026-10-04",
      _catalogueSource: "KN recovery",
      _region: "Caribbean"
    }
  ]

};
