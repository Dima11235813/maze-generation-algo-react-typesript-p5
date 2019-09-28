import { GRID_CELL_WIDTH } from "../../constants/gridConstants"
import { CellWallPoints } from "./CellWallPoints"
import { Point } from "./Point"
import { Color } from "../../utils/colorUtils"
import { logVisitedCell } from "../../utils/loggingUtils"

export class Cell {
    //TOP, RIGHT, BOTTOM, LEFT
    public walls: boolean[]
    public visited = false
    constructor(public column: any, public row: any, private _p: p5) {
        //TODO Fix this

        //i is the column number
        //j is the row number
        this.walls = new Array(4).fill(true)

    }
    show = () => {
        let colToDraw = this.column * GRID_CELL_WIDTH
        let rowToDraw = this.row * GRID_CELL_WIDTH

        this._p.stroke(255)
        if (this.visited) {
            // let colorForVisited = new Color(255, 0, 255, 100)
            // const { r, g, b, a } = colorForVisited
            // this._p.fill(r, g, b, a)
            this._p.fill(255, 0, 255, 100)
        } else {
            logVisitedCell(colToDraw, rowToDraw)
            this._p.noFill()
            this._p.rect(colToDraw, rowToDraw, GRID_CELL_WIDTH, GRID_CELL_WIDTH)
        }

        //Initially just draw the square - Not useful for individual cell wall drawing 
        // this._p.rect(colToDraw, rowToDraw, GRID_CELL_WIDTH, GRID_CELL_WIDTH)

        //Create 4 points - create point objects
        //point 1 @ x,y
        let point1 = new Point(rowToDraw, colToDraw)
        //point 2 @ x + width, y
        let point2 = new Point(rowToDraw + GRID_CELL_WIDTH, colToDraw)
        //point 3 @ x + width, y + width
        let point3 = new Point(rowToDraw + GRID_CELL_WIDTH, colToDraw + GRID_CELL_WIDTH)
        //point 4 @ x, y + width
        let point4 = new Point(rowToDraw, colToDraw + GRID_CELL_WIDTH)

        //Create bools to determine whether to draw each wall
        let drawTop = this.walls[0]
        let drawRight = this.walls[1]
        let drawBottom = this.walls[2]
        let drawLeft = this.walls[3]

        if (drawTop) {
            //point 1 to point 2
            let cellOptions = new CellWallPoints(point1, point2)
            this.drawCellWalls(cellOptions)
        }
        if (drawRight) {
            //point 2 to point 3
            let cellOptions = new CellWallPoints(point2, point3)
            this.drawCellWalls(cellOptions)
        }
        if (drawBottom) {
            let cellOptions = new CellWallPoints(point3, point4)
            this.drawCellWalls(cellOptions)
        }
        if (drawLeft) {
            let cellOptions = new CellWallPoints(point4, point1)
            this.drawCellWalls(cellOptions)
        }

    }
    drawCellWalls = (cellWallPoints: CellWallPoints) => {
        this._p.line(
            cellWallPoints.startPoint.x,
            cellWallPoints.startPoint.y,
            cellWallPoints.endPoint.x,
            cellWallPoints.endPoint.y
        )
    }
}