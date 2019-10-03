import { MazeOptions } from "../mazeGenComp/mazeUtils/mazeOptions"
import { ColorUtils } from "./colorUtils"
import { mazeDefaultOptions } from "../mazeGenComp/mazeUtils/mazeDefaults"
import { cpus } from "os"
import { Color } from "p5"

//set up keys for local storage

export const mazeDefaultsStorageKeys = {
    //SCENE
    backgroundColorKey: "backgroundColorKey",
    //CELL COLORS
    cellColorKey: "cellColorKey",
    cellWallColorKey: "cellWallColorKey",
    //CELL SIZES
    cellSizeKey: "cellSizeKey",
    cellWallSizeKey: "cellWallSizeKey",
    //CELL WALL SHAPE
    cellWallStrokeCapStyleKey: "cellWallStrokeCapStyleKey"
}


export const storageUtils = {

    setMazeoptionsInStorage: (mazeOptions: MazeOptions) => {
        //BACKGROUND
        localStorage.setItem(mazeDefaultsStorageKeys.backgroundColorKey, mazeOptions.cellColor.toString())
        //CELL COLOR
        localStorage.setItem(mazeDefaultsStorageKeys.cellColorKey, mazeOptions.cellColor.toString())
        localStorage.setItem(mazeDefaultsStorageKeys.cellWallColorKey, mazeOptions.cellWallColor.toString())
        //CELL SHAPE
        localStorage.setItem(mazeDefaultsStorageKeys.cellSizeKey, mazeOptions.cellSize.toString())
        localStorage.setItem(mazeDefaultsStorageKeys.cellWallSizeKey, mazeDefaultsStorageKeys.cellWallSizeKey.toString())
        //CELL SHAPE STYLE
        localStorage.setItem(mazeDefaultsStorageKeys.cellWallStrokeCapStyleKey, mazeOptions.cellWallStrokeCapStyle)
    },
    updateMazeOptionsFromStorage: (mazeOptions: MazeOptions) => {
        let colorUtils = new ColorUtils()

        //BACKGROUND
        let backgroundColor = localStorage.getItem(mazeDefaultsStorageKeys.backgroundColorKey)
        //CELL COLOR
        let cellColor = localStorage.getItem(mazeDefaultsStorageKeys.cellColorKey)
        let cellWallColor = localStorage.getItem(mazeDefaultsStorageKeys.cellWallColorKey)
        //CELL SHAPE
        let cellSize = localStorage.getItem(mazeDefaultsStorageKeys.cellSizeKey)
        let cellWallSize = localStorage.getItem(mazeDefaultsStorageKeys.cellWallSizeKey)
        //CELL SHAPE STYLE
        let cellWallStrokeCapStyle = localStorage.getItem(mazeDefaultsStorageKeys.cellWallStrokeCapStyleKey)

        //DEFAULT COLOR IF STORAGE FAILS 
        const defaultIfFail = "255:255:255:1"

        //BACKGROUND
        mazeOptions.backgroundColor = colorUtils.fromStringToObj(
            backgroundColor ? backgroundColor : defaultIfFail
        )
        //CELL COLOR
        mazeOptions.cellColor = colorUtils.fromStringToObj(cellColor ? cellColor : defaultIfFail)
        mazeOptions.cellWallColor = colorUtils.fromStringToObj(cellWallColor ? cellWallColor : defaultIfFail)
        //CELL SHAPE
        mazeOptions.cellSize = parseInt(cellSize ? cellSize : `${mazeDefaultOptions.defaultCellSize}`)
        mazeOptions.cellWallSize = parseInt(cellWallSize ? cellWallSize : `${mazeDefaultOptions.defaultCellWallSize}`)
        //CELL SHAPE STYLE
        mazeOptions.cellWallStrokeCapStyle = cellWallStrokeCapStyle ? cellWallStrokeCapStyle : `${mazeDefaultOptions.defaultStrokeCapStyle}`
        //TODO Do I need to return the options
    }
}
