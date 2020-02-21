import { UiPreferencesStore, INVERSE_COLOR_DEFAULT_SETTING, DARK_MODE_DEFAULT_SETTING } from '../UiPreferencesStore'
import { RootStore } from '../RootStore';

describe("UiPreferencesStore", () => {
    let rootStore: RootStore = new RootStore()
    let uiPreferencesStore: UiPreferencesStore
    beforeEach(() => {
        uiPreferencesStore = new UiPreferencesStore(rootStore)
    });

    it("sets inverse color mode to default", () => {
        expect(uiPreferencesStore.inverseColorMode).toBe(INVERSE_COLOR_DEFAULT_SETTING)
    })
    it("sets dark mode to default", () => {
        expect(uiPreferencesStore.inverseColorMode).toBe(DARK_MODE_DEFAULT_SETTING)
    })
    it("toggles inverse color mode", () => {
        uiPreferencesStore.updateInverseColorMode(!INVERSE_COLOR_DEFAULT_SETTING)
        expect(uiPreferencesStore.inverseColorMode).toBe(!INVERSE_COLOR_DEFAULT_SETTING)
    })
    it("toggles dark mode", () => {
        uiPreferencesStore.updateDarkModeEnabled(!DARK_MODE_DEFAULT_SETTING)
        expect(uiPreferencesStore.darkModeEnable).toBe(!DARK_MODE_DEFAULT_SETTING)
    })
})