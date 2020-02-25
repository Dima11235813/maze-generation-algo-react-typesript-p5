import { mazeOptionsUiContext } from "../../AppContext"
import { MazeOptions } from "./mazeOptions"
import { useContext } from "react"
import { Point } from "../components/Point"


export class ProjectionTo3dUtilClass {
    constructor() {

    }
}
export const offsetWidthBy3dProjection = (value: number, mazeOptions: MazeOptions): number => {
    const { windowWidth,
    } = mazeOptions
    let offsetWidth3d = Math.floor(value - (windowWidth / 2))
    // console.log(offsetWidth3d)
    return offsetWidth3d
}
export const offsetHeightBy3dProjection = (value: number, mazeOptions: MazeOptions): number => {
    const {
        windowHeight,
    } = mazeOptions
    let offsetHeight3d = Math.floor(value - (windowHeight / 2))
    // console.log(offsetHeight3d)
    return offsetHeight3d
}



export const getProjectionFor3D = (use3d: boolean, point: Point, mazeOptions: MazeOptions) => {
    let x_value = point.x
    let y_value = point.y
    //set up point vals based on 2D or 3D projection 
    //TODO extract this logic
    let xColPointValToDraw
    let yRowPointValToDraw
    if (use3d) {
        xColPointValToDraw = offsetWidthBy3dProjection(x_value, mazeOptions)
    } else {
        xColPointValToDraw = x_value
    }
    if (use3d) {
        yRowPointValToDraw = offsetHeightBy3dProjection(y_value, mazeOptions)
    } else {
        yRowPointValToDraw = y_value
    }
    let pointToReturn = new Point(xColPointValToDraw, yRowPointValToDraw)
    console.log(pointToReturn)
    return pointToReturn
}