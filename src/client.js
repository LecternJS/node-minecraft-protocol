/* eslint-disable no-new */
const minecraftData = require('minecraft-data');

const BaseClient = require('./BaseClient');

const Util = require('./Util/Util');
const Constants = require('./Util/Constants');

const debug = require('debug')('minecraft-protocol');

const DetectVersion = require('./Client/DetectVersion');
const TCP = require('./Client/TCP');
const MojangHandling = require('./Client/MojangHandling');
const PluginChannels = require('./Client/PluginChannels');


class Client extends BaseClient {

	constructor(options = {}) {
		if (!Util.isObject(options)) throw new TypeError('Client options must be an object');
		const { version: minecraftVersion } = minecraftData(options.version);
		if (!minecraftVersion) throw new Error(`Unsupported Protocol Version: ${options.version}`);
		options.minecraftVersion = minecraftVersion;

		super(false, minecraftVersion.minecraftVersion, options.customPackets, options.hideErrors);
		this.options = Util.mergeDefault(Constants.CLIENT, options);

		// START IT UP BOIS!
		this.run();
	}

	run() {
		new TCP(this);
		if (/(microsoft|ms)/i.test(this.options.auth)) {
			const MicrosoftAuth = new MicrosoftAuth(this);
			MicrosoftAuth.authenticate();
		} else {
			const MojangAuth = new MojangAuth(this);
			MojangAuth.authenticate();
		}
		if (!this.options.version) new DetectVersion(this);
		this.on('connect', this.setProtocol(this));
		if (this.options.keepAlive) {
			this.keepAliveTimeout = null;
			this.on('keep_alive', this.onKeepAlive);
			this.on('end', clearTimeout(this.keepAliveTimeout));
		}
		new MojangHandling(this);
		this.on('success', this.onLogin);
		this.once('compress', this.compress);
		this.on('set_compression', this.compress);
		new PluginChannels(this);
		this.on('disconnect', this.versionChecking);
	}

	setProtocol(client) {
		function next() {
			const serverHost = client.tagHost ? `${client.options.host}${client.tagHost}` : client.options.host;
			client.write('set_protocol', {
				protocolVersion: client.options.protocolVersion,
				serverHost, serverPort: client.options.port,
				nextState: 2
			});
			client.state = Constants.STATES.LOGIN;
			client.write('login_start', {
				username: client.username
			});
		}

		if (client.wait_connect) return client.on('connect_allowed', next);
		else return next();
	}

	onKeepAlive(packet) {
		if (this.keepAliveTimeout) clearTimeout(this.keepAliveTimeout);
		this.keepAliveTimeout = setTimeout(() => this.end(), this.options.checkTimeoutInterval);
		this.write('keep_alive', {
			keepAliveId: packet.keepAliveId
		});
	}

	onLogin(packet) {
		this.state = Constants.STATES.PLAY;
		this.uuid = packet.uuid;
		this.username = packet.username;
	}

	compress(packet) {
		this.compressionThreshold = packet.threshold;
	}

	versionChecking(message) {
		if (!message.reason) return;
		message = JSON.parse(message.reason);
		let text = message.text ? message.text : message;
		let versionRequired;

		if (text.translate && text.translate.startsWith('multiplayer.disconnect.outdated_')) {
			[versionRequired] = text.with;
		} else {
			if (text.extra) [[text]] = text.extra;
			versionRequired = /(?:Outdated client! Please use|Outdated server! I'm still on) (.+)/.exec(text);
			versionRequired = versionRequired ? versionRequired[1] : null;
		}

		if (!versionRequired) { return; }
		this.end();
		this.emit('error', new Error(`This server is version ${versionRequired
		}, you are using version ${this.version}, please specify the correct version in the options.`));
	}

}

module.exports = Client;

