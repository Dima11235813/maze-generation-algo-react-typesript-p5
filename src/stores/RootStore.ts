import { RouterStore } from 'mobx-react-router';
import { UiPreferencesStore } from './UiPreferencesStore';
import { UserStore } from './UserStore';
import { MazeViewStore } from './MazeViewStore';
import { BrowserInfoStore } from './BrowserInfoStore';

export class RootStore {
    uiPreferencesStore: UiPreferencesStore
    mazeViewStore: MazeViewStore
    routerStore: RouterStore
    userStore: UserStore
    browserInfoStore: BrowserInfoStore
    constructor() {
        this.routerStore = new RouterStore()
        this.uiPreferencesStore = new UiPreferencesStore(this)
        this.mazeViewStore = new MazeViewStore(this)
        this.userStore = new UserStore(this)
        this.browserInfoStore = new BrowserInfoStore(this)
    }
}
