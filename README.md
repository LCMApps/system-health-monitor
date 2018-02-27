**System Health Monitor**

[![Build Status](https://travis-ci.org/LCMApps/system-health-monitor.svg?branch=master)](https://travis-ci.org/LCMApps/system-health-monitor)
[![Coverage Status](https://coveralls.io/repos/github/LCMApps/system-health-monitor/badge.svg?branch=master)](https://coveralls.io/github/LCMApps/system-health-monitor?branch=master)

Модуль контроллирует загруженность сервера на котором запущен с определенным интервалом (задается в конфиге).

**Создание нового инстанса**

    systemHealthMonitor = new SystemHealthMonitor(config);

, где `config` - объект с полями

    checkInterval: {uint32} - интервал в мс с которым сервис будет проверять состояние сервера;
    
    mem:
        thresholdType: {'none', 'fixed', 'rate'} - тип проверки перегрузки по памяти;
        minFree: {uint32} - (required for thresholdType = fixed), минимально допустимый объем свободной памяти в MB;
        highWatermark: {float} - (required for thresholdType = rate), максимально допустимый процент использования памяти (0, 1];
        
    cpu:
        calculationAlgo: {'sma', 'last_value'} - алгоритм для определения нагрузки на CPU;
        thresholdType: {'none', 'rate'} - тип проверки перегрузки по CPU;
        periodPoints: {uint32} - (required for calculationAlgo = sma), количество значений нагрузки за предыдущие периоды;
        highWatermark: {float} - (required for thresholdType = rate), максимально допустимый процент использования CPU (0, 1];

**Запуск сервиса**

    startPromise = systemHealthMonitor.start();
    
Метод `start` возвращает Promise.

Пока сервис не будет запущен, другие его методы будут бросать ошибку.

**Остановка сервиса**

    systemHealthMonitor.stop();

**Определение общей и свободной оперативной памяти**

    totalMem = systemHealthMonitor.getMemTotal();
    freeMem = systemHealthMonitor.getMemFree();

`getMemTotal` и `getMemFree` возвращают значение в MB.

Подзадача определяет общее количество памяти на сервере и количество свободной памяти. 
Свободная память является такой, которая может быть выделена процессом. И расчитывается как сума значений полей 
`MemFree`, `Buffers`, `Cached` из системного файла `'/proc/meminfo'`.

**_Важно!_**
Определение показателей RAM работает только для ОС в которых существует системный файл `'/proc/meminfo'`, 
в другом случае значение полей будет равно `-1`.

**Определение количества ядер процесора и его загруженности**

    cpuCount = systemHealthMonitor.getCpuCount();
    cpuUsage = systemHealthMonitor.getCpuUsage();

`getCpuUsage` возвращает значение в процентах от 0 до 100.

Количество ядер CPU может меняться с течением времени, могут добавляться ядра или убираться. 
Количества ядер и загруженность процесора определяются на базе данных из системного файла `/proc/stat`.

При _calculationAlgo = last_value_ :

    load =  (currentBusyTime - previousBusyTime) / (currentWorkTime - previousWorkTime)

При _calculationAlgo = sma_ для определения нагрузки используется алгоритм Simple Moving Average.
Для расчета использується N (задается в конфиге) значений нагрузки за предыдущие периоды. 
Пока не собрано N значений, то cpu.usage остается равным 100.

**Определение статуса сервера**

    cpuCount = systemHealthMonitor.isOverloaded();
    
`isOverloaded` возвращает значение `true` или `false`.

Перегруженность сервера определяется на основании переданых конфигов и показателей RAM и CPU.

Если хотя бы одно значений сервиса не удалось расчитать, то `isOverloaded` возвращает `false`.
