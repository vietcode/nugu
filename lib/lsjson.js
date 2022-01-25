const { join } = require("path");
const rclone = require("rclone.js");

/**
 * @typedef {import('./File.js')} File
 */

/**
 * Get list of file stats from a path
 * @param {string} path The path to the file or folder.
 * @param {Object} options custom options
 * @returns {Promise<File[]>} The file list in JSON format.
 */
async function lsjson(source, options = {}) {
  const rclone = this;

  let result;
  try {
    result = await rclone.promises.lsjson(source, {
      "recursive": true,
      "files-only": true,
      "mimetype": false,
      ...options,
    });
  } catch(error) {
    throw `${error}`;
  }

  return JSON.parse(`${result}`).map(file => {
    const Path = file.Path;
    // Because `source` can be either of a folder or a file, we
    // remove the actual relative path of this file from `source`
    // to get the directory name.
    file.AbsolutePath = join(source.replace(Path, ""), Path);

    return file;
  });
}

module.exports = lsjson.bind(rclone);
