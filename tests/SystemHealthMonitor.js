/* eslint-disable max-len */
'use strict';

const fs     = require('fs');
const sinon  = require('sinon');
const assert = require('chai').assert;

const SystemHealthMonitor = require('../index');

const meminfoMock = fs.readFileSync('./tests/meminfoMock.txt', 'utf8');

describe('SystemHealthMonitor', () => {
    describe('SystemHealthMonitor methods tests', () => {
        let checkerConf = {
            checkIntervalMsec: 15000,
            mem:           {
                thresholdType: 'none',
                minFree:       1024,
                highWatermark: 0.75
            },
            cpu:           {
                calculationAlgo: 'sma',
                thresholdType:   'none',
                periodPoints:    5,
                highWatermark:   0.75
            }
        };

        const expectedSchedulerClass = 'Timeout';

        let systemMonitor;

        beforeEach(() => {
            systemMonitor = new SystemHealthMonitor(checkerConf);
        });

        it('SystemHealthMonitor start successfully', async () => {
            const determineHealthIndicatorsSpy = sinon.spy(systemMonitor, '_determineHealthIndicators');
            const setIntervalSpy = sinon.spy(global, 'setInterval');

            await systemMonitor.start();

            const actualSchedulerClass = systemMonitor._healthScheduler.constructor.name;

            assert.equal(systemMonitor._status, SystemHealthMonitor.STATUS_STARTED);
            assert.isTrue(determineHealthIndicatorsSpy.calledOnce);
            assert.isTrue(determineHealthIndicatorsSpy.calledWithExactly());
            assert.equal(actualSchedulerClass, expectedSchedulerClass);
            assert.isTrue(setIntervalSpy.calledOnce);
            assert.isTrue(setIntervalSpy.calledWithExactly(
                systemMonitor._determineHealthIndicators,
                checkerConf.checkIntervalMsec
            ));

            clearInterval(systemMonitor._healthScheduler);
        });

        it('SystemHealthMonitor second start call throw error', async () => {
            const determineHealthIndicatorsSpy = sinon.stub(systemMonitor, '_determineHealthIndicators');

            await systemMonitor.start();

            try {
                await systemMonitor.start();
                assert.fail('service second start success', 'service second start throw error');
            } catch (err) {
                const actualSchedulerClass = systemMonitor._healthScheduler.constructor.name;

                assert.instanceOf(err, Error);
                assert.equal(err.message, 'SystemHealthMonitor service is already started');
                assert.equal(systemMonitor._status, SystemHealthMonitor.STATUS_STARTED);
                assert.isTrue(determineHealthIndicatorsSpy.calledOnce);
                assert.isTrue(determineHealthIndicatorsSpy.calledWithExactly());
                assert.equal(actualSchedulerClass, expectedSchedulerClass);
            }

            clearInterval(systemMonitor._healthScheduler);
        });

        it('SystemHealthMonitor stop scheduler', async () => {
            const determineHealthIndicatorsSpy = sinon.stub(systemMonitor, '_determineHealthIndicators');
            const clearIntervalSpy = sinon.spy(global, 'clearInterval');

            await systemMonitor.start();
            systemMonitor.stop();

            assert.isTrue(determineHealthIndicatorsSpy.calledOnce);
            assert.isTrue(determineHealthIndicatorsSpy.calledWithExactly());
            assert.equal(systemMonitor._status, SystemHealthMonitor.STATUS_STOPPED);
            assert.isTrue(clearIntervalSpy.calledOnce);
            assert.isTrue(clearIntervalSpy.calledWithExactly(systemMonitor._healthScheduler));

            clearIntervalSpy.restore();
        });

        it('SystemHealthMonitor second stop call throw error', async () => {
            const determineHealthIndicatorsSpy = sinon.stub(systemMonitor, '_determineHealthIndicators');
            const clearIntervalSpy = sinon.spy(global, 'clearInterval');

            await systemMonitor.start();
            systemMonitor.stop();

            assert.throws(() => {
                systemMonitor.stop();
            }, 'SystemHealthMonitor service is not started');

            assert.isTrue(determineHealthIndicatorsSpy.calledOnce);
            assert.isTrue(determineHealthIndicatorsSpy.calledWithExactly());
            assert.equal(systemMonitor._status, SystemHealthMonitor.STATUS_STOPPED);
            assert.isTrue(clearIntervalSpy.calledOnce);
            assert.isTrue(clearIntervalSpy.calledWithExactly(systemMonitor._healthScheduler));

            clearIntervalSpy.restore();
        });

        const publicInfoMethods = ['getMemTotal', 'getMemFree', 'getCpuCount', 'getCpuUsage', 'isOverloaded'];

        publicInfoMethods.forEach((method) => {
            it(`SystemHealthMonitor method ${method} throw err because service not started`, () => {
                assert.throws(() => {
                    systemMonitor[method]();
                }, 'SystemHealthMonitor service is not started');
            });
        });

        it('Parse data from /proc/meminfo and calculate free and total memory indicators', async () => {
            const expectedMemTotal = 7879;
            const expectedMemFree  = 4371;

            const readMeminfoFileStub = sinon.stub(systemMonitor, '_readMeminfoFile');

            readMeminfoFileStub.resolves(meminfoMock);

            const result = await systemMonitor._getMemInfo();

            assert.isUndefined(result);
            assert.strictEqual(systemMonitor._memTotal, expectedMemTotal);
            assert.strictEqual(systemMonitor._memFree, expectedMemFree);
            assert.isTrue(readMeminfoFileStub.calledOnce);
            assert.isTrue(readMeminfoFileStub.calledWithExactly());
        });

        it('Read data from /proc/meminfo throw err. Free and total memory indicators set to -1', async () => {
            const expectedMemTotal = -1;
            const expectedMemFree  = -1;

            const readMeminfoFileStub = sinon.stub(systemMonitor, '_readMeminfoFile');

            readMeminfoFileStub.rejects();

            const result = await systemMonitor._getMemInfo();

            assert.isUndefined(result);
            assert.strictEqual(systemMonitor._memTotal, expectedMemTotal);
            assert.strictEqual(systemMonitor._memFree, expectedMemFree);
            assert.isTrue(readMeminfoFileStub.calledOnce);
            assert.isTrue(readMeminfoFileStub.calledWithExactly());
        });
    });
});
