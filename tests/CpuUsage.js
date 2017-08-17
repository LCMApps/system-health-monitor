'use strict';

const assert = require('chai').assert;

const CpuUsage = require('../lib/CpuUsage');

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

describe('/lib/CpuUsage', () => {
    it('CpuUsage correctly calculate CPU load with initial state', () => {
        const expectedCpuLoad = 86.49;

        const cpuUsage = new CpuUsage();
        const result = cpuUsage.calculate(cpusMock);

        assert.strictEqual(result, expectedCpuLoad);
    });

    it('CpuUsage correctly calculate CPU load with non-initial state', () => {
        const expectedCpuLoad = 37.5;

        const cpuUsage = new CpuUsage();
        cpuUsage.calculate(cpusMock);
        const result = cpuUsage.calculate(cpusMock2);

        assert.strictEqual(result, expectedCpuLoad);
    });
});
