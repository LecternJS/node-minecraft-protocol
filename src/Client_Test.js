const { EventEmitter } = require('events');
const minecraftData = require('minecraft-data');

const Utils = require('./Util/Util');
const Constants = require('./Util/Constants');
const { Compressor, Decompressor } = require('./Util/Compression');
const Framing = require('./Util/Framing');
const Serializer = require('./Util/Serializer');
const Encryption = require('./Util/Encryption');

const debug = require('debug')('minecraft-protocol');

const TCP = require('./Client/TCP');


class Client extends EventEmitter {

	constructor(options = {}) {
		if (!Utils.isObject(options)) throw new TypeError('The client options for Client must be an object.');
		const { version } = minecraftData(options.version || Constants.DEFAULTVERSION);
		if (!version) throw new Error(`Unsupported Protocol Version: ${options.version || Constants.DEFAULTVERSION}`);
		options.majorVersion = version.majorVersion;
		options.protocolVersion = version.version;

		options = Utils.mergeDefault(Constants.CLIENT, options);
		super(options);

		this.splitter = Framing.createSplitter();
		this.framer = Framing.createFramer();

		this.version = version;
		this.packetsToParse = {};
		this.compressor = null;
		this.cipher = null;
		this.decipher = null;
		this.decompressor = null;
		this.ended = true;
		this.latency = 0;
		this.closeTimer = null;

		this.state = Constants.STATES.HANDSHAKING;
	}

	get state() {
		return this.protocolState;
	}

	setSerializer(state) {
		this.serializer = Serializer.createSerializer({
			isServer: this.isServer,
			version: this.version,
			customPackets: this.customPackets,
			state
		});

		this.serializer.on('error', (error) => {
			let parts;
			if (error.field) {
				parts = error.field.split('.');
				parts.shift();
			} else { parts = []; }
			const serializerDirection = !this.isServer ? 'toServer' : 'toClient';
			error.field = [this.protocolState, serializerDirection].concat(parts).join('.');
			error.message = `Serialization error for ${error.field} : ${error.message}`;
			if (!this.compressor) this.serializer.pipe(this.framer);
			else this.serializer.pipe(this.compressor);
			this.emit('error', error);
		});

		this.deserializer = Serializer.createDeserializer({
			isServer: this.isServer,
			version: this.version,
			packetsToParse: this.packetsToParse,
			customPackets: this.customPackets,
			noErrorLogging: this.hideErrors,
			state
		});

		this.deserializer.on('error', (error) => {
			let parts;
			if (error.field) {
				parts = error.field.split('.');
				parts.shift();
			} else { parts = []; }
			const deserializerDirection = this.isServer ? 'toServer' : 'toClient';
			error.field = [this.protocolState, deserializerDirection].concat(parts).join('.');
			error.message = `Deserialization error for ${error.field} : ${error.message}`;
			if (!this.compressor) this.splitter.pipe(this.deserializer);
			else this.decompressor.pipe(this.deserializer);
			this.emit('error', error);
		});

		this.deserializer.on('data', (parsed) => {
			parsed.metadata.name = parsed.data.name;
			parsed.data = parsed.data.params;
			parsed.metadata.state = state;
			debug(`read packet ${state}.${parsed.metadata.name}`);
			if (debug.enabled) {
				const data = JSON.stringify(parsed.data, null, 2);
				debug(data && data.length > 10000 ? parsed.data : data);
			}
			this.emit('packet', parsed.data, parsed.metadata, parsed.buffer);
			this.emit(parsed.metadata.name, parsed.data, parsed.metadata);
			this.emit(`raw.${parsed.metadata.name}`, parsed.buffer, parsed.metadata);
			this.emit('raw', parsed.buffer, parsed.metadata);
		});

		this.splitter.recognizeLegacyPing = state === Constants.STATES.HANDSHAKING;
	}

	set state(newProperty) {
		const oldProperty = this.protocolState;
		this.protocolState = newProperty;

		if (this.serializer) {
			if (!this.compressor) {
				this.serializer.unpipe();
				this.splitter.unpipe(this.deserializer);
			} else {
				this.serializer.unpipe(this.compressor);
				this.decompressor.unpipe(this.deserializer);
			}

			this.serializer.removeAllListeners();
			this.deserializer.removeAllListeners();
		}
		this.setSerializer(this.protocolState);

		if (!this.compressor) {
			this.serializer.pipe(this.framer);
			this.splitter.pipe(this.deserializer);
		} else {
			this.serializer.pipe(this.compressor);
			this.decompressor.pipe(this.deserializer);
		}

		this.emit('state', newProperty, oldProperty);
	}

	get compressionThreshold() {
		return this.compressor === null ? -2 : this.compressor.compressionThreshold;
	}

	set compressionThreshold(threshold) {
		this.setCompressionThreshold(threshold);
	}

	setSocket(socket) {
		this.ended = false;
		this.socket = socket;

		if (this.socket.setNoDelay) this.socket.setNoDelay(true);

		this.socket.on('connect', () => this.emit('connect'));
		this.socket.on('error', this.onFatalError);
		this.socket.on('close', this.endSocket);
		this.socket.on('end', this.endSocket);
		this.socket.on('timeout', this.endSocket);
		this.framer.on('error', this.onError);
		this.splitter.on('error', this.onError);

		this.socket.pipe(this.splitter);
		this.framer.pipe(this.socket);
	}

	endSocket() {
		if (this.ended) return;
		this.ended = true;
		clearTimeout(this.closeTimer);
		this.socket.removeListener('close', this.endSocket);
		this.socket.removeListener('end', this.endSocket);
		this.socket.removeListener('timeout', this.endSocket);
		this.emit('end', this._endReason || 'SocketClosed');
	}

	end(reason) {
		this._endReason = reason;
		/* ending the serializer will end the whole chain
        serializer -> framer -> socket -> splitter -> deserializer */
		if (this.serializer) this.serializer.end();
		else if (this.socket) this.socket.end();
		if (this.socket) this.closeTimer = setTimeout(this.socket.destroy.bind(this.socket), 30000);
	}

	setEncryption(sharedSecret) {
		if (this.cipher) this.emit('error', new Error('Set encryption twic-e!'));
		this.cipher = Encryption.createCipher(sharedSecret);
		this.cipher.on('error', (err) => this.emit('error', err));
		this.framer.unpipe(this.socket);
		this.framer.pipe(this.cipher).pipe(this.socket);
		this.decipher = Encryption.createDecipher(sharedSecret);
		this.decipher.on('error', (err) => this.emit('error', err));
		this.socket.unpipe(this.splitter);
		this.socket.pipe(this.decipher).pipe(this.splitter);
	}

	setCompressionThreshold(threshold) {
		if (this.compressor === null) {
			this.compressor = new Compressor(threshold);
			this.compressor.on('error', (err) => this.emit('error', err));
			this.serializer.unpipe(this.framer);
			this.serializer.pipe(this.compressor).pipe(this.framer);
			this.decompressor = new Decompressor(threshold, this.hideErrors);
			this.decompressor.on('error', (err) => this.emit('error', err));
			this.splitter.unpipe(this.deserializer);
			this.splitter.pipe(this.decompressor).pipe(this.deserializer);
		} else {
			this.decompressor.threshold = threshold;
			this.compressor.threshold = threshold;
		}
	}

	write(name, params) {
		if (!this.serializer.writable) { return; }
		debug(`writing packet ${this.state}.${name}`);
		debug(params);
		this.serializer.write({ name, params });
	}

	writeRaw(buffer) {
		const stream = this.compressor === null ? this.framer : this.compressor;
		if (!stream.writable) { return; }
		stream.write(buffer);
	}

	// TCP/IP-specific (not generic Stream) method for backwards-compatibility
	connect() {
		const TCPHandler = new TCP(this);
		TCPHandler.connect(this);
	}

	onFatalError(err) {
		this.emit('error', err);
		this.endSocket();
	}

	onError(err) {
		this.emit('error', err);
	}

}

module.exports = Client;
