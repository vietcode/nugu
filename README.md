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
# Uploads a folder using the files' MD5 hash as name.
npx nugu remote:path/to/folder --filename '{md5}{extname}' > folder.nzb
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
  archive: false, // Whether to place all files into a store-only archive.
});
```

## Naming

> There are only two hard things in Computer Science: cache invalidation and
> naming things.
>
> -- Phil Karlton

Naming is hard, so by default, the file name (no path) is used for posting. For
any reason when different naming is needed, one can use `filename` option to
customize it.

With JavaScript API, this option can take a function which is called for each
files and must return a string for the actual file name of that file, i.e.

```js
(file) => file.Hashes.md5
```

The full file object has the following fields:

```json
{
  "Hashes": {
    "crc32": "ecb65bb98f9d905b70458986c39fcbad7715e5f2fcc3b1f07767d7c83e2438cc",
    "md5": "b1946ac92492d2347c6235b4d2611184",
    "sha1": "f572d396fae9206628714fb2ce00f72e94f2258f"
  },
  "ID": "y2djkhiujf83u33",
  "OrigID": "UYOJVTUW00Q1RzTDA",
  "IsBucket": false,
  "IsDir": false,
  "MimeType": "application/octet-stream",
  "ModTime": "2017-05-31T16:15:57.034468261+01:00",
  "Name": "file.txt",
  "Encrypted": "v0qpsdq8anpci8n929v3uu9338",
  "EncryptedPath": "kja9098349023498/v0qpsdq8anpci8n929v3uu9338",
  "Path": "full/path/goes/here/file.txt",
  "Size": 6,
  "Tier": "hot"
}
```

Depending on situation, some of the fields may not present.

On the CLI, the `--filename` flag takes a string that can contain placeholders.
Each placeholders is replaced with the file's properties, with the `Hashes`
object is flattened out, i.e.:

```shell
--filename '{md5}{extname}'
```

There are few special placeholders:

- `{filename}` - The full file name and path as specified in command supplied.
- `{basename}` - Base file name without path.
- `{pathname}` - Path component of file name
- `{extname}` - Extention of the file, with leading dot.

**NOTES**: Files with same name will override each other. It's your
responsibility to make sure they are all unique.
