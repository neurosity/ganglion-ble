# OpenBCI Ganglion

WebBluetooth client for the Ganglion EEG board by OpenBCI

## Installation

`npm install --save ganglion-ble`

## Usage

``` js
import Ganglion from 'ganglion-ble';

const ganglion = new Ganglion();
await ganglion.connect();

ganglion.stream.subscribe(sample => {
    console.log('sample', sample);
});
```

A sample consists of:

``` js
{
  data: [Number, Number, Number, Number],
  timestamp: Date
};
```

> For security reasons, WebBLE must be started from user interaction. Add a connect button that would start the BLE connection. See ./examples/basic/index.js

## Demo

* Clone this repo
* `npm install`
* `npm start`
* Go to http://localhost:900/examples/basic

### License

MIT