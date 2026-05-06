/* eslint-disable indent */
/* eslint no-use-before-define: ["error", { "functions": false }] */
const fs = require('fs');
const yaml = require('yaml');
const cbor = require('cbor');
const log = require('./log');

function createAttribute(key, items) {
  const modifiers = [];
  if (items !== null) {
    for (let i = 0; i < items.length; i += 1) {
      // eslint-disable-next-line no-restricted-syntax
      for (const [name, mvalue] of Object.entries(items[i])) {
        switch (name) {
          case 'key':
            // eslint-disable-next-line no-param-reassign
            key = mvalue;
            break;
          case 'div':
          case 'mul':
          case 'add':
          case 'sub': {
            const value = parseFloat(mvalue);
            if (Number.isNaN(value)) { throw new Error(`Bad value for modifier "${name}:${mvalue}"`); }
            modifiers.push({ name, value });
            break;
          }
          case 'fpp': {
            const value = parseInt(mvalue, 10);
            if (Number.isNaN(value)) { throw new Error(`Bad value for modifier "${name}:${mvalue}"`); }
            modifiers.push({ name, value });
            break;
          }
          case 'tso':
          case 'tsp': {
            modifiers.push({ name, value: createAttributes(mvalue) });
            break;
          }
          case 'enum': {
            // test if mvalue is array of strings
            if (!Array.isArray(mvalue)) { throw new Error(`Bad value for modifier "${name}:${mvalue}"`); }
            for (let j = 0; j < mvalue.length; j += 1) {
              if (typeof mvalue[j] !== 'string') { throw new Error(`Bad value for modifier "${name}:${mvalue}"`); }
            }
            modifiers.push({ name, value: mvalue });
            break;
          }
          default:
            throw new Error(`Unknown modifier "${name}"`);
        }
      }
    }
  }
  return { key, modifiers };
}

function createAttributes(attributes) {
  return attributes.map((attribute, index) => {

    const keys = Object.keys(attribute);
    if (keys.length !== 1) {
      throw new Error(`Unable to multiple keys "${keys}" per index ${index}`);
    }

    const key = keys[0];
    const items = attribute[key];
    return createAttribute(key, items);
  });
}

function applyModifiers(value, modifiers) {
  if (modifiers && value !== null) {
    for (let i = 0; i < modifiers.length; i += 1) {
      const modifier = modifiers[i];
      switch (modifier.name) {
        case 'div':
          // eslint-disable-next-line no-param-reassign
          value /= modifier.value;
          break;
        case 'mul':
          // eslint-disable-next-line no-param-reassign
          value *= modifier.value;
          break;
        case 'add':
          // eslint-disable-next-line no-param-reassign
          value += modifier.value;
          break;
        case 'sub':
          // eslint-disable-next-line no-param-reassign
          value -= modifier.value;
          break;
        case 'fpp':
          {
            const exp = 10 ** modifier.value;
            // eslint-disable-next-line no-param-reassign
            value = Math.floor(value * exp) / exp;
            // value = parseFloat(value.toFixed(modifier.value));
            break;
          }
        case 'enum':
          {
            const index = parseInt(value, 10);
            if (!Number.isNaN(index) && index >= 0 && index <= modifier.value.length) {
              // eslint-disable-next-line no-param-reassign
              value = modifier.value[value];
            } else {
              // eslint-disable-next-line no-param-reassign
              value = `(enum:${value})`;
            }
            break;
          }
        default:
          break;
      }
    }
  }
  return value;
}

function unrol(decoded, attributes) {
  const result = {};
  if (decoded.forEach === undefined) return decoded;

  decoded.forEach((value, index) => {

    // console.log(index, value);

    const attribute = attributes[index] || { key: `(key:${index})` };

    if (value instanceof Map) {
      result[attribute.key] = unrol(value, attributes);
    } else if (value instanceof Array) {
      if (attribute.modifiers && attribute.modifiers.length === 1) {

        const modifier = attribute.modifiers[0];
        if (modifier.name === 'tso') {

          const startTS = value[0];
          const vparams = modifier.value;
          const vparamsLen = vparams.length;
          const points = [];

          for (let i = 1, l = value.length; i < l; i += vparamsLen + 1) {
            const point = { timestamp: Math.round(startTS + value[i]) };
            for (let j = 0; j < vparamsLen; j += 1) {
              const vparam = vparams[j];
              point[vparam.key] = applyModifiers(value[i + j + 1], vparam.modifiers);
            }
            points.push(point);
          }
          result[attribute.key] = points;

        } else if (modifier.name === 'tsp') {
          const startTS = value[0];
          const periodTS = value[1];
          const vparams = modifier.value;
          const vparamsLen = vparams.length;
          const points = [];

          for (let pi = 0, pl = (value.length - 2) / vparamsLen, i = 2; pi < pl; pi += 1, i += vparamsLen) {
            const point = { timestamp: Math.round(startTS + periodTS * pi) };
            for (let j = 0; j < vparamsLen; j += 1) {
              const vparam = vparams[j];
              point[vparam.key] = applyModifiers(value[i + j], vparam.modifiers);
            }
            points.push(point);
          }
          result[attribute.key] = points;
        }

      } else {
        result[attribute.key] = value.map((item) => unrol(item, attributes));
      }
    } else if (value instanceof Buffer) {
      result[attribute.key] = value.toString('hex');
    } else if (typeof value === 'bigint') {
      result[attribute.key] = value.toString();
    } else {
      result[attribute.key] = applyModifiers(value, attribute.modifiers);
    }
  });
  return result;
}

class Decoder {
  constructor(text) {
    const codec = yaml.parse(text);

    this.attributes = createAttributes(codec);
  }

  decode(hexbuf) {
    const decoded = cbor.decodeAllSync(hexbuf);
    return unrol(decoded[0], this.attributes);
  }
}

function newDecoder(text) {
  return new Decoder(text);
}

function newDecoderFromFile(filename) {
  const text = fs.readFileSync(filename).toString('utf8');
  return newDecoder(text);
}

module.exports = { newDecoder, newDecoderFromFile };
