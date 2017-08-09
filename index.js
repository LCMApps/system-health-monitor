'use strict';

const os = require('os');

class HealthChecker {
    static get STATUS_STOPPED() {
        return 1;
    }

    static get STATUS_STARTED() {
        return 2;
    }

    constructor(config) {
        checkConfig(config);

        this._status = HealthChecker.STATUS_STOPPED;

        this._memThresholdType = config.mem.thresholdType;
        this._memMaxFixed      = config.mem.maxFixed;
        this._memHighWatermark = config.mem.highWatermark;

        this._cpuThresholdType = config.cpu.thresholdType;
        this._cpuHighWatermark = config.cpu.highWatermark;

        this._loadListLength = config.cpu.loadListLength;
        this._checkInterval  = config.checkInterval || 15000; // ms

        this._memTotal = -1;
        this._memFree  = -1;
        this._cpuCount = -1;
        this._cpuUsage = 100;
        this._cpusList = undefined;

        this._isOverload   = true;

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
        if (this._status === HealthChecker.STATUS_STOPPED) {
            throw new Error('HealthChecker service is not started');
        }

        clearInterval(this._healthScheduler);

        this._status = HealthChecker.STATUS_STOPPED;
    }

    /* istanbul ignore next */
    getMemTotal() {
        try {
            return Math.round(os.totalmem() / 1024);
        } catch (err) {
            return -1;
        }
    }

    /* istanbul ignore next */
    getMemFree() {
        try {
            return Math.round(os.freemem() / 1024);
        } catch (err) {
            return -1;
        }
    }

    getCpuCount() {
        try {
            return this._cpusList.length;
        } catch (err) {
            return -1;
        }
    }

    getCpuUsage() {
        return this._cpuUsage;
    }

    isOverloaded() {
        return this._isOverload;
    }

    _determineHealthIndicators() {
        let memOverload = false;
        let cpuOverload = false;

        this._cpusList = this._getCpuInfo();
        this._memTotal = this.getMemTotal();
        this._memFree  = this.getMemFree();

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
                memOverload   = !(memUsed && (memUsed < this._memMaxFixed));
                break;
            }

            case 'rate': {
                const memUsed = Math.abs(this._memTotal - this._memFree);
                memOverload   = !(memUsed && (memUsed / this._memTotal < this._memHighWatermark));
                break;
            }
        }

        if (this._cpuThresholdType === 'rate') {
            cpuOverload = this._cpuUsage > this._cpuHighWatermark;
        }

        this._isOverload = memOverload || cpuOverload;
    }

    /* istanbul ignore next */
    _getCpuInfo() {
        try {
            return os.cpus();
        } catch (err) {
            return undefined;
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

function checkConfig({checkInterval, mem, cpu}) {
    if (checkInterval !== undefined && (!Number.isSafeInteger(checkInterval) || checkInterval < 1)) {
        throw new Error('checkInterval must be integer and more then 1');
    }

    if (typeof mem !== 'object' || typeof cpu !== 'object') {
        throw new Error('fields `mem` and `cpu` is required and type of object');
    }

    if (mem.thresholdType !== 'none') {
        if (mem.thresholdType === 'fixed') {
            if (mem.maxFixed === undefined || !Number.isSafeInteger(mem.maxFixed) || mem.maxFixed <= 0) {
                throw new Error('mem.maxFixed fields is required for threshold = fixed and must be more then 0');
            }
        } else if (mem.thresholdType === 'rate') {
            if (mem.highWatermark === undefined || !Number.isFinite(mem.highWatermark) ||
                mem.highWatermark <= 0 || mem.highWatermark >= 1) {

                throw new Error('mem.highWatermark fields is required for threshold = rate and must be in range (0;1)');
            }
        } else {
            throw new Error('mem.thresholdType is not set or has invalid type');
        }
    }


    if (cpu.thresholdType !== 'none') {
        if (cpu.thresholdType === 'rate') {
            if (cpu.highWatermark === undefined || !Number.isFinite(cpu.highWatermark) ||
                cpu.highWatermark <= 0 || cpu.highWatermark > 100) {
                throw new Error('cpu.highWatermark fields is required for threshold = rate ' +
                    'and must be in range (0;100]');
            }

            if (!Number.isSafeInteger(cpu.loadListLength) || cpu.loadListLength < 1) {
                throw new Error('cpu.loadListLength fields is required for threshold = rate and must be more then 0');
            }
        } else {
            throw new Error('cpu.thresholdType is not set or has invalid type');
        }
    }
}

module.exports = HealthChecker;
