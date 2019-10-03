import { MazeOptions } from "./mazeOptions"
import { ChangeEvent } from "react"
import { mazeDefaultsStorageKeys } from "../../utils/storageUtils"
import { Color } from "../../utils/colorUtils"

export class MazeOptionsSetter {
    constructor(public mazeOptions: MazeOptions) {

    }
    //TODO Move to color utils class
    //SET UP HANDLERS FOR COLOR CHANGE
    handleCellColorChange = (color: any): void => {
        this.assignColorToTarget(color.rgb, this.mazeOptions.cellColor)
    }
    handleBackgroundColorChange = (color: any): void => {
        this.assignColorToTarget(color.rgb, this.mazeOptions.backgroundColor)
    }
    handleCellWallColorChange = (color: any): void => {
        this.assignColorToTarget(color.rgb, this.mazeOptions.cellWallColor)
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
        if (a) {
            targetColor.a = a
        }
    }
    handleCellWidthChange = (event: ChangeEvent<HTMLSelectElement>) => {
        // temp = newWidth
        // newWidth += temp
        // if (newWidth > minCellWidth && newWidth < maxCellWidth) {
        //   mazeOptions.cellSize = newWidth
        // } else {
        // }
        let newWidth = parseInt(event.target.value)
        this.mazeOptions.cellSize = newWidth
        localStorage.setItem(mazeDefaultsStorageKeys.cellSizeKey, event.target.value)
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
        console.log(`New cell wall width percent is ${this.mazeOptions.cellWallSize}`)
    }
}