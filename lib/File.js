/**
 * A Rclone File.
 * @class
 * @constructor
 * @public
 */
class File {
  /**
   * Creates a file.
   */
  constructor(file) {
    /** @type {string} the relative path of the file */
    this.Path = file.Path;
    /** @type {string} the file name */
    this.Name = file.Name;
    /** @type {number} the size of the file in bytes */
    this.Size = file.Size;
    /** @type {string} the ID of this file object. Not defined for local file */
    this.ID = file.ID;
    /** @type {string} the hashes of this file. */
    this.Hashes = file.Hashes;
  }
}

module.exports = File;
