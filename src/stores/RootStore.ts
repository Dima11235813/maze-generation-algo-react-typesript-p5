import { RouterStore } from 'mobx-react-router';
import { UiPreferencesStore } from './UiPreferencesStore';
import { UserStore } from './UserStore';

export class RootStore {
    uiPreferencesStore: UiPreferencesStore
    routerStore: RouterStore
    userStore: UserStore
    constructor() {
        this.routerStore = new RouterStore()
        this.uiPreferencesStore = new UiPreferencesStore(this)
        this.userStore = new UserStore(this)
    }
}
