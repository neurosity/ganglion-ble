import { parseGanglion } from 'openbci-utilities/dist/utilities';
import { Subject } from 'rxjs/Subject';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import {
    numberOfChannelsForBoardType,
    rawDataToSampleObjectDefault
} from 'openbci-utilities/dist/constants';

import { tap } from 'rxjs/operators/tap';
import { map } from 'rxjs/operators/map';
import { first } from 'rxjs/operators/first';
import { filter } from 'rxjs/operators/filter';
import { takeUntil } from 'rxjs/operators/takeUntil';
import { mergeMap } from 'rxjs/operators/mergeMap';
import { fromEvent } from 'rxjs/observable/fromEvent';

import { renameDataProp } from './utils';

import {
    DEVICE_OPTIONS as deviceOptions,
    GANGLION_SERVICE_ID as serviceId,
    CHARACTERISTICS as characteristicsByType,
    CHARACTERISTIC_EVENT as onCharacteristic,
    DISCONNECTED_EVENT as onDisconnected,
    COMMAND_STRINGS as commandStrings,
    BOARD_NAME as boardName
} from './constants';

export default class Ganglion {

    constructor (options = {}) {
        this.options = options;
        this.gatt = null;
        this.device = null;
        this.deviceName = null;
        this.service = null;
        this.characteristics = null;
        this.onDisconnect$ = new Subject();
        this.boardName = boardName;
        this.channelSize = numberOfChannelsForBoardType(boardName);
        this.rawDataPacketToSample = rawDataToSampleObjectDefault(this.channelSize);
        this.connectionStatus = new BehaviorSubject(false);
        this.stream = new Subject().pipe(
            map(event => this.eventToBufferMapper(event)),
            tap(buffer => this.setRawDataPacket(buffer)),
            map(() => parseGanglion(this.rawDataPacketToSample)),
            mergeMap(x => x),
            map(renameDataProp),
            takeUntil(this.onDisconnect$)
        );
        this.accelData = this.stream.pipe(
            filter(sample => sample.accelData.length)
        );
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
        const commands = Object.entries(commandStrings)
            .reduce((acc, [ key, command ]) => ({
                ...acc,
                [key]: new TextEncoder().encode(command)
            }), {});

        reader.startNotifications();
        reader.addEventListener(onCharacteristic, event => {
            this.stream.next(event);
        });

        if (this.options.accelData) {
            await writer.writeValue(commands.accelData);
            reader.readValue();
        }
        await writer.writeValue(commands.start);
        reader.readValue();
    }

    addDisconnectedEvent () {
        fromEvent(this.device, onDisconnected)
            .pipe(first())
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
