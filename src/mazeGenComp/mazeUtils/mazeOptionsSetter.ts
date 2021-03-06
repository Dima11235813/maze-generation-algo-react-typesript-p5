import { MazeOptions } from "./mazeOptions"
import { mazeDefaultsStorageKeys, storageUtils } from "../../utils/storageUtils"
import { Color } from "../../utils/colorUtils"
import { logger } from "../../utils/loggingUtils"

export class MazeOptionsSetter {
    constructor(private _mazeOptions: MazeOptions) {

    }
    //TODO Move to color utils class
    //SET UP HANDLERS FOR COLOR CHANGE
    updateStorage = () => {
        //todo set up individual setters for options
        storageUtils.setMazeoptionsInStorage(this._mazeOptions)
    }
    handleBackgroundColorChange = (color: any): void => {
        this.assignColorToTarget(color.rgb, this._mazeOptions.backgroundColor)
        this.updateStorage()
    }
    handleCellColorChange = (color: any): void => {
        this.assignColorToTarget(color.rgb, this._mazeOptions.cellColor)
        this.updateStorage()
    }
    handleCellWallColorChange = (color: any): void => {
        this.assignColorToTarget(color.rgb, this._mazeOptions.cellWallColor)
        this.updateStorage()
    }
    assignColorToTarget = (assignmentColor: Color, targetColor: Color) => {
        const { r, g, b, a } = assignmentColor
        targetColor.r = r
        targetColor.g = g
        targetColor.b = b
        //TODO FIGURE OUT WHY SENDING A TO P5 CAUSES ODD THINGS TO HAPPEN
        // if (a) {
        //   this._mazeOptions.cellColor.a = a
        // }
        // if (a) {
        //     targetColor.a = a
        // }
    }
    handleCellSizeChange = (size: number) => {
        this._mazeOptions.cellSize = size
        localStorage.setItem(mazeDefaultsStorageKeys.cellSizeKey, size.toString())
        logger(`New cell width is ${this._mazeOptions.cellSize}`)
    }


    handleCellWallWidthPercentChange = (newValue: number) => {
        this._mazeOptions.cellWallSize = newValue
        this._mazeOptions.updateDynamicValues()
        localStorage.setItem(mazeDefaultsStorageKeys.cellWallSizeKey, newValue.toString())
        logger(`New cell wall width percent is ${this._mazeOptions.cellWallSize}`)
    }
    handleCellWallStyleChange = (newValue: string) => {
        this._mazeOptions.cellWallStrokeCapStyle = newValue
        localStorage.setItem(mazeDefaultsStorageKeys.cellWallStrokeCapStyleKey, newValue)
        console.log(`New cell wall style is ${this._mazeOptions.cellWallStrokeCapStyle}`)
        //TODO Change console.logs to logger
        // logger(
        //   );

    }
    handleFrameRateChange = (rate: number) => {
        this._mazeOptions.frameRate = Math.floor(rate)
        localStorage.setItem(mazeDefaultsStorageKeys.frameRateKey, rate.toString())
        logger(`New frame rate is ${this._mazeOptions.cellSize}`)
    }
}