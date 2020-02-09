import { MazeOptions } from "./mazeOptions"
import { ChangeEvent } from "react"
import { mazeDefaultsStorageKeys, storageUtils } from "../../utils/storageUtils"
import { Color } from "../../utils/colorUtils"
import { logger } from "../../utils/loggingUtils"

export class MazeOptionsSetter {
    constructor(public mazeOptions: MazeOptions) {

    }
    //TODO Move to color utils class
    //SET UP HANDLERS FOR COLOR CHANGE
    updateStorage = () => {
        //todo set up individual setters for options
        storageUtils.setMazeoptionsInStorage(this.mazeOptions)
    }
    handleBackgroundColorChange = (color: any): void => {
        this.assignColorToTarget(color.rgb, this.mazeOptions.backgroundColor)
        this.updateStorage()
    }
    handleCellColorChange = (color: any): void => {
        this.assignColorToTarget(color.rgb, this.mazeOptions.cellColor)
        this.updateStorage()
    }
    handleCellWallColorChange = (color: any): void => {
        this.assignColorToTarget(color.rgb, this.mazeOptions.cellWallColor)
        this.updateStorage()
    }
    assignColorToTarget = (assignmentColor: Color, targetColor: Color) => {
        const { r, g, b, a } = assignmentColor
        targetColor.r = r
        targetColor.g = g
        targetColor.b = b
        //TODO FIGURE OUT WHY SENDING A TO P5 CAUSES ODD THINGS TO HAPPEN
        // if (a) {
        //   this.mazeOptions.cellColor.a = a
        // }
        // if (a) {
        //     targetColor.a = a
        // }
    }
    handleCellSizeChange = (size: number) => {
        this.mazeOptions.cellSize = size
        localStorage.setItem(mazeDefaultsStorageKeys.cellSizeKey, size.toString())
        console.log(`New cell width is ${this.mazeOptions.cellSize}`)
    }
    
    
    handleCellWallWidthPercentChange = (newValue: number) => {
        this.mazeOptions.cellWallSize = newValue
        this.mazeOptions.updateDynamicValues()
        localStorage.setItem(mazeDefaultsStorageKeys.cellWallSizeKey, newValue.toString())
        console.log(`New cell wall width percent is ${this.mazeOptions.cellWallSize}`)
    }
}