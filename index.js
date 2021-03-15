const { join } = require("path");
const { spawn } = require("child_process");
const { Readable } = require("stream");

const rclone = require("rclone.js").promises;

require("nvar")();

const OPTIONS = {
  "out": "-", // Outputs the NZB to `stdout` so others can pipe from it if needed.
  "log-level": 1, // Only shows error.
}

// Maps environment variables to default options if any.
Object.keys(process.env).forEach(key => {
  if (key.indexOf("USENET_POST_") > -1) {
    const value = process.env[key];
    key = key.replace("USENET_POST_", "").toLowerCase().replace("_", "-");
    OPTIONS[key] = value;
  }
});

/**
 * A file from a remote.
 * @typedef {Object} File
 * @property {!string} Path - The relative path of the file.
 * @property {!string} Name - The file name.
 * @property {!number} Size - The size of the file.
 */

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

module.exports = async function(sourcePath, options = {}) {
  options = {
    ...OPTIONS,
    ...options,
  };

  const files = await lsjson(sourcePath);
  // Converts the file list into a string, one file per line.
  const filelist = files.map(({ Path, Name, Size }) => {
    // Because `sourcePath` can be either of a folder or a file, we
    // remove the actual relative path of this file from `sourcePath`
    // to get the directory name.
    const filePath = join(sourcePath.replace(Path, ""), Path);
    return `procjson://"${ Name }",${ Size },"npx rclone cat ${ filePath }"`;
  }).join("\n");

  // Input file from stdin that we pipe our file list to.
  options["input-file"] = "-";

  const args = ["nyuu"];

  // Converts options to string params.
  Object.keys(options).forEach(key => {
    args.push(`--${key}`);
    args.push(`${options[key]}`);
  });

  // Toggles the SSL flag for secure ports.
  if ([563, 443].indexOf(parseInt(options.port)) > -1) {
    args.push("--ssl");
  }

  const uploader = spawn("npx", args, {
    stdio: [
      "pipe", // We pipe our data to stdin.
      "inherit", // Let stdout inherit from parent process.
      "inherit", // Let stderr inherit from parent process.
    ],
  });

  uploader.on("close", () => {

  });

  Readable.from(filelist).pipe(uploader.stdin);
}
