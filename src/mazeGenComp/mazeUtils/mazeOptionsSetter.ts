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
    handleCellWidthChange = (size: number) => {
        this.mazeOptions.cellSize = size
        localStorage.setItem(mazeDefaultsStorageKeys.cellSizeKey, size.toString())
        console.log(`New cell width is ${this.mazeOptions.cellSize}`)
    }


    handleCellWallWidthPercentChange = (event: ChangeEvent<HTMLSelectElement>) => {
        // temp = newWidth
        // newWidth += temp
        // if (newWidth > minCellWidth && newWidth < maxCellWidth) {
        //   mazeOptions.cellSize = newWidth
        // } else {
        // }
        let newWidthPercent = parseInt(event.target.value)
        this.mazeOptions.cellWallSize = newWidthPercent
        logger(`New cell wall width percent is ${this.mazeOptions.cellWallSize}`)
    }
}