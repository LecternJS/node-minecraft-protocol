class Util {

	constructor() {
		throw new Error('This class must not be intitated with new.');
	}

	/**
     * Verify if the input is an object.
     * @param {Object} input The object to verify.
     * @returns {boolean}
     */

	static isObject(input) {
		return input && input.constructor === Object;
	}

	/**
     * Sets default properties on an object that aren't already specified.
     * @param {Object} def Default properties.
     * @param {Object} given Object to assign defaults to.
     * @returns {Object}
     */

	static mergeDefault(def, given) {
		if (!given) return Util.deepClone(def);
		for (const key in def) {
			if (typeof given[key] === 'undefined') given[key] = Util.deepClone(def[key]);
			else if (Util.isObject(given[key])) given[key] = Util.mergeDefault(def[key], given[key]);
		}

		return given;
	}

	/**
     * Deep clone.
     * @param {*} source The object to clone.
     * @returns {*}
     */
	static deepClone(source) {
		// Check if it's a primitive (with exception of function and null, which is typeof object)
		if (source === null || Util.isPrimitive(source)) return source;
		if (Array.isArray(source)) {
			const output = [];
			for (const value of source) output.push(Util.deepClone(value));
			return output;
		}
		if (Util.isObject(source)) {
			const output = {};
			for (const [key, value] of Object.entries(source)) output[key] = Util.deepClone(value);
			return output;
		}
		if (source instanceof Map) {
			const output = new source.constructor();
			for (const [key, value] of source.entries()) output.set(key, Util.deepClone(value));
			return output;
		}
		if (source instanceof Set) {
			const output = new source.constructor();
			for (const value of source.values()) output.add(Util.deepClone(value));
			return output;
		}
		return source;
	}

	static isPrimitive(value) {
		return Util.PRIMITIVE_TYPES.includes(typeof value);
	}


}

module.exports = Util;
