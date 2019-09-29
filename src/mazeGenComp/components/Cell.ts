import { GRID_CELL_WIDTH } from "../../constants/gridConstants"
import { CellWallPoints } from "./CellWallPoints"
import { Point } from "./Point"
import { Color } from "../../utils/colorUtils"
import { logVisitedCell } from "../../utils/loggingUtils"
import { getPointValsAtIndex } from "../../utils/gridUtils"

export class Cell {
    //TOP, RIGHT, BOTTOM, LEFT
    public walls: boolean[]
    public visited = false
    public neightbors: Cell[] = []
    constructor(public column: any, public row: any, private _p: p5) {
        //TODO Fix this
        // console.log(`Created cell at column #${column} and row #${row}`)
        //i is the column number
        //j is the row number
        this.walls = new Array(4).fill(true)

    }
    show = () => {
        let xColPointValToDraw = this.column * GRID_CELL_WIDTH
        let yRowPointValToDraw = this.row * GRID_CELL_WIDTH

        this._p.stroke(255)

        //set fill based on if visited or not
        if (this.visited) {
            // let colorForVisited = new Color(255, 0, 255, 100)
            // const { r, g, b, a } = colorForVisited
            // this._p.fill(r, g, b, a)
            logVisitedCell(this.column, this.row)
            this._p.fill(255, 0, 255, 100)
        } else {
            this._p.noFill()
        }

        //draw the rectangle
        this._p.rect(xColPointValToDraw, yRowPointValToDraw, GRID_CELL_WIDTH, GRID_CELL_WIDTH)

        //Initially just draw the square - Not useful for individual cell wall drawing 
        // this._p.rect(xColPointValToDraw, yRowPointValToDraw, GRID_CELL_WIDTH, GRID_CELL_WIDTH)

        //Create 4 points - create point objects
        //point 1 @ x,y
        let point1 = new Point(xColPointValToDraw, yRowPointValToDraw)
        //point 2 @ x + width, y
        let point2 = new Point(xColPointValToDraw + GRID_CELL_WIDTH, yRowPointValToDraw)
        //point 3 @ x + width, y + width
        let point3 = new Point(xColPointValToDraw + GRID_CELL_WIDTH, yRowPointValToDraw + GRID_CELL_WIDTH)
        //point 4 @ x, y + width
        let point4 = new Point(xColPointValToDraw, yRowPointValToDraw + GRID_CELL_WIDTH)

        //Create bools to determine whether to draw each wall
        let drawTop = this.walls[0]
        let drawRight = this.walls[1]
        let drawBottom = this.walls[2]
        let drawLeft = this.walls[3]

        if (drawTop) {
            let cellOptions = new CellWallPoints(point1, point2)
            this.drawCellWalls(cellOptions)
        }
        if (drawRight) {
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

    checkIfNeighborsHaveBeenVisited = (
        numberOfColumns: number = 0,
        numberOfRows: number = 0,
        grid: Cell[]) => {

        //TODO Clean up logic in classes
        let topNeightbor = grid[getPointValsAtIndex(this.column, this.row - 1, numberOfColumns, numberOfRows)]
        let rightNeightbor = grid[getPointValsAtIndex(this.column + 1, this.row, numberOfColumns, numberOfRows)]
        let bottomNeightbor = grid[getPointValsAtIndex(this.column, this.row + 1, numberOfColumns, numberOfRows)]
        let leftNeightbor = grid[getPointValsAtIndex(this.column - 1, this.row, numberOfColumns, numberOfRows)]

        //add any neighbors to array
        if (topNeightbor && !topNeightbor.visited) {
            this.neightbors.push(topNeightbor)
        }
        if (rightNeightbor && !rightNeightbor.visited) {
            this.neightbors.push(rightNeightbor)
        }
        if (bottomNeightbor && !bottomNeightbor.visited) {
            this.neightbors.push(bottomNeightbor)
        }
        if (leftNeightbor && !leftNeightbor.visited) {
            this.neightbors.push(leftNeightbor)
        }

        //pick random item out of array
        if (this.neightbors.length > 0) {
            return this.neightbors[this._p.floor(this._p.random(0, this.neightbors.length))]
        }else{
            return undefined
        }
    }
}