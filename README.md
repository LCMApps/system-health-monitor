# System Health Monitor for node

[![NPM version](https://img.shields.io/npm/v/system-health-monitor.svg)](https://www.npmjs.com/package/system-health-monitor)
[![Release Status](https://github.com/LCMApps/system-health-monitor/workflows/NPM%20Release/badge.svg)](https://github.com/LCMApps/system-health-monitor/releases)
[![Build Status](https://travis-ci.org/LCMApps/system-health-monitor.svg?branch=master)](https://travis-ci.org/LCMApps/system-health-monitor)
[![Coverage Status](https://coveralls.io/repos/github/LCMApps/system-health-monitor/badge.svg?branch=master)](https://coveralls.io/github/LCMApps/system-health-monitor?branch=master)

Module allows controlling CPU and memory usage of the Linux host it runs on. It may be configured for:
* usage of the different strategies of CPU monitoring: simple last value or
[simple moving average](https://en.wikipedia.org/wiki/Moving_average#Simple_moving_average).
* recognizing service overload basing on the settings.

The main goal of this module is to help determine host overload and provide a simple solution to balance the load
between multiple instances using [Amazon ELB](https://aws.amazon.com/elasticloadbalancing/),
[HAProxy](https://www.haproxy.org/), [consul](https://www.consul.io/),
[etcd](https://coreos.com/etcd/docs/latest/) or even your custom solution.

Please, check the full documentation below.

**Table of Contents**

* [Installation and Usage](#installation)
* [Mem Overload Control](#mem-overload-control)
* [CPU Overload Control](#cpu-overload-control)
* [How Does the Service Run Memory Checks?](#mem-checks-details)
* [How Does the Service Check CPU Usage?](#cpu-checks-details)

# <a name="installation"></a>Installation and Usage

Using npm:
```shell
$ npm install --save system-health-monitor
```

Using yarn:
```shell
$ yarn add system-health-monitor
```

After you've installed i, set it up and start the service in your code. Note, that it's a basic example which doesn't
cover overload checks.

```js
const SystemHealthMonitor = require('system-health-monitor');

const monitorConfig = {
    checkIntervalMsec: 1000,
    mem: {
        thresholdType: 'none'
    },
    cpu: {
        calculationAlgo: 'last_value',
        thresholdType: 'none'
    }
};
const monitor = new SystemHealthMonitor(monitorConfig);
monitor.start()
    .then(
        // your code
        monitor.stop();
    )
    .catch(err => {
        console.error(err);
        process.exit(1);
});
```

This simple example checks system info every second (`checkIntervalMsec` option) and provides information about the
current amount of free memory, total amount of memory, CPU usage (avg by cores) and amount of available cores.

To collect all the data described above you may use the following methods:
* `monitor.getMemTotal()` returns total amount of memory in megabytes on the host, returned value is an integer;
* `monitor.getMemFree()` returns amount of the free memory in megabytes, returned value is an integer;
* `monitor.getCpuCount()` returns total amount of CPU cores;
* `monitor.getCpuUsage()` returns value from 0 to 100 that indicates average CPU utilization by all cores of all
processors;


All `get` methods throws an error on stopped service. To start service just call `monitor.start()`. This method
returns promise and may fail on incompatible and unsupportable platforms. Service cannot stop by itself after start.
To stop service call the `monitor.stop()` method.

The main feature of the service is its ability to use different strategies to check the host's load and make decisions
whether it’s overloaded or not. Default behavior shown above doesn't make any extra checks and doesn't recognize
overload.

Using mem and CPU overload control settings you may experience all the power of the module. Please notice that
`system-health-monitor` will mark the host as overloaded if at least one check becomes overloaded.

# <a name="mem-overload-control"></a>Mem Overload Control

To enable memory control set `mem.thresholdType` to one of the following values:
* `fixed` to track minimum amount of memory available on the host;
* `rate` to track free/total ratio.

`mem` and `mem.thresholdType` fields are mandatory.

With `mem.thresholdType == 'fixed'` you need to specify the `mem.minFree` option. This option must be an integer and it
specifies minimum amount of free memory on the host. If free memory drops below `mem.minFree` the service becomes
overloaded and `monitor.isOverloaded()` returns `true`.

The following configuration will mark the system as overloaded when amount of free memory becomes less then 100 Mbytes:
```js
const monitorConfig = {
    checkIntervalMsec: 1000,
    mem: {
        thresholdType: 'fixed',
        minFree: 100
    },
    cpu: {
        calculationAlgo: 'last_value',
        thresholdType: 'none'
    }
};
```

With `mem.thresholdType == 'rate'` you need to specify the `mem.highWatermark` option. This option must be a float
between 0 and 1 and it specifies maximum ratio of used memory to total memory that can be considered as healthy.
If used/total ratio goes above `mem.highWatermark` the service becomes overloaded. For example: for a host with 8 GB
of total memory and 2 Gb of free memory the usage ratio is 0.75 and with `mem.highWatermark == 0.8` host is still
alive, but with `mem.highWatermark == 0.7` it is considered overloaded.

The following configuration will mark the system as overloaded when the usage ratio becomes more than 0.8:
```js
const monitorConfig = {
    checkIntervalMsec: 1000,
    mem: {
        thresholdType: 'rate',
        highWatermark: 0.8
    },
    cpu: {
        calculationAlgo: 'last_value',
        thresholdType: 'none'
    }
};
```

# <a name="cpu-overload-control"></a>CPU Overload Control


Utilization of core over period is a result of division of the time the core was running user or kernel processes
by amount of elapsed time between sequential checks during the period (controlled by `checkIntervalMsec` option).
The average utilization is an arithmetical mean of utilization values of all available cores.

For example: for a host with 4 CPU cores available and values of utilization between two
sequential calls that equals to 18%, 93%, 27% and 35%, the avg utilization is `((18+93+27+35)/4)/100 == 0.4325`.

To enable CPU control set `cpu.thresholdType` with `rate` value and choose `cpu.highWatermark` threshold.
This threshold must be a float between 0 and 1 and. It specifies threshold of average utilization. 

Also, you need to choose an algorithm of utilization. `cpu.calculationAlgo` must be one of the following values:
* `last_value` to determine overload using only last fetched CPU utilization info between two sequential calls. It's
similar to a Linux `top` command output;
* `sma` to determine overload with
[simple moving average](https://en.wikipedia.org/wiki/Moving_average#Simple_moving_average) algorithm.

`cpu.calculationAlgo == 'sma'` requires to set `cpu.periodPoints` to calculate the moving average. For example,
with `cpu.periodPoints == 5` service will store average utilization for 5 points and then will calculate
the moving average. Such strategy helps to smoothen outliers in data, such as short-living but computationally heavy
processes, and prevents from marking itself as overloaded.

Example of config with `cpu.calculationAlgo = 'last_value'`:
```js
const monitorConfig = {
    checkIntervalMsec: 1000,
    mem: {
        thresholdType: 'rate',
        highWatermark: 0.8
    },
    cpu: {
        thresholdType: 'rate',
        highWatermark: 0.8,
        calculationAlgo: 'last_value'
    }
};
```

If avg utilization for a 1 second becomes greater than 80% the service will be marked as overloaded.

Example of config with `cpu.calculationAlgo = 'sma'`:
```js
const monitorConfig = {
    checkIntervalMsec: 1000,
    mem: {
        thresholdType: 'rate',
        highWatermark: 0.8
    },
    cpu: {
        thresholdType: 'rate',
        highWatermark: 0.8,
        calculationAlgo: 'sma',
        periodPoints: 5
    }
};
```

If avg utilization for a 1 second becomes greater than 80%, but lower than 80% for the next 4 seconds, the moving
average becomes less than 80% and the service will not be marked as overloaded.

**_Note!_** With `sma` strategy service stays overloaded for `checkIntervalMsec * cpu.periodPoints` milliseconds and
`monitor.getCpuUsage()` returns `100`. That's because the monitor has no data for sequential `cpu.periodPoints` periods.

# <a name="mem-checks-details"></a>How Does the Service Run Memory Checks?

Service uses Linux virtual system file `/proc/meminfo`. Free memory is a memory that may be freed by OS and utilized
by user processes. Let's look at Linux `free` program output which is based on `/proc/meminfo` too.

```shell
$ free -m
             total       used       free     shared    buffers     cached
Mem:          6144       5947        196         10          0       5022
-/+ buffers/cache:        924       5219
Swap:          512        422         89
```

Total memory is 6144 MB and free memory is a value of `total - used + buffers + cached`. In this example, there's
5219 MB free memory. 
In `/proc/meminfo` file total memory is the value of `MemTotal` field. Free memory calculated as the sum of fields
`MemFree`, `Buffers`, `Cached` and `SReclaimable`. `SReclaimable` - The part of RAM used by the kernel to cache data 
structures for its own use, and can be reclaimed, such as caches.

Total amount of memory may change between calls in virtual environments.

**_Note!_** Service returns `-1` for `monitor.getMemFree()` and `monitor.getMemTotal()` calls on systems that
doesn't have `/proc/meminfo`.

# <a name="cpu-checks-details"></a>How Does the Service Check CPU Usage?

The amount of CPU cores may vary in virtual environments and service may return different values in runtime. It's a
normal behaviour. Amount of cores and average utilization is calculated using Linux virtual system file `/proc/stat`:

```shell
$ cat /proc/stat
cpu  2468011 93 1895218 2074036491 8489135 0 298431 140633 0 0
cpu0 193221 6 138656 129428364 561751 0 24729 12892 0 0
cpu1 180009 5 132206 129523256 565967 0 19897 9599 0 0
cpu2 167629 5 129160 129496132 555672 0 42950 12013 0 0
cpu3 160527 1 123302 129593091 549019 0 17765 8861 0 0
cpu4 154441 6 120384 129618649 541504 0 17336 8562 0 0
cpu5 152489 9 118711 129633153 535548 0 16906 8468 0 0
cpu6 149576 7 117104 129643970 533544 0 16632 8382 0 0
cpu7 150117 2 115407 129653960 526582 0 16252 8209 0 0
cpu8 146830 6 114208 129667525 521570 0 16179 8161 0 0
cpu9 145896 6 113281 129676717 516285 0 15984 8034 0 0
cpu10 148127 4 114799 129655519 522416 0 16118 8159 0 0
cpu11 145447 0 112945 129680421 515379 0 15780 7992 0 0
cpu12 143579 6 111053 129695472 507535 0 15411 7796 0 0
cpu13 143100 6 110482 129695659 509306 0 15296 7726 0 0
cpu14 144229 11 112923 129680456 517374 0 15758 7893 0 0
cpu15 142789 6 110589 129694140 509675 0 15432 7878 0 0
```

`monitor.getCpuCount()` is an amount of line in that file with `cpu{%NO%}`.

First line of the file specifies the amount of time (measured in USER_HZ) during which the system was in different
states.

```shell
cpu  2468011 93 1895218 2074036491 8489135 0 298431 140633 0 0
```

* first column with value `2468011` is the amount of time spent in `user` state;
* second column with value `93` - in `nice` state;
* third column with value `1895218` - in `system` state;
* fourth column with value `2074036491` - in `idle` state;

Using the values above we may calculate `work` that is all work that cores have done (even idle):
`work` = `user + nice + system + idle`.

On the other hand, useful load is `busy` = `user + nice + system` (without idle).

Let's consider that `checkIntervalMsec` is 1000 ms. To calculate avg usage for one-second-long period of time
we need to calculate the current value and the value 1000 ms ago.
`usage` = `100.0 * (busy - prevBusy) / (work - prevWork)`. 

`monitor.getCpuUsage()` returns `usage` value for `last_value` strategy.
