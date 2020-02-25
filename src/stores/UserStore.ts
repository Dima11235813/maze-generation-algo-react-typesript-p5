import { action, decorate, observable } from 'mobx';
import { CommonStore } from "./CommonStore"
import { RootStore } from "./RootStore";

export class UserStore extends CommonStore {
    constructor(store: RootStore) {
        super(store);
    }
    //https://mobx.js.org/refguide/observable-decorator.html
    @observable user: any | undefined 

    @action updateInverseColorMode = (state: boolean) => {
        // this.user = state
    }
}
