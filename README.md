# NUGU [![Open in Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/vietcode/nugu/blob/main/Nugu.ipynb)

Node.js Usenet Generic Uploader.

The uploader supports uploading from either a local file/folder or a
file/folder on a cloud provider through a Rclone remote.

By default, uploaded articles are checked using 1 connection. Adjust
the `--check-connections` flag to 0 to disable, or 2 or higher to set
the number of connections used for post checking. Higher numbers of
connections are only useful if post checking is bottlenecking the rest
of the process.

## Installation

```sh
npm install vietcode/nugu
```

See [Usage](#usage) below for how to call it.

If you don't want to pass the common options all the time, create an
`.env` file in your current directory. For each options needed, adds an
variable prefixed with `USENET_POST_`, and the uppercased option name.
Hyphen (`-`) needs to be replaced with underscore (`_`). For example:

- `USENET_POST_PORT=443`: sets `port` option to 443.
- `USENET_POST_ARTICLE_SIZE=1048576`: sets `article-size` option to 1MB.

## Usage

### CLI

```shell
# Uploads a single file and saves the NZB to file.
npx nugu remote:path/to/linux.iso --host=localhost --port=119 > linux.iso.nzb
# Uploads a folder and saves the NZB to file.
npx nugu remote:path/to/folder --host=localhost --port=119 > folder.nzb
# Adds all file in a folder into a zip file with custom name before uploading.
npx nugu --archive --filename folder.zip remote:path/to/folder > folder.zip.nzb
```

### Javascript

```js
const nugu = require("nugu");

/** @type {Buffer} **/
const nzb = await nugu("remote:path/to/file-or-folder", {
  host: "localhost",
  port: 119,
  method: "POST",
  user: "",
  password: "",
  connections: 3,
  "article-size": 716800, // Target size of each news post (default 700K)
  comment: "", // Comment to insert before post subject
  comment2: "", // Comment to append after post subject
  subject: `{comment} [{0filenum}/{files}] - "{filename}" yEnc ({part}/{parts}) {filesize} {comment2}`,
  from: "", // Shortcut for `-H From=...`. Defaults to 'username <username@host>'.
  groups: "alt.binaries.test", // Shortcut for `-H Newsgroups=...`. Separate multiple groups with commas.
  filename: ({Name, Path, Size, ID}) => Name, // Custom filename.
  progress: console.log,
});
```
