import { action, observable } from 'mobx';
import { CommonStore } from "./CommonStore"
import { RootStore } from "./RootStore";
import { logger } from '../utils/loggingUtils';

const rotationSpeed = .05
const upDownSpeed = 6

export enum KeyEventType {
    UP, DOWN
}

export interface MazeRunnerViewPoint {
    x: number,
    y: number,
    rotation: number
}

export class MazeViewStore extends CommonStore {
    constructor(store: RootStore) {
        super(store);
    }
    @observable runMazeMode: boolean = false
    @observable mazeRunnerViewPoint: MazeRunnerViewPoint = {
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
    @action updateMazeRunnerViewPoint = (newViewPoint: MazeRunnerViewPoint) => {
        this.mazeRunnerViewPoint = newViewPoint
        console.log(`New maze runner view point is ${JSON.stringify(this.mazeRunnerViewPoint)}`)
    }
    @action changeRunMazeMode = () => {
        this.runMazeMode = !this.runMazeMode
        this.runMazeMode ? this.bindKeyDirectionHandler() : this.unbindKeyDirectionHandler()
        console.log(`Entering run maze mode: ${this.runMazeMode} with current view as ${JSON.stringify(this.mazeRunnerViewPoint)}`)
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
    handleKeyEvent = (keyEvent: KeyboardEvent, upOrDown: KeyEventType) => {
        const { keyCode } = keyEvent
        switch (keyCode) {
            //If going up
            case 38:
                if (upOrDown === KeyEventType.UP) {
                    this.mazeRunnerViewPoint.y =  0
                } else if (upOrDown === KeyEventType.DOWN) {
                    this.mazeRunnerViewPoint.y =  -upDownSpeed
                }
                console.log(`Keyevent up fired, new y value ${this.mazeRunnerViewPoint.y}`)
                break;
            //If going right
            case 39:
                if (upOrDown === KeyEventType.UP) {
                    this.mazeRunnerViewPoint.rotation = this.mazeRunnerViewPoint.rotation = 0
                } else if (upOrDown === KeyEventType.DOWN) {
                    this.mazeRunnerViewPoint.rotation = this.mazeRunnerViewPoint.rotation = -rotationSpeed
                }
                console.log(`Keyevent right fired, new rotation value ${this.mazeRunnerViewPoint.rotation}`)
                break;
            //If going down
            case 40:
                if (upOrDown === KeyEventType.UP) {
                    this.mazeRunnerViewPoint.y =  0
                } else if (upOrDown === KeyEventType.DOWN) {
                    this.mazeRunnerViewPoint.y =  upDownSpeed
                }
                console.log(`Keyevent up fired, new y value ${this.mazeRunnerViewPoint.y}`)
                break;
            //If going left
            case 37:
                if (upOrDown === KeyEventType.UP) {
                    this.mazeRunnerViewPoint.rotation = this.mazeRunnerViewPoint.rotation = 0
                } else if (upOrDown === KeyEventType.DOWN) {
                    this.mazeRunnerViewPoint.rotation = this.mazeRunnerViewPoint.rotation = rotationSpeed
                }
                break;
        }
    }
}