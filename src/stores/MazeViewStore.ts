import { action, observable } from 'mobx';
import { CommonStore } from "./CommonStore"
import { RootStore } from "./RootStore";

export enum MazeViews {
    MAIN,
    ONE_HALF,
    ONE_THIRD,
    ONE_FOURTH,
    ONE_FIFTH,
    FOLLOW,
    BIRDS_EYE,
}

export class MazeViewStore extends CommonStore {
    constructor(store: RootStore) {
        super(store);
    }
    @observable mazeView: MazeViews = MazeViews.MAIN

    @action changeView = () => {
        this.mazeView++
        console.log(`Updated maze view to value: ${this.mazeView}`)
    }
}