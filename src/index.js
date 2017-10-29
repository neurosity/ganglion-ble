import { Subject } from 'rxjs/Subject';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/takeUntil';

import {
    DEVICE_OPTIONS as deviceOptions,
    GANGLION_SERVICE_ID as serviceId,
    CHARACTERISTICS as characteristicsByType,
    CHARACTERISTIC_EVENT as onCharacteristic,
    START_COMMAND_STRING as startCommandString
} from './constants';

export default class Ganglion {

    constructor () {
        this.gatt = null;
        this.device = null;
        this.deviceName = null;
        this.service = null;
        this.characteristics = null;
        this.onDisconnect$ = new Subject();
        this.decompressedSamples = [];
        this.stream = new Subject()
            .map(this.eventToBuffer)
            .takeUntil(this.onDisconnect$);
    }
    
    async connect () {
        this.device = await navigator.bluetooth.requestDevice(deviceOptions);
        this.gatt = await this.device.gatt.connect();
        this.deviceName = this.gatt.device.name;
        this.service = await this.gatt.getPrimaryService(serviceId);
        const characteristics = await this.service.getCharacteristics();

        this.characteristics = Object
            .entries(characteristicsByType)
            .reduce((map, [ name, uuid ]) => ({
                ...map,
                [name]: characteristics.find(c => c.uuid === uuid)
            }), {});
    }

    async start () {
        const { reader, writer } = this.characteristics;
        const encoder = new TextEncoder();
        const startCommand = encoder.encode(startCommandString);

        reader.startNotifications();
        reader.addEventListener(onCharacteristic, event => {
            this.stream.next(event);
        });

        await writer.writeValue(startCommand);
        reader.readValue();
    }

    eventToBuffer (event) {
        return new Uint8Array(event.target.value.buffer);
    }

    disconnect () {
        if (!this.gatt) { return };
        this.onDisconnect$.next();
        this.gatt.disconnect();
    }
}
