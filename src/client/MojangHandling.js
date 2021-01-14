const crypto = require('crypto');
const Yggdrasil = require('yggdrasil');

const debug = require('debug')('minecraft-protocol');

class MojangHandling {

	/**
	 * Mojang Handler for Encryption Handshake.
	 * @param {Object} client Our extended Client
	 */
	constructor(client) {
		this.client = client;
		this.yggdrasilServer = Yggdrasil.server({ agent: this.client.options.agent, host: this.client.options.sessionServer });
		this.client.once('encryption_begin', this.beginEncryption);
	}


	/**
	 * Encryption handler for Mojang.
	 * @param {*} packet Magic Packet we recieve for starting handshake.
	 */
	beginEncryption(packet) {
		const secret = crypto.randomBytes(16, this.sharedSecret);
		if (!this.options.haveCredentials) {
			if (packet.serverId !== '-') debug('This server appears to be an offline server and you are providing no credentials. This authentication will most likely end in failure.');
			this.sendEncryptionKeyResponse(packet, secret);
		} else {
			this.submitServerJoinRequest((err) => {
				if (err) {
					this.client.emit('error', err);
					return this.client.end();
				} else {
					return this.sendEncryptionKeyResponse(packet, secret);
				}
			});
		}
	}

	/**
	 * Error Handler for Crypto.
	 * @param {*} err Error
	 * @param {Buffer} secret Secret String that was randomly generated
	 * @returns {Buffer} secret
	 */
	sharedSecret(err, secret) {
		if (err) {
			debug(err);
			this.client.emit('error', err);
			return this.client.end();
		}
		return secret;
	}


	/**
	 * Sends encryption key response to our server of choice.
	 * @param {Buffer} packet The server packet we recieved.
	 * @param {Buffer} secret Ultimate secrete
	 * @returns {AssignedNodesOptions} Tells the client what encryption parameters we are using
	 */
	sendEncryptionKeyResponse(packet, secret) {
		const pubKey = this.convertKeyToPem(packet.publicKey);
		const encryptedSharedSecretBuffer = crypto.publicEncrypt({ key: pubKey, padding: crypto.constants.RSA_PKCS1_PADDING }, secret);
		const encryptedVerifyTokenBuffer = crypto.publicEncrypt({ key: pubKey, padding: crypto.constants.RSA_PKCS1_PADDING }, packet.verifyToken);
		this.client.write('encryption_begin', {
			sharedSecret: encryptedSharedSecretBuffer,
			verifyToken: encryptedVerifyTokenBuffer
		});
		return this.client.setEncryption(secret);
	}

	/**
	 * Submit a join request to mojang so we can join. (Includes encryption stuff)
	 * @param {Buffer} packet Mojang Packet We Recieved
	 * @param {Buffer} secret The ultimate secret we created
	 * @param {Function} callback The function that handles whether or not we are on fire.
	 * @returns {Function} callback
	 */
	submitServerJoinRequest(packet, secret, callback) {
		return this.yggdrasilServer.join(this.client.options.accessToken, this.client.session.selectedProfile.id, packet.serverId, secret, packet.publicKey, callback);
	}


	/**
     * Converts a Minecraft Public Key into PEM Format.
     * @param {Buffer} buffer Minecraft public key buffer
     * @returns {string} Public Key
     */
	convertKeyToPem(buffer) {
		let pem = '-----BEGIN PUBLIC KEY-----\n';
		let base64PubKey = buffer.toString('base64');
		while (base64PubKey.length > 0) {
			pem += `${base64PubKey.substring(0, 65)}\n`;
			base64PubKey = base64PubKey.substring(65);
		}
		pem += '-----END PUBLIC KEY-----\n';
		return pem;
	}

}

module.exports = MojangHandling;
