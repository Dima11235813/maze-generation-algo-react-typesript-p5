import { action, decorate, observable } from 'mobx';
import { CommonStore } from "./CommonStore"
import { RootStore } from "./RootStore";

//TODO add to presets or consts file

export const INVERSE_COLOR_DEFAULT_SETTING = false
export const DARK_MODE_DEFAULT_SETTING = false

export class UiPreferencesStore extends CommonStore {
    constructor(store: RootStore) {
        super(store);
    }
    darkModeEnable: boolean = INVERSE_COLOR_DEFAULT_SETTING
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