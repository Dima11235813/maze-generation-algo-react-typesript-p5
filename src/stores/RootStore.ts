import { RouterStore } from 'mobx-react-router';
import { UiPreferencesStore } from './UiPreferencesStore';

export class RootStore {
    uiPreferencesStore: UiPreferencesStore
    routerStore: RouterStore
    constructor() {
        this.routerStore = new RouterStore()
        this.uiPreferencesStore = new UiPreferencesStore(this)
    }
}
