"use strict";

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const VERSION = "2.2.0";

const DEFAULT_LIMIT = 10;
const MAX_ATTEMPTS = 3;

const PLAY_SECONDS = 8;
const HARD_TIMEOUT_MS = 15000;
const RETRY_DELAY_MS = 1500;

const BROWSER_USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
    "AppleWebKit/537.36 (KHTML, like Gecko) " +
    "Chrome/154.0.0.0 Safari/537.36";

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function findFFmpeg() {
    const local = process.env.LOCALAPPDATA;

    if (!local) {
        throw new Error("LOCALAPPDATA is unavailable.");
    }

    const packageRoot = path.join(
        local,
        "Microsoft",
        "WinGet",
        "Packages",
        "Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe"
    );

    if (!fs.existsSync(packageRoot)) {
        throw new Error(
            "Gyan FFmpeg WinGet package directory not found."
        );
    }

    const candidates = [];

    for (
        const entry of fs.readdirSync(
            packageRoot,
            { withFileTypes: true }
        )
    ) {
        if (!entry.isDirectory()) continue;

        const executable = path.join(
            packageRoot,
            entry.name,
            "bin",
            "ffmpeg.exe"
        );

        if (fs.existsSync(executable)) {
            candidates.push(executable);
        }
    }

    if (candidates.length === 0) {
        throw new Error("ffmpeg.exe not found.");
    }

    candidates.sort();

    return candidates[candidates.length - 1];
}

function loadCatalogue(file) {
    const manifest =
        readJson(file);

    if (
        !manifest ||
        !Array.isArray(manifest.stations)
    ) {
        throw new Error(
            "Oceania discovery manifest does not contain a stations array."
        );
    }

    return manifest.stations;
}

function flattenCatalogue(catalogue) {
    return catalogue.slice();
}

function chooseSample(catalogue, limit) {
    const countries =
        Object.keys(catalogue);

    const sample = [];

    let round = 0;

    while (
        sample.length < limit &&
        countries.length > 0
    ) {
        let added = false;

        for (
            const code of countries
        ) {
            const stations =
                catalogue[code] || [];

            if (stations[round]) {
                sample.push(
                    stations[round]
                );

                added = true;

                if (
                    sample.length >= limit
                ) {
                    break;
                }
            }
        }

        if (!added) break;

        round++;
    }

    return sample;
}

function parseDecodedEvidence(stderr) {
    const text =
        stderr || "";

    const inputAudio =
        /Stream\s+#\d+:\d+.*Audio:/i.test(
            text
        );

    const outputAudio =
        /Stream\s+#\d+:\d+.*Audio:\s*pcm_/i.test(
            text
        ) ||
        /audio:\d+(?:\.\d+)?KiB/i.test(
            text
        );

    let decodedAudioKiB = null;

    const audioMatch =
        text.match(
            /audio:(\d+(?:\.\d+)?)KiB/i
        );

    if (audioMatch) {
        decodedAudioKiB =
            Number(audioMatch[1]);
    }

    let decodedSeconds = null;

    const timeMatches =
        [
            ...text.matchAll(
                /time=(\d+):(\d+):(\d+(?:\.\d+)?)/g
            )
        ];

    if (
        timeMatches.length > 0
    ) {
        const last =
            timeMatches[
                timeMatches.length - 1
            ];

        decodedSeconds =
            Number(last[1]) * 3600 +
            Number(last[2]) * 60 +
            Number(last[3]);
    }

    return {
        inputAudio,
        outputAudio,

        decodedAudioKiB,
        decodedSeconds,

        decodedBytesEvidence:
            Number.isFinite(
                decodedAudioKiB
            ) &&
            decodedAudioKiB > 0,

        decodedTimeEvidence:
            Number.isFinite(
                decodedSeconds
            ) &&
            decodedSeconds > 0
    };
}

function detectHttpStatus(stderr) {
    const text =
        stderr || "";

    const match =
        text.match(
            /(?:HTTP error|Server returned)\s+(\d{3})/i
        );

    if (!match) {
        return null;
    }

    return Number(match[1]);
}

function classifyAttempt({
    stderr,
    exitCode,
    timedOut,
    spawnError
}) {
    const evidence =
        parseDecodedEvidence(
            stderr
        );

    const httpStatus =
        detectHttpStatus(
            stderr
        );

    if (spawnError) {
        return {
            status: "FAILED",
            reason: "spawn-error",
            httpStatus,
            evidence
        };
    }

    if (
        exitCode === 0 &&
        evidence.inputAudio &&
        evidence.outputAudio &&
        (
            evidence.decodedTimeEvidence ||
            evidence.decodedBytesEvidence
        )
    ) {
        return {
            status: "PLAYING",
            reason:
                "decoded-audio-confirmed",
            httpStatus,
            evidence
        };
    }

    if (timedOut) {
        return {
            status: "FAILED",
            reason: "hard-timeout",
            httpStatus,
            evidence
        };
    }

    if (
        httpStatus === 401 ||
        httpStatus === 403
    ) {
        return {
            status: "ACCESS_DENIED",
            reason:
                "http-access-restricted",
            httpStatus,
            evidence
        };
    }

    if (
        httpStatus === 404 ||
        httpStatus === 410
    ) {
        return {
            status: "FAILED",
            reason:
                "http-source-not-found",
            httpStatus,
            evidence
        };
    }

    if (
        httpStatus !== null &&
        httpStatus >= 500 &&
        httpStatus <= 599
    ) {
        return {
            status: "FAILED",
            reason:
                "http-server-error",
            httpStatus,
            evidence
        };
    }

    if (
        httpStatus !== null &&
        httpStatus >= 400 &&
        httpStatus <= 499
    ) {
        return {
            status: "FAILED",
            reason:
                "http-client-error",
            httpStatus,
            evidence
        };
    }

    const lower =
        (stderr || "")
            .toLowerCase();

    if (
        /connection refused/.test(lower) ||
        /connection timed out/.test(lower) ||
        /network is unreachable/.test(lower) ||
        /temporary failure in name resolution/.test(lower) ||
        /could not resolve/.test(lower) ||
        /i\/o error/.test(lower)
    ) {
        return {
            status: "FAILED",
            reason:
                "network-failure",
            httpStatus,
            evidence
        };
    }

    if (
        /invalid data found/.test(lower) ||
        /error opening input/.test(lower) ||
        /could not find codec parameters/.test(lower)
    ) {
        return {
            status: "FAILED",
            reason:
                "media-failure",
            httpStatus,
            evidence
        };
    }

    if (
        exitCode === 0 &&
        evidence.inputAudio &&
        !(
            evidence.decodedTimeEvidence ||
            evidence.decodedBytesEvidence
        )
    ) {
        return {
            status: "NO_OUTPUT",
            reason:
                "audio-stream-without-decoded-output",
            httpStatus,
            evidence
        };
    }

    return {
        status: "FAILED",
        reason:
            exitCode === null
                ? "unknown-process-failure"
                : "ffmpeg-exit-" +
                  exitCode,
        httpStatus,
        evidence
    };
}

function buildHeadersForStation(
    station
) {
    let referer =
        "https://www.google.com/";

    try {
        const url =
            new URL(
                station.stream
            );

        referer =
            `${url.protocol}//${url.hostname}/`;
    }
    catch (_) {
    }

    return {
        userAgent:
            BROWSER_USER_AGENT,

        headers:
            "Referer: " +
            referer +
            "\r\n" +
            "Origin: " +
            referer.replace(/\/$/, "") +
            "\r\n" +
            "Accept: */*\r\n"
    };
}

function testAttempt(
    ffmpeg,
    station,
    attemptNumber,
    mode
) {
    return new Promise(
        resolve => {

            const args = [
                "-hide_banner",
                "-nostdin",
                "-loglevel",
                "info"
            ];

            if (
                mode ===
                "browser-headers"
            ) {
                const browser =
                    buildHeadersForStation(
                        station
                    );

                args.push(
                    "-user_agent",
                    browser.userAgent,
                    "-headers",
                    browser.headers
                );
            }

            args.push(
                "-rw_timeout",
                "10000000",

                "-i",
                station.stream,

                "-map",
                "0:a:0?",

                "-t",
                String(
                    PLAY_SECONDS
                ),

                "-vn",
                "-sn",
                "-dn",

                "-f",
                "null",
                "-"
            );

            const started =
                Date.now();

            let stderr = "";
            let timedOut = false;
            let finished = false;
            let spawnError = null;

            const child =
                spawn(
                    ffmpeg,
                    args,
                    {
                        windowsHide:
                            true
                    }
                );

            child.stderr.on(
                "data",
                chunk => {
                    stderr +=
                        chunk.toString(
                            "utf8"
                        );
                }
            );

            child.on(
                "error",
                error => {
                    spawnError =
                        error;
                }
            );

            const timer =
                setTimeout(
                    () => {
                        timedOut =
                            true;

                        try {
                            child.kill();
                        }
                        catch (_) {
                        }
                    },
                    HARD_TIMEOUT_MS
                );

            child.on(
                "close",
                code => {

                    if (finished) {
                        return;
                    }

                    finished = true;

                    clearTimeout(
                        timer
                    );

                    const verdict =
                        classifyAttempt({
                            stderr,
                            exitCode:
                                code,
                            timedOut,
                            spawnError
                        });

                    resolve({
                        attempt:
                            attemptNumber,

                        mode,

                        status:
                            verdict.status,

                        reason:
                            verdict.reason,

                        httpStatus:
                            verdict.httpStatus,

                        exitCode:
                            code,

                        timedOut,

                        elapsedMs:
                            Date.now() -
                            started,

                        evidence:
                            verdict.evidence,

                        error:
                            spawnError
                                ? spawnError.message
                                : null
                    });
                }
            );
        }
    );
}

async function testStation(
    ffmpeg,
    station
) {
    const attempts = [];

    let sawAccessDenied = false;
    let sawNoOutput = false;

    for (
        let attemptNumber = 1;
        attemptNumber <= MAX_ATTEMPTS;
        attemptNumber++
    ) {
        const attempt =
            await testAttempt(
                ffmpeg,
                station,
                attemptNumber,
                "standard"
            );

        attempts.push(
            attempt
        );

        if (
            attempt.status ===
            "PLAYING"
        ) {
            return {
                stationuuid:
                    station.stationuuid,

                name:
                    station.name,

                country:
                    station.country,

                countrycode:
                    station.countrycode,

                stream:
                    station.stream,

                status:
                    attemptNumber === 1
                        ? "PLAYING"
                        : "PLAYING_AFTER_RETRY",

                reason:
                    attemptNumber === 1
                        ? "decoded-audio-confirmed"
                        : "decoded-audio-confirmed-after-retry",

                attemptsUsed:
                    attempts.length,

                attempts
            };
        }

        if (
            attempt.status ===
            "ACCESS_DENIED"
        ) {
            sawAccessDenied =
                true;

            /*
             * A repeated standard request is unlikely
             * to fix deterministic 401/403 access policy.
             * Move directly to browser-header fallback.
             */
            break;
        }

        if (
            attempt.status ===
            "NO_OUTPUT"
        ) {
            sawNoOutput =
                true;
        }

        if (
            attemptNumber <
            MAX_ATTEMPTS
        ) {
            await sleep(
                RETRY_DELAY_MS
            );
        }
    }

    if (sawAccessDenied) {

        await sleep(
            RETRY_DELAY_MS
        );

        const fallback =
            await testAttempt(
                ffmpeg,
                station,
                attempts.length + 1,
                "browser-headers"
            );

        attempts.push(
            fallback
        );

        if (
            fallback.status ===
            "PLAYING"
        ) {
            return {
                stationuuid:
                    station.stationuuid,

                name:
                    station.name,

                country:
                    station.country,

                countrycode:
                    station.countrycode,

                stream:
                    station.stream,

                status:
                    "PLAYING_WITH_HEADERS",

                reason:
                    "decoded-audio-confirmed-with-browser-headers",

                attemptsUsed:
                    attempts.length,

                attempts
            };
        }

        if (
            fallback.status ===
            "NO_OUTPUT"
        ) {
            sawNoOutput =
                true;
        }

        if (
            fallback.status ===
            "ACCESS_DENIED"
        ) {
            return {
                stationuuid:
                    station.stationuuid,

                name:
                    station.name,

                country:
                    station.country,

                countrycode:
                    station.countrycode,

                stream:
                    station.stream,

                status:
                    "ACCESS_RESTRICTED",

                reason:
                    "http-access-restricted-after-browser-header-fallback",

                attemptsUsed:
                    attempts.length,

                attempts
            };
        }
    }

    return {
        stationuuid:
            station.stationuuid,

        name:
            station.name,

        country:
            station.country,

        countrycode:
            station.countrycode,

        stream:
            station.stream,

        status:
            sawNoOutput
                ? "NO_OUTPUT_CONFIRMED"
                : "FAILED_CONFIRMED",

        reason:
            sawNoOutput
                ? "no-decoded-output-after-retries"
                : "failed-after-retries",

        attemptsUsed:
            attempts.length,

        attempts
    };
}

function buildSummary(results) {
    const summary = {
        PLAYING: 0,
        PLAYING_AFTER_RETRY: 0,
        PLAYING_WITH_HEADERS: 0,
        NO_OUTPUT_CONFIRMED: 0,
        ACCESS_RESTRICTED: 0,
        FAILED_CONFIRMED: 0
    };

    for (
        const result of results
    ) {
        if (
            Object.prototype
                .hasOwnProperty.call(
                    summary,
                    result.status
                )
        ) {
            summary[
                result.status
            ]++;
        }
    }

    summary.USABLE =
        summary.PLAYING +
        summary.PLAYING_AFTER_RETRY +
        summary.PLAYING_WITH_HEADERS;

    summary.NOT_CONFIRMED_PLAYING =
        summary.NO_OUTPUT_CONFIRMED +
        summary.ACCESS_RESTRICTED +
        summary.FAILED_CONFIRMED;

    return summary;
}

function atomicWriteJson(file, data) {
    const directory =
        path.dirname(file);

    fs.mkdirSync(
        directory,
        {
            recursive: true
        }
    );

    const tempFile =
        file + ".tmp";

    if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
    }

    fs.writeFileSync(
        tempFile,
        JSON.stringify(
            data,
            null,
            2
        ) + "\n",
        {
            encoding: "utf8",
            flag: "wx"
        }
    );

    fs.renameSync(
        tempFile,
        file
    );
}

function readJson(file) {
    return JSON.parse(
        fs.readFileSync(
            file,
            "utf8"
        )
    );
}

function getCheckpointFiles(directory) {
    if (!fs.existsSync(directory)) {
        return [];
    }

    return fs.readdirSync(directory)
        .filter(
            name =>
                /^batch-\d{4}-\d{4}\.json$/i.test(
                    name
                )
        )
        .sort();
}

function validateCheckpoint(
    checkpoint,
    expectedCatalogue,
    totalStations
) {
    if (
        checkpoint.tool !==
        "Wazabanga Playback Auditor"
    ) {
        throw new Error(
            "Invalid checkpoint tool."
        );
    }

    if (
        checkpoint.version !== VERSION
    ) {
        throw new Error(
            "Checkpoint version mismatch."
        );
    }

    if (
        path.resolve(
            checkpoint.sourceCatalogue
        ) !==
        path.resolve(
            expectedCatalogue
        )
    ) {
        throw new Error(
            "Checkpoint catalogue mismatch."
        );
    }

    if (
        checkpoint.totalCatalogueStations !==
        totalStations
    ) {
        throw new Error(
            "Checkpoint catalogue-size mismatch."
        );
    }

    if (
        !Number.isInteger(
            checkpoint.startIndex
        ) ||
        !Number.isInteger(
            checkpoint.endIndex
        ) ||
        checkpoint.startIndex < 0 ||
        checkpoint.endIndex <
            checkpoint.startIndex
    ) {
        throw new Error(
            "Invalid checkpoint range."
        );
    }

    const expectedCount =
        checkpoint.endIndex -
        checkpoint.startIndex +
        1;

    if (
        !Array.isArray(
            checkpoint.results
        ) ||
        checkpoint.results.length !==
        expectedCount
    ) {
        throw new Error(
            "Checkpoint result count mismatch."
        );
    }

    for (
        let i = 0;
        i < checkpoint.results.length;
        i++
    ) {
        const result =
            checkpoint.results[i];

        const expectedIndex =
            checkpoint.startIndex + i;

        if (
            result.catalogueIndex !==
            expectedIndex
        ) {
            throw new Error(
                "Checkpoint catalogue index mismatch."
            );
        }
    }
}

function summarizeAll(results) {
    return buildSummary(
        results
    );
}

async function main() {
    const catalogueFile =
        path.resolve(
            process.argv[2] ||
            path.join(
                process.cwd(),
                "radio",
                "tools", "discovery", "oceania-discovery.json"
            )
        );

    const batchSizeArgument =
        process.argv[3];

    const batchSize =
        batchSizeArgument
            ? Number(
                batchSizeArgument
            )
            : 100;

    if (
        !Number.isInteger(
            batchSize
        ) ||
        batchSize < 1
    ) {
        throw new Error(
            "Batch size must be a positive integer."
        );
    }

    if (
        !fs.existsSync(
            catalogueFile
        )
    ) {
        throw new Error(
            "Catalogue not found: " +
            catalogueFile
        );
    }

    const ffmpeg =
        findFFmpeg();

    const catalogue =
        loadCatalogue(
            catalogueFile
        );

    /*
     * v2.2 deliberately uses the catalogue's
     * deterministic flattened order.
     *
     * Every station receives exactly one
     * zero-based catalogueIndex.
     */
    const allStations =
        flattenCatalogue(
            catalogue
        );

    const totalStations =
        allStations.length;

    if (
        totalStations === 0
    ) {
        throw new Error(
            "Catalogue contains no stations."
        );
    }

    const checkpointDirectory =
        path.join(
            process.cwd(),
            "radio",
            "tools",
            "playback-results",
            "oceania-v1-checkpoints"
        );

    fs.mkdirSync(
        checkpointDirectory,
        {
            recursive: true
        }
    );

    /*
     * Resume discovery.
     *
     * Existing checkpoints must form one exact,
     * contiguous sequence beginning at index 0.
     */
    const checkpointFiles =
        getCheckpointFiles(
            checkpointDirectory
        );

    const existingResults = [];

    let nextIndex = 0;

    for (
        const fileName of checkpointFiles
    ) {
        const fullPath =
            path.join(
                checkpointDirectory,
                fileName
            );

        const checkpoint =
            readJson(
                fullPath
            );

        validateCheckpoint(
            checkpoint,
            catalogueFile,
            totalStations
        );

        if (
            checkpoint.startIndex !==
            nextIndex
        ) {
            throw new Error(
                "Checkpoint sequence is not contiguous at " +
                fileName +
                ". Expected start index " +
                nextIndex +
                ", found " +
                checkpoint.startIndex +
                "."
            );
        }

        existingResults.push(
            ...checkpoint.results
        );

        nextIndex =
            checkpoint.endIndex + 1;
    }

    if (
        nextIndex >
        totalStations
    ) {
        throw new Error(
            "Checkpoint data exceeds catalogue size."
        );
    }

    console.log("");
    console.log(
        "WAZABANGA PLAYBACK AUDITOR v2.2"
    );
    console.log(
        "==============================="
    );

    console.log(
        "Version:",
        VERSION
    );

    console.log(
        "FFmpeg:",
        ffmpeg
    );

    console.log(
        "Catalogue:",
        catalogueFile
    );

    console.log(
        "Catalogue stations:",
        totalStations
    );

    console.log(
        "Batch size:",
        batchSize
    );

    console.log(
        "Completed stations:",
        nextIndex
    );

    console.log(
        "Remaining stations:",
        totalStations - nextIndex
    );

    console.log(
        "Checkpoint directory:",
        checkpointDirectory
    );

    console.log(
        "Maximum standard attempts:",
        MAX_ATTEMPTS
    );

    console.log(
        "Browser-header fallback:",
        "401/403 only"
    );

    console.log(
        "Decode window:",
        PLAY_SECONDS,
        "seconds"
    );

    console.log("");

    if (
        nextIndex === totalStations
    ) {
        const summary =
            summarizeAll(
                existingResults
            );

        console.log(
            "Catalogue audit already complete."
        );

        console.log("");
        console.log("RESULTS");
        console.log("-------");

        for (
            const key of [
                "PLAYING",
                "PLAYING_AFTER_RETRY",
                "PLAYING_WITH_HEADERS",
                "NO_OUTPUT_CONFIRMED",
                "ACCESS_RESTRICTED",
                "FAILED_CONFIRMED",
                "USABLE",
                "NOT_CONFIRMED_PLAYING"
            ]
        ) {
            console.log(
                key.padEnd(24),
                summary[key]
            );
        }

        return;
    }

    const startIndex =
        nextIndex;

    const endIndex =
        Math.min(
            startIndex +
            batchSize -
            1,
            totalStations - 1
        );

    const batchResults = [];

    console.log(
        "Current batch:",
        `${startIndex}-${endIndex}`
    );

    console.log(
        "Stations this batch:",
        endIndex -
        startIndex +
        1
    );

    console.log("");

    for (
        let index = startIndex;
        index <= endIndex;
        index++
    ) {
        const station =
            allStations[index];

        console.log(
            `[${index + 1}/${totalStations}]`,
            station.countrycode,
            "-",
            station.name
        );

        const result =
            await testStation(
                ffmpeg,
                station
            );

        const indexedResult = {
            catalogueIndex:
                index,

            ...result
        };

        batchResults.push(
            indexedResult
        );

        console.log(
            "    ",
            result.status,
            "-",
            result.reason,
            "- attempts:",
            result.attemptsUsed
        );

        for (
            const attempt of
            result.attempts
        ) {
            const http =
                attempt.httpStatus
                    ? ` HTTP=${attempt.httpStatus}`
                    : "";

            console.log(
                "       attempt",
                attempt.attempt,
                `[${attempt.mode}]`,
                "=>",
                attempt.status,
                "/",
                attempt.reason +
                    http,
                "/",
                attempt.elapsedMs +
                    "ms"
            );
        }
    }

    const batchSummary =
        summarizeAll(
            batchResults
        );

    const checkpoint = {
        tool:
            "Wazabanga Playback Auditor",

        version:
            VERSION,

        generatedAt:
            new Date()
                .toISOString(),

        sourceCatalogue:
            catalogueFile,

        totalCatalogueStations:
            totalStations,

        batchSize,

        startIndex,
        endIndex,

        stationCount:
            batchResults.length,

        configuration: {
            maximumStandardAttempts:
                MAX_ATTEMPTS,

            browserHeaderFallback:
                "HTTP 401/403 only",

            decodeSeconds:
                PLAY_SECONDS,

            hardTimeoutMs:
                HARD_TIMEOUT_MS,

            retryDelayMs:
                RETRY_DELAY_MS
        },

        summary:
            batchSummary,

        results:
            batchResults
    };

    const checkpointFile =
        path.join(
            checkpointDirectory,
            "batch-" +
            String(startIndex)
                .padStart(4, "0") +
            "-" +
            String(endIndex)
                .padStart(4, "0") +
            ".json"
        );

    if (
        fs.existsSync(
            checkpointFile
        )
    ) {
        throw new Error(
            "Checkpoint already exists: " +
            checkpointFile
        );
    }

    atomicWriteJson(
        checkpointFile,
        checkpoint
    );

    /*
     * Re-read the checkpoint immediately.
     * This verifies the completed write before
     * we report the batch as committed.
     */
    const verify =
        readJson(
            checkpointFile
        );

    validateCheckpoint(
        verify,
        catalogueFile,
        totalStations
    );

    const combinedResults = [
        ...existingResults,
        ...batchResults
    ];

    const combinedSummary =
        summarizeAll(
            combinedResults
        );

    console.log("");
    console.log("BATCH RESULTS");
    console.log("-------------");

    for (
        const key of [
            "PLAYING",
            "PLAYING_AFTER_RETRY",
            "PLAYING_WITH_HEADERS",
            "NO_OUTPUT_CONFIRMED",
            "ACCESS_RESTRICTED",
            "FAILED_CONFIRMED",
            "USABLE",
            "NOT_CONFIRMED_PLAYING"
        ]
    ) {
        console.log(
            key.padEnd(24),
            batchSummary[key]
        );
    }

    console.log("");
    console.log("CHECKPOINT");
    console.log("----------");
    console.log(
        checkpointFile
    );

    console.log("");
    console.log(
        "Checkpoint verification: PASS"
    );

    console.log("");
    console.log("OVERALL PROGRESS");
    console.log("----------------");

    console.log(
        "Completed:",
        combinedResults.length,
        "/",
        totalStations
    );

    console.log(
        "Remaining:",
        totalStations -
        combinedResults.length
    );

    console.log(
        "USABLE:",
        combinedSummary.USABLE
    );

    console.log(
        "NOT_CONFIRMED_PLAYING:",
        combinedSummary
            .NOT_CONFIRMED_PLAYING
    );

    console.log("");

    if (
        combinedResults.length ===
        totalStations
    ) {
        console.log(
            "FULL OCEANIA PLAYBACK AUDIT COMPLETE"
        );
    }
    else {
        console.log(
            "BATCH COMPLETE - run the same command again to resume."
        );
    }

    console.log(
        "==============================="
    );
}

main().catch(error => {
    console.error("");
    console.error(
        "STOP:",
        error.message
    );

    process.exit(1);
});
