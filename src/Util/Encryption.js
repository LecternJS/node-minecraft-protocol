/* eslint-disable new-cap */
const { Transform } = require('readable-stream');
const crypto = require('crypto');
const aesjs = require('aes-js');

function createCipher(secret) {
	if (crypto.getCiphers().includes('aes-128-cfb8')) {
		return crypto.createCipheriv('aes-128-cfb8', secret, secret);
	}
	return new Cipher(secret);
}

function createDecipher(secret) {
	if (crypto.getCiphers().includes('aes-128-cfb8')) {
		return crypto.createDecipheriv('aes-128-cfb8', secret, secret);
	}
	return new Decipher(secret);
}

class Cipher extends Transform {

	constructor(secret) {
		super();
		this.aes = new aesjs.ModeOfOperation.cfb(secret, secret, 1);
	}

	_transform(chunk, encoding, callback) {
		try {
			const res = this.aes.encrypt(chunk);
			return callback(null, res);
		} catch (error) {
			return callback(error);
		}
	}

}

class Decipher extends Transform {

	constructor(secret) {
		super();
		this.aes = new aesjs.ModeOfOperation.cfb(secret, secret, 1);
	}

	_transform(chunk, encoding, callback) {
		try {
			const res = this.aes.decrypt(chunk);
			return callback(null, res);
		} catch (error) {
			return callback(error);
		}
	}

}

module.exports = {
	createCipher: createCipher,
	createDecipher: createDecipher
};
