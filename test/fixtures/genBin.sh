#!/bin/sh

dd if=/dev/urandom of=$1.bin bs=$1 count=1
