#!/usr/bin/env node

const mri = require("mri");

const nugu = require("../");

const argv = process.argv.slice(2);
const {_: args, ...options} = mri(argv);

// Default to output NZB to stdout.
if (!options.out) {
  options.out = "-";
}

nugu(...args, options);
