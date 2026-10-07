const fs = require("fs");

const candidatePath = process.argv[2];
const outputPath = process.argv[3];

if (!candidatePath || !outputPath) {
  throw new Error("Usage: node builder <candidate> <output>");
}

const candidate = JSON.parse(
  fs.readFileSync(candidatePath, "utf8")
);

if (!Array.isArray(candidate.stations)) {
  throw new Error("Candidate stations array missing.");
}

if (candidate.stations.length !== 330) {
  throw new Error(
    `Expected 330 candidate stations, got ${candidate.stations.length}.`
  );
}

const COUNTRY_KEYS = ["AU", "NZ"];

const catalogue = {
  AU: [],
  NZ: []
};

function countryCode(station) {
  return String(
    station.countrycode ??
    station.countryCode ??
    ""
  ).trim().toUpperCase();
}

function streamUrl(station) {
  return String(
    station.stream ??
    station.url_resolved ??
    station.url ??
    ""
  ).trim();
}

for (const station of candidate.stations) {
  const code = countryCode(station);

  if (!COUNTRY_KEYS.includes(code)) {
    throw new Error(`Unexpected country code: ${code}`);
  }

  const record = {
    stationuuid: String(station.stationuuid ?? ""),
    name: String(station.name ?? ""),
    stream: streamUrl(station),
    homepage: String(station.homepage ?? ""),
    favicon: String(station.favicon ?? ""),
    tags: String(station.tags ?? ""),
    language: String(station.language ?? ""),
    codec: String(station.codec ?? ""),
    bitrate: Number(station.bitrate ?? 0)
  };

  if (!record.stationuuid) {
    throw new Error("Empty stationuuid.");
  }

  if (!record.stream) {
    throw new Error(`Empty stream for ${record.stationuuid}.`);
  }

  if (!/^https:\/\//i.test(record.stream)) {
    throw new Error(`Non-HTTPS stream: ${record.stream}`);
  }

  catalogue[code].push(record);
}

if (catalogue.AU.length !== 194) {
  throw new Error(
    `Expected AU=194, got ${catalogue.AU.length}.`
  );
}

if (catalogue.NZ.length !== 136) {
  throw new Error(
    `Expected NZ=136, got ${catalogue.NZ.length}.`
  );
}

const all = [...catalogue.AU, ...catalogue.NZ];

if (all.length !== 330) {
  throw new Error(`Expected 330 runtime records, got ${all.length}.`);
}

const uuidCounts = new Map();
const streamCounts = new Map();

for (const station of all) {
  uuidCounts.set(
    station.stationuuid,
    (uuidCounts.get(station.stationuuid) || 0) + 1
  );

  streamCounts.set(
    station.stream,
    (streamCounts.get(station.stream) || 0) + 1
  );
}

const duplicateUUIDs =
  [...uuidCounts.values()].filter(n => n > 1).length;

const duplicateStreams =
  [...streamCounts.values()].filter(n => n > 1).length;

if (duplicateUUIDs !== 0) {
  throw new Error(`Duplicate UUID groups: ${duplicateUUIDs}`);
}

if (duplicateStreams !== 0) {
  throw new Error(`Duplicate stream groups: ${duplicateStreams}`);
}

const js =
  "const WAZABANGA_OCEANIA_STATIONS = " +
  JSON.stringify(catalogue, null, 2) +
  ";\n";

const tmp = outputPath + ".tmp";

fs.writeFileSync(tmp, js, "utf8");

/*
 * Verify generated JS without evaluating arbitrary source.
 * Strip the fixed declaration and trailing semicolon,
 * then parse the remaining JSON payload.
 */
const written = fs.readFileSync(tmp, "utf8");

const prefix = "const WAZABANGA_OCEANIA_STATIONS = ";
const suffix = ";\n";

if (!written.startsWith(prefix) || !written.endsWith(suffix)) {
  fs.unlinkSync(tmp);
  throw new Error("Generated catalogue wrapper invalid.");
}

const payload = written.slice(
  prefix.length,
  written.length - suffix.length
);

const parsed = JSON.parse(payload);

if (
  !Array.isArray(parsed.AU) ||
  !Array.isArray(parsed.NZ) ||
  parsed.AU.length !== 194 ||
  parsed.NZ.length !== 136
) {
  fs.unlinkSync(tmp);
  throw new Error("Generated catalogue reread verification failed.");
}

const keys = Object.keys(parsed);

if (
  keys.length !== 2 ||
  keys[0] !== "AU" ||
  keys[1] !== "NZ"
) {
  fs.unlinkSync(tmp);
  throw new Error(
    `Unexpected runtime keys: ${keys.join(",")}`
  );
}

fs.renameSync(tmp, outputPath);

console.log("");
console.log("RUNTIME CATALOGUE");
console.log("-----------------");
console.log(`AU:                     ${catalogue.AU.length}`);
console.log(`NZ:                     ${catalogue.NZ.length}`);
console.log(`Total:                  ${all.length}`);
console.log(`Duplicate UUID groups:  ${duplicateUUIDs}`);
console.log(`Duplicate stream groups:${duplicateStreams}`);
console.log("");
console.log("WAZABANGA_OCEANIA_STATIONS: CREATED");
console.log("OCEANIA v1.8 RUNTIME CATALOGUE BUILD: PASS");