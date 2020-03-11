import { action, observable } from 'mobx';
import { CommonStore } from "./CommonStore"
import { RootStore } from "./RootStore";
import { logger } from '../utils/loggingUtils';

export class MazeViewStore extends CommonStore {
    constructor(store: RootStore) {
        super(store);
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
    @action changePercentOfCubeProjectionToShow = (value: number) => {
        this.percentOfCubeProjectionToShow = value
        logger(`Updated percentOfCubeProjectionToShow with value: ${this.percentOfCubeProjectionToShow}`)
    }
}