const { join } = require("path");
const { spawn } = require("child_process");
const { Readable } = require("stream");
const readline = require("readline");

const rclone = require("rclone.js").promises;

require("nvar")();

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
    key = key.replace("USENET_POST_", "").toLowerCase().replace("_", "-");
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
    delete options.progress;
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
    return `procjson://"${ Name }",${ Size },"npx rclone cat ${ filePath }"`;
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
      const progressStream = readline.createInterface({
        input: stderr,
      });

      progressStream.on("line", progress);
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
