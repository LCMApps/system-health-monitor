'use strict';

const CpuUsage = require('./CpuUsage');

class CpuUsageSma extends CpuUsage {
    constructor(periodPoints) {
        super();

        this._periodPoints   = periodPoints;
        this._loadCollection = [];
    }

    calculate(coresInfo) {
        let cpuUsage = 100;
        const load   = this._getCpuLoad(coresInfo);

        this._loadCollection.push(load);

        if (this._loadCollection.length === this._periodPoints) {
            cpuUsage = this._loadCollection.reduce((sum, load) => {
                return sum += load;
            }, 0);

            cpuUsage /= this._periodPoints;

            this._loadCollection.shift();
        }

        return +cpuUsage.toFixed(2);
    }
}

module.exports = CpuUsageSma;
