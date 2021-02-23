@agen/zip
===========

This package contains a AsyncIterator-based unzip utility methods. The main method - `unzip` - provides
an asynchronous iterator over file entries stored in the archive. 
The structure of returned file instances:
* `async* content()` - return an async iterator over byte content of the file; note that this method 
  *do not* uncomress the data; use the `@agen/gzip` to inflate bytes.
* `path` - path to the file; for directories it contains the trailing `/` symbol.
* `size` - the total (uncompressed) size of the file
* `compressedSize` - size of the compressed entry in the archive
* `type` - a MIME type of the entry
* `modified` the data of the file modification
* `compressed` boolean flag defining if the content of the file is compresed or not

**Note**: This module *does not* provide inflating utilities for compressed files.
To uncompress the content the `@agen/gzip` library should be used in the `raw` mode. 

The code of this library is based on a rewamped implementation of the [yauzl](https://github.com/thejoshwolfe/yauzl) package (MIT License). To properly read Zip archives this code uses random access readers providing the following methods and fields:
* `async* readRange(from, to)` - provides an async iterator over the specified range of bytes
* `async read(start, end)` - provides a (ArrayBuffer) with data from the specified byte range 
* `length` the total length of the zipped content

Internally all values are loaded from byte arrays (like Uint8Array).

This library has no external dependencies and can be used in the browser, in Deno or in Node environmets.

`unzip` method
--------------

This method returns an AsyncIterator over files in the specified archive.

Parameters:
* `reader` - reader instance with the following fields:
  * `async* readRange(from, to)` - provides an async iterator over the specified range of bytes
  * `async read(start, end)` - provides a (ArrayBuffer) with data from the specified byte range 
  * `length` the total length of the zipped content


Returns an AsyncGenerator over archived file entries.

Example: 
```javascript

import fs from 'fs';
import { unzip, reader } from '@agen/zip';
import { inflate } from '@agen/gzip';
import { decode } from '@agen/encoding';
import { compose } from '@agen/utils';

const buf = fs.readFileSync('./MyArchive.zip');
const files = unzip(reader(buf)); // returns an Async Generator

// Now we can decompress and read text content from files:
for await (let file of files()) {
  console.log('>', file.path, file.size);

  // Function transforming the content:
  const f = compose(
    // Step 1: Inflate compressed files
    // IMPORTANT: use the 'raw' mode to inflate the content
    file.compressed && inflate({ raw : true }), 

    // Step 2: Decode text files:
    file.text.match(/\.txt$/) && decode()
  );

  let it = f(file.content());
  for let (let block of it) {
    // Blocks are decompressed and decoded to UTF8 for text files:
    console.log(block);
  }
}

```
