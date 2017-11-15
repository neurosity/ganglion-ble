import { parseGanglion } from 'openbci-utilities/dist/utilities';
import { numberOfChannelsForBoardType, rawDataToSampleObjectDefault } from 'openbci-utilities/dist/constants';
import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import 'rxjs/add/operator/do';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/first';
import 'rxjs/add/operator/filter';
import 'rxjs/add/operator/takeUntil';
import 'rxjs/add/operator/mergeMap';
import 'rxjs/add/observable/fromEvent';

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
        this.boardName = 'ganglion';
        this.channelSize = numberOfChannelsForBoardType(this.boardName);
        this.rawDataPacketToSample = rawDataToSampleObjectDefault(this.channelSize);
        this.connectionStatus = new BehaviorSubject(false);
        this.stream = new Subject()
            .map(event => this.eventToBufferMapper(event))
            .do(buffer => this.setRawDataPacket(buffer))
            .map(() => parseGanglion(this.rawDataPacketToSample))
            .mergeMap(x => x)
            .takeUntil(this.onDisconnect$);
    }

    eventToBufferMapper (event) {
        return new Uint8Array(event.target.value.buffer);
    }

    setRawDataPacket (buffer) {
        this.rawDataPacketToSample.rawDataPacket = buffer;
    }
    
    async connect () {
        this.device = await navigator.bluetooth.requestDevice(deviceOptions);
        this.addDisconnectedEvent();
        this.gatt = await this.device.gatt.connect();
        this.deviceName = this.gatt.device.name;
        this.service = await this.gatt.getPrimaryService(serviceId);
        this.setCharacteristics(await this.service.getCharacteristics());
        this.connectionStatus.next(true);
    }

    setCharacteristics (characteristics) {
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

    addDisconnectedEvent () {
        Observable.fromEvent(this.device, 'gattserverdisconnected')
            .first()
            .subscribe(() => {
                this.gatt = null;
                this.device = null;
                this.deviceName = null;
                this.service = null;
                this.characteristics = null;
                this.connectionStatus.next(false);
            });
    }

    disconnect () {
        if (!this.gatt) { return };
        this.onDisconnect$.next();
        this.gatt.disconnect();
    }
}
