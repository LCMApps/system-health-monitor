'use strict';

const os = require('os');
const _  = require('lodash');

class HealthChecker {
    static get STATUS_STOPPED() {
        return 1;
    }

    static get STATUS_STARTED() {
        return 2;
    }

    static get HEALTH_STATUS_OK() {
        return 1;
    }

    static get HEALTH_STATUS_OVERLOAD() {
        return 2;
    }

    constructor(config) {
        checkConfig(config);

        this._status = HealthChecker.STATUS_STOPPED;

        this._memThresholdType = config.mem.thresholdType;
        this._memMaxFixed      = config.mem.maxFixed;
        this._memHighWatermark = config.mem.highWatermark;

        this._cpuThresholdType = config.cpuUsage.thresholdType;
        this._cpuMaxFixed      = config.cpuUsage.maxFixed;

        this._loadListLength = config.cpuUsage.loadListLength;
        this._checkInterval  = config.checkInterval || 15000; // ms

        this._pid      = process.pid;
        this._memTotal = -1;
        this._memFree  = -1;
        this._cpuCount = -1;
        this._cpuUsage = 100;
        this._cpusList = undefined;

        this._isOverload   = true;
        this._healthStatus = HealthChecker.HEALTH_STATUS_OVERLOAD;

        this._cpuUsageList = [];
        this._prevWorkTime = 0;
        this._prevBusyTime = 0;
    }

    start() {
        if (this._status === HealthChecker.STATUS_STARTED) {
            throw new Error('HealthChecker service is already started');
        }

        this._determineHealthIndicators();

        this._healthScheduler = setInterval(this._determineHealthIndicators, this._checkInterval);
        this._status          = HealthChecker.STATUS_STARTED;
    }

    stop() {
        if (this._status !== HealthChecker.STATUS_STARTED) {
            throw new Error('HealthChecker service is not started');
        }

        clearInterval(this._healthScheduler);

        this._status = HealthChecker.STATUS_STOPPED;
    }

    isOverload() {
        return this._isOverload;
    }

    getHealthInfo() {
        return {
            status: this._healthStatus,
            pid:    this._pid,
            mem:    {
                total: this._memTotal,
                free:  this._memFree
            },
            cpu:    {
                usage: this._cpuUsage,
                count: this._cpuCount
            }
        };
    }

    _determineHealthIndicators() {
        let memOverload = false;
        let cpuOverload = false;

        this._cpusList = this._getCpuInfo();
        this._memTotal = this._getTotalRam();
        this._memFree  = this._getFreeRam();
        this._cpuCount = this._getCpuCount();

        this._calculateCpuLoad();

        if (this._cpuUsageList.length === this._loadListLength) {
            this._cpuUsage = this._cpuUsageList.reduce((sum, load) => {
                return sum += load / this._loadListLength;
            }, 0);
        } else {
            this._cpuUsage = 100;
        }

        switch (this._memThresholdType) {
            case 'fixed': {
                const memUsed = Math.abs(this._memTotal - this._memFree);
                memOverload = !(memUsed && (memUsed < this._memMaxFixed));
                break;
            }

            case 'rate': {
                const memUsed = Math.abs(this._memTotal - this._memFree);
                memOverload = !(memUsed && (memUsed / this._memTotal < this._memHighWatermark));
                break;
            }
        }

        if (this._cpuThresholdType === 'multiplier') {
            cpuOverload = this._cpuUsage > this._cpuMaxFixed;
        }

        this._isOverload   = memOverload || cpuOverload;
        this._healthStatus = this._isOverload ? HealthChecker.HEALTH_STATUS_OVERLOAD : HealthChecker.HEALTH_STATUS_OK;
    }

    _getCpuInfo() {
        try {
            return os.cpus();
        } catch (err) {
            return undefined;
        }
    }

    _getCpuCount() {
        try {
            return this._cpusList.length;
        } catch (err) {
            return -1;
        }
    }

    _getTotalRam() {
        try {
            return Math.round(os.totalmem() / 1024);
        } catch (err) {
            return -1;
        }
    }

    _getFreeRam() {
        try {
            return Math.round(os.freemem() / 1024);
        } catch (err) {
            return -1;
        }
    }

    _calculateCpuLoad() {
        let load            = 100;
        let currentBusyTime = 0;
        let currentWorkTime = 0;

        if (Array.isArray(this._cpusList)) {
            this._cpusList.forEach(core => {
                currentBusyTime += core.times.user + core.times.nice + core.times.sys + core.times.irq;
                currentWorkTime += core.times.idle;
            });

            currentWorkTime += currentBusyTime;

            load = 100 * (currentBusyTime - this._prevBusyTime) / (currentWorkTime - this._prevWorkTime);
        }

        this._prevWorkTime = currentWorkTime;
        this._prevBusyTime = currentBusyTime;

        if (this._cpuUsageList.length === this._loadListLength) {
            this._cpuUsageList.shift();
        }

        this._cpuUsageList.push(load);
    }
}

function checkConfig(config) {
    if (!_.isObject(config) || _.isFunction(config) || _.isArray(config)) {
        throw new Error('config must be an object');
    }

    if (config.checkInterval !== undefined && (!Number.isSafeInteger(config.checkInterval) ||
        config.checkInterval < 1)) {
        throw new Error('checkInterval must be integer and more then 1');
    }

    if (!_.isObject(config.mem) || !_.isObject(config.cpuUsage)) {
        throw new Error('fields `mem` and `cpuUsage` is required and type of object');
    }

    if (config.mem.thresholdType !== 'none') {
        if (config.mem.thresholdType === 'fixed') {
            if (config.mem.maxFixed === undefined || !Number.isFinite(config.mem.maxFixed) ||
                config.mem.maxFixed <= 0) {
                throw new Error('mem.maxFixed fields is required for threshold = fixed and must be more then 0');
            }
        } else if (config.mem.thresholdType === 'rate') {
            if (config.mem.highWatermark === undefined || !Number.isFinite(config.mem.highWatermark) ||
                config.mem.highWatermark <= 0 || config.mem.highWatermark >= 1) {

                throw new Error('mem.highWatermark fields is required for threshold = rate and must be in range (0;1)');
            }
        } else {
            throw new Error('invalid mem.thresholdType');
        }
    }

    if (config.cpuUsage.thresholdType !== 'none') {
        if (config.cpuUsage.thresholdType === 'multiplier') {
            if (config.cpuUsage.maxFixed === undefined || !Number.isFinite(config.cpuUsage.maxFixed) ||
                config.cpuUsage.maxFixed <= 0 || config.cpuUsage.maxFixed > 100) {
                throw new Error('cpuUsage.maxFixed fields is required for threshold = multiplier and ' +
                    'must be in range (0;100]');
            }
        } else {
            throw new Error('invalid cpuUsage.thresholdType');
        }
    }
}

module.exports = HealthChecker;
