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
    cellWallStrokeCapStyleKey: "cellWallStrokeCapStyleKey",
    //Render
    frameRateKey: "frameRateKey"
}


export const storageUtils = {

    setMazeoptionsInStorage: (mazeOptions: MazeOptions) => {
        //BACKGROUND
        localStorage.setItem(mazeDefaultsStorageKeys.backgroundColorKey, mazeOptions.backgroundColor.toString())
        //CELL COLOR
        localStorage.setItem(mazeDefaultsStorageKeys.cellColorKey, mazeOptions.cellColor.toString())
        localStorage.setItem(mazeDefaultsStorageKeys.cellWallColorKey, mazeOptions.cellWallColor.toString())
        //CELL SHAPE
        localStorage.setItem(mazeDefaultsStorageKeys.cellSizeKey, mazeOptions.cellSize.toString())
        localStorage.setItem(mazeDefaultsStorageKeys.cellWallSizeKey, mazeOptions.cellWallSize.toString())
        //CELL SHAPE STYLE
        localStorage.setItem(mazeDefaultsStorageKeys.cellWallStrokeCapStyleKey, mazeOptions.cellWallStrokeCapStyle)
        //Frame Rate
        localStorage.setItem(mazeDefaultsStorageKeys.frameRateKey, mazeOptions.frameRate.toString())

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
        //Render
        let frameRate = localStorage.getItem(mazeDefaultsStorageKeys.frameRateKey)


        //BACKGROUND
        mazeOptions.backgroundColor = colorUtils.fromStringToObj(
            backgroundColor ? backgroundColor : mazeDefaultOptions.defaultBackgroundColor.toString()
        )
        //TODO Use defaults class to construct color strings and set util func for that
        //CELL COLOR
        mazeOptions.cellColor = colorUtils.fromStringToObj(cellColor ? cellColor : mazeDefaultOptions.defaultCellColor.toString())
        mazeOptions.cellWallColor = colorUtils.fromStringToObj(cellWallColor ? cellWallColor : mazeDefaultOptions.defaultCellWallColor.toString())
        //CELL SHAPE
        mazeOptions.cellSize = parseInt(cellSize ? cellSize : `${mazeDefaultOptions.defaultCellSize}`)
        mazeOptions.cellWallSize = parseInt(cellWallSize ? cellWallSize : `${mazeDefaultOptions.defaultCellWallSize}`)
        //CELL SHAPE STYLE
        mazeOptions.cellWallStrokeCapStyle = cellWallStrokeCapStyle ? cellWallStrokeCapStyle : `${mazeDefaultOptions.defaultStrokeCapStyle}`
        //Render
        mazeOptions.frameRate = parseInt(frameRate ? frameRate : `${mazeDefaultOptions.frameRate}`)
    }
}
