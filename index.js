'use strict';

const fs        = require('fs');
const os        = require('os');
const promisify = require('util').promisify;

const CpuUsage    = require('./lib/CpuUsage');
const CpuUsageSma = require('./lib/CpuUsageSma');

const readFileAsync  = promisify(fs.readFile);
const MB_MULTIPLIER = 1024;
const MEMINFO_PATH = '/proc/meminfo';

/**
 * Row example: MemTotal:        8068528 kB
 * @param {string} row
 * @returns {number} size in kB
 */
function getSizeFromMeminfoRow(row) {
    return +row.split(':')[1].slice(0, -3).trim();
}

class SystemHealthMonitor {
    static get STATUS_STOPPED() {
        return 1;
    }

    static get STATUS_STARTED() {
        return 2;
    }

    constructor({checkIntervalMsec, mem, cpu}) {
        if (!Number.isSafeInteger(checkIntervalMsec) || checkIntervalMsec < 1) {
            throw new Error('field "checkIntervalMsec" is required must be an integer and more than 1');
        }

        this._checkIntervalMsec = checkIntervalMsec;

        this._isMemOverloaded    = undefined;
        this._isCpuOverloaded    = undefined;
        this._cpuUsageCalculator = undefined;

        this._initMemChecks(mem);
        this._initCpuChecks(cpu);

        this._status = SystemHealthMonitor.STATUS_STOPPED;

        this._memTotal   = -1;
        this._memFree    = -1;
        this._cpuCount   = -1;
        this._cpuUsage   = 100;
        this._isOverload = true;

        this._healthScheduler = undefined;

        this._determineHealthIndicators = this._determineHealthIndicators.bind(this);
    }

    async start() {
        if (this._status === SystemHealthMonitor.STATUS_STARTED) {
            throw new Error('SystemHealthMonitor service is already started');
        }

        await this._determineHealthIndicators();

        this._healthScheduler = setInterval(this._determineHealthIndicators, this._checkIntervalMsec);
        this._status          = SystemHealthMonitor.STATUS_STARTED;
    }

    stop() {
        if (this._status === SystemHealthMonitor.STATUS_STOPPED) {
            throw new Error('SystemHealthMonitor service is not started');
        }

        clearInterval(this._healthScheduler);

        this._status = SystemHealthMonitor.STATUS_STOPPED;
    }

    getMemTotal() {
        if (this._status === SystemHealthMonitor.STATUS_STOPPED) {
            throw new Error('SystemHealthMonitor service is not started');
        }

        return this._memTotal;
    }

    getMemFree() {
        if (this._status === SystemHealthMonitor.STATUS_STOPPED) {
            throw new Error('SystemHealthMonitor service is not started');
        }

        return this._memFree;
    }

    getCpuCount() {
        if (this._status === SystemHealthMonitor.STATUS_STOPPED) {
            throw new Error('SystemHealthMonitor service is not started');
        }

        return this._cpuCount;
    }

    getCpuUsage() {
        if (this._status === SystemHealthMonitor.STATUS_STOPPED) {
            throw new Error('SystemHealthMonitor service is not started');
        }

        return this._cpuUsage;
    }

    isOverloaded() {
        if (this._status === SystemHealthMonitor.STATUS_STOPPED) {
            throw new Error('SystemHealthMonitor service is not started');
        }

        return this._isOverload;
    }

    /* istanbul ignore next */
    async _readMeminfoFile() {
        return await readFileAsync(MEMINFO_PATH, 'utf8');
    }
    /**
     * For /proc/meminfo doc see: https://www.centos.org/docs/5/html/5.1/Deployment_Guide/s2-proc-meminfo.html
     * @returns {Promise.<void>}
     */
    async _getMemInfo() {
        let memFree           = 0;
        let indicatorsCounter = 5;
        let memInfo           = undefined;

        try {
            memInfo = await this._readMeminfoFile();
        } catch (err) {
            this._memTotal = -1;
            this._memFree  = -1;
            return;
        }

        for (const line of memInfo.split('\n')) {
            if (line.includes('MemTotal:')) {
                this._memTotal = Math.floor(getSizeFromMeminfoRow(line) / MB_MULTIPLIER);
                indicatorsCounter--;
                continue;
            }

            if (/(^MemFree|^Buffers|^Cached|^SReclaimable):/.test(line)) {
                memFree += parseInt(getSizeFromMeminfoRow(line));
                indicatorsCounter--;
                continue;
            }

            if (indicatorsCounter === 0) {
                break;
            }
        }

        this._memFree = Math.ceil(memFree / MB_MULTIPLIER);
    }

    /* istanbul ignore next */
    _getCpuInfo() {
        try {
            return os.cpus();
        } catch (err) {
            return undefined;
        }
    }

    /* istanbul ignore next */
    _getCpuCount() {
        try {
            return this._cpusList.length;
        } catch (err) {
            return -1;
        }
    }

    async _determineHealthIndicators() {
        await this._getMemInfo();

        const memOverload = this._isMemOverloaded(this._memFree, this._memTotal);

        this._cpusList = this._getCpuInfo();

        if (this._cpusList === undefined) {
            this._cpuCount = -1;
            this._cpuUsage = 100;
        } else {
            this._cpuCount = this._getCpuCount();
            this._cpuUsage = this._cpuUsageCalculator.calculate(this._cpusList);
        }

        const cpuOverload = this._isCpuOverloaded(this._cpuUsage);

        this._isOverload = memOverload || cpuOverload;
    }

    _isMemOverloadedByIncorrectData(free, total) {
        return free < 0 || total < 0;
    }

    _isMemOverloadedByFixedThreshold(minFree, free, total) {
        return this._isMemOverloadedByIncorrectData(free, total) || free < minFree;
    }

    _isMemOverloadedByRateThreshold(highWatermark, free, total) {
        return this._isMemOverloadedByIncorrectData(free, total) || (total - free) / total > highWatermark;
    }

    _isCpuOverloadByRateThreshold(highWatermark, cpuUsage) {
        return highWatermark * 100 < cpuUsage;
    }

    _initMemChecks(mem) {
        if (typeof mem !== 'object') {
            throw new Error('field "mem" is required and must be an object');
        }

        if (mem.thresholdType === 'fixed') {
            if (mem.minFree === undefined || !Number.isSafeInteger(mem.minFree) || mem.minFree <= 0) {
                throw new Error('"mem.minFree" field is required for threshold = fixed and must be more then 0');
            }

            this._isMemOverloaded = this._isMemOverloadedByFixedThreshold.bind(this, mem.minFree);
        } else if (mem.thresholdType === 'rate') {
            if (mem.highWatermark === undefined || !Number.isFinite(mem.highWatermark) ||
                mem.highWatermark <= 0 || mem.highWatermark >= 1) {

                throw new Error(
                    '"mem.highWatermark" field is required for threshold = rate and must be in range (0;1)'
                );
            }

            this._isMemOverloaded = this._isMemOverloadedByRateThreshold.bind(this, mem.highWatermark);
        } else if (mem.thresholdType === 'none') {
            this._isMemOverloaded = this._isMemOverloadedByIncorrectData.bind(this);
        } else {
            throw new Error('"mem.thresholdType" is not set or has invalid type');
        }
    }

    _initCpuChecks(cpu) {
        if (typeof cpu !== 'object') {
            throw new Error('field "cpu" is required and must be an object');
        }

        if (cpu.calculationAlgo === 'sma') {
            if (!Number.isSafeInteger(cpu.periodPoints) || cpu.periodPoints < 1) {
                throw new Error('"cpu.periodPoints" field is required for SMA algorithm and must be more than 0');
            }
            this._cpuUsageCalculator = new CpuUsageSma(cpu.periodPoints);
        } else if (cpu.calculationAlgo === 'last_value') {
            this._cpuUsageCalculator = new CpuUsage();
        } else {
            throw new Error('"cpu.calculationAlgo" is not set or has invalid type');
        }

        if (cpu.thresholdType === 'rate') {
            if (!cpu.highWatermark || !Number.isFinite(cpu.highWatermark) || cpu.highWatermark > 1) {
                throw new Error(
                    '"cpu.highWatermark" field is required for threshold = rate and must be in range (0,1]'
                );
            }

            this._isCpuOverloaded = this._isCpuOverloadByRateThreshold.bind(this, cpu.highWatermark);
        } else if (cpu.thresholdType === 'none') {
            this._isCpuOverloaded = () => false;
        } else {
            throw new Error('"cpu.thresholdType" is not set or has invalid type');
        }
    }
}

module.exports = SystemHealthMonitor;
