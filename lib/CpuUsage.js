'use strict';

class CpuUsage {
    constructor() {
        this._prevWorkTime   = 0;
        this._prevBusyTime   = 0;
    }

    calculate(coresInfo) {
        return +this._getCpuLoad(coresInfo).toFixed(2);
    }

    _getCpuLoad(coresInfo) {
        let currentBusyTime = 0;
        let currentWorkTime = 0;

        coresInfo.forEach(coreInfo => {
            currentBusyTime += coreInfo.times.user + coreInfo.times.nice + coreInfo.times.sys;
            currentWorkTime += coreInfo.times.idle;
        });

        currentWorkTime += currentBusyTime;

        const load = 100 * (currentBusyTime - this._prevBusyTime) / (currentWorkTime - this._prevWorkTime);

        this._prevWorkTime = currentWorkTime;
        this._prevBusyTime = currentBusyTime;

        return load;
    }
}

module.exports = CpuUsage;
