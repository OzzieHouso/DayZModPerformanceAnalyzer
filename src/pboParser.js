/**
 * Copyright (c) 2025 ozziehouso
 *
 * This file is part of a project that can be used and adapted via pull requests.
 * Redistribution or recreation of this code as a separate project is prohibited.
 * See LICENSE file for details.
 */

// PBO (Packable Binary Object) file format parser for DayZ/Arma mods
//
// PBO Structure:
// 1. First header entry (empty filename):
//    - If packing method = 0x56657273 ('Vers'): signature/product entry with metadata properties
//    - Otherwise: boundary marker
// 2. If signature entry: read key-value properties until hitting empty property name
// 3. File entries: list of files with metadata (filename, packing method, sizes, timestamp)
// 4. Boundary marker: empty filename entry marking end of file list
// 5. File data blocks: compressed or uncompressed data for each file entry
// 6. Optional signature (SHA-1 hash) at the end
//
// Packing Methods:
// - 0x00000000: Uncompressed data
// - 0x43707273 ('Cprs'): LZH compressed data
// - 0x56657273 ('Vers'): Product/signature entry (metadata only)
//
// NOTE: This PBO parser is BETA functionality. The PBO format is complex and this implementation
// may not handle all edge cases or variants. If you encounter issues parsing a PBO file,
// please extract it first using PBO Manager or similar tools, then upload as a ZIP file instead.
// ZIP files are the recommended and most reliable method for mod analysis.
//
// For Developers - Updating Packing Method Constants:
// If you encounter PBO files with different packing methods, you can add new constants below.
// Packing methods are stored as 4-byte little-endian integers in the PBO header.
// To find the hex value:
// 1. Open the PBO in a hex editor
// 2. Look at the 4 bytes after each filename's null terminator
// 3. Convert the ASCII characters to hex (e.g., 'Vers' = 0x56657273)
// Common values:
// - 0x00000000: Uncompressed/raw data
// - 0x43707273: 'Cprs' - LZH compressed
// - 0x56657273: 'Vers' - Product entry (metadata)
// - 0x456E6372: 'Encr' - Encrypted (not commonly used)
// 
// These constants are valid as of 11/11/2025 and fetched by ozziehouso using HxD.

import { promises as fs } from 'fs';

const PACKING_METHOD_UNCOMPRESSED = 0x00000000;
const PACKING_METHOD_PACKED = 0x43707273; // 'Cprs' - LZH compression
const PACKING_METHOD_PRODUCT = 0x56657273; // 'Vers' - Signature/metadata entry

export class PBOParser {
  constructor(pboPath) {
    this.pboPath = pboPath;
    this.files = [];
  }

  async parse() {
    const buffer = await fs.readFile(this.pboPath);
    let offset = 0;

    const entries = [];

    const firstEntry = this.readHeaderEntry(buffer, offset);
    offset = firstEntry.newOffset;

    if (firstEntry.packingMethod === PACKING_METHOD_PRODUCT) {
      console.log('PBO has signature/metadata headers');
      while (true) {
        const prop = this.readProperty(buffer, offset);
        offset = prop.newOffset;
        if (!prop.name) break;
        console.log(`Property: ${prop.name} = ${prop.value}`);
      }
    } else if (firstEntry.fileName !== '') {
      console.log(`First entry is content file: ${firstEntry.fileName}`);
      entries.push(firstEntry);
    }

    while (true) {
      const headerEntry = this.readHeaderEntry(buffer, offset);
      offset = headerEntry.newOffset;

      if (headerEntry.fileName === '') {
        console.log('Hit boundary marker, end of file list');
        break;
      }

      console.log(`Found file: ${headerEntry.fileName} (method: 0x${headerEntry.packingMethod.toString(16)}, dataSize: ${headerEntry.dataSize})`);
      entries.push(headerEntry);
    }

    console.log(`Total entries found: ${entries.length}`);

    for (const entry of entries) {
      if (entry.fileName.toLowerCase().endsWith('.c') || entry.fileName.toLowerCase().endsWith('.cpp')) {
        console.log(`Processing script file: ${entry.fileName}`);
        const fileData = buffer.slice(offset, offset + entry.dataSize);
        offset += entry.dataSize;

        let content;
        if (entry.packingMethod === PACKING_METHOD_UNCOMPRESSED) {
          content = fileData.toString('utf8');
        } else if (entry.packingMethod === PACKING_METHOD_PACKED) {
          content = this.decompressLZH(fileData, entry.originalSize);
        } else {
          console.warn(`Unknown packing method for ${entry.fileName}: 0x${entry.packingMethod.toString(16)}`);
          continue;
        }

        console.log(`Extracted ${entry.fileName}: ${content.length} bytes`);
        this.files.push({
          path: entry.fileName,
          name: entry.fileName.split(/[\\/]/).pop(),
          content: content,
          lines: content.split('\n'),
          size: content.length
        });
      } else {
        offset += entry.dataSize;
      }
    }

    console.log(`Total script files extracted: ${this.files.length}`);

    return this.files;
  }

  readHeaderEntry(buffer, offset) {
    const fileName = this.readCString(buffer, offset);
    offset = fileName.newOffset;

    const packingMethod = buffer.readUInt32LE(offset);
    offset += 4;

    const originalSize = buffer.readUInt32LE(offset);
    offset += 4;

    const reserved = buffer.readUInt32LE(offset);
    offset += 4;

    const timeStamp = buffer.readUInt32LE(offset);
    offset += 4;

    const dataSize = buffer.readUInt32LE(offset);
    offset += 4;

    return {
      fileName: fileName.value,
      packingMethod,
      originalSize,
      reserved,
      timeStamp,
      dataSize,
      newOffset: offset
    };
  }

  readProperty(buffer, offset) {
    const name = this.readCString(buffer, offset);
    offset = name.newOffset;

    if (!name.value) {
      return { name: null, value: null, newOffset: offset };
    }

    const value = this.readCString(buffer, offset);
    offset = value.newOffset;

    return {
      name: name.value,
      value: value.value,
      newOffset: offset
    };
  }

  readCString(buffer, offset) {
    let end = offset;
    while (end < buffer.length && buffer[end] !== 0) {
      end++;
    }

    const value = buffer.toString('utf8', offset, end);
    return {
      value,
      newOffset: end + 1
    };
  }

  decompressLZH(compressedData, originalSize) {
    const output = Buffer.alloc(originalSize);
    let outputPos = 0;
    let inputPos = 0;

    while (outputPos < originalSize && inputPos < compressedData.length) {
      const format = compressedData[inputPos++];

      for (let i = 0; i < 8 && outputPos < originalSize && inputPos < compressedData.length - 2; i++) {
        const isUncompressed = (format >> i) & 0x01;

        if (isUncompressed) {
          output[outputPos++] = compressedData[inputPos++];
        } else {
          const pointer = compressedData.readUInt16LE(inputPos);
          inputPos += 2;

          const rpos = outputPos - (pointer & 0x00ff) - ((pointer & 0xf000) >> 4);
          let rlen = ((pointer & 0x0f00) >> 8) + 3;

          if (rpos + rlen < 0) {
            for (let j = 0; j < rlen; j++) {
              output[outputPos++] = 0x20;
            }
          } else {
            let copyPos = Math.max(0, rpos);
            while (rpos < 0) {
              output[outputPos++] = 0x20;
              rlen--;
            }

            if (rlen > 0) {
              for (let j = 0; j < rlen; j++) {
                output[outputPos++] = output[copyPos++];
              }
            }
          }
        }
      }
    }

    return output.toString('utf8');
  }

  getFiles() {
    return this.files;
  }
}
