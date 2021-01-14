'use strict';

const { ProtoDef } = require('protodef');
const { Serializer } = require('protodef');
const FullPacketParser = require('protodef');
const { Compiler: { ProtoDefCompiler } } = require('protodef');

const merge = require('lodash.merge');
const get = require('lodash.get');

const { STATES } = require('./Constants');
const Minecraft = require('./DataTypes/Minecraft');


const protocols = {};

function createProtocol(state, direction, version, customPackets, compiled = true) {
	const key = `${state};${direction};${version}${compiled ? ';c' : ''}`;
	if (protocols[key]) return protocols[key];
	const mcData = require('minecraft-data')(version);

	if (compiled) {
		const compiler = new ProtoDefCompiler();
		compiler.addTypes(require('./DataTypes/Compiler-Minecraft'));
		compiler.addProtocol(merge(mcData.protocol, get(customPackets, [mcData.version.majorVersion])), [state, direction]);
		const proto = compiler.compileProtoDefSync();
		protocols[key] = proto;
		return proto;
	}

	const proto = new ProtoDef(false);
	proto.addTypes(Minecraft);
	proto.addProtocol(merge(mcData.protocol, get(customPackets, [mcData.version.majorVersion])), [state, direction]);
	protocols[key] = proto;
	return proto;
}

function createSerializer({ state = STATES.HANDSHAKING, isServer = false, version, customPackets, compiled = true } = {}) {
	return new Serializer(createProtocol(state, !isServer ? 'toServer' : 'toClient', version, customPackets, compiled), 'packet');
}

function createDeserializer({ state = STATES.HANDSHAKING, isServer = false, version, customPackets, compiled = true, noErrorLogging = false } = {}) {
	return new FullPacketParser(createProtocol(state, isServer ? 'toServer' : 'toClient', version, customPackets, compiled), 'packet', noErrorLogging);
}

module.exports = {
	createSerializer: createSerializer,
	createDeserializer: createDeserializer
};
