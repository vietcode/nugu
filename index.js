const { basename } = require("path");
const { spawn } = require("child_process");

const rclone = require("rclone.js");

/**
 * Get size of a file in bytes
 * @param {string} filePath The path to the file
 * @returns {Number} the file size in bytes.
 */
async function getSize(filePath) {
  return new Promise((resolve, reject) => {
    const lsf = rclone.lsf(filePath, "--format", "s");
    let stdout = "";
    lsf.stdout.on("data", data => {
      stdout += data;
    });
    lsf.stderr.on("data", (data) => {
      reject(data.toString());
    });
    lsf.stdout.on("end", () => {
      resolve(parseInt(stdout.trim()));
    });
  });
}

module.exports = async function(filePath, options = {}) {
  const fileSize = await getSize(filePath);
  const fileName = basename(filePath.replace(":", ":/"));

  const args = ["nyuu"];

  // Converts options to string params.
  Object.keys(options).forEach(key => {
    args.push(`--${key}`);
    args.push(options[key]);
  });

  if ([563, 443].indexOf(parseInt(options.port)) > -1) {
    args.push("--ssl");
  }

  // Input.
  args.push(`procjson://"${fileName}",${fileSize},"npx rclone cat ${filePath}"`);

  const uploader = spawn("npx", args, {
    stdio: "inherit",
  });

  uploader.on("close", () => {
    console.log("done");
  });
}
