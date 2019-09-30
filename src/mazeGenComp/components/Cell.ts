import { GRID_CELL_WIDTH } from "../../constants/gridConstants"
import { CellWallPoints } from "./CellWallPoints"
import { Point } from "./Point"
import { logVisitedCell, logger, loggerObj } from "../../utils/loggingUtils"
import { getPointValsAtIndex } from "../../utils/gridUtils"
import { Color } from "../../utils/colorUtils"

export class Cell {
    //TOP, RIGHT, BOTTOM, LEFT
    public walls: boolean[]
    public visited = 0
    public neightbors: Cell[] = []
    constructor(
        public column: any,
        public row: any,
        private _p: p5,
        private _cellWidth: number,
        private _cellHeight: number

    ) {
        //TODO Fix this
        // console.log(`Created cell at column #${column} and row #${row}`)
        //i is the column number
        //j is the row number
        this.walls = new Array(4).fill(true)
    }
    getColorBasedOnVisited = () => this.visited + 1
    show = (color: Color) => {
        let xColPointValToDraw = this.column * this._cellWidth
        let yRowPointValToDraw = this.row * this._cellHeight


        //set fill based on if visited or not
        if (this.visited) {
            // let colorForVisited = new Color(255, 0, 255, 100)
            // const { r, g, b, a } = colorForVisited
            // this._p.fill(r, g, b, a)
            // logVisitedCell(this.column, this.row)
            //draw the rectangle
            // /https://p5js.org/reference/#/p5/fill
            const { r, g, b, a } = color
            // if (a) {

            //     this._p.fill(
            //         r / (this.getColorBasedOnVisited()),
            //         g / (this.getColorBasedOnVisited()),
            //         b,
            //         a
            //         // 126 / (this.getColorBasedOnVisited()),
            //         // 1 / (this.getColorBasedOnVisited()),
            //     )
            // } else {
                this._p.fill(
                    r / (this.getColorBasedOnVisited()),
                    g / (this.getColorBasedOnVisited()),
                    b / (this.getColorBasedOnVisited())
                    // 126 / (this.getColorBasedOnVisited()),
                    // 1 / (this.getColorBasedOnVisited()),
                )

            // }

            console.log(`Cell Color`)
            console.log(color)
            // this._p.fill(255 / (this.getColorBasedOnVisited()),0, 0, 255)
            this._p.noStroke()
            this._p.rect(xColPointValToDraw, yRowPointValToDraw, this._cellWidth, this._cellHeight)
        }
        this._p.stroke(255)


        //Initially just draw the square - Not useful for individual cell wall drawing 
        // this._p.rect(xColPointValToDraw, yRowPointValToDraw, GRID_CELL_WIDTH, GRID_CELL_WIDTH)

        //Create 4 points - create point objects
        //point 1 @ x,y
        let point1 = new Point(xColPointValToDraw, yRowPointValToDraw)
        //point 2 @ x + width, y
        let point2 = new Point(xColPointValToDraw + this._cellWidth, yRowPointValToDraw)
        //point 3 @ x + width, y + width
        let point3 = new Point(xColPointValToDraw + this._cellWidth, yRowPointValToDraw + this._cellHeight)
        //point 4 @ x, y + width
        let point4 = new Point(xColPointValToDraw, yRowPointValToDraw + this._cellHeight)

        //Create bools to determine whether to draw each wall
        let drawTop = this.walls[0]
        let drawRight = this.walls[1]
        let drawBottom = this.walls[2]
        let drawLeft = this.walls[3]

        if (drawTop) {
            let pointsToDrawWallBetween = new CellWallPoints(point1, point2)
            this._drawCellWalls(pointsToDrawWallBetween)
        }
        if (drawRight) {
            let pointsToDrawWallBetween = new CellWallPoints(point2, point3)
            this._drawCellWalls(pointsToDrawWallBetween)
        }
        if (drawBottom) {
            let pointsToDrawWallBetween = new CellWallPoints(point3, point4)
            this._drawCellWalls(pointsToDrawWallBetween)
        }
        if (drawLeft) {
            let pointsToDrawWallBetween = new CellWallPoints(point4, point1)
            this._drawCellWalls(pointsToDrawWallBetween)
        }

    }
    private _drawCellWalls = (cellWallPoints: CellWallPoints) => {
        this._p.line(
            cellWallPoints.startPoint.x,
            cellWallPoints.startPoint.y,
            cellWallPoints.endPoint.x,
            cellWallPoints.endPoint.y
        )
    }
    highlight = () => {
        var xLength = this.column * this._cellWidth
        var yLength = this.row * this._cellHeight
        this._p.noStroke()
        this._p.fill(0, 0, 255 / this.visited + 1, 100)
        this._p.rect(xLength, yLength, this._cellWidth, this._cellHeight)
    }

    getRandomNeightborToVisit = (
        numberOfColumns: number = 0,
        numberOfRows: number = 0,
        grid: Cell[]) => {

        //TODO Clean up logic in classes
        let topNeightbor = grid[getPointValsAtIndex(this.column, this.row - 1, numberOfColumns, numberOfRows)]
        let rightNeightbor = grid[getPointValsAtIndex(this.column + 1, this.row, numberOfColumns, numberOfRows)]
        let bottomNeightbor = grid[getPointValsAtIndex(this.column, this.row + 1, numberOfColumns, numberOfRows)]
        let leftNeightbor = grid[getPointValsAtIndex(this.column - 1, this.row, numberOfColumns, numberOfRows)]

        //clear out neighbors because this changes 
        this.neightbors = []

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
            let nextNeighborToVisit = this.neightbors[this._p.floor(this._p.random(0, this.neightbors.length))]
            // logger(`
            // Number of neightbors: ${this.neightbors.length}
            // Neighbor selected`)
            // loggerObj(nextNeighborToVisit)
            // logger(`Current Cell walls`)
            // loggerObj(this.walls)
            // logger(`Current Column and Row`)
            // loggerObj(`Column ${this.column} Row ${this.row}`)
            return nextNeighborToVisit
        } else {
            return undefined
        }
    }
}