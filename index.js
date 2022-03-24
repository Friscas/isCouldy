/*
 * AAAAAAAA
 * A lot of code convention ecc have being ignored and some bad code practice have being used
 * Reason being i need this library ASAP and will improve it once the tool im writing this lib for
 * is productive
 *
 */

/* eslint-disable no-await-in-loop */

/* eslint-disable node/prefer-promises/fs */

const EventEmitter = require('events');
const fs = require('fs');
const dns = require('dns').promises;
const axios = require('axios').default;
const IPCIDR = require('ip-cidr');

const event = new EventEmitter();

class IsCloudy {
  constructor(target, update) {
    this.ip = this._validateHost(target);
    this.update = update || false;
    this.IPs = [];
  }

  async check() {
    if (this.update) {
      this._getRanges();
    } else if (this._checkIfExist()) {
      this._getRanges();
    } else {
      this.IPs = JSON.parse(fs.readFileSync('ips.json'));
    }

    if (this.IPs.length > 0) {
      // very bad coding ik, i will improve the code quality once i am done with the main tool im working on
      const results = await this._isCloudy();
      if (results) event.emit('done', results);
      return results;
    }
  }

  onError(method) {
    event.addListener('error', method);
  }

  onCloudFlareFound(method) {
    event.addListener('found', method);
  }

  onDone(method) {
    event.addListener('done', method);
  }

  _validateHost(host) {
    if (typeof host !== 'string' && !Array.isArray(host)) {
      throw new TypeError(
        'Invalid type for the target, it can only be a string or an array of strings'
      );
    }

    return host;
  }

  _getRanges() {
    axios({
      method: 'GET',
      url: 'https://www.cloudflare.com/ips-v4'
    })
      .then((data) => {
        const ranges = data.data.split('\n');
        this._generateIPs(ranges);
      })
      .catch((err) => event.emit('error', err));
  }

  _generateIPs(ranges) {
    let ips;
    for (const range of ranges) {
      ips = new IPCIDR(range).toArray();
      this.IPs = [...this.IPs, ...ips];
    }

    this._writeArrayToJsonFile(this.IPs);
  }

  _writeArrayToJsonFile(ips) {
    fs.writeFile('ips.json', JSON.stringify(ips), 'utf8', (err) => {
      if (err) {
        event.emit('error', err);
      } else {
        this.update = false;
        this.check(); // ik know, i know its very bad, i will handle every async as it should be correctly handled once i start the rework
      }
    });
  }

  _checkIfExist() {
    return !fs.existsSync('ips.json');
  }

  _isURL(url) {
    try {
      url = new URL(url);
    } catch (error) {
      return false;
    }
    return url.host;
  }

  async _ValidateIp(ip) {
    try {
      if (this._isURL(ip)) {
        ip = this._isURL(ip);
      }
      ip = await dns.lookup(ip);
      return ip.address;
    } catch (error) {
      event.emit('error', error);
    }
  }

  async _isCloudy() {
    let results = [];
    let bFound;
    let result;
    if (typeof this.ip === 'string') {
      bFound = this.IPs.includes(await this._ValidateIp(this.ip));
      results = {
        target: this.ip,
        CloudFlare: bFound
      };
      if (bFound) event.emit('found', results);
    } else {
      for (const ip of this.ip) {
        bFound = this.IPs.includes(await this._ValidateIp(ip));
        result = {
          target: ip,
          CloudFlare: bFound
        };
        results.push(result);
        if (bFound) event.emit('found', result);
      }
    }

    return results;
  }
}

module.exports = IsCloudy;
