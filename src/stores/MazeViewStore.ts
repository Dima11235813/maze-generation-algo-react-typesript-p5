import { action, observable } from 'mobx';
import { CommonStore } from "./CommonStore"
import { RootStore } from "./RootStore";
import { logger } from '../utils/loggingUtils';

const rotationSpeed = 1

//TODO Set this to be cell width somehow
const upDownSpeed = 10

export enum KeyEventType {
    UP, DOWN
}
export enum Direction {
    FORWARD, BACKWARD
}
export enum RotationDirection {
    LEFT, RIGHT
}

export interface CameraView {
    x: number,
    y: number,
    rotation: number
}

export class MazeViewStore extends CommonStore {
    constructor(store: RootStore) {
        super(store);
        //TODO Remove after dev
        this.bindKeyDirectionHandler()
    }
    @observable peakOffset: number = 0;
    @observable xCameraLocation: number = 0;
    @observable yCameraLocation: number = 0;
    @observable lastRotation: number = 0
    @observable runMazeMode: boolean = false
    @observable appliedRotation: number = 0
    @observable cameraView: CameraView = {
        x: 0,
        y: 0,
        rotation: 0
    }
    @observable mazeView: number = 0
    @observable showGeneratorCubeProjection: boolean = true
    @observable percentOfCubeProjectionToShow: number = 10

    @action changeView = () => {
        this.mazeView++
        logger(`Updated maze view to value: ${this.mazeView}`)
    }
    @action changeShowGeneratorCubeProjection = () => {
        this.showGeneratorCubeProjection = !this.showGeneratorCubeProjection
        logger(`Updated show Generator Cube Projection value: ${this.showGeneratorCubeProjection}`)
    }
    @action updatecameraView = (newViewPoint: CameraView) => {
        this.cameraView = newViewPoint
        console.log(`New maze runner view point is ${JSON.stringify(this.cameraView)}`)
    }
    @action changeRunMazeMode = () => {
        this.runMazeMode = !this.runMazeMode
        this.runMazeMode ? this.bindKeyDirectionHandler() : this.unbindKeyDirectionHandler()
        console.log(`Entering run maze mode: ${this.runMazeMode} with current view as ${JSON.stringify(this.cameraView)}`)
    }
    @action changePercentOfCubeProjectionToShow = (value: number) => {
        this.percentOfCubeProjectionToShow = value
        logger(`Updated percentOfCubeProjectionToShow with value: ${this.percentOfCubeProjectionToShow}`)
    }
    bindKeyDirectionHandler = () => {
        document.addEventListener('keydown', this.handleKeyDown);
        document.addEventListener('keyup', this.handleKeyUp);
    }
    unbindKeyDirectionHandler = () => {
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);
    }
    handleKeyUp = (keyEvent: KeyboardEvent) => {
        this.handleKeyEvent(keyEvent, KeyEventType.UP)
    }
    handleKeyDown = (keyEvent: KeyboardEvent) => {
        this.handleKeyEvent(keyEvent, KeyEventType.DOWN)
    }
    assignForwardBackSpeed = (cameraView: CameraView, direction: Direction) => {
        if (direction === Direction.FORWARD) {
            switch (this.appliedRotation) {
                case 0:
                    cameraView.x = upDownSpeed
                    this.xCameraLocation += upDownSpeed
                    break;
                case 1:
                    cameraView.y = -upDownSpeed
                    this.yCameraLocation -= upDownSpeed
                    break;
                case 2:
                    cameraView.x = -upDownSpeed
                    this.xCameraLocation -= upDownSpeed
                    break;
                case 3:
                    cameraView.y = upDownSpeed
                    this.yCameraLocation += upDownSpeed
                    break;
            }
        } else if (direction === Direction.BACKWARD) {
            switch (this.appliedRotation) {
                case 0:
                    cameraView.x = -upDownSpeed
                    this.xCameraLocation -= upDownSpeed
                    break;
                case 1:
                    cameraView.y = upDownSpeed
                    this.yCameraLocation += upDownSpeed
                    break;
                case 2:
                    cameraView.x = upDownSpeed
                    this.xCameraLocation += upDownSpeed
                    break;
                case 3:
                    cameraView.y = -upDownSpeed
                    this.yCameraLocation -= upDownSpeed
                    break;
            }
        }
    }
    handleKeyEvent = (keyEvent: KeyboardEvent, upOrDown: KeyEventType) => {
        const { keyCode } = keyEvent
        switch (keyCode) {
            //Peek
            case 80:
                this.handlePeak(upOrDown)
                break;
            //If going up
            case 38:
                if (upOrDown === KeyEventType.UP) {
                    this.cameraView.y = 0
                } else if (upOrDown === KeyEventType.DOWN) {
                    this.assignForwardBackSpeed(this.cameraView, Direction.FORWARD)
                }
                break;
            //If going down
            case 40:
                if (upOrDown === KeyEventType.UP) {
                    this.cameraView.y = 0
                } else if (upOrDown === KeyEventType.DOWN) {
                    this.assignForwardBackSpeed(this.cameraView, Direction.BACKWARD)
                }
                break;
            //If going right
            case 39:
                if (upOrDown === KeyEventType.UP) {
                    this.cameraView.rotation = 0
                } else if (upOrDown === KeyEventType.DOWN) {
                    this.cameraView.rotation -= rotationSpeed
                    this.applyRotationLogic(RotationDirection.RIGHT)
                }
                break;
            //If going left
            case 37:
                if (upOrDown === KeyEventType.UP) {
                    this.cameraView.rotation = 0
                } else if (upOrDown === KeyEventType.DOWN) {
                    this.cameraView.rotation += rotationSpeed
                    this.applyRotationLogic(RotationDirection.LEFT)
                }

                break;
        }
        this.logCameraViewData()
    }
    logCameraViewData = () => {
        console.log(`
            rotation value ${this.cameraView.rotation}
            y value ${this.cameraView.y}
            x value ${this.cameraView.x}
            last rotation ${this.lastRotation}
            appliedRotation = ${this.appliedRotation}
            x camera location ${this.xCameraLocation}
            y camera location ${this.yCameraLocation}
            `)

    }
    applyRotationLogic = (direction: RotationDirection) => {
        if (this.appliedRotation === 0) {
            if (direction === RotationDirection.RIGHT) {
                this.appliedRotation = 3
            } else if (direction === RotationDirection.LEFT) {
                this.appliedRotation = 1
            }
        } else if (this.appliedRotation === 3) {
            if (direction === RotationDirection.RIGHT) {
                this.appliedRotation = 2
            } else if (direction === RotationDirection.LEFT) {
                this.appliedRotation = 0
            }
        } else {
            if (direction === RotationDirection.RIGHT) {
                if (this.appliedRotation < 4) this.appliedRotation += this.cameraView.rotation
            } else if (direction === RotationDirection.LEFT) {
                if (this.appliedRotation > 0) this.appliedRotation += this.cameraView.rotation
            }
        }
        this.lastRotation = this.cameraView.rotation
    }
    handlePeak = (keyEventType: KeyEventType) => {
        const peakOffsetDefault = 50
        if (keyEventType === KeyEventType.UP) {
            this.peakOffset = 0
        } else if (keyEventType === KeyEventType.DOWN && this.peakOffset !== peakOffsetDefault) {
            this.peakOffset = peakOffsetDefault
        }
    }
}