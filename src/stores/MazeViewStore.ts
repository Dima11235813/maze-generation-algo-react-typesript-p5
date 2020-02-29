import { action, observable } from 'mobx';
import { CommonStore } from "./CommonStore"
import { RootStore } from "./RootStore";

export class MazeViewStore extends CommonStore {
    constructor(store: RootStore) {
        super(store);
    }
    @observable mazeView: number = 0

    @action changeView = () => {
        this.mazeView++
        console.log(`Updated maze view to value: ${this.mazeView}`)
    }
}