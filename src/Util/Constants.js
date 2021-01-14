module.exports = {
	CLIENT: {
		host: 'localhost',
		port: 25565,
		version: this.DEFAULTVERSION,
		hideErrors: false,
		isServer: false,
		keepAlive: true,
		checkTimeoutInterval: 30000,
		agent: 'Minecraft',
		sessionServer: 'https://sessionserver.mojang.com',
		customPackets: {}
	},
	PING: {
		host: 'localhost',
		port: 25565,
		version: this.DEFAULTVERSION,
		closeTimeout: 120000,
		noPongTimeout: 5000
	},
	DEFAULTVERSION: '1.16.4',
	SUPPORTEDVERSIONS: ['1.7', '1.8', '1.9', '1.10', '1.11.2', '1.12.2', '1.13.2', '1.14.4', '1.15.2', '1.16.4'],
	STATES: {
		HANDSHAKING: 'handshaking',
		STATUS: 'status',
		LOGIN: 'login',
		PLAY: 'play'
	}
};
