const { join } = require("path");
const { spawn } = require("child_process");
const { Readable } = require("stream");
const readline = require("readline");

const rclone = require("rclone.js").promises;

require("nvar")();

// The log from `nyuu` has lines for upload info.
// For example: Uploading 4137 article(s) from 1 file(s) totalling 2827.49 MiB.
const UPLOAD_INFO_REGEX = /Uploading (?<articles>[\d]+) article\(s\) from (?<files>[\d]+) file\(s\) totalling (?<totalSize>[\d.]+ (?:K|M|G)iB)/;
// Log lines with progress data.
const PROGRESS_REGEX = /Article posting progress: (?<read>[\d]+) read, (?<posted>[\d]+) posted(?:, (?<checked>[\d]+) checked)?/

/**
 * A file from a remote.
 * @typedef {Object} File
 * @property {!string} Path - The relative path of the file.
 * @property {!string} Name - The file name.
 * @property {!number} Size - The size of the file.
 * @property {string} [ID] - The ID of this file object. Not defined for local file.
 */

const OPTIONS = {
  /** @type {(File) => string} */
  filename: ({ Name }) => Name,
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
 * Get list of file stats from a path
 * @param {string} path The path to the file or folder.
 * @returns {Promise<File[]>} The file list in JSON format.
 */
async function lsjson(path) {
  const result = await rclone.lsjson(
    path,
    "-R", "--files-only",
    "--no-mimetype", "--no-modtime",
  );
  return JSON.parse(result);
}

/**
 * Uploads a folder or file into a single NZB.
 * @param {string} sourcePath Path to the source folder/file to upload
 * @param {Object} options Upload options.
 */
module.exports = async function(sourcePath, options = {}) {
  options = {
    ...OPTIONS,
    ...options,
  };

  // Saves the user-specified output option.
  const output = options.out;
  // But asks the uploader to always output to stdout.
  options.out = "-";

  const progress = options.progress;
  // When the `progress` option is a function, we can't pass it to nyuu.
  if (typeof options.progress === "function") {
    // Then we set Nyuu to output progress to its log instead of stderr,
    // since we can't handle ASCII escaping sequences there.
    options.progress = "log:2s";
  }

  const files = await lsjson(sourcePath);
  // Converts the file list into a string, one file per line.
  const filelist = files.map((file) => {
    const { Path, Size } = file;
    // Lets the `filename` option rename it if needed. Default to file's `Name`.
    const Name = options.filename(file);
    // Because `sourcePath` can be either of a folder or a file, we
    // remove the actual relative path of this file from `sourcePath`
    // to get the directory name.
    const filePath = join(sourcePath.replace(Path, ""), Path);
    return `procjson://"${ Name }",${ Size },"npx rclone cat '${ filePath }'"`;
  }).join("\n");

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

  const { stdin, stdout, stderr } = spawn("npx", args);

  Readable.from(filelist).pipe(stdin);

  if (output === "-") {
    stdout.pipe(process.stdout);
    stderr.pipe(process.stderr);
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
