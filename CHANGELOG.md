## Changelog

### 1.2.1

- Dependencies was bumped

### 1.2.0

- Algorithm of calculation free memory was tuned and now it considers `SReclaimable` as a memory that may be freed (`free` in the output).
- Minor bug with timers in tests was fixed.
- Versions of devDependencies were bumped.

### 1.1.0

- `checkInterval` field in the options of the `SystemHealthMonitor`'s constructor was refactored to
`checkIntervalMsec`. Code becomes more straightforward.
