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
    //https://mobx.js.org/refguide/observable-decorator.html
    @observable darkModeEnable: boolean = INVERSE_COLOR_DEFAULT_SETTING
    @observable inverseColorMode: boolean = false
    @observable use3dMode: boolean = true

    @action updateDarkModeEnabled = (state: boolean) => {
        this.darkModeEnable = state
    }
    @action updateInverseColorMode = (state: boolean) => {
        this.inverseColorMode = state
    }
    @action updateUse3dMode = (state: boolean) => {
        this.use3dMode = state
    }
}

//THIS pattern requires
// "emitDecoratorMetadata": true,
// "experimentalDecorators": true,
//in tsconfig 
//TODO research if there's any implication in this decision - the above is easier to write
//https://stackoverflow.com/questions/38271273/experimental-decorators-warning-in-typescript-compilation

// decorate(UiPreferencesStore, {
//     darkModeEnable: observable,
//     inverseColorMode: observable,
//     updateDarkModeEnabled: action,
//     updateInverseColorMode: action
// })