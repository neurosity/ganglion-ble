# OpenBCI Ganglion

WebBluetooth client for the Ganglion EEG board by OpenBCI

## Installation

`npm install --save ganglion-ble`

## Usage

``` js
import Ganglion from 'ganglion-ble';

const ganglion = new Ganglion();
await ganglion.connect();
await ganglion.start();

ganglion.stream.subscribe(sample => {
    console.log('sample', sample);
});
```

Currently, a sample consists of a Uint8Array of 20. Next steps are to process this buffer into a sample following this data structure:

``` js
{
  data: [Number, Number, Number, Number],
  timestamp: Date
};
```

> For security reasons, WebBLE must be started from user interaction. Add a connect button that would start the BLE connection. See ./examples/basic/index.js

## Accelerometer data example

``` js
import Ganglion from 'ganglion-ble';

const ganglion = new Ganglion({
  accelData: true
});
await ganglion.connect();
await ganglion.start();

ganglion.accelData.subscribe(sample => {
    console.log('sample with accelData', sample);
});
```

## Demo

* Clone this repo
* `npm install`
* `npm start`
* Go to http://localhost:900/examples/basic

### License

MIT