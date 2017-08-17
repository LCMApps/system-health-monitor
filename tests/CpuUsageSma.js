'use strict';

const assert = require('chai').assert;

const CpuUsageSma = require('../lib/CpuUsageSma');

const cpusMock = [
    {
        model: 'Intel(R) Core(TM) i3-3220 CPU @ 3.30GHz',
        speed: 3299,
        times: {
            user: 100,
            nice: 20,
            sys:  200,
            idle: 50,
            irq:  0
        }
    },
    {
        model: 'Intel(R) Core(TM) i3-3220 CPU @ 3.30GHz',
        speed: 3300,
        times: {
            user: 100,
            nice: 20,
            sys:  200,
            idle: 50,
            irq:  0
        }
    }];

const cpusMock2 = [
    {
        model: 'Intel(R) Core(TM) i3-3220 CPU @ 3.30GHz',
        speed: 3299,
        times: {
            user: 100,
            nice: 50,
            sys:  200,
            idle: 100,
            irq:  0
        }
    },
    {
        model: 'Intel(R) Core(TM) i3-3220 CPU @ 3.30GHz',
        speed: 3300,
        times: {
            user: 100,
            nice: 50,
            sys:  200,
            idle: 100,
            irq:  0
        }
    }];

let periodPoints = 3;

describe('/lib/CpuUsageSma', () => {
    it('CpuUsage correctly calculate CPU load with initial state', () => {
        const expectedCpuLoad = 100;

        const cpuUsage = new CpuUsageSma(periodPoints);
        const result   = cpuUsage.calculate(cpusMock);

        assert.strictEqual(result, expectedCpuLoad);
    });

    // eslint-disable-next-line max-len
    it('CpuUsage correctly calculate CPU load with non-initial state but count of period points is lower than periodPoints', () => {
        const expectedCpuLoad = 100;

        const cpuUsage = new CpuUsageSma(periodPoints);

        cpuUsage.calculate(cpusMock);

        const result = cpuUsage.calculate(cpusMock2);

        assert.strictEqual(result, expectedCpuLoad);
    });

    it('CpuUsage correctly calculate CPU load with non-initial state', () => {
        const expectedCpuLoad = 41.33;

        const cpuUsage = new CpuUsageSma(periodPoints);

        cpuUsage.calculate(cpusMock);
        cpuUsage.calculate(cpusMock);

        const result = cpuUsage.calculate(cpusMock2);

        assert.strictEqual(result, expectedCpuLoad);
    });
});
