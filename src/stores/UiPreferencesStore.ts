import { action, decorate, observable } from 'mobx';
import { CommonStore } from "./CommonStore"
import { RootStore } from "./RootStore";

export class UiPreferencesStore extends CommonStore {
    constructor(store: RootStore) {
        super(store);
    }
    darkModeEnable: boolean = false
    inverseColorMode: boolean = false

    updateDarkModeEnabled = (state: boolean) => {
        this.darkModeEnable = state
    }
    updateInverseColorMode = (state: boolean) => {
        this.inverseColorMode = state
    }
}

decorate(UiPreferencesStore, {
    darkModeEnable: observable,
    inverseColorMode: observable,
    updateDarkModeEnabled: action,
    updateInverseColorMode: action
})