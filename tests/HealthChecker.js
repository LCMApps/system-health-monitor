/* eslint-disable max-len */
'use strict';

const HealthChecker = require('../index');

const sinon  = require('sinon');
const assert = require('chai').assert;

describe('HealthChecker', () => {
    describe('Config validation', () => {
        let incorrectConfigs = [42, true, 'string', null, undefined, Symbol(), [], () => {
        }];

        incorrectConfigs.forEach((config) => {
            it('argument must be an object', () => {
                try {
                    new HealthChecker(config);
                } catch (err) {
                    assert.instanceOf(err, Error);
                }
            });
        });

        let incorrectCheckInterval = [0, -1, 3.5, true, 'string', null, Symbol(), {}, [], () => {
        }];

        incorrectCheckInterval.forEach((arg) => {
            it('checkInterval must be an save integer', () => {
                const config = {checkInterval: arg};

                try {
                    new HealthChecker(config);
                } catch (err) {
                    assert.instanceOf(err, Error);
                    assert.equal(err.message, 'checkInterval must be integer and more than 1');
                }
            });
        });

        let incorrectMemField = [42, true, 'string', null, undefined, Symbol(), [], () => {
        }];

        incorrectMemField.forEach((arg) => {
            it('config.mem must be an object', () => {
                const config = {mem: arg};

                try {
                    new HealthChecker(config);
                } catch (err) {
                    assert.instanceOf(err, Error);
                    assert.equal(err.message, 'fields `mem` and `cpu` is required and must be an object');
                }
            });
        });

        let incorrectCpuUsageField = [42, true, 'string', null, undefined, Symbol(), [], () => {
        }];

        incorrectCpuUsageField.forEach((arg) => {
            it('config.cpu must be an object', () => {
                const config = {mem: arg};

                try {
                    new HealthChecker(config);
                } catch (err) {
                    assert.instanceOf(err, Error);
                    assert.equal(err.message, 'fields `mem` and `cpu` is required and must be an object');
                }
            });
        });

        let incorrectMemThresholdType = ['string', 'non', 'multiplier', undefined];

        incorrectMemThresholdType.forEach((arg) => {
            it('invalid mem.thresholdType', () => {
                const config = {
                    mem: {thresholdType: arg},
                    cpu: {}
                };

                try {
                    new HealthChecker(config);
                } catch (err) {
                    assert.instanceOf(err, Error);
                    assert.equal(err.message, 'mem.thresholdType is not set or has invalid type');
                }
            });
        });

        let incorrectMemMaxFixed = [0, -1, true, 'string', null, undefined, Symbol(), {}, [], () => {
        }];

        incorrectMemMaxFixed.forEach((arg) => {
            it('invalid mem.maxFixed', () => {
                const config = {
                    mem: {
                        thresholdType: 'fixed',
                        maxFixed:      arg
                    },
                    cpu: {}
                };

                try {
                    new HealthChecker(config);
                } catch (err) {
                    assert.instanceOf(err, Error);
                    assert.equal(err.message, 'mem.maxFixed fields is required for threshold = fixed and must be more than 0');
                }
            });
        });

        let incorrectMemHighWatermark = [0, 1, -1, true, 'string', null, undefined, Symbol(), {}, [], () => {
        }];

        incorrectMemHighWatermark.forEach((arg) => {
            it('invalid mem.highWatermark', () => {
                const config = {
                    mem: {
                        thresholdType: 'rate',
                        maxFixed:      arg
                    },
                    cpu: {}
                };

                try {
                    new HealthChecker(config);
                } catch (err) {
                    assert.instanceOf(err, Error);
                    assert.equal(err.message, 'mem.highWatermark fields is required for threshold = rate and must be in range (0,1]');
                }
            });
        });

        let incorrectCpuThresholdType = ['string', 'non', 'fixed', 'multiplier', undefined];

        incorrectCpuThresholdType.forEach((arg) => {
            it('invalid cpu.thresholdType', () => {
                const config = {
                    mem: {thresholdType: 'none'},
                    cpu: {
                        thresholdType: arg,
                        loadListLength: 5
                    }
                };

                try {
                    new HealthChecker(config);
                } catch (err) {
                    assert.instanceOf(err, Error);
                    assert.equal(err.message, 'cpu.thresholdType is not set or has invalid type');
                }
            });
        });

        let incorrectCpuMaxFixed = [0, 100.1, -1, true, 'string', null, undefined, Symbol(), {}, [], () => {
        }];

        incorrectCpuMaxFixed.forEach((arg) => {
            it('invalid cpu.highWatermark', () => {
                const config = {
                    mem: {
                        thresholdType: 'none'
                    },
                    cpu: {
                        thresholdType: 'rate',
                        maxFixed:      arg,
                        loadListLength: 5

                    }
                };

                try {
                    new HealthChecker(config);
                } catch (err) {
                    assert.instanceOf(err, Error);
                    assert.equal(err.message, 'cpu.highWatermark fields is required for threshold = rate and must be in range (0,1]');
                }
            });
        });

        let incorrectCpuLoadListLength = [0, 100.1, -1, true, 'string', null, undefined, Symbol(), {}, [], () => {
        }];

        incorrectCpuLoadListLength.forEach((arg) => {
            it('invalid cpu.loadListLength', () => {
                const config = {
                    mem: {
                        thresholdType: 'none'
                    },
                    cpu: {
                        thresholdType:  'rate',
                        highWatermark:  50,
                        loadListLength: arg
                    }
                };

                try {
                    new HealthChecker(config);
                } catch (err) {
                    assert.instanceOf(err, Error);
                    assert.equal(err.message, 'cpu.loadListLength fields is required for threshold = rate and must be more than 0');
                }
            });
        });
    });

    let checkerConf = {
        checkInterval: 15000,
        mem:           {
            thresholdType: 'none',
            maxFixed:      1024,
            highWatermark: 0.75
        },
        cpu:           {
            thresholdType:  'none',
            loadListLength: 5,
            highWatermark:  75.5
        }
    };

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

    it('HealthChecker correctly calculate CPU load with zero state of service', () => {
        const healthChecker = new HealthChecker(checkerConf);

        healthChecker._cpusList = cpusMock;

        healthChecker._calculateCpuLoad();

        let expectedBusyTime = 0;
        let expectedWorkTime = 0;

        cpusMock.forEach(core => {
            expectedBusyTime += core.times.user + core.times.nice + core.times.sys + core.times.irq;
            expectedWorkTime += core.times.user + core.times.nice + core.times.sys + core.times.irq + core.times.idle;
        });

        const expectedCpuLoad = expectedBusyTime / expectedWorkTime * 100;

        assert.equal(healthChecker._prevWorkTime, expectedWorkTime);
        assert.equal(healthChecker._prevBusyTime, expectedBusyTime);
        assert.equal(healthChecker._cpuUsageList.length, 1);
        assert.equal(healthChecker._cpuUsageList[0], expectedCpuLoad);
        assert.equal(healthChecker.isOverloaded(), true);
    });

    it('HealthChecker correctly calculate CPU load with non-zero state of service', () => {
        const prevWorkTime = 200;
        const prevBusyTime = 100;

        const healthChecker = new HealthChecker(checkerConf);

        healthChecker._cpusList     = cpusMock;
        healthChecker._prevWorkTime = prevWorkTime;
        healthChecker._prevBusyTime = prevBusyTime;
        healthChecker._cpuUsageList = [50];

        healthChecker._calculateCpuLoad();

        let expectedBusyTime = 0;
        let expectedWorkTime = 0;

        cpusMock.forEach(core => {
            expectedBusyTime += core.times.user + core.times.nice + core.times.sys + core.times.irq;
            expectedWorkTime += core.times.user + core.times.nice + core.times.sys + core.times.irq + core.times.idle;
        });

        const expectedCpuLoad = (expectedBusyTime - prevBusyTime) / (expectedWorkTime - prevWorkTime) * 100;

        assert.equal(healthChecker._prevWorkTime, expectedWorkTime);
        assert.equal(healthChecker._prevBusyTime, expectedBusyTime);
        assert.equal(healthChecker._cpuUsageList.length, 2);
        assert.equal(healthChecker._cpuUsageList[1], expectedCpuLoad);
        assert.equal(healthChecker.isOverloaded(), true);
    });

    it('HealthChecker calculate CPU load equal 100% if info about cores not allowed', () => {
        const prevWorkTime  = 200;
        const prevBusyTime  = 100;
        const healthChecker = new HealthChecker(checkerConf);

        healthChecker._prevWorkTime = prevWorkTime;
        healthChecker._prevBusyTime = prevBusyTime;
        healthChecker._cpuUsageList = [50];

        healthChecker._calculateCpuLoad();

        const expectedBusyTime = 0;
        const expectedWorkTime = 0;
        const expectedCpuLoad  = 100;

        assert.equal(healthChecker._prevWorkTime, expectedWorkTime);
        assert.equal(healthChecker._prevBusyTime, expectedBusyTime);
        assert.equal(healthChecker._cpuUsageList.length, 2);
        assert.equal(healthChecker._cpuUsageList[1], expectedCpuLoad);
        assert.equal(healthChecker.isOverloaded(), true);
        assert.equal(healthChecker.getCpuUsage(), 1);
        assert.equal(healthChecker.getCpuCount(), -1);
    });

    it('HealthChecker set overload = false if all thresholdType = none', () => {
        const healthChecker = new HealthChecker(checkerConf);

        sinon.stub(healthChecker, '_getCpuInfo');
        sinon.stub(healthChecker, '_getCpuCount');
        sinon.stub(healthChecker, '_getTotalMem');
        sinon.stub(healthChecker, '_getFreeMem');
        sinon.stub(healthChecker, '_calculateCpuLoad');

        healthChecker._getTotalMem.returns(2048);
        healthChecker._getFreeMem.returns(10);
        healthChecker._getCpuCount.returns(4);
        healthChecker._cpuUsageList = [100, 100, 100, 100, 100];

        healthChecker._determineHealthIndicators();

        assert.isOk(healthChecker._getCpuInfo.calledOnce);
        assert.isOk(healthChecker._getTotalMem.calledOnce);
        assert.isOk(healthChecker._getFreeMem.calledOnce);
        assert.isOk(healthChecker._calculateCpuLoad.calledOnce);
        assert.equal(healthChecker.isOverloaded(), false);
        assert.equal(healthChecker.getCpuUsage(), 1);
        assert.equal(healthChecker.getCpuCount(), 4);
    });

    it('HealthChecker set overload = true if cpu.thresholdType = rate and CPU usage higher highWatermark', () => {
        checkerConf.cpu.thresholdType = 'rate';

        const healthChecker = new HealthChecker(checkerConf);

        sinon.stub(healthChecker, '_getCpuInfo');
        sinon.stub(healthChecker, 'getCpuCount');
        sinon.stub(healthChecker, '_getTotalMem');
        sinon.stub(healthChecker, '_getFreeMem');
        sinon.stub(healthChecker, '_calculateCpuLoad');

        healthChecker._getTotalMem.returns(2048);
        healthChecker._getFreeMem.returns(10);
        healthChecker.getCpuCount.returns(4);
        healthChecker._cpuUsageList = [100, 75, 75, 75, 75];

        healthChecker._determineHealthIndicators();

        const expectedCpuUsage = 0.8;

        assert.isOk(healthChecker._getCpuInfo.calledOnce);
        assert.isOk(healthChecker._getTotalMem.calledOnce);
        assert.isOk(healthChecker._getFreeMem.calledOnce);
        assert.isOk(healthChecker._calculateCpuLoad.calledOnce);
        assert.equal(healthChecker.isOverloaded(), true);
        assert.equal(healthChecker.getCpuUsage(), expectedCpuUsage);
        assert.equal(healthChecker.getCpuCount(), 4);
    });

    it('HealthChecker set overload = false if cpu.thresholdType = rate and CPU usage lower maxFixed', () => {
        checkerConf.cpu.thresholdType = 'rate';

        const healthChecker = new HealthChecker(checkerConf);

        sinon.stub(healthChecker, '_getCpuCount');
        sinon.stub(healthChecker, '_getTotalMem');
        sinon.stub(healthChecker, '_getFreeMem');
        sinon.stub(healthChecker, '_calculateCpuLoad');

        healthChecker._getTotalMem.returns(2048);
        healthChecker._getFreeMem.returns(10);
        healthChecker._getCpuCount.returns(4);
        healthChecker._cpuUsageList = [100, 50, 40, 40, 30];

        healthChecker._determineHealthIndicators();

        const expectedCpuUsage = 0.52;

        assert.equal(healthChecker.isOverloaded(), false);
        assert.equal(healthChecker.getCpuUsage(), expectedCpuUsage);
        assert.equal(healthChecker.getCpuCount(), 4);
    });

    it('HealthChecker set overload = false if mem.thresholdType = fixed and RAM usage lower maxFixed', () => {
        checkerConf.cpu.thresholdType = 'none';
        checkerConf.mem.thresholdType = 'fixed';
        checkerConf.mem.maxFixed      = 1500;

        const healthChecker = new HealthChecker(checkerConf);

        sinon.stub(healthChecker, '_getCpuCount');
        sinon.stub(healthChecker, '_getTotalMem');
        sinon.stub(healthChecker, '_getFreeMem');
        sinon.stub(healthChecker, '_calculateCpuLoad');

        healthChecker._getTotalMem.returns(2048);
        healthChecker._getFreeMem.returns(1000);
        healthChecker._getCpuCount.returns(4);
        healthChecker._cpuUsageList = [100, 100, 100, 100, 100];

        healthChecker._determineHealthIndicators();

        assert.equal(healthChecker.isOverloaded(), false);
        assert.equal(healthChecker.getMemFree(), 1000);
        assert.equal(healthChecker.getMemTotal(), 2048);
    });

    it('HealthChecker set overload = true if mem.thresholdType = fixed and RAM usage higher maxFixed', () => {
        checkerConf.cpu.thresholdType = 'none';
        checkerConf.mem.thresholdType = 'fixed';
        checkerConf.mem.maxFixed      = 1500;

        const healthChecker = new HealthChecker(checkerConf);

        sinon.stub(healthChecker, '_getCpuCount');
        sinon.stub(healthChecker, '_getTotalMem');
        sinon.stub(healthChecker, '_getFreeMem');
        sinon.stub(healthChecker, '_calculateCpuLoad');

        healthChecker._getTotalMem.returns(2048);
        healthChecker._getFreeMem.returns(100);
        healthChecker._getCpuCount.returns(4);
        healthChecker._cpuUsageList = [100, 100, 100, 100, 100];

        healthChecker._determineHealthIndicators();

        assert.equal(healthChecker.isOverloaded(), true);
        assert.equal(healthChecker.getMemFree(), 100);
        assert.equal(healthChecker.getMemTotal(), 2048);
    });

    it('HealthChecker set overload = false if mem.thresholdType = rate and RAM usage lower highWatermark', () => {
        checkerConf.cpu.thresholdType = 'none';
        checkerConf.mem.thresholdType = 'rate';
        checkerConf.mem.highWatermark = 0.75;

        const healthChecker = new HealthChecker(checkerConf);

        sinon.stub(healthChecker, '_getCpuCount');
        sinon.stub(healthChecker, '_getTotalMem');
        sinon.stub(healthChecker, '_getFreeMem');
        sinon.stub(healthChecker, '_calculateCpuLoad');

        healthChecker._getTotalMem.returns(2048);
        healthChecker._getFreeMem.returns(1000);
        healthChecker._getCpuCount.returns(4);
        healthChecker._cpuUsageList = [100, 100, 100, 100, 100];

        healthChecker._determineHealthIndicators();

        assert.equal(healthChecker.isOverloaded(), false);
        assert.equal(healthChecker.getMemFree(), 1000);
        assert.equal(healthChecker.getMemTotal(), 2048);
    });

    it('HealthChecker set overload = true if mem.thresholdType = rate and RAM usage higher highWatermark', () => {
        checkerConf.cpu.thresholdType = 'none';
        checkerConf.mem.thresholdType = 'rate';
        checkerConf.mem.highWatermark = 0.75;

        const healthChecker = new HealthChecker(checkerConf);

        sinon.stub(healthChecker, '_getCpuCount');
        sinon.stub(healthChecker, '_getTotalMem');
        sinon.stub(healthChecker, '_getFreeMem');
        sinon.stub(healthChecker, '_calculateCpuLoad');

        healthChecker._getTotalMem.returns(2048);
        healthChecker._getFreeMem.returns(400);
        healthChecker._getCpuCount.returns(4);
        healthChecker._cpuUsageList = [100, 100, 100, 100, 100];

        healthChecker._determineHealthIndicators();

        assert.equal(healthChecker.isOverloaded(), true);
        assert.equal(healthChecker.getMemFree(), 400);
        assert.equal(healthChecker.getMemTotal(), 2048);
    });

    it('HealthChecker set overload = true if mem.thresholdType = rate and _getFreeMem return -1', () => {
        checkerConf.cpu.thresholdType = 'none';
        checkerConf.mem.thresholdType = 'rate';
        checkerConf.mem.highWatermark = 0.75;

        const healthChecker = new HealthChecker(checkerConf);

        sinon.stub(healthChecker, 'getCpuCount');
        sinon.stub(healthChecker, '_getTotalMem');
        sinon.stub(healthChecker, '_getFreeMem');
        sinon.stub(healthChecker, '_calculateCpuLoad');

        healthChecker._getTotalMem.returns(2048);
        healthChecker._getFreeMem.returns(-1);
        healthChecker.getCpuCount.returns(4);
        healthChecker._cpuUsageList = [100, 100, 100, 100, 100];

        healthChecker._determineHealthIndicators();

        assert.equal(healthChecker.isOverloaded(), true);
        assert.equal(healthChecker.getMemFree(), -1);
        assert.equal(healthChecker.getMemTotal(), 2048);
    });

    it('HealthChecker set overload = true if mem.thresholdType = rate and _getFreeMem and _getTotalMem return -1', () => {
        checkerConf.cpu.thresholdType = 'none';
        checkerConf.mem.thresholdType = 'rate';
        checkerConf.mem.highWatermark = 0.75;

        const healthChecker = new HealthChecker(checkerConf);

        sinon.stub(healthChecker, '_getCpuCount');
        sinon.stub(healthChecker, '_getTotalMem');
        sinon.stub(healthChecker, '_getFreeMem');
        sinon.stub(healthChecker, '_calculateCpuLoad');

        healthChecker._getTotalMem.returns(-1);
        healthChecker._getFreeMem.returns(-1);
        healthChecker._getCpuCount.returns(4);
        healthChecker._cpuUsageList = [100, 100, 100, 100, 100];

        healthChecker._determineHealthIndicators();

        assert.equal(healthChecker.isOverloaded(), true);
        assert.equal(healthChecker.getMemFree(), -1);
        assert.equal(healthChecker.getMemTotal(), -1);
    });

    it('HealthChecker set overload = true if mem.thresholdType = fixed and _getFreeMem and _getTotalMem return -1', () => {
        checkerConf.cpu.thresholdType = 'none';
        checkerConf.mem.thresholdType = 'fixed';
        checkerConf.mem.maxFixed      = 1500;

        const healthChecker = new HealthChecker(checkerConf);

        sinon.stub(healthChecker, '_getCpuCount');
        sinon.stub(healthChecker, '_getTotalMem');
        sinon.stub(healthChecker, '_getFreeMem');
        sinon.stub(healthChecker, '_calculateCpuLoad');

        healthChecker._getTotalMem.returns(-1);
        healthChecker._getFreeMem.returns(-1);
        healthChecker._getCpuCount.returns(4);
        healthChecker._cpuUsageList = [100, 100, 100, 100, 100];

        healthChecker._determineHealthIndicators();

        assert.equal(healthChecker.isOverloaded(), true);
        assert.equal(healthChecker.getMemFree(), -1);
        assert.equal(healthChecker.getMemTotal(), -1);
    });

    it('HealthChecker set overload = false if mem and cpu indicators are lower max values', () => {
        checkerConf.cpu.thresholdType = 'rate';
        checkerConf.cpu.highWatermark = 75;
        checkerConf.mem.thresholdType = 'rate';
        checkerConf.mem.highWatermark = 0.75;

        const healthChecker = new HealthChecker(checkerConf);

        sinon.stub(healthChecker, '_getCpuCount');
        sinon.stub(healthChecker, '_getTotalMem');
        sinon.stub(healthChecker, '_getFreeMem');
        sinon.stub(healthChecker, '_calculateCpuLoad');

        healthChecker._getTotalMem.returns(2048);
        healthChecker._getFreeMem.returns(700);
        healthChecker._getCpuCount.returns(4);
        healthChecker._cpuUsageList = [100, 50, 60, 30, 60];

        healthChecker._determineHealthIndicators();

        assert.equal(healthChecker.isOverloaded(), false);
        assert.equal(healthChecker.getMemFree(), 700);
        assert.equal(healthChecker.getMemTotal(), 2048);
        assert.equal(healthChecker.getCpuCount(), 4);
        assert.equal(healthChecker.getCpuUsage(), 0.6);
    });

    it('HealthChecker set overload = true if mem and cpu indicators are higher max values', () => {
        checkerConf.cpu.thresholdType = 'none';
        checkerConf.mem.thresholdType = 'rate';
        checkerConf.mem.highWatermark = 0.75;

        const healthChecker = new HealthChecker(checkerConf);

        sinon.stub(healthChecker, 'getCpuCount');
        sinon.stub(healthChecker, '_getTotalMem');
        sinon.stub(healthChecker, '_getFreeMem');
        sinon.stub(healthChecker, '_calculateCpuLoad');

        healthChecker._getTotalMem.returns(2048);
        healthChecker._getFreeMem.returns(300);
        healthChecker.getCpuCount.returns(4);
        healthChecker._cpuUsageList = [100, 80, 60, 90, 70];

        healthChecker._determineHealthIndicators();

        assert.equal(healthChecker.isOverloaded(), true);
        assert.equal(healthChecker.getMemFree(), 300);
        assert.equal(healthChecker.getMemTotal(), 2048);
        assert.equal(healthChecker.getCpuCount(), 4);
        assert.equal(healthChecker.getCpuUsage(), 0.8);
    });

    it('HealthChecker start scheduler', () => {
        const healthChecker = new HealthChecker(checkerConf);

        sinon.stub(healthChecker, '_determineHealthIndicators');

        healthChecker.start();

        const expectedSchedulerClass = 'Timeout';
        const actualSchedulerClass   = healthChecker._healthScheduler.constructor.name;

        assert.equal(healthChecker._status, HealthChecker.STATUS_STARTED);
        assert.isOk(healthChecker._determineHealthIndicators.calledOnce);
        assert.equal(actualSchedulerClass, expectedSchedulerClass);
        assert.equal(healthChecker._healthScheduler._repeat, checkerConf.checkInterval);
    });

    it('HealthChecker second start call throw error', () => {
        const healthChecker = new HealthChecker(checkerConf);

        sinon.stub(healthChecker, '_determineHealthIndicators');

        healthChecker.start();

        const expectedSchedulerClass = 'Timeout';
        const actualSchedulerClass   = healthChecker._healthScheduler.constructor.name;

        assert.equal(healthChecker._status, HealthChecker.STATUS_STARTED);
        assert.isOk(healthChecker._determineHealthIndicators.calledOnce);
        assert.equal(actualSchedulerClass, expectedSchedulerClass);

        assert.throw(() => healthChecker.start());
    });

    it('HealthChecker stop scheduler', () => {
        const healthChecker = new HealthChecker(checkerConf);

        sinon.stub(healthChecker, '_determineHealthIndicators');

        healthChecker.start();
        healthChecker.stop();

        assert.isOk(healthChecker._determineHealthIndicators.calledOnce);
        assert.equal(healthChecker._status, HealthChecker.STATUS_STOPPED);
        assert.equal(healthChecker._healthScheduler._repeat, null);
    });

    it('HealthChecker second stop call throw error', () => {
        const healthChecker = new HealthChecker(checkerConf);

        sinon.stub(healthChecker, '_determineHealthIndicators');

        healthChecker.start();
        healthChecker.stop();

        assert.isOk(healthChecker._determineHealthIndicators.calledOnce);
        assert.equal(healthChecker._status, HealthChecker.STATUS_STOPPED);
        assert.equal(healthChecker._healthScheduler._repeat, null);

        assert.throw(() => healthChecker.stop());
    });
});
