import { action, decorate, computed, observable } from 'mobx';
import { CommonStore } from "./CommonStore"
import { RootStore } from "./RootStore";

export class BrowserInfoStore extends CommonStore {
    constructor(store: RootStore) {
        super(store);
        this.setBrowserDimensions()
    }
    @observable windowHeight: any
    @observable windowWidth: any

    @action setBrowserDimensions = () => {
        const heightPadding = 80
        const widthPadding = 20
        this.windowHeight = window.innerHeight - heightPadding
        this.windowWidth = window.innerWidth - widthPadding
    }
    @computed get halfWindowHeight() {
        return this.windowHeight / 2
    }
    @computed get halfWindowWidth() {
        return this.windowWidth / 2
    }
}
