const { spawn } = require("child_process");
const { Readable } = require("stream");
const readline = require("readline");
const fs = require("fs");

const archive = require("rclone-archive");

const lsjson = require("./lsjson.js");

require("nvar")();

/**
 * @typedef {import('./lib/File.js')} File
 */

// The log from `nyuu` has lines for upload info.
// For example: Uploading 4137 article(s) from 1 file(s) totalling 2827.49 MiB.
const UPLOAD_INFO_REGEX = /Uploading (?<articles>[\d]+) article\(s\) from (?<files>[\d]+) file\(s\) totalling (?<totalSize>[\d.]+ (?:K|M|G)iB)/;
// Log lines with progress data.
const PROGRESS_REGEX = /Article posting progress: (?<read>[\d]+) read, (?<posted>[\d]+) posted(?:, (?<checked>[\d]+) checked)?/

const OPTIONS = {
  /** @type {(File) => string} */
  "filename": ({ Name }) => Name,
  "archive": false, // Whether to store all input files into an archive.
  "check-connections": 1, // Post checking with 1 connection by default.
}

// Maps environment variables to default options if any.
Object.keys(process.env).forEach(key => {
  if (key.indexOf("USENET_POST_") > -1) {
    const value = process.env[key];
    key = key.replace("USENET_POST_", "").toLowerCase().replace(/_/g, "-");
    OPTIONS[key] = value;
  }
});

/**
 * Uploads a folder or file into a single NZB.
 * @param {string} sourcePath Path to the source folder/file to upload
 * @param {Object} options Upload options.
 */
module.exports = async function nugu(sourcePath, options = {}) {
  options = {
    ...OPTIONS,
    ...options,
  };

  // Saves the user-specified output option.
  const output = options.out;
  // But asks the uploader to always output to stdout so we can intercept.
  options.out = "-";

  const filename = options.filename;
  // `filename` option expects a function.
  if (typeof filename === "string") {
    options.filename = function(_file) { return filename; }
  }

  const progress = options.progress;
  // When the `progress` option is a function, we can't pass it to nyuu.
  if (typeof options.progress === "function") {
    // Then we set Nyuu to output progress to its log instead of stderr,
    // since we can't handle ASCII escaping sequences there.
    options.progress = "log:2s";
  }

  const files = await lsjson(sourcePath);
  const archiveFile = options.archive;
  delete options.archive;

  let filelist;
  if (archiveFile) {
    // Dry runs creating an archive with the files to get the archive size.
    const file = await archive(files, "/dev/null", {
      dryRun: true,
    });
    const { Size } = file;
    const Name = options.filename(file);
    // Tells nyuu to run `rclone archive` command, available through `rclone-archive`.
    filelist = `procjson://"${ Name }",${ Size },"npx rclone archive -- '${ sourcePath }' -"`;
  } else {
    // Converts the file list into a string, one file per line.
    filelist = files.map((file) => {
      const { Path, AbsolutePath, Size } = file;
      // Lets the `filename` option rename it if needed. Default to file's `Name`.
      const Name = options.filename(file);
      return `procjson://"${ Name }",${ Size },"npx rclone cat '${ AbsolutePath }'"`;
    }).join("\n");
  }

  // Input file from stdin that we pipe our file list to.
  options["input-file"] = "-";

  const args = ["nyuu"];

  // Converts options to string params.
  Object.keys(options).forEach(key => {
    args.push(`--${ key }`);
    const value = options[key];

    if (typeof value !== "boolean") {
      args.push(`${ value }`);
    }
  });

  // Toggles the SSL flag for secure ports.
  if ([563, 443].indexOf(parseInt(options.port)) > -1) {
    args.push("--ssl");
  }

  const subprocess = spawn("npx", args, {
    // We needs to pipe `stdin`, but only pipe `stdout` when the user requests
    // it. `stderr` is always sent to the real TTY.
    stdio: ["pipe", output === "-" ? "inherit" : "pipe", "inherit"],
  });

  const { stdin, stdout, stderr } = subprocess;
  // Sends input to the subprocess.
  Readable.from(filelist).pipe(stdin);

  if (output === "-") {
    // Does nothing, as the output is already sent to process' `stdout`.
    return subprocess;
  } else if (output) {
    // Sends output to the file stream.
    stdout.pipe(fs.createWriteStream(output));
    return subprocess;
  } else {
    if (typeof progress === "function") {
      // By default, progress is output to stderr.
      const progressStream = readline.createInterface({
        input: stderr,
      });

      // Progress data.
      const data = {
        files: 0,
        articles: 0,
        totalSize: 0,
        read: 0,
        posted: 0,
        checked: 0,
      };

      // Parses lines of Nyuu's logs for progress data.
      progressStream.on("line", (line) => {
        line = line.replace(/[\W+]\s/, "");

        const uploadInfo = line.match(UPLOAD_INFO_REGEX);
        if (uploadInfo) {
          Object.assign(data, uploadInfo.groups);
        } else {
          const progressInfo = line.match(PROGRESS_REGEX);
          if (progressInfo) {
            Object.assign(data, progressInfo.groups);
          }
        }

        progress(data);
      });
    }

    return new Promise((resolve, reject) => {
      const chunks = [];
      stdout.on("data", (chunk) => {
        chunks.push(chunk);
      });
      stdout.on("end", () => {
        resolve(Buffer.concat(chunks));
      });
    });
  }
}
