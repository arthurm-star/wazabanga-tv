/*
  WAZABANGA RADIO
  Globe Intelligence Layer
  Version: 1.2 Phase 1

  PURPOSE
  -------
  Geographic intelligence for the Wazabanga globe.

  IMPORTANT
  ---------
  This file does NOT control:
  - radio playback
  - navigation
  - browser history
  - station validation
  - catalogues
  - REGION_MAP

  REGION_MAP in radio.js remains the authoritative
  Wazabanga browsing taxonomy.

  Coordinates are approximate geographic centres
  for visual globe positioning only.
*/

(function () {
  "use strict";

  const CONTINENTS = {

    "africa": {
      name: "Africa",
      center: { lat: 1.5, lon: 17.5 },
      countries: {

        AO: { name: "Angola", lat: -12.5, lon: 18.5 },
        BF: { name: "Burkina Faso", lat: 12.3, lon: -1.6 },
        BJ: { name: "Benin", lat: 9.3, lon: 2.3 },
        BI: { name: "Burundi", lat: -3.4, lon: 29.9 },
        CD: { name: "Democratic Republic of the Congo", lat: -2.9, lon: 23.7 },
        CF: { name: "Central African Republic", lat: 6.6, lon: 20.9 },
        CG: { name: "Republic of the Congo", lat: -0.2, lon: 15.8 },
        CI: { name: "Côte d'Ivoire", lat: 7.5, lon: -5.5 },
        CM: { name: "Cameroon", lat: 5.7, lon: 12.7 },
        CV: { name: "Cape Verde", lat: 16.0, lon: -24.0 },
        DZ: { name: "Algeria", lat: 28.0, lon: 2.6 },
        EG: { name: "Egypt", lat: 26.8, lon: 30.8 },
        ER: { name: "Eritrea", lat: 15.2, lon: 39.8 },
        ET: { name: "Ethiopia", lat: 9.1, lon: 40.5 },
        GH: { name: "Ghana", lat: 7.9, lon: -1.0 },
        GN: { name: "Guinea", lat: 10.4, lon: -10.9 },
        GQ: { name: "Equatorial Guinea", lat: 1.7, lon: 10.3 },
        GW: { name: "Guinea-Bissau", lat: 12.0, lon: -15.2 },
        KE: { name: "Kenya", lat: 0.0, lon: 37.9 },
        LR: { name: "Liberia", lat: 6.4, lon: -9.4 },
        LS: { name: "Lesotho", lat: -29.6, lon: 28.2 },
        LY: { name: "Libya", lat: 26.3, lon: 17.2 },
        MA: { name: "Morocco", lat: 31.8, lon: -7.1 },
        MG: { name: "Madagascar", lat: -18.8, lon: 46.9 },
        ML: { name: "Mali", lat: 17.6, lon: -4.0 },
        MR: { name: "Mauritania", lat: 21.0, lon: -10.9 },
        MU: { name: "Mauritius", lat: -20.3, lon: 57.6 },
        MW: { name: "Malawi", lat: -13.3, lon: 34.3 },
        MZ: { name: "Mozambique", lat: -18.7, lon: 35.5 },
        NA: { name: "Namibia", lat: -22.6, lon: 17.1 },
        NG: { name: "Nigeria", lat: 9.1, lon: 8.7 },
        RW: { name: "Rwanda", lat: -1.9, lon: 29.9 },
        SC: { name: "Seychelles", lat: -4.7, lon: 55.5 },
        SD: { name: "Sudan", lat: 12.9, lon: 30.2 },
        SL: { name: "Sierra Leone", lat: 8.5, lon: -11.8 },
        SN: { name: "Senegal", lat: 14.5, lon: -14.5 },
        SO: { name: "Somalia", lat: 5.2, lon: 46.2 },
        SS: { name: "South Sudan", lat: 7.9, lon: 30.0 },
        ST: { name: "São Tomé and Príncipe", lat: 0.2, lon: 6.6 },
        SZ: { name: "Eswatini", lat: -26.5, lon: 31.5 },
        TD: { name: "Chad", lat: 15.5, lon: 18.7 },
        TG: { name: "Togo", lat: 8.6, lon: 1.2 },
        TN: { name: "Tunisia", lat: 34.0, lon: 9.5 },
        TZ: { name: "Tanzania", lat: -6.4, lon: 34.9 },
        UG: { name: "Uganda", lat: 1.4, lon: 32.3 },
        ZA: { name: "South Africa", lat: -30.6, lon: 22.9 },
        ZM: { name: "Zambia", lat: -13.1, lon: 27.8 },
        ZW: { name: "Zimbabwe", lat: -19.0, lon: 29.2 }

      }
    },

    "asia": {
      name: "Asia",
      center: { lat: 29.5, lon: 85.0 },
      countries: {

        AE: { name: "United Arab Emirates", lat: 23.4, lon: 53.8 },
        BD: { name: "Bangladesh", lat: 23.7, lon: 90.4 },
        BH: { name: "Bahrain", lat: 26.0, lon: 50.6 },
        ID: { name: "Indonesia", lat: -2.5, lon: 118.0 },
        IL: { name: "Israel", lat: 31.0, lon: 34.9 },
        IN: { name: "India", lat: 20.6, lon: 79.0 },
        JO: { name: "Jordan", lat: 31.2, lon: 36.5 },
        JP: { name: "Japan", lat: 36.2, lon: 138.3 },
        KR: { name: "South Korea", lat: 36.5, lon: 127.9 },
        KW: { name: "Kuwait", lat: 29.3, lon: 47.5 },
        LB: { name: "Lebanon", lat: 33.9, lon: 35.9 },
        MY: { name: "Malaysia", lat: 4.2, lon: 102.0 },
        OM: { name: "Oman", lat: 21.5, lon: 55.9 },
        PH: { name: "Philippines", lat: 12.9, lon: 121.8 },
        PK: { name: "Pakistan", lat: 30.4, lon: 69.3 },
        QA: { name: "Qatar", lat: 25.4, lon: 51.2 },
        SA: { name: "Saudi Arabia", lat: 23.9, lon: 45.1 },
        SG: { name: "Singapore", lat: 1.35, lon: 103.8 },
        TH: { name: "Thailand", lat: 15.9, lon: 101.0 },
        TR: { name: "Turkey", lat: 39.0, lon: 35.2 },
        VN: { name: "Vietnam", lat: 14.1, lon: 108.3 }

      }
    },

    "europe": {
      name: "Europe",
      center: { lat: 54.0, lon: 15.0 },
      countries: {

        AT: { name: "Austria", lat: 47.5, lon: 14.6 },
        BE: { name: "Belgium", lat: 50.5, lon: 4.5 },
        CH: { name: "Switzerland", lat: 46.8, lon: 8.2 },
        DE: { name: "Germany", lat: 51.2, lon: 10.5 },
        DK: { name: "Denmark", lat: 56.3, lon: 9.5 },
        ES: { name: "Spain", lat: 40.5, lon: -3.7 },
        FI: { name: "Finland", lat: 61.9, lon: 25.7 },
        FR: { name: "France", lat: 46.2, lon: 2.2 },
        GB: { name: "United Kingdom", lat: 55.4, lon: -3.4 },
        GR: { name: "Greece", lat: 39.1, lon: 21.8 },
        IE: { name: "Ireland", lat: 53.1, lon: -8.2 },
        IT: { name: "Italy", lat: 41.9, lon: 12.6 },
        NL: { name: "Netherlands", lat: 52.1, lon: 5.3 },
        NO: { name: "Norway", lat: 60.5, lon: 8.5 },
        PL: { name: "Poland", lat: 51.9, lon: 19.1 },
        PT: { name: "Portugal", lat: 39.4, lon: -8.2 },
        SE: { name: "Sweden", lat: 60.1, lon: 18.6 }

      }
    },

    "north-america": {
      name: "North America",
      center: { lat: 28.0, lon: -85.0 },
      countries: {

        AG: { name: "Antigua & Barbuda", lat: 17.1, lon: -61.8 },
        BB: { name: "Barbados", lat: 13.2, lon: -59.5 },
        BS: { name: "Bahamas", lat: 25.0, lon: -77.4 },
        CA: { name: "Canada", lat: 56.1, lon: -106.3 },
        CR: { name: "Costa Rica", lat: 9.7, lon: -83.8 },
        CU: { name: "Cuba", lat: 21.5, lon: -79.4 },
        DM: { name: "Dominica", lat: 15.4, lon: -61.4 },
        DO: { name: "Dominican Republic", lat: 18.7, lon: -70.2 },
        GD: { name: "Grenada", lat: 12.1, lon: -61.7 },
        GT: { name: "Guatemala", lat: 15.8, lon: -90.2 },
        HT: { name: "Haiti", lat: 19.0, lon: -72.3 },
        JM: { name: "Jamaica", lat: 18.1, lon: -77.3 },
        KN: { name: "Saint Kitts & Nevis", lat: 17.3, lon: -62.7 },
        LC: { name: "Saint Lucia", lat: 13.9, lon: -61.0 },
        MX: { name: "Mexico", lat: 23.6, lon: -102.6 },
        PA: { name: "Panama", lat: 8.5, lon: -80.8 },
        PR: { name: "Puerto Rico", lat: 18.2, lon: -66.6 },
        TT: { name: "Trinidad & Tobago", lat: 10.7, lon: -61.2 },
        US: { name: "United States", lat: 39.8, lon: -98.6 },
        VC: { name: "Saint Vincent & the Grenadines", lat: 13.3, lon: -61.2 }

      }
    },

    "south-america": {
      name: "South America",
      center: { lat: -15.0, lon: -60.0 },
      countries: {

        AR: { name: "Argentina", lat: -38.4, lon: -63.6 },
        BR: { name: "Brazil", lat: -14.2, lon: -51.9 },
        CL: { name: "Chile", lat: -33.4, lon: -70.7 },
        CO: { name: "Colombia", lat: 4.6, lon: -74.3 },
        PE: { name: "Peru", lat: -9.2, lon: -75.0 },
        VE: { name: "Venezuela", lat: 6.4, lon: -66.6 }

      }
    },

    "oceania": {
      name: "Australia / Oceania",
      center: { lat: -25.0, lon: 140.0 },
      countries: {

        AU: { name: "Australia", lat: -25.3, lon: 133.8 },
        NZ: { name: "New Zealand", lat: -40.9, lon: 174.9 }

      }
    },

    "antarctica": {
      name: "Antarctica",
      center: { lat: -82.0, lon: 0.0 },
      countries: {}
    }

  };

  /*
    Build a fast country-code index.

    This allows later globe phases to ask:

      WAZABANGA_GLOBE.getCountry("UG")
      WAZABANGA_GLOBE.getCountry("TT")

    without searching every continent.
  */

  const COUNTRY_INDEX = {};

  Object.entries(CONTINENTS).forEach(
    ([continentKey, continent]) => {

      Object.entries(continent.countries).forEach(
        ([code, country]) => {

          COUNTRY_INDEX[code] = {
            code,
            name: country.name,
            lat: country.lat,
            lon: country.lon,
            continentKey,
            continent: continent.name
          };

        }
      );

    }
  );

  /*
    Public read-only globe intelligence API.
  */

  window.WAZABANGA_GLOBE = Object.freeze({

    version: "1.2-phase1",

    continents: CONTINENTS,

    countries: COUNTRY_INDEX,

    getCountry(code) {

      const normalized =
        String(code || "")
          .trim()
          .toUpperCase();

      return COUNTRY_INDEX[normalized] || null;
    },

    getContinent(key) {

      const normalized =
        String(key || "")
          .trim()
          .toLowerCase();

      return CONTINENTS[normalized] || null;
    },

    getCountriesForContinent(key) {

      const continent =
        this.getContinent(key);

      if (!continent) {
        return [];
      }

      return Object.entries(continent.countries).map(
        ([code, country]) => ({
          code,
          name: country.name,
          lat: country.lat,
          lon: country.lon
        })
      );
    },

    getAllCountries() {

      return Object.values(COUNTRY_INDEX);
    }

  });

})();
