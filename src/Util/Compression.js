/* eslint-disable consistent-return */
'use strict';

const { types: { varint: [readVarInt, writeVarInt, sizeOfVarInt] } } = require('protodef');
const zlib = require('zlib');
const { Transform } = require('readable-stream');

class Compressor extends Transform {

	constructor(compressionThreshold = -1) {
		super();
		this.compressionThreshold = compressionThreshold;
	}

	_transform(chunk, encoding, callback) {
		if (chunk.length >= this.compressionThreshold) {
			zlib.deflate(chunk, (err, newChunk) => {
				if (err) return callback(err);
				const buf = Buffer.alloc(sizeOfVarInt(chunk.length) + newChunk.length);
				const offset = writeVarInt(chunk.length, buf, 0);
				newChunk.copy(buf, offset);
				this.push(buf);
				return callback();
			});
		} else {
			const buf = Buffer.alloc(sizeOfVarInt(0) + chunk.length);
			const offset = writeVarInt(0, buf, 0);
			chunk.copy(buf, offset);
			this.push(buf);
			return callback();
		}
	}

}


class Decompressor extends Transform {

	constructor(compressionThreshold = -1, hideErrors = false) {
		super();
		this.compressionThreshold = compressionThreshold;
		this.hideErrors = hideErrors;
	}

	_transform(chunk, encoding, callback) {
		const { size, value, error } = readVarInt(chunk, 0);
		if (error) { return callback(error); }
		if (value === 0) {
			this.push(chunk.slice(size));
			return callback();
		} else {
			/*  Z_SYNC_FLUSH = 2, but when using Browserify/Webpack it doesn't exist */
			/** Fix by lefela4. */
			zlib.unzip(chunk.slice(size), { finishFlush: 2 }, (err, newBuf) => {
				if (err) {
					if (!this.hideErrors) {
						console.error('problem inflating chunk');
						console.error(`uncompressed length ${value}`);
						console.error(`compressed length ${chunk.length}`);
						console.error(`hex ${chunk.toString('hex')}`);
						console.log(err);
					}
					return callback();
				}
				if (newBuf.length !== value && !this.hideErrors) {
					console.error(`uncompressed length should be ${value} but is ${newBuf.length}`);
				}
				this.push(newBuf);
				return callback();
			});
		}
	}

}

module.exports = { Compressor, Decompressor };
