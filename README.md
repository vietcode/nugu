# NUGU

Node.js Usenet Generic Uploader.

The uploader supports uploading from either local file or a file on a cloud provider through a Rclone remote.

## Installation

```sh
npm install rclone.js
```

## Usage

```js
const nugu = require("nugu");

nugu("remote:path/to/file.iso", {
  host: "localhost",
  port: 119,
  method: "POST",
  user: "",
  password: "",
  connections: 3,
  articleSize: 716800, // Target size of each news post (default 700K)
  comment: "", // Comment to insert before post subject
  comment2: "", // Comment to append after post subject
  subject: `{comment} [{0filenum}/{files}] - "{filename}" yEnc ({part}/{parts}) {filesize} {comment2}`,
  from: "", // Shortcut for `-H From=...`. Defaults to 'username <username@host>'.
  groups: "alt.binaries.test", // Shortcut for `-H Newsgroups=...`. Separate multiple groups with commas.
});
```
