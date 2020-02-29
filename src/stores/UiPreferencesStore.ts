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
    @observable mazeOptionsIsOpen: boolean = false
    @observable animateMirror: boolean = false

    @action updateDarkModeEnabled = () => {
        this.darkModeEnable = !this.darkModeEnable
    }
    @action toggleInverseColorMode = () => {
        this.inverseColorMode = !this.inverseColorMode
    }
    @action toggleUpdateUse3dMode = () => {
        this.use3dMode = !this.use3dMode
    }
    @action toggleMazeOptionsIsOpen = () => {
        this.mazeOptionsIsOpen = !this.mazeOptionsIsOpen
    }
    @action toggleAnimateMirror = () => {
        this.animateMirror = !this.animateMirror
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
//     toggleInverseColorMode: action
// })