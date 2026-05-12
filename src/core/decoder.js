import fs from 'fs';
import yaml from 'yaml';
import cbor from 'cbor';

/**
 * The Decoder class encapsulates the logic for parsing binary payloads
 * based on a YAML schema (codec).
 */
export class Decoder {
  constructor(text) {
    const codec = yaml.parse(text);
    this.attributes = flattenAttributes(codec.schema);
  }

  /**
   * Decodes a binary buffer into a human-readable JSON object.
   */
  decode(hexbuf) {
    const decoded = cbor.decodeAllSync(hexbuf);
    if (!decoded || decoded.length === 0) return null;
    return unrol(decoded[0], this.attributes);
  }
}

/**
 * Factory function to create a new Decoder instance from raw text.
 */
export function newDecoder(text) {
  return new Decoder(text);
}

/**
 * Factory function to create a new Decoder instance from a YAML file.
 */
export function newDecoderFromFile(filename) {
  const text = fs.readFileSync(filename).toString('utf8');
  return newDecoder(text);
}

// --- Internal Helper Functions (Mapping & Transformation) ---

function flattenAttributes(codecSchema) {
  const attributes = [];

  function parseModifiers(items, assignId) {
    if (!items || !Array.isArray(items)) return [];
    const modifiers = [];

    for (let i = 0; i < items.length; i++) {
      for (const [k, v] of Object.entries(items[i])) {
        if (k.startsWith('$')) {
          const name = k.substring(1);
          if (name === 'tso' || name === 'tsp') {
            modifiers.push({ name, value: parseVirtualAttributes(v) });
          } else if (name === 'div' || name === 'mul' || name === 'add' || name === 'sub' || name === 'fpp') {
            modifiers.push({ name, value: parseFloat(v) });
          } else if (name === 'enum') {
            modifiers.push({ name, value: v });
          }
        } else {
          if (assignId) {
            const attr = { key: k, modifiers: [] };
            attributes.push(attr);
            attr.modifiers = parseModifiers(v, true);
          }
        }
      }
    }
    return modifiers;
  }

  function parseVirtualAttributes(items) {
    if (!items || !Array.isArray(items)) return [];
    const vattrs = [];
    for (let i = 0; i < items.length; i++) {
      for (const [k, v] of Object.entries(items[i])) {
        if (!k.startsWith('$')) {
          const attr = { key: k, modifiers: parseModifiers(v, false) };
          vattrs.push(attr);
        }
      }
    }
    return vattrs;
  }

  parseModifiers(codecSchema, true);
  return attributes;
}

function applyModifiers(value, modifiers) {
  if (modifiers && value !== null) {
    for (let i = 0; i < modifiers.length; i += 1) {
      const modifier = modifiers[i];
      switch (modifier.name) {
        case 'div':
          value /= modifier.value;
          break;
        case 'mul':
          value *= modifier.value;
          break;
        case 'add':
          value += modifier.value;
          break;
        case 'sub':
          value -= modifier.value;
          break;
        case 'fpp':
          {
            const exp = 10 ** modifier.value;
            value = Math.floor(value * exp) / exp;
            break;
          }
        case 'enum':
          {
            const index = parseInt(value, 10);
            if (!Number.isNaN(index) && index >= 0 && index < modifier.value.length) {
              value = modifier.value[index];
            } else {
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
  if (decoded === undefined || decoded === null || decoded.forEach === undefined) return decoded;

  decoded.forEach((value, index) => {
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
        } else {
          result[attribute.key] = value.map((item) => unrol(item, attributes));
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
